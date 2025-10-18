import 'package:mason_logger/mason_logger.dart';
import 'package:oq_compress/src/commands/file_command.dart';

class MetadataCommand extends FileCommand {
  MetadataCommand({required super.logger});

  @override
  String get description => 'Command for getting media file metadata';

  @override
  String get name => 'metadata';

  @override
  Future<int> run() async {
    final file = await getInputFile();
    logger.info('Processing file: ${file.path.split('/').last}');

    final metadata = await fileEncoder.getMetadata(file);
    logger.success(metadata.toString());

    return ExitCode.success.code;
  }
}
