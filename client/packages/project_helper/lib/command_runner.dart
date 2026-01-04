import 'package:args/command_runner.dart';
import 'package:project_helper/commands/pre_build_command.dart';

/// Main command runner for oqhelper
class OqHelperCommandRunner extends CommandRunner<void> {
  OqHelperCommandRunner()
      : super(
          'oqhelper',
          'OpenQuester project helper - replaces Makefiles for Dart/Flutter projects',
        ) {
    addCommand(PreBuildCommand());
  }
}
