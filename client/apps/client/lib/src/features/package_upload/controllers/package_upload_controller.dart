import 'package:flutter/foundation.dart' show ChangeNotifier;
import 'package:openquester/common_imports.dart';

typedef PackageId = int;

@singleton
class PackageUploadController extends ChangeNotifier {
  bool loading = false;

  double _progress = 0;
  double get progress => _progress;

  void _setProgress(double value) {
    _progress = value;
    notifyListeners();
  }

  Future<PackageId?> pickAndUpload() async {
    loading = true;
    _setProgress(0);
    try {
      final importResult = await getIt<PackageService>().pickAndImportFile();
      if (importResult == null) return null;
      _setProgress(.15);

      final files = importResult.filesBytesByHash.map(
        (hash, bytes) => MapEntry(hash, EditorMediaFile.fromBytes(hash, bytes)),
      );
      PackageId? packageId;
      await for (final state in getIt<PackageService>().uploadPackage(
        packageInput: getIt<PackageService>().convertOqPackageToInput(
          importResult.package,
        ),
        mediaFilesByHash: files,
      )) {
        switch (state.phase) {
          case PackageUploadPhase.idle:
            _setProgress(0);
          case PackageUploadPhase.uploading:
            _setProgress(state.progress);
          case PackageUploadPhase.completed:
            packageId = state.packageId;
            _setProgress(1);
          case PackageUploadPhase.error:
            throw Exception(state.error.toString());
        }
      }
      if (packageId == null) {
        throw StateError('Package upload did not complete');
      }
      return packageId;
    } catch (error, stackTrace) {
      logger.e('Package upload failed', error: error, stackTrace: stackTrace);
      rethrow;
    } finally {
      loading = false;
      notifyListeners();
    }
  }
}
