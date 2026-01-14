import 'package:mason_logger/mason_logger.dart';
import 'package:project_helper/commands/task_command.dart';
import 'package:project_helper/tasks/format_exception_task.dart';

/// Command to format code with exceptions
class FormatExceptionCommand extends TaskCommand {
  FormatExceptionCommand(Logger logger) : super(FormatExceptionTask(), logger);
}
