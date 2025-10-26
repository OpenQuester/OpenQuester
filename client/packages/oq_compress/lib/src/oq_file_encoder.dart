import 'dart:async';
import 'dart:io';
import 'dart:typed_data';

import 'package:archive/archive_io.dart';
import 'package:collection/collection.dart';
import 'package:oq_compress/src/common/command_wrapper.dart';
import 'package:oq_compress/src/common/process_utils.dart';
import 'package:oq_compress/src/models/ffprobe_output.dart';
import 'package:oq_shared/oq_shared.dart';

class OqFileEncoder {
  const OqFileEncoder({this.logger});
  final BaseLogger? logger;

  /// Check if the current platform supports FFmpeg operations.
  static Future<bool> isSupported() => CommandWrapper.isSupported();

  Future<FfprobeOutput> getMetadata(File file) async {
    logger?.t('Getting metadata for file: ${file.path}');

    if (!await isSupported()) {
      throw UnsupportedError(
        'FFmpeg operations are not supported on this platform. '
        'Desktop platforms (Windows, macOS, Linux) with FFmpeg '
        'installed are required.',
      );
    }

    final result = await CommandWrapper().metadata(file);
    logger?.t('Successfully retrieved metadata for: ${file.path}');
    return result!;
  }

  Future<File> encode({
    required File inputFile,
    required File outputFile,
    required CodecType codecType,
  }) async {
    logger?.t(
      'Encoding: ${inputFile.path} -> ${outputFile.path} (type: $codecType)',
    );

    if (!await isSupported()) {
      throw UnsupportedError(
        'FFmpeg operations are not supported on this platform. '
        'Desktop platforms (Windows, macOS, Linux) with FFmpeg '
        'installed are required.',
      );
    }

    final result = CommandWrapper().encode(
      inputFile: inputFile,
      outputFile: outputFile,
      codecType: codecType,
    );

    logger?.t('Encoding completed: ${outputFile.path}');
    return result;
  }

  /// Encode multiple files with progress tracking and error handling.
  ///
  /// [batchSize] controls how many files are processed concurrently in each
  /// batch.
  /// This applies to both metadata fetching and encoding operations to manage
  /// memory usage and system resources.
  ///
  /// Returns a map of successful encodings: {inputFile: outputFile}.
  /// Failed encodings are tracked in [onError] callback if provided.
  Future<Map<File, File>> encodeFiles(
    List<File> files, {
    required String outputDirectory,
    void Function(double progress)? onProgress,
    void Function(File file, Object error, StackTrace stackTrace)? onError,
    int batchSize = 2,
  }) async {
    logger?.i(
      'Starting encodeFiles: ${files.length} files, batchSize: $batchSize',
    );

    if (!await isSupported()) {
      throw UnsupportedError(
        'FFmpeg operations are not supported on this platform. '
        'Desktop platforms (Windows, macOS, Linux) with FFmpeg '
        'installed are required.',
      );
    }

    final results = <File, File>{};
    final totalFiles = files.length;

    if (totalFiles == 0) {
      logger?.w('No files provided for encoding');
      return results;
    }

    // Ensure output directory exists
    final outputDir = Directory(outputDirectory);
    await outputDir.create(recursive: true);
    logger?.d('Created output directory: $outputDirectory');

    var successCount = 0;
    var errorCount = 0;

    // Process files in batches to manage memory usage and system resources
    for (var i = 0; i < totalFiles; i += batchSize) {
      final batch = files.skip(i).take(batchSize).toList();
      final batchIndex = (i ~/ batchSize) + 1;
      final totalBatches = (totalFiles / batchSize).ceil();

      logger?.i(
        'Processing batch $batchIndex/$totalBatches (${batch.length} files)',
      );

      // Pre-fetch metadata for all files in batch concurrently
      final metadataFutures = batch.map((file) async {
        try {
          final metadata = await getMetadata(file);
          final codecType = getFileType(metadata);
          return (file, metadata, codecType);
        } catch (e) {
          logger?.w('Failed to get metadata for ${file.path}: $e');
          return (file, null, null);
        }
      }).toList();

      final metadataResults = await Future.wait(metadataFutures);

      // Create encoding futures for all files in batch to run concurrently
      final encodingFutures = metadataResults.asMap().entries.map((entry) {
        final j = entry.key;
        final (inputFile, metadata, codecType) = entry.value;
        final currentIndex = i + j;

        return () async {
          logger?.t(
            'Encoding file ${currentIndex + 1}/$totalFiles: ${inputFile.path}',
          );

          try {
            if (metadata == null || codecType == null) {
              logger?.w(
                'Unable to determine codec type for file: ${inputFile.path}',
              );
              onError?.call(
                inputFile,
                Exception('Unable to determine codec type for file'),
                StackTrace.current,
              );
              return null;
            }

            logger?.t('Detected codec type: $codecType for ${inputFile.path}');

            // Generate output file path
            final fileName = inputFile.path.split(Platform.pathSeparator).last;
            final outputFile = File(
              [outputDirectory, fileName].join(Platform.pathSeparator),
            );

            logger?.t('Output file: ${outputFile.path}');

            // Encode the file
            final encodedFile = await encode(
              inputFile: inputFile,
              outputFile: outputFile,
              codecType: codecType,
            );

            logger?.t(
              'Successfully encoded: ${inputFile.path} -> ${encodedFile.path}',
            );

            // Report progress
            final progress = (currentIndex + 1) / totalFiles;
            onProgress?.call(progress);
            logger?.t('Progress: ${(progress * 100).toStringAsFixed(1)}%');

            return (inputFile, encodedFile);
          } catch (error, stackTrace) {
            logger?.e(
              'Failed to encode file ${inputFile.path}: $error',
              error: error,
              stackTrace: stackTrace,
            );
            onError?.call(inputFile, error, stackTrace);
            return null;
          }
        };
      }).toList();

      // Execute all encoding operations in the batch concurrently
      final encodingResults = await Future.wait(
        encodingFutures.map((future) => future()),
      );

      // Process results and update counters
      for (final result in encodingResults) {
        if (result != null) {
          final (inputFile, encodedFile) = result;
          results[inputFile] = encodedFile;
          successCount++;
        } else {
          errorCount++;
        }
      }

      // Small delay to prevent memory allocation issues between batches
      await Future<void>.delayed(const Duration(milliseconds: 100));

      logger?.i(
        'Completed batch $batchIndex/$totalBatches. Success: $successCount, Errors: $errorCount',
      );
    }

    logger?.i(
      'Encoding completed. Total: $totalFiles, '
      'Success: $successCount, Errors: $errorCount',
    );
    return results;
  }

