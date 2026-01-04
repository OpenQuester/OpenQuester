import 'package:mason_logger/mason_logger.dart';
import 'package:project_helper/build_task.dart';
import 'package:project_helper/utils.dart';

/// Task to format code
class FormatTask implements BuildTask {
  @override
  String get name => 'format';

  @override
  String get description => 'Format Dart code';

  @override
  Future<bool> execute(
    String workingDirectory, {
    required Logger logger,
    Progress? progress,
    bool verbose = false,
  }) async {
    if (verbose) logger.info('Formatting Code');

    progress?.update('Formatting code...');

    final command = getDartCommand();
    final result = await runCommand(
      [...command, 'format', 'lib', 'packages'],
      workingDirectory: workingDirectory,
      verbose: verbose,
      logger: logger,
    );

    if (result.exitCode != 0) {
      logger.err('✗ Code formatting failed');
      if (!verbose) logger.err(result.stderr.toString());
      return false;
    }

    if (verbose) logger.success('✓ Code formatted');
    return true;
  }
}
