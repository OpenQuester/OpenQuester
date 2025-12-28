import 'dart:async';

import 'package:openquester/common_imports.dart';
import 'package:oq_editor/oq_editor.dart';

/// Controller for uploading packages from editor with progress tracking
/// Similar to PackageUploadController but stream-based for reactive progress
@singleton
class PackageEditorUploadController {
  final _progressController = StreamController<PackageUploadState>.broadcast();

  /// Stream of upload progress states
  /// UI can listen to this for real-time progress updates
  Stream<PackageUploadState> get progressStream => _progressController.stream;

  /// Current upload progress (0.0 to 1.0)
  double _currentProgress = 0;
  double get currentProgress => _currentProgress;

  /// Current upload message
  String _currentMessage = '';
  String get currentMessage => _currentMessage;

  /// Static onSave method for OqEditorController
  /// Can be passed directly: `onSave: PackageEditorUploadController.onSave`
  static Future<OqPackage> onSave(
    OqPackage package,
    Map<String, MediaFileReference> mediaFilesByHash,
  ) async {
    await const ProfileDialog().showIfUnauthorized(
      AppRouter.I.navigatorKey.currentContext!,
    );
    final controller = getIt<PackageEditorUploadController>();

    // Convert package using unified service
    final packageInput = getIt<PackageService>().convertOqPackageToInput(
      package,
    );

    // Upload and track progress using unified service
    int? packageId;
    await for (final state in getIt<PackageService>().uploadPackage(
      packageInput: packageInput,
      mediaFilesByHash: mediaFilesByHash,
    )) {
      // Emit state to stream for UI
      controller._progressController.add(state);

      state.map(
        idle: (_) {
          controller
            .._currentProgress = 0.0
            .._currentMessage = '';
        },
        uploading: (s) {
          controller
            .._currentProgress = s.progress
            .._currentMessage = s.message ?? '';
          logger.d(
            'Upload progress: ${(s.progress * 100).toInt()}% - ${s.message}',
          );
        },
        completed: (s) {
          controller
            .._currentProgress = 1.0
            .._currentMessage = '';
          packageId = s.packageId;
          logger.i('Package uploaded successfully: ${s.packageId}');
        },
        error: (s) {
          controller
            .._currentProgress = 0.0
            .._currentMessage = s.error.toString();
          logger.e('Upload failed', error: s.error, stackTrace: s.stackTrace);
        },
      );
    }

    // Return package with updated ID if available
    if (packageId == null) {
      throw UserError(controller.currentMessage);
    }

    // Return package with updated ID
    return package.copyWith(id: packageId!);
  }
}
