import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:openquester/common_imports.dart';
import 'package:oq_editor/oq_editor.dart';

/// Unified service for package operations
@singleton
class PackageService {
  /// Convert OqPackage to PackageCreationInput for API upload
  PackageCreationInput convertOqPackageToInput(OqPackage package) {
    return PackageCreationInput(
      content: PackageCreateInputData(
        title: package.title,
        description: package.description,
        language: package.language,
        ageRestriction: package.ageRestriction,
        tags: package.tags,
        rounds: package.rounds,
      ),
    );
  }

  /// Upload package with media files and detailed progress tracking
  /// Stream-based version for PackageEditorUploadController
  Stream<PackageUploadState> uploadPackage({
    required PackageCreationInput packageInput,
    required Map<String, MediaFileReference> mediaFilesByHash,
  }) async* {
    try {
      // Step 1: Create package on backend
      yield PackageUploadState.uploading(
        progress: 0.2,
        message: LocaleKeys.oq_editor_preparing_upload.tr(),
      );

      final result = await Api.I.api.packages.postV1Packages(
        body: packageInput,
      );
      final uploadLinks = result.uploadLinks.entries.toList();

      // Step 2: Upload media files with progress
      if (uploadLinks.isEmpty) {
        yield PackageUploadState.completed(packageId: result.id);
        return;
      }

      yield* _uploadMediaFiles(uploadLinks, mediaFilesByHash, result.id);
    } catch (error, stackTrace) {
      logger.e(
        'Package upload failed',
        error: error,
        stackTrace: stackTrace,
      );
      yield PackageUploadState.error(
        error: error,
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
    try {
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
        final media = await mediaFilesByHash[link.key]?.platformFile
            .readBytes();

        if (media != null && media.isNotEmpty) {
          logger.t(
            'Uploading file ${link.key} ${i + 1}/${uploadLinks.length}...',
          );
          await getIt<S3UploadController>().uploadFile(
            uploadLink: Uri.parse(link.value),
            file: media,
            md5Hash: link.key,
          );
        } else {
          throw Exception('Media file not found for hash: ${link.key}');
        }
      }

      logger.d('All files uploaded successfully');
      yield PackageUploadState.completed(packageId: packageId);
    } catch (e, s) {
      logger.e('File upload failed: $e', error: e, stackTrace: s);
      yield PackageUploadState.error(
        error: e,
        stackTrace: s,
      );
    }
  }

  /// Import OQ file and return package with media files using worker
  Future<ImportResult> importOqFile(Uint8List oqBytes) async {
    final worker = PackageWorkerService();
    final result = await worker.parseOqPackage(oqBytes);

    // Convert OqPackage from JSON
    final oqPackage = OqPackage.fromJson(result.package);

    // Convert file bytes from List<int> to Uint8List
    final filesBytesByHash = <String, Uint8List>{};
    for (final entry in result.filesBytesByHash.entries) {
      final hash = entry.key;
      final bytesList = entry.value;
      filesBytesByHash[hash] = Uint8List.fromList(bytesList);
    }

    // Convert encoded file hashes
    final encodedFileHashes = result.encodedFileHashes?.toSet();

    return ImportResult(
      package: oqPackage,
      filesBytesByHash: filesBytesByHash,
      encodedFileHashes: encodedFileHashes,
    );
  }

  /// Import SIQ file and return package with media files using worker
  Future<ImportResult> importSiqFile(Uint8List siqBytes) async {
    try {
      final worker = PackageWorkerService();
      final result = await worker.parseSiqFile(siqBytes);

      // Extract package data and convert to OqPackage
      final packageInput = PackageCreationInput.fromJson(result.body);
      final oqPackage = _createOqPackageFromInput(packageInput.content);

      return ImportResult(
        package: oqPackage,
        filesBytesByHash: result.files,
      );
    } catch (e) {
      throw Exception(
        'Worker parsing failed, falling back to direct parsing: $e',
      );
    }
  }

  /// Create OqPackage from PackageCreateInputData
  /// Helper method to convert API format to OQ format
  OqPackage _createOqPackageFromInput(PackageCreateInputData inputData) {
    return OqPackage(
      id: -1, // New package, using -1 as placeholder ID
      title: inputData.title,
      description: inputData.description,
      language: inputData.language,
      ageRestriction: inputData.ageRestriction,
      tags: inputData.tags,
      rounds: inputData.rounds,
      author: const ShortUserInfo(
        id: 0,
        username: 'local',
      ), // Placeholder author
      createdAt: DateTime.now(),
      logo: inputData.logo?.file != null
          ? PackageLogoFileItem(
              file: FileItem(
                id: null,
                md5: inputData.logo!.file.md5,
                type: inputData.logo!.file.type,
                link: null,
              ),
            )
          : null,
    );
  }

  /// Import SIQ file with progress tracking
  /// Stream-based version for controllers that need progress updates
  /// For progress tracking, always use the direct method as it provides
  /// granular progress updates. Worker is mainly beneficial for
  /// blocking operations without progress needs.
  Stream<SiqImportProgress> importSiqFileWithProgress(Uint8List siqBytes) {
    return SiqImportHelper().convertSiqToOqPackage(siqBytes);
  }

  /// Pick and import package file (unified picker for .oq and .siq)
  /// Returns null if user cancels
  Future<ImportResult?> pickAndImportFile() async {
    final fileResult = await SiqImportHelper.pickPackageFile();
    if (fileResult == null) return null;

    switch (fileResult.extension) {
      case 'oq':
        return importOqFile(fileResult.bytes);
      case 'siq':
        return importSiqFile(fileResult.bytes);
      default:
        throw Exception(
          'Unsupported file type: .${fileResult.extension}',
        );
    }
  }
}

/// Result of import operations
class ImportResult {
  const ImportResult({
    required this.package,
    required this.filesBytesByHash,
    this.encodedFileHashes,
  });

  final OqPackage package;
  final Map<String, Uint8List> filesBytesByHash;
  final Set<String>? encodedFileHashes;
}
