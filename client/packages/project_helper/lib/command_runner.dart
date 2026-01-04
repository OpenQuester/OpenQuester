import 'package:cli_completion/cli_completion.dart';
import 'package:mason_logger/mason_logger.dart';
import 'package:project_helper/commands/build_packages_command.dart';
import 'package:project_helper/commands/format_command.dart';
import 'package:project_helper/commands/format_exception_command.dart';
import 'package:project_helper/commands/gen_files_command.dart';
import 'package:project_helper/commands/gen_indexes_command.dart';
import 'package:project_helper/commands/gen_locale_command.dart';
import 'package:project_helper/commands/pre_build_command.dart';
import 'package:project_helper/commands/pre_run_command.dart';

/// Main command runner for oqhelper
class OqHelperCommandRunner extends CompletionCommandRunner<void> {
  OqHelperCommandRunner({Logger? logger})
    : _logger = logger ?? Logger(),
      super(
        'oqhelper',
        'OpenQuester project helper - replaces Makefiles for Dart/Flutter projects',
      ) {
    addCommand(PreBuildCommand(_logger));
    addCommand(PreRunCommand(_logger));
    addCommand(GenFilesCommand(_logger));
    addCommand(GenLocaleCommand(_logger));
    addCommand(GenIndexesCommand(_logger));
    addCommand(FormatCommand(_logger));
    addCommand(BuildPackagesCommand(_logger));
    addCommand(FormatExceptionCommand(_logger));
  }

  final Logger _logger;
}
