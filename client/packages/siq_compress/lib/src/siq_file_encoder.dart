import 'dart:async';
import 'dart:io';
import 'dart:typed_data';

import 'package:archive/archive_io.dart';
import 'package:collection/collection.dart';
import 'package:siq_compress/src/common/command_wrapper.dart';
import 'package:siq_compress/src/models/ffprobe_output.dart';

class SiqFileEncoder {
  Future<FfprobeOutput> getMetadata(File file) async {
    final result = await CommandWrapper().metadata(file);
    return result!;
  }

  Future<File> encode({
    required File inputFile,
    required File outputFile,
    required CodecType codecType,
  }) async {
    final result = CommandWrapper().encode(
      inputFile: inputFile,
      outputFile: outputFile,
      codecType: codecType,
    );
    return result;
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
    final withVideo = metadata.streams
        .firstWhereOrNull((e) => e.codecType == CodecType.video);
    final withAudio = metadata.streams
        .firstWhereOrNull((e) => e.codecType == CodecType.audio);
    if (withVideo != null && withAudio?.codecName != 'mjpeg') {
      if (metadata.streams.length == 1) return CodecType.image;
      return CodecType.video;
    }
    if (withAudio != null) return CodecType.audio;
    return null;
  }

  Future<File?> encodePackage(File file) async {
    final inputDir =
        Directory([file.parent.path, 'input'].join(Platform.pathSeparator));
    final outputDir =
        Directory([file.parent.path, 'output'].join(Platform.pathSeparator));
    await outputDir.create();

    await extractFileToDisk(file.path, inputDir.path);

    const folders = {'Images', 'Video', 'Audio'};
    final fileEncoder = SiqFileEncoder();

    for (final folderName in folders) {
      final inputFolder = Directory(
        [inputDir.path, folderName].join(Platform.pathSeparator),
      );
      final outputFolder = Directory(
        [outputDir.path, folderName].join(Platform.pathSeparator),
      );

      if (!inputFolder.existsSync()) continue;

      outputFolder.createSync();

      final files = inputFolder.listSync();
      for (final file in files) {
        if (file is! File) continue;

        final outputFile = File(
          [
            outputFolder.path,
            file.path.split(Platform.pathSeparator).last,
          ].join(Platform.pathSeparator),
        );

        final metadata = await fileEncoder.getMetadata(file);
        final codecType = fileEncoder.getFileType(metadata);

        if (codecType == null) continue;

        await encode(
          inputFile: file,
          outputFile: outputFile,
          codecType: codecType,
        );
      }

      await inputFolder.delete(recursive: true);
    }

    await _moveDirectoryContents(inputDir, outputDir);
    await inputDir.delete(recursive: true);

    final encoder = ZipFileEncoder();
    await file.delete();
    final outputArchiveFile = File(file.path);
    await encoder.zipDirectory(
      outputDir,
      filename: outputArchiveFile.path,
    );

    return outputArchiveFile;
  }

  Future<void> _moveDirectoryContents(
    Directory sourceDir,
    Directory targetDir,
  ) async {
    if (!sourceDir.existsSync()) return;

    await targetDir.create(recursive: true);

    await for (final entity in sourceDir.list()) {
      final newPath = [targetDir.path, entity.uri.pathSegments.last]
          .join(Platform.pathSeparator);

      if (entity is File) {
        await entity.rename(newPath);
      } else if (entity is Directory) {
        await _moveDirectoryContents(entity, Directory(newPath));
        await entity.delete(recursive: true);
      }
    }
  }

  void dispose() {}
}
