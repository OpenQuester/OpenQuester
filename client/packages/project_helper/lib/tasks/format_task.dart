import 'dart:io';
import 'package:project_helper/build_task.dart';
import 'package:project_helper/utils.dart';

/// Task to format code
class FormatTask implements BuildTask {
  @override
  String get name => 'format';

  @override
  String get description => 'Format Dart code';

  @override
  Future<bool> execute(String workingDirectory) async {
    printSection('Formatting Code');

    final command = getDartCommand();
    final result = await runCommand(
      command.split(' ').first,
      [...command.split(' ').skip(1), 'format', 'lib', 'packages/*/lib'],
      workingDirectory: workingDirectory,
    );

    if (result.exitCode != 0) {
      print('✗ Code formatting failed');
      return false;
    }

    print('✓ Code formatted');
    return true;
  }
}
