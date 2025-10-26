import 'dart:async';
import 'dart:typed_data' show Uint8List;

import 'package:flutter/foundation.dart' show ChangeNotifier;
import 'package:openquester/common_imports.dart';
import 'package:oq_editor/oq_editor.dart';

typedef PackageId = int;

@singleton
class PackageUploadController extends ChangeNotifier {
  bool loading = false;

  var _progress = 0.0;
  double get progress => _progress;

  /// Progress part after picking
  static const _afterPickProgress = 0.1;
  static const _afterParseProgress = 0.15;

  /// Encoding progress stream controller
  StreamController<double>? _encodingProgressController;

  /// Encoding progress stream for UI dialogs
  Stream<double> get encodingProgressStream =>
      _encodingProgressController?.stream ?? const Stream<double>.empty();

  /// Media file encoder for compressing files before upload
  final MediaFileEncoder _mediaFileEncoder = MediaFileEncoder();

  void _setProgress(double value) {
    _progress = value;
    notifyListeners();
  }

  Future<PackageId?> pickAndUpload() async {
    try {
      // Reset state
      loading = true;
      _setProgress(0);

      // Use unified picker to handle both .oq and .siq files
      final fileResult = await SiqImportHelper.pickPackageFile();
      if (fileResult == null) return null;

      _setProgress(_afterPickProgress);

      // Handle different file types using unified upload approach
      switch (fileResult.extension) {
        case 'siq':
          return await _uploadFromSiqFile(fileResult.bytes);
        case 'oq':
          return await _uploadFromOqFile(fileResult.bytes);
        default:
          throw Exception(
            'Unsupported file type: .${fileResult.extension}',
          );
      }
    } catch (e, s) {
      logger.e(e, stackTrace: s);
      rethrow;
    } finally {
      loading = false;
      notifyListeners();
    }
  }

  /// Upload OQ file using unified service with encoding
  Future<PackageId> _uploadFromOqFile(Uint8List oqBytes) async {
    _setProgress(_afterParseProgress);

    // Import OQ package using unified service
    final importResult = await getIt<PackageService>().importOqFile(oqBytes);

    _setProgress(0.3);

    // Encode media files for compression before upload
    final encodingResult = await _encodeMediaFiles(
      importResult.package,
      EditorMediaUtils.convertBytesToMediaFiles(importResult.filesBytesByHash),
    );

    // Convert encoded package to input
    final packageInput = getIt<PackageService>().convertOqPackageToInput(
      encodingResult.package,
    );

    return _uploadPackage(
      packageInput,
      encodingResult.files,
    );
  }

  /// Upload SIQ file using unified service with worker optimization and encoding
  Future<PackageId> _uploadFromSiqFile(Uint8List siqBytes) async {
    _setProgress(_afterParseProgress);

    // Use optimized service for better performance
    // (uses worker on all platforms)
    final importResult = await getIt<PackageService>().importSiqFile(
      siqBytes,
    );

    _setProgress(0.3);

    // Encode media files for compression before upload
    final encodingResult = await _encodeMediaFiles(
      importResult.package,
      EditorMediaUtils.convertBytesToMediaFiles(importResult.filesBytesByHash),
    );

    // Convert encoded package to input
    final packageInput = getIt<PackageService>().convertOqPackageToInput(
      encodingResult.package,
    );

    return _uploadPackage(
      packageInput,
      encodingResult.files,
    );
  }

  /// Encode media files for compression
  /// Returns updated package and encoded media files
  Future<({OqPackage package, Map<String, MediaFileReference> files})>
  _encodeMediaFiles(
    OqPackage package,
    Map<String, MediaFileReference> mediaFilesByHash,
  ) async {
    // Start encoding progress tracking if there are media files
    if (mediaFilesByHash.isNotEmpty) {
      _encodingProgressController = StreamController<double>.broadcast();
    }

    try {
      final result = await _mediaFileEncoder.encodePackage(
        package,
        mediaFilesByHash,
        onProgress: _encodingProgressController?.add,
      );

      // Close encoding progress stream
      await _encodingProgressController?.close();
      _encodingProgressController = null;

      return result;
    } catch (e) {
      // Clean up progress stream on error
      await _encodingProgressController?.close();
      _encodingProgressController = null;
      rethrow;
    }
  }

  /// Upload package using unified service
  Future<PackageId> _uploadPackage(
    PackageCreationInput packageInput,
    Map<String, MediaFileReference> mediaFilesByHash,
  ) async {
    PackageId? packageId;

    await for (final state in getIt<PackageService>().uploadPackage(
      packageInput: packageInput,
      mediaFilesByHash: mediaFilesByHash,
    )) {
      state.map(
        idle: (_) => _setProgress(0),
        uploading: (s) => _setProgress(s.progress),
        completed: (s) => packageId = s.packageId,
        error: (s) => throw Exception(s.error.toString()),
      );
    }

    if (packageId == null) {
      throw Exception('Upload failed');
    }

    return packageId!;
  }
}
