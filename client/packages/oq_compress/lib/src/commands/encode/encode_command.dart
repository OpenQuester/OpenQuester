import 'package:mason_logger/mason_logger.dart';
import 'package:oq_compress/src/commands/file_command.dart';

class EncodeCommand extends FileCommand {
  EncodeCommand({required super.logger});

  @override
  String get description => 'Command for encoding media files';

  @override
  String get name => 'encode';

  @override
  Future<int> run() async {
    final inputFile = await getInputFile();
    final outputFile = await getOutputFile();
    final progress = logger.progress(
      'Processing file: ${inputFile.path.split('/').last}',
    );

    final metadata = await fileEncoder.getMetadata(inputFile);
    final codecType = fileEncoder.getFileType(metadata);

    if (codecType == null) {
      progress.cancel();
      logger.err('Cant get file type');
      return ExitCode.usage.code;
    }

    final fileType = codecType.name;
    progress.update('Encoding $fileType');

    final result = await fileEncoder.encode(
      inputFile: inputFile,
      outputFile: outputFile,
      codecType: codecType,
    );

    final size = (await result.length()) / 1024 / 1024;
    progress.complete(
      [
        'Output $fileType file at ${result.path}',
        'with size ${size.toStringAsFixed(2)}MB',
      ].join(' '),
    );

    return ExitCode.success.code;
  }
}
