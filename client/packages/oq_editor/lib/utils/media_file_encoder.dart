import 'dart:async';

import 'package:crypto/crypto.dart';
import 'package:file_picker/file_picker.dart';
import 'package:openapi/openapi.dart';
import 'package:oq_compress/oq_compress.dart';
import 'package:oq_editor/models/media_file_reference.dart';
import 'package:oq_shared/oq_shared.dart';
import 'package:path_provider/path_provider.dart';
import 'package:universal_io/io.dart';

/// Reusable utility for encoding media files
/// Used by both upload controller and archive exporter
class MediaFileEncoder {
  MediaFileEncoder({this.logger});

  /// Optional logger for debug messages
  final BaseLogger? logger;

  /// Set of encoded file hashes to avoid re-encoding
  final Set<String> _encodedFilesHash = <String>{};

  Directory? _encodingOutputDirectory;

  /// Encode media files with compression if supported
  /// Returns a record with processed files and hash mapping
  /// Optimized to avoid unnecessary file operations when encoding not supported
  Future<
    ({Map<String, MediaFileReference> files, Map<String, String> hashMapping})
  >
  encodeMediaFiles(
    Map<String, MediaFileReference> mediaFilesByHash, {
    void Function(double progress)? onProgress,
  }) async {
    final processedFiles = <String, MediaFileReference>{};
    final hashMapping = <String, String>{}; // originalHash -> newHash

    // Check if encoding is supported on this platform
    final encodingSupported = await OqFileEncoder.isSupported();
    if (!encodingSupported) {
      logger?.d('OqFileEncoder not supported - using original files');
      return (files: mediaFilesByHash, hashMapping: hashMapping);
    }

    logger?.d('OqFileEncoder is supported - files will be compressed');

    // Create temporary directory for encoding
    final tempDir = await getTemporaryDirectory();
    _encodingOutputDirectory = Directory(
      '${tempDir.path}/encode_${DateTime.now().millisecondsSinceEpoch}',
    );
    await _encodingOutputDirectory!.create();

    // Step 1: Process files - only copy/read those that need encoding
    final filesToEncode = <File>[];
    final originalHashToFile = <String, File>{};
    final originalHashToMediaFile = <String, MediaFileReference>{};

    var processedCount = 0;
    final totalFiles = mediaFilesByHash.length;

    for (final entry in mediaFilesByHash.entries) {
      final originalHash = entry.key;
      final mediaFile = entry.value;

      // Skip if already encoded - reuse cached result
      if (_encodedFilesHash.contains(originalHash)) {
        logger?.d('File already encoded, using cached: $originalHash');
        processedFiles[originalHash] = mediaFile;
        hashMapping[originalHash] = originalHash;
        processedCount++;
        onProgress?.call(processedCount / totalFiles * 0.3); // 30% for prep
        continue;
      }

      // Only prepare files for encoding that need it
      // Save to temp file for encoding (optimize: use path if available)
      final tempFile = File(
        '${_encodingOutputDirectory!.path}/input_$originalHash',
      );

      if (mediaFile.platformFile.path != null) {
        // Optimize: Copy file directly if path is available
        final sourceFile = File(mediaFile.platformFile.path!);
        await sourceFile.copy(tempFile.path);
      } else {
        await tempFile.writeAsBytes(await mediaFile.platformFile.readBytes());
      }

      filesToEncode.add(tempFile);
      originalHashToFile[originalHash] = tempFile;
      originalHashToMediaFile[originalHash] = mediaFile;

      processedCount++;
      onProgress?.call(processedCount / totalFiles * 0.3); // 30% for prep
    }

    // Step 2: Encode files using encodeFiles function
    if (filesToEncode.isEmpty) {
      logger?.d(
        'No files to encode after filtering - using original files',
      );
      return (files: mediaFilesByHash, hashMapping: hashMapping);
    }
    // TODO: Add logger to OqFileEncoder
    const encoder = OqFileEncoder();

    try {
      final outputDir = '${_encodingOutputDirectory!.path}/output';

      final encodingResults = await encoder.encodeFiles(
        filesToEncode,
        outputDirectory: outputDir,
        onProgress: (progress) {
          // Progress from 30% to 90% (60% range for encoding)
          final adjustedProgress = 0.3 + (progress * 0.6);
          onProgress?.call(adjustedProgress);
          logger?.d(
            'Encoding progress: ${(progress * 100).toStringAsFixed(1)}%',
          );
        },
        onError: (file, error, stackTrace) {
          logger?.w(
            'Failed to encode ${file.path}: $error - will use original',
          );
        },
      );

      // Step 3: Import files to processed files map
      var finalizedCount = 0;
      for (final entry in originalHashToFile.entries) {
        final originalHash = entry.key;
        final inputFile = entry.value;
        final originalMediaFile = originalHashToMediaFile[originalHash]!;

        // Check if file was successfully encoded
        final encodedFile = encodingResults[inputFile];

        if (encodedFile != null && encodedFile.existsSync()) {
          // Use encoded file
          final encodedBytes = await encodedFile.readAsBytes();
          final encodedHash = md5.convert(encodedBytes).toString();

          logger?.d(
            'File encoded: $originalHash -> $encodedHash '
            '(${inputFile.lengthSync()}B -> ${encodedBytes.length}B)',
          );

          // Create MediaFileReference from encoded file
          final encodedMediaFile = _createMediaFileFromPath(
            encodedFile.path,
            'encoded_${originalMediaFile.fileName}',
          );
          processedFiles[encodedHash] = encodedMediaFile;
          hashMapping[originalHash] = encodedHash;
          _encodedFilesHash.add(encodedHash);
        } else {
          // Use original file (encoding failed)
          processedFiles[originalHash] = originalMediaFile;
          hashMapping[originalHash] = originalHash; // No change in hash

          logger?.d('Using original file for hash: $originalHash');
        }

        finalizedCount++;
        // Progress from 90% to 100% (10% range for finalization)
        final adjustedProgress =
            0.9 + (finalizedCount / originalHashToFile.length * 0.1);
        onProgress?.call(adjustedProgress);
      }
    } catch (e, st) {
      logger?.e('Error during file encoding: $e', stackTrace: st);
      rethrow;
    } finally {
      encoder.dispose();
    }
    logger?.d(
      'Encoding completed. Encoded files: ${_encodedFilesHash.length}',
    );
    return (files: processedFiles, hashMapping: hashMapping);
  }

