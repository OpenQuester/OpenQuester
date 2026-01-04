import 'dart:io';
import 'package:path/path.dart' as p;
import 'package:yaml/yaml.dart';
import 'package:project_helper/build_task.dart';
import 'package:project_helper/utils.dart';

/// Task to run build_runner
class GenerateFilesTask implements BuildTask {
  @override
  String get name => 'gen_files';

  @override
  String get description => 'Generate files using build_runner';

  @override
  Future<bool> execute(String workingDirectory) async {
    print('Running build_runner...');

    final isFlutter = await _isFlutterPackage(workingDirectory);
    final command = isFlutter ? getFlutterCommand() : getDartCommand();

    List<String> buildArgs;
    if (isFlutter) {
      buildArgs = ['pub', 'run', 'build_runner', 'build', '-d'];
    } else {
      buildArgs = ['run', 'build_runner', 'build', '-d'];
    }

    final result = await runCommand(
      command.split(' ').first,
      [...command.split(' ').skip(1), ...buildArgs],
      workingDirectory: workingDirectory,
    );

    if (result.exitCode != 0) {
      print('✗ build_runner failed');
      return false;
    }

    print('✓ build_runner completed');
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
