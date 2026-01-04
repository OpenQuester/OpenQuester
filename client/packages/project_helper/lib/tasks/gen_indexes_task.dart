import 'dart:io';

import 'package:mason_logger/mason_logger.dart';
import 'package:path/path.dart' as path;
import 'package:project_helper/build_task.dart';
import 'package:project_helper/utils.dart';

/// Task to generate index files
class GenerateIndexesTask implements BuildTask {
  @override
  String get name => 'gen_indexes';

  @override
  String get description => 'Generate index files (barrel exports)';

  @override
  Future<bool> execute(
    String workingDirectory, {
    required Logger logger,
    Progress? progress,
    bool verbose = false,
  }) async {
    // Check for index_generator configuration
    final indexGeneratorConfig = File(
      path.join(workingDirectory, 'index_generator.yaml'),
    );
    if (indexGeneratorConfig.existsSync() == false) {
      logger.warn('⚠ No index_generator.yaml found, skipping...');
      return true;
    }

    if (verbose) logger.info('Generating Index Files');

    final command = getFlutterCommand();

    // Install index_generator if needed
    progress?.update('Ensuring index_generator is available...');
    await runCommand(
      command.first,
      [...command.sublist(1), 'pub', 'global', 'activate', 'index_generator'],
      workingDirectory: workingDirectory,
      verbose: verbose,
      logger: logger,
    );

    // Run index_generator
    progress?.update('Running index_generator...');
    final result = await runCommand(
      command.first,
      [...command.sublist(1), 'pub', 'global', 'run', 'index_generator'],
      workingDirectory: workingDirectory,
      verbose: verbose,
      logger: logger,
    );

    if (result.exitCode != 0) {
      logger.err('✗ Index generation failed');
      if (!verbose) logger.err(result.stderr.toString());
      return false;
    }

    if (verbose) logger.success('✓ Index files generated');
    return true;
  }
}
