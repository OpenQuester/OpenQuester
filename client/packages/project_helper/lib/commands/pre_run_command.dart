import 'dart:io';

import 'package:project_helper/commands/pre_build_command.dart';

/// Command to run the full pre-build process
class PreRunCommand extends PreBuildCommand {
  PreRunCommand(super.logger);

  @override
  String get name => 'pre_run';

  @override
  String get description => 'Run the build process without formatting';

  @override
  void setFlags() {
    argParser
      ..addFlag(
        'verbose',
        abbr: 'v',
        negatable: false,
        help: 'Show verbose output',
      )
      ..addOption(
        'ignore-packages',
        abbr: 'i',
        defaultsTo: 'project_helper',
        help:
            'Comma-separated list of package names to ignore (default: project_helper)',
      );
  }

  @override
  Future<void> run() async {
    final currentDir = Directory.current.path;
    final verbose = argResults?['verbose'] as bool? ?? false;
    final ignorePackages = getIgnoredPackages();

    logger.info('🚀 OpenQuester Pre-Run');
    logger.info('');
    await runPrebuild(false, currentDir, verbose, true, ignorePackages);
  }
}