  /// Helper method to create MediaFileReference from a file path
  MediaFileReference _createMediaFileFromPath(
    String filePath,
    String fileName,
  ) {
    final platformFile = PlatformFile(
      name: fileName,
      size: File(filePath).lengthSync(),
      path: filePath,
    );
    return MediaFileReference(platformFile: platformFile);
  }

  /// Encode media files and update package with new file hashes
  /// Returns a record with updated package and processed files
  /// This method handles the hash mapping updates in package file references
  Future<({OqPackage package, Map<String, MediaFileReference> files})>
  encodePackage(
    OqPackage package,
    Map<String, MediaFileReference> mediaFilesByHash, {
    void Function(double progress)? onProgress,
  }) async {
    // First encode the media files
    final encodingResult = await encodeMediaFiles(
      mediaFilesByHash,
      onProgress: onProgress,
    );

    // If no hash mapping changes, return original package
    if (encodingResult.hashMapping.isEmpty) {
      return (package: package, files: encodingResult.files);
    }

    // Update package with new file hashes
    final updatedPackage = _updatePackageFileHashes(
      package,
      encodingResult.hashMapping,
    );

    return (package: updatedPackage, files: encodingResult.files);
  }

  /// Update all file hash references in the package
  /// Traverses all rounds, themes, and questions to update file hashes
  OqPackage _updatePackageFileHashes(
    OqPackage package,
    Map<String, String> hashMapping,
  ) {
    // Update rounds
    final updatedRounds = package.rounds.map((round) {
      // Update themes in the round
      final updatedThemes = round.themes.map((theme) {
        // Update questions in the theme
        final updatedQuestions = theme.questions.map((question) {
          return _updateQuestionFileHashes(question, hashMapping);
        }).toList();

        return theme.copyWith(questions: updatedQuestions);
      }).toList();

      return round.copyWith(themes: updatedThemes);
    }).toList();

    return package.copyWith(rounds: updatedRounds);
  }

