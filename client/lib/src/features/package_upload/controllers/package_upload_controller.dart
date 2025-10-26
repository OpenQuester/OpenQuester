import 'dart:typed_data' show Uint8List;

import 'package:flutter/foundation.dart' show ChangeNotifier;
import 'package:openquester/common_imports.dart';
import 'package:oq_editor/models/package_upload_state.dart';
import 'package:oq_editor/utils/siq_import_helper.dart';

typedef PackageId = int;

@singleton
class PackageUploadController extends ChangeNotifier {
  bool loading = false;

  var _progress = 0.0;
  double get progress => _progress;

  /// Progress part after picking
  static const _afterPickProgress = 0.1;
  static const _afterParseProgress = 0.15;

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

  /// Upload OQ file using unified service
  Future<PackageId> _uploadFromOqFile(Uint8List oqBytes) async {
    _setProgress(_afterParseProgress);

    // Import OQ package using unified service
    final importResult = await getIt<PackageService>().importOqFile(oqBytes);

    _setProgress(0.3);

    // Convert and upload using unified service
    final packageInput = getIt<PackageService>().convertOqPackageToInput(
      importResult.package,
    );

    return _uploadPackage(packageInput);
  }

  /// Upload SIQ file using unified service with worker optimization
  Future<PackageId> _uploadFromSiqFile(Uint8List siqBytes) async {
    _setProgress(_afterParseProgress);

    // Use optimized service for better performance
    // (uses worker on all platforms)
    final importResult = await getIt<PackageService>().importSiqFile(
      siqBytes,
    );

    _setProgress(0.3);

    // Convert and upload using unified service
    final packageInput = getIt<PackageService>().convertOqPackageToInput(
      importResult.package,
    );

    return _uploadPackage(packageInput);
  }

  /// Upload package using unified service
  Future<PackageId> _uploadPackage(PackageCreationInput packageInput) async {
    PackageId? packageId;

    await for (final state in getIt<PackageService>().uploadPackage(
      packageInput: packageInput,
      mediaFilesByHash: {}, // No media files for simple uploads
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
