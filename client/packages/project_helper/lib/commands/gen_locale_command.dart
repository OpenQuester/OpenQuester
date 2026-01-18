import 'package:mason_logger/mason_logger.dart';
import 'package:project_helper/commands/task_command.dart';
import 'package:project_helper/tasks/gen_locale_task.dart';

/// Command to generate localization keys
class GenLocaleCommand extends TaskCommand {
  GenLocaleCommand(Logger logger) : super(GenerateLocaleTask(), logger);
}