  /// Update file hashes in a question based on its type
  PackageQuestionUnion _updateQuestionFileHashes(
    PackageQuestionUnion question,
    Map<String, String> hashMapping,
  ) {
    return question.map(
      simple: (q) => q.copyWith(
        questionFiles: _updateQuestionFiles(q.questionFiles, hashMapping),
        answerFiles: _updateQuestionFiles(q.answerFiles, hashMapping),
      ),
      stake: (q) => q.copyWith(
        questionFiles: _updateQuestionFiles(q.questionFiles, hashMapping),
        answerFiles: _updateQuestionFiles(q.answerFiles, hashMapping),
      ),
      secret: (q) => q.copyWith(
        questionFiles: _updateQuestionFiles(q.questionFiles, hashMapping),
        answerFiles: _updateQuestionFiles(q.answerFiles, hashMapping),
      ),
      noRisk: (q) => q.copyWith(
        questionFiles: _updateQuestionFiles(q.questionFiles, hashMapping),
        answerFiles: _updateQuestionFiles(q.answerFiles, hashMapping),
      ),
      choice: (q) => q.copyWith(
        questionFiles: _updateQuestionFiles(q.questionFiles, hashMapping),
        answerFiles: _updateQuestionFiles(q.answerFiles, hashMapping),
      ),
      hidden: (q) => q.copyWith(
        questionFiles: _updateQuestionFiles(q.questionFiles, hashMapping),
        answerFiles: _updateQuestionFiles(q.answerFiles, hashMapping),
      ),
    );
  }

  /// Update file hashes in a list of PackageQuestionFile objects
  List<PackageQuestionFile>? _updateQuestionFiles(
    List<PackageQuestionFile?>? files,
    Map<String, String> hashMapping,
  ) {
    if (files == null) return null;

    return files
        .map((file) {
          if (file == null) return null;

          final newHash = hashMapping[file.file.md5];
          if (newHash != null && newHash != file.file.md5) {
            logger?.d('Updating file hash: ${file.file.md5} -> $newHash');
            return file.copyWith(
              file: file.file.copyWith(md5: newHash),
            );
          }
          return file;
        })
        .nonNulls
        .toList();
  }

  /// Populate the cache with encoded file hashes
  /// Used when importing a package that contains metadata about encoded files
  void populateEncodedFilesCache(Set<String> encodedFileHashes) {
    _encodedFilesHash.addAll(encodedFileHashes);
    logger?.d(
      'Populated encoder cache with ${encodedFileHashes.length} encoded files',
    );
  }

  /// Get current set of encoded file hashes (for export metadata)
  Set<String> get encodedFileHashes => Set.from(_encodedFilesHash);

  /// Clear cached encoded files
  Future<void> clearCache() async {
    _encodedFilesHash.clear();
    await cleanupEncodingDirectory();
    logger?.d('Cleared encoded files cache');
  }

  Future<void> cleanupEncodingDirectory() async {
    if (_encodingOutputDirectory != null &&
        _encodingOutputDirectory!.existsSync()) {
      await _encodingOutputDirectory!.delete(recursive: true);
      _encodingOutputDirectory = null;
      logger?.d('Cleaned up encoding temporary directory');
    }
  }

  /// Dispose and clean up
  Future<void> dispose() async {
    await clearCache();
  }
}
