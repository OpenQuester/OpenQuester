import 'dart:io';
import 'package:mason_logger/mason_logger.dart';
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
  Future<bool> execute(
    String workingDirectory, {
    required Logger logger,
    Progress? progress,
    bool verbose = false,
  }) async {
    // Check if localization directory exists
    final localeDir = Directory(
      p.join(workingDirectory, 'assets', 'localization'),
    );
    if (!await localeDir.exists()) {
      if (verbose) {
        logger.warn('⚠ No localization directory found, skipping...');
      }
      return true;
    }

    progress?.update('Generating localization keys...');

    final command = getFlutterCommand();
    final result = await runCommand(
      [
        ...command,
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
      verbose: verbose,
      logger: logger,
    );

    if (result.exitCode != 0) {
      logger.err('✗ Locale generation failed');
      if (!verbose) logger.err(result.stderr.toString());
      return false;
    }

    if (verbose) logger.success('✓ Localization keys generated');
    return true;
  }
}
