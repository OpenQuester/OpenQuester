import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:openquester/common_imports.dart';
import 'package:oq_editor/oq_editor.dart';
import 'package:universal_io/io.dart';

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

    // Convert package to PackageCreationInput with MD5 hashes
    final body = await controller._convertPackageToBody(
      package,
      mediaFilesByHash,
    );

    // Upload and track progress
    int? packageId;
    await for (final state in controller._uploadPackage(
      body: body,
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
    // In production, you'd fetch the full package from backend
    if (packageId == null) {
      throw UserError(controller.currentMessage);
    }

    // Return package with updated ID
    return package.copyWith(id: packageId!);
  }

  /// Convert OqPackage to PackageCreationInput
  /// Package already contains file references with MD5 hashes
  Future<PackageCreationInput> _convertPackageToBody(
    OqPackage package,
    Map<String, MediaFileReference> mediaFilesByHash,
  ) async {
    // Convert OqPackage to PackageCreateInputData
    // The OqPackage structure already matches the API schema
    // File references with MD5 hashes are already in the question objects
    final content = PackageCreateInputData(
      title: package.title,
      description: package.description,
      language: package.language,
      ageRestriction: package.ageRestriction,
      tags: package.tags,
      rounds: package.rounds,
    );

    return PackageCreationInput(content: content);
  }

  /// Upload package with media files - returns stream for progress tracking
  Stream<PackageUploadState> _uploadPackage({
    required PackageCreationInput body,
    required Map<String, MediaFileReference> mediaFilesByHash,
  }) async* {
    try {
      // Step 1: Create package on backend
      yield PackageUploadState.uploading(
        progress: 0.2,
        message: LocaleKeys.oq_editor_preparing_upload.tr(),
      );

      final result = await Api.I.api.packages.postV1Packages(body: body);
      final uploadLinks = result.uploadLinks.entries.toList();

      // Step 2: Upload media files with progress
      if (uploadLinks.isEmpty) {
        yield PackageUploadState.completed(packageId: result.id);
        return;
      }

      yield* _uploadMediaFiles(uploadLinks, mediaFilesByHash, result.id);
    } catch (error, stackTrace) {
      final errorMessage = Api.parseError(error) ?? error.toString();
      logger.e(
        'Package upload failed: $errorMessage',
        error: error,
        stackTrace: stackTrace,
      );
      yield PackageUploadState.error(
        error: errorMessage,
        stackTrace: stackTrace,
      );
    }
  }

  /// Upload media files and emit progress updates
  Stream<PackageUploadState> _uploadMediaFiles(
    List<MapEntry<String, String>> uploadLinks,
    Map<String, MediaFileReference> mediaFilesByHash,
    int packageId,
  ) async* {
    logger.d('Uploading ${uploadLinks.length} files...');

    const baseProgress = 0.2; // After package creation
    const uploadRange = 0.8; // 0.2 to 1.0

    for (var i = 0; i < uploadLinks.length; i++) {
      final link = uploadLinks[i];
      final progress = baseProgress + (i / uploadLinks.length) * uploadRange;

      yield PackageUploadState.uploading(
        progress: progress,
        message: LocaleKeys.oq_editor_uploading_file.tr(
          args: ['${i + 1}', '${uploadLinks.length}'],
        ),
      );

      // Get media file by hash and upload
      final media = mediaFilesByHash[link.key];

      if (media != null) {
        final fileBytes = await _readMediaBytes(media);
        await getIt<S3UploadController>().uploadFile(
          uploadLink: Uri.parse(link.value),
          file: fileBytes,
          md5Hash: link.key,
        );
      } else {
        logger.w('Media file not found for hash: ${link.key}');
      }
    }

    logger.d('All files uploaded successfully');
    yield PackageUploadState.completed(packageId: packageId);
  }

  /// Read bytes from MediaFileReference (web or native)
  Future<Uint8List> _readMediaBytes(MediaFileReference media) async {
    final platformFile = media.platformFile;

    if (platformFile.bytes != null) {
      return platformFile.bytes!;
    }

    if (platformFile.path != null) {
      return File(platformFile.path!).readAsBytes();
    }

    throw Exception('Cannot read file bytes for: ${platformFile.name}');
  }
}
