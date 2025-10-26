import 'dart:async';
import 'dart:typed_data';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/foundation.dart';
import 'package:openapi/openapi.dart';
import 'package:oq_editor/models/media_file_reference.dart';
import 'package:oq_shared/oq_shared.dart';
import 'package:siq_file/siq_file.dart';
import 'package:universal_io/io.dart';

/// Result of SIQ import conversion
class SiqImportResult {
  const SiqImportResult({
    required this.package,
    required this.mediaFilesByHash,
  });

  /// Converted OQ package
  final OqPackage package;

  /// Media files by MD5 hash
  final Map<String, MediaFileReference> mediaFilesByHash;
}

/// Progress state for SIQ import operations
sealed class SiqImportProgress {
  const SiqImportProgress();
}

final class SiqImportPickingFile extends SiqImportProgress {
  const SiqImportPickingFile();
}

final class SiqImportParsingFile extends SiqImportProgress {
  const SiqImportParsingFile({required this.progress});
  final double progress;
}

final class SiqImportConvertingMedia extends SiqImportProgress {
  const SiqImportConvertingMedia({
    required this.progress,
    required this.current,
    required this.total,
  });
  final double progress;
  final int current;
  final int total;
}

final class SiqImportCompleted extends SiqImportProgress {
  const SiqImportCompleted({required this.result});
  final SiqImportResult result;
}

final class SiqImportError extends SiqImportProgress {
  const SiqImportError({required this.error, this.stackTrace});
  final Object error;
  final StackTrace? stackTrace;
}

/// Reusable helper for importing SIQ files and converting them to OQ format
/// This utility follows DRY principle and can be used by both upload controller
/// and editor
class SiqImportHelper {
  SiqImportHelper({this.logger});

  final BaseLogger? logger;

  /// Pick a package file (.oq or .siq) using file picker
  /// Returns the file bytes and extension or null if cancelled
  static Future<({Uint8List bytes, String extension})?>
  pickPackageFile() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['oq', 'siq'], // Allow both extensions
      withData: true, // Ensure bytes are loaded (important for web)
    );

    if (result == null || result.files.isEmpty) {
      return null;
    }

    final pickedFile = result.files.first;
    final extension = pickedFile.extension?.toLowerCase() ?? '';

    // Validate extension
    if (!['oq', 'siq'].contains(extension)) {
      throw Exception(
        'Unsupported file type: $extension. Only .oq and '
        '.siq files are supported.',
      );
    }

    Uint8List? bytes;
    if (pickedFile.bytes != null) {
      bytes = pickedFile.bytes;
    } else if (pickedFile.path != null) {
      // Read from path if bytes not available (non-web platforms)
      final file = File(pickedFile.path!);
      bytes = await file.readAsBytes();
    }

    if (bytes == null) {
      throw Exception('Could not read file data');
    }

    return (bytes: bytes, extension: extension);
  }

  /// Convert SIQ file bytes to OQ package format with media files
  /// Returns a stream of progress updates
  Stream<SiqImportProgress> convertSiqToOqPackage(Uint8List siqBytes) async* {
    try {
      yield const SiqImportParsingFile(progress: 0.1);

      // Parse SIQ file using the siq_file package directly
      final parser = SiqArchiveParser();

      try {
        yield const SiqImportParsingFile(progress: 0.3);

        // Load archive
        await parser.load(siqBytes);

        yield const SiqImportParsingFile(progress: 0.6);

        // Parse SIQ content to get package structure
        final siqData = await parser.parse();

        yield const SiqImportParsingFile(progress: 0.8);

        // Get files hash map from parser
        final filesHashMap = parser.filesHash;

        yield const SiqImportParsingFile(progress: 1);

        // Convert to OQ package
        final oqPackage = _createOqPackageFromSiqData(siqData);

        // Convert media files to MediaFileReference objects
        final mediaFilesByHash = <String, MediaFileReference>{};

        var fileIndex = 0;
        final totalFiles = filesHashMap.length;

        for (final entry in filesHashMap.entries) {
          yield SiqImportConvertingMedia(
            progress: fileIndex / totalFiles,
            current: fileIndex + 1,
            total: totalFiles,
          );

          final hash = entry.key;
          final archiveFiles = entry.value;

          if (archiveFiles.isNotEmpty) {
            final archiveFile = archiveFiles.first;
            final fileBytes = archiveFile.content;

            // Create a PlatformFile from the bytes
            final platformFile = PlatformFile(
              name: archiveFile.name,
              size: fileBytes.length,
              bytes: fileBytes,
            );

            // Create MediaFileReference
            final mediaFile = MediaFileReference(platformFile: platformFile);
            mediaFilesByHash[hash] = mediaFile;

            // Close archive file to free memory
            await archiveFile.close();
          }

          fileIndex++;
        }

        yield SiqImportCompleted(
          result: SiqImportResult(
            package: oqPackage,
            mediaFilesByHash: mediaFilesByHash,
          ),
        );
      } finally {
        await parser.dispose();
      }
    } catch (error, stackTrace) {
      logger?.e('SIQ import failed', error: error, stackTrace: stackTrace);
      yield SiqImportError(error: error, stackTrace: stackTrace);
    }
  }

  /// Convert SIQ PackageCreateInputData to OQ Package
  OqPackage _createOqPackageFromSiqData(PackageCreateInputData siqData) {
    return OqPackage(
      id: -1, // New package, using -1 as placeholder ID like empty package
      title: siqData.title,
      description: siqData.description,
      language: siqData.language,
      ageRestriction: siqData.ageRestriction,
      tags: siqData.tags,
      rounds: siqData.rounds,
      author: const ShortUserInfo(
        id: 0,
        username: 'local',
      ), // Placeholder author
      createdAt: DateTime.now(),
      logo: siqData.logo?.file != null
          ? PackageLogoFileItem(
              file: FileItem(
                id: null,
                md5: siqData.logo!.file.md5,
                type: siqData.logo!.file.type,
                link: null,
              ),
            )
          : null,
    );
  }

  /// Pick and convert SIQ file to OQ package format
  /// Returns a stream of progress updates ending with the result or error
  Stream<SiqImportProgress> pickAndConvertSiqFile() async* {
    try {
      yield const SiqImportPickingFile();

      // Pick package file and check extension
      final fileResult = await pickPackageFile();
      if (fileResult == null) {
        return; // User cancelled
      }

      // Validate that it's a SIQ file
      if (fileResult.extension != 'siq') {
        yield SiqImportError(
          error: Exception(
            'Expected .siq file, got .${fileResult.extension}. '
            'Please select a SIQ file.',
          ),
        );
        return;
      }

      // Convert to OQ format
      yield* convertSiqToOqPackage(fileResult.bytes);
    } catch (error, stackTrace) {
      logger?.e(
        'SIQ file picking failed',
        error: error,
        stackTrace: stackTrace,
      );
      yield SiqImportError(error: error, stackTrace: stackTrace);
    }
  }
}
