import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:openquester/common_imports.dart';
import 'package:oq_editor/models/media_file_reference.dart';
import 'package:oq_editor/models/package_upload_state.dart';
import 'package:oq_editor/utils/oq_package_archiver.dart';
import 'package:oq_editor/utils/siq_import_helper.dart';
import 'package:siq_file/siq_file.dart';
import 'package:universal_io/io.dart';

/// Unified service for package operations
/// Eliminates code duplication across upload and editor controllers
/// Follows DRY principle by centralizing all package-related operations
@singleton
class PackageService {
  /// Convert OqPackage to PackageCreationInput for API upload
  /// Used by all upload controllers
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

  /// Read bytes from MediaFileReference (web or native)
  /// Common utility used across all controllers
  Future<Uint8List> readMediaBytes(MediaFileReference media) async {
    final platformFile = media.platformFile;

    if (platformFile.bytes != null) {
      return platformFile.bytes!;
    }

    if (platformFile.path != null) {
      return File(platformFile.path!).readAsBytes();
    }

    throw Exception('Cannot read file bytes for: ${platformFile.name}');
  }

  /// Convert MediaFileReference map to bytes map
  /// Helper for processing media files before upload
  Future<Map<String, Uint8List>> convertMediaFilesToBytes(
    Map<String, MediaFileReference> mediaFilesByHash,
  ) async {
    final filesBytesByHash = <String, Uint8List>{};

    for (final entry in mediaFilesByHash.entries) {
      final hash = entry.key;
      final mediaFile = entry.value;
      final bytes = await readMediaBytes(mediaFile);
      filesBytesByHash[hash] = bytes;
    }

    return filesBytesByHash;
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
        final fileBytes = await readMediaBytes(media);
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

  /// Import OQ file and return package with media files using worker
  /// Used by multiple controllers - now optimized with worker for all platforms
  Future<ImportResult> importOqFile(Uint8List oqBytes) async {
    try {
      // Use unified worker service for better performance on all platforms
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
    } catch (e) {
      // Fallback to direct parsing if worker fails
      logger.w('Worker parsing failed, falling back to direct parsing: $e');
      return _importOqFileDirectly(oqBytes);
    }
  }

  /// Import OQ file directly (fallback when worker fails)
  Future<ImportResult> _importOqFileDirectly(Uint8List oqBytes) async {
    final result = await OqPackageArchiver.importPackage(oqBytes);
    return ImportResult(
      package: result.package,
      filesBytesByHash: result.filesBytesByHash,
      encodedFileHashes: result.encodedFileHashes,
    );
  }

  /// Import SIQ file and return package with media files using worker
  /// Used by multiple controllers - now optimized with worker for all platforms
  Future<ImportResult> importSiqFile(Uint8List siqBytes) async {
    try {
      // Use unified worker service for better performance on all platforms
      final worker = PackageWorkerService();
      final result = await worker.parseSiqFile(siqBytes);

      // Extract package data and convert to OqPackage
      final packageInput = PackageCreationInput.fromJson(result.body);
      final oqPackage = _createOqPackageFromInput(packageInput.content);

      // For file bytes, we need to parse the SIQ archive
      // again to get actual bytes
      // The worker only gives us metadata for performance reasons
      final filesBytesByHash = await _extractSiqFileBytes(siqBytes);

      return ImportResult(
        package: oqPackage,
        filesBytesByHash: filesBytesByHash,
      );
    } catch (e) {
      // Fallback to direct parsing if worker fails
      logger.w('Worker parsing failed, falling back to direct parsing: $e');
      return _importSiqFileDirectly(siqBytes);
    }
  }

  /// Extract file bytes from SIQ archive after worker parsing
  /// This is a lighter operation after worker has done the heavy parsing
  Future<Map<String, Uint8List>> _extractSiqFileBytes(
    Uint8List siqBytes,
  ) async {
    final filesBytesByHash = <String, Uint8List>{};

    // Quick file extraction - parser structure is already validated by worker
    final parser = SiqArchiveParser();
    try {
      await parser.load(siqBytes);

      // Only extract file bytes, skip heavy parsing (already done by worker)
      final filesHashMap = parser.filesHash;

      for (final entry in filesHashMap.entries) {
        final hash = entry.key;
        final archiveFiles = entry.value;

        if (archiveFiles.isNotEmpty) {
          final archiveFile = archiveFiles.first;
          final fileBytes = Uint8List.fromList(archiveFile.content);
          filesBytesByHash[hash] = fileBytes;
          await archiveFile.close();
        }
      }
    } finally {
      await parser.dispose();
    }

    return filesBytesByHash;
  }

  /// Import SIQ file with web worker optimization (deprecated,
  /// use importSiqFile instead)
  /// Use this for simple imports without progress tracking needs
  @Deprecated(
    'Use importSiqFile instead - workers are now used for all platforms',
  )
  Future<ImportResult> importSiqFileOptimized(Uint8List siqBytes) async {
    return importSiqFile(siqBytes);
  }

  /// Import SIQ file directly (fallback or non-web platforms)
  Future<ImportResult> _importSiqFileDirectly(Uint8List siqBytes) async {
    OqPackage? oqPackage;
    Map<String, MediaFileReference>? mediaFilesByHash;

    await for (final progress in SiqImportHelper().convertSiqToOqPackage(
      siqBytes,
    )) {
      switch (progress) {
        case SiqImportCompleted(:final result):
          oqPackage = result.package;
          mediaFilesByHash = result.mediaFilesByHash;
        case SiqImportError(:final error):
          throw Exception(error);
        case SiqImportParsingFile():
        case SiqImportConvertingMedia():
        case SiqImportPickingFile():
          // Progress handling can be added by caller if needed
          break;
      }
    }

    if (oqPackage == null || mediaFilesByHash == null) {
      throw Exception('Failed to convert SIQ file to package format');
    }

    // Convert media files to bytes map
    final filesBytesByHash = await convertMediaFilesToBytes(mediaFilesByHash);

    return ImportResult(
      package: oqPackage,
      filesBytesByHash: filesBytesByHash,
    );
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
/// Unified structure used across all import methods
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
