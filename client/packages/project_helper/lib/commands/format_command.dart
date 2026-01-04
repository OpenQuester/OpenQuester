import 'package:mason_logger/mason_logger.dart';
import 'package:project_helper/commands/task_command.dart';
import 'package:project_helper/tasks/format_task.dart';

/// Command to format code
class FormatCommand extends TaskCommand {
  FormatCommand(Logger logger) : super(FormatTask(), logger);
}
