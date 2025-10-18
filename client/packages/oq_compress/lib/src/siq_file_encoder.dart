import 'dart:async';
import 'dart:io';
import 'dart:typed_data';

import 'package:archive/archive_io.dart';
import 'package:collection/collection.dart';
import 'package:oq_compress/src/common/command_wrapper.dart';
import 'package:oq_compress/src/common/process_utils.dart';
import 'package:oq_compress/src/models/ffprobe_output.dart';

class OqFileEncoder {
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
    final withVideo = metadata.streams.firstWhereOrNull(
      (e) => e.codecType == CodecType.video,
    );
    final withAudio = metadata.streams.firstWhereOrNull(
      (e) => e.codecType == CodecType.audio,
    );
    if (withVideo != null) {
      final frames = int.tryParse(withVideo.nbFrames ?? '') ?? -1;
      if (frames > 1) return CodecType.video;
      if (withAudio != null) return CodecType.audio;
      return CodecType.image;
    }
    if (withAudio != null) return CodecType.audio;
    return null;
  }

  Future<void> _setDirPermissions({
    required Directory dir,
    String permissions = '0775',
  }) async {
    if (![Platform.isLinux, Platform.isMacOS].contains(true)) return;
    await runProcess('chmod', ['-R', permissions, dir.path]);
  }

  Future<File?> encodePackage(File file) async {
    final inputDir = Directory(
      [file.parent.path, 'input'].join(Platform.pathSeparator),
    );
    final outputDir = Directory(
      [file.parent.path, 'output'].join(Platform.pathSeparator),
    );
    await outputDir.create();

    await extractFileToDisk(file.path, inputDir.path);

    // Fixes permissions after files extraction
    await _setDirPermissions(dir: inputDir);
    await _setDirPermissions(dir: outputDir);

    const folders = {'Images', 'Video', 'Audio'};
    final fileEncoder = OqFileEncoder();

    for (final folderName in folders) {
      final mediaInDir = Directory(
        [inputDir.path, folderName].join(Platform.pathSeparator),
      );
      final mediaOutDir = Directory(
        [outputDir.path, folderName].join(Platform.pathSeparator),
      );

      if (!mediaInDir.existsSync()) continue;

      mediaOutDir.createSync();

      final files = mediaInDir.listSync();
      for (final file in files) {
        if (file is! File) continue;

        final outputFile = File(
          [
            mediaOutDir.path,
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

        // Delay to fix "Cannot allocate memory" (?)
        await Future<void>.delayed(const Duration(milliseconds: 100));
      }

      await mediaInDir.delete(recursive: true);
    }

    await _moveDirectoryContents(inputDir, outputDir);
    await inputDir.delete(recursive: true);

    final encoder = ZipFileEncoder();
    await file.delete();
    final outputArchiveFile = File(file.path);
    await encoder.zipDirectory(outputDir, filename: outputArchiveFile.path);

    return outputArchiveFile;
  }

  Future<void> _moveDirectoryContents(
    Directory sourceDir,
    Directory targetDir,
  ) async {
    if (!sourceDir.existsSync()) return;

    // Ensure the target root exists
    await targetDir.create(recursive: true);

    final itemsList = sourceDir.list();
    await for (final item in itemsList) {
      await item.rename(
        [
          targetDir.path,
          item.path.split(Platform.pathSeparator).last,
        ].join(Platform.pathSeparator),
      );
    }
  }

  void dispose() {}
}
