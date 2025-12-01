import 'package:mason_logger/mason_logger.dart';
import 'package:oq_compress/oq_compress.dart';
import 'package:oq_compress/src/commands/file_command.dart';
import 'package:universal_io/io.dart';

class EncodePackageCommand extends FileCommand {
  EncodePackageCommand({required super.logger});

  @override
  String get description => 'Command for encoding siq package';

  @override
  String get name => 'encode_package';

  @override
  Future<int> run() async {
    final inputFile = await getInputFile();
    final outputFile = await getOutputFile();
    final progress = logger.progress(
      'Processing file: ${inputFile.path.split('/').last}',
    );

    const encoder = OqFileEncoder();
    final tempFolder = Directory.systemTemp;
    final workDir = Directory(
      [
        tempFolder.path,
        'encode_${DateTime.now().millisecondsSinceEpoch}',
      ].join(Platform.pathSeparator),
    );
    await workDir.create();

    try {
      final outputArchive = await encoder.encodePackage(inputFile);
      await outputArchive?.rename(outputFile.path);
      progress.complete();
    } finally {
      encoder.dispose();
      await workDir.delete(recursive: true);
    }

    return ExitCode.success.code;
  }
}
