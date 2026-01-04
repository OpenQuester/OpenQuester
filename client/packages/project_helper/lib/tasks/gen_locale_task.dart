import 'dart:io';
import 'package:path/path.dart' as p;
import 'package:project_helper/build_task.dart';
import 'package:project_helper/utils.dart';

/// Task to generate localization keys
class GenerateLocaleTask implements BuildTask {
  @override
  String get name => 'gen_locale';

  @override
  String get description => 'Generate localization keys';

  @override
  Future<bool> execute(String workingDirectory) async {
    // Check if localization directory exists
    final localeDir = Directory(p.join(workingDirectory, 'assets', 'localization'));
    if (!await localeDir.exists()) {
      print('⚠ No localization directory found, skipping...');
      return true;
    }

    print('Generating localization keys...');

    final command = getFlutterCommand();
    final result = await runCommand(
      command.split(' ').first,
      [
        ...command.split(' ').skip(1),
        'pub',
        'run',
        'easy_localization:generate',
        '-f',
        'keys',
        '-o',
        'locale_keys.g.dart',
        '-S',
        'assets/localization/',
      ],
      workingDirectory: workingDirectory,
    );

    if (result.exitCode != 0) {
      print('✗ Locale generation failed');
      return false;
    }

    print('✓ Localization keys generated');
    return true;
  }
}