  Future<Uint8List> fileToBytes(File file) async => file.readAsBytes();

  /// Run [command] with temp file for use,
  /// so in process input file can be removed.
  ///
  /// After running remove temp folder
  ///
  Future<R> processWithTmpFile<R>({
    required File file,
    required Future<R> Function(File file) command,
  }) async {
    final tmpDir = await Directory.systemTemp.createTemp('siq-file-encode');
    final inputFile = File(
      [tmpDir.path, 'input_file'].join(Platform.pathSeparator),
    );
    await file.copy(inputFile.path);
    try {
      final result = await command(inputFile);
      return result;
    } finally {
      await tmpDir.delete(recursive: true);
    }
  }

  CodecType? getFileType(FfprobeOutput metadata) {
    logger?.t('Analyzing file type from metadata streams');

    final withVideo = metadata.streams.firstWhereOrNull(
      (e) => e.codecType == CodecType.video,
    );
    final withAudio = metadata.streams.firstWhereOrNull(
      (e) => e.codecType == CodecType.audio,
    );

    if (withVideo != null) {
      final frames = int.tryParse(withVideo.nbFrames ?? '') ?? -1;
      logger?.t('Found video stream with $frames frames');

      if (frames > 1) {
        logger?.t('Detected as video file (multiple frames)');
        return CodecType.video;
      }
      if (withAudio != null) {
        logger?.t('Detected as audio file (single frame + audio stream)');
        return CodecType.audio;
      }
      logger?.t('Detected as image file (single frame, no audio)');
      return CodecType.image;
    }
    if (withAudio != null) {
      logger?.t('Detected as audio file (audio stream only)');
      return CodecType.audio;
    }

    logger?.w('Unable to determine file type from metadata');
    return null;
  }

  Future<void> _setDirPermissions({
    required Directory dir,
    String permissions = '0775',
  }) async {
    if (![Platform.isLinux, Platform.isMacOS].contains(true)) {
      logger?.t('Skipping permission setting on ${Platform.operatingSystem}');
      return;
    }

    logger?.t('Setting permissions $permissions for: ${dir.path}');
    await runProcess('chmod', ['-R', permissions, dir.path]);
    logger?.t('Successfully set permissions for: ${dir.path}');
  }

