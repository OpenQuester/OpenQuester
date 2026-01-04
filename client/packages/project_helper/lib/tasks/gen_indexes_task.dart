import 'dart:io';
import 'package:project_helper/build_task.dart';
import 'package:project_helper/utils.dart';

/// Task to generate index files
class GenerateIndexesTask implements BuildTask {
  @override
  String get name => 'gen_indexes';

  @override
  String get description => 'Generate index files (barrel exports)';

  @override
  Future<bool> execute(String workingDirectory) async {
    printSection('Generating Index Files');

    final command = getFlutterCommand();

    // Install index_generator if needed
    print('Ensuring index_generator is available...');
    await runCommand(
      command.split(' ').first,
      [...command.split(' ').skip(1), 'pub', 'global', 'activate', 'index_generator'],
      workingDirectory: workingDirectory,
    );

    // Run index_generator
    print('Running index_generator...');
    final result = await runCommand(
      command.split(' ').first,
      [...command.split(' ').skip(1), 'pub', 'global', 'run', 'index_generator'],
      workingDirectory: workingDirectory,
    );

    if (result.exitCode != 0) {
      print('✗ Index generation failed');
      return false;
    }

    print('✓ Index files generated');
    return true;
  }
}
