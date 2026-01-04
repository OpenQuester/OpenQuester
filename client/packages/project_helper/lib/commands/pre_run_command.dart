import 'dart:io';

import 'package:project_helper/commands/pre_build_command.dart';

/// Command to run the full pre-build process
class PreRunCommand extends PreBuildCommand {
  PreRunCommand(super.logger) {
    argParser.addFlag(
      'verbose',
      abbr: 'v',
      negatable: false,
      help: 'Show verbose output',
    );
  }

  @override
  String get name => 'pre_run';

  @override
  String get description => 'Run the build process without formatting';

  @override
  Future<void> run() async {
    final currentDir = Directory.current.path;
    final verbose = argResults?['verbose'] as bool? ?? false;

    logger.info('🚀 OpenQuester Pre-Run');
    logger.info('');
    runPrebuild(false, currentDir, verbose, true);
  }
}