  Future<File?> encodePackage(File file) async {
    logger?.i('Starting package encoding for: ${file.path}');

    if (!await isSupported()) {
      throw UnsupportedError(
        'FFmpeg operations are not supported on this platform. '
        'Desktop platforms (Windows, macOS, Linux) with FFmpeg '
        'installed are required.',
      );
    }

    final inputDir = Directory(
      [file.parent.path, 'input'].join(Platform.pathSeparator),
    );
    final outputDir = Directory(
      [file.parent.path, 'output'].join(Platform.pathSeparator),
    );
    await outputDir.create();
    logger?.t(
      'Created directories: input=${inputDir.path}, output=${outputDir.path}',
    );

    await extractFileToDisk(file.path, inputDir.path);
    logger?.t('Extracted package contents to: ${inputDir.path}');

    // Fixes permissions after files extraction (run concurrently)
    await Future.wait([
      _setDirPermissions(dir: inputDir),
      _setDirPermissions(dir: outputDir),
    ]);
    logger?.t('Set directory permissions');

    const folders = {'Images', 'Video', 'Audio'};
    var totalProcessedFiles = 0;

    for (final folderName in folders) {
      logger?.i('Processing media folder: $folderName');

      final mediaInDir = Directory(
        [inputDir.path, folderName].join(Platform.pathSeparator),
      );
      final mediaOutDir = Directory(
        [outputDir.path, folderName].join(Platform.pathSeparator),
      );

      if (!mediaInDir.existsSync()) {
        logger?.t('Folder does not exist: ${mediaInDir.path}');
        continue;
      }

      await mediaOutDir.create(recursive: true);

      // Collect all files in the media directory
      final files = await mediaInDir
          .list()
          .where((entity) => entity is File)
          .cast<File>()
          .toList();
      logger?.i('Found ${files.length} files in $folderName folder');

      if (files.isNotEmpty) {
        // Use the new encodeFiles method for batch processing
        final results = await encodeFiles(
          files,
          outputDirectory: mediaOutDir.path,
          onError: (file, error, stackTrace) {
            // Log errors but continue processing other files
            logger?.e(
              'Failed to encode ${file.path}: $error',
              error: error,
              stackTrace: stackTrace,
            );
          },
        );

        totalProcessedFiles += results.length;
        logger?.i(
          'Processed ${results.length}/${files.length} files in $folderName folder',
        );
      }

      await mediaInDir.delete(recursive: true);
      logger?.t('Cleaned up input folder: ${mediaInDir.path}');
    }

    logger?.i('Moving remaining directory contents');
    await _moveDirectoryContents(inputDir, outputDir);

    logger?.i('Cleaning up temporary directories');
    await inputDir.delete(recursive: true);
    logger?.t('Cleaned up temporary directories');

    await _createFinalArchive(
      file: file,
      outputDir: outputDir,
      totalProcessedFiles: totalProcessedFiles,
    );

    logger?.i('Package encoding completed: ${file.path}');
    return file;
  }

  /// Creates the final archive from the processed output directory.
  Future<void> _createFinalArchive({
    required File file,
    required Directory outputDir,
    required int totalProcessedFiles,
  }) async {
    logger?.i(
      'Creating final archive with $totalProcessedFiles processed files',
    );

    // Create the archive encoder
    final encoder = ZipFileEncoder();

    // Prepare the final archive file path
    final outputArchiveFile = File(file.path);

    // Delete original file and create new archive
    await file.delete();

    // Create the zip archive
    await encoder.zipDirectory(outputDir, filename: outputArchiveFile.path);

    logger?.t('Archive created successfully: ${outputArchiveFile.path}');
  }

  Future<void> _moveDirectoryContents(
    Directory sourceDir,
    Directory targetDir,
  ) async {
    logger?.d('Moving contents from ${sourceDir.path} to ${targetDir.path}');

    if (!sourceDir.existsSync()) {
      logger?.w('Source directory does not exist: ${sourceDir.path}');
      return;
    }

    // Ensure the target root exists
    await targetDir.create(recursive: true);

    var movedCount = 0;

    await for (final item in sourceDir.list()) {
      final targetPath = [
        targetDir.path,
        item.path.split(Platform.pathSeparator).last,
      ].join(Platform.pathSeparator);

      logger?.t('Moving: ${item.path} -> $targetPath');
      await item.rename(targetPath);
      movedCount++;
    }

    logger?.t(
      'Moved $movedCount items from ${sourceDir.path} to ${targetDir.path}',
    );
  }

  void dispose() {}
}
