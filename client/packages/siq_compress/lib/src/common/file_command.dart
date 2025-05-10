import 'package:args/command_runner.dart';
import 'package:mason_logger/mason_logger.dart';
import 'package:siq_compress/src/siq_file_encoder.dart';
import 'package:universal_io/io.dart';

abstract class FileCommand extends Command<int> {
  FileCommand({required this.logger});
  final Logger logger;

  Future<File> getInputFile() async => _getFile(0);
  Future<File> getOutputFile() async => _getFile(1);

  File _getFile(int index) {
    // TODO: Add exect parametrs count validation
    if (argResults!.rest.isEmpty) {
      usageException('Provide file path');
    }

    final target = argResults!.rest[index];
    final targetFile = File(target);

    return targetFile;
  }

  late final fileEncoder = SiqFileEncoder();
}
