import 'dart:io';
import 'package:mason_logger/mason_logger.dart';
import 'package:path/path.dart' as p;
import 'package:project_helper/build_task.dart';
import 'package:project_helper/utils.dart';

/// Task to run build_runner
class GenerateFilesTask implements BuildTask {
  @override
  String get name => 'gen_files';

  @override
  String get description => 'Generate files using build_runner';

  @override
  Future<bool> execute(
    String workingDirectory, {
    required Logger logger,
    Progress? progress,
    bool verbose = false,
  }) async {
    progress?.update('Running build_runner...');

    final isFlutter = await _isFlutterPackage(workingDirectory);
    final command = isFlutter ? getFlutterCommand() : getDartCommand();

    final buildArgs = [
      if (isFlutter) 'pub',
      'run',
      'build_runner',
      'build',
      '-d',
    ];

    final result = await runCommand(
      [...command, ...buildArgs],
      workingDirectory: workingDirectory,
      verbose: verbose,
      logger: logger,
    );

    if (result.exitCode != 0) {
      logger.err('✗ build_runner failed');
      if (!verbose) logger.err(result.stderr.toString());
      return false;
    }

    if (verbose) logger.success('✓ build_runner completed');
    return true;
  }

  Future<bool> _isFlutterPackage(String packagePath) async {
    final pubspecFile = File(p.join(packagePath, 'pubspec.yaml'));
    if (!await pubspecFile.exists()) {
      return false;
    }

    try {
      final content = await pubspecFile.readAsString();
      return content.contains('sdk: flutter');
    } catch (e) {
      return false;
    }
  }
}
