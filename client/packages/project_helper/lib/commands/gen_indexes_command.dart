import 'package:mason_logger/mason_logger.dart';
import 'package:project_helper/commands/task_command.dart';
import 'package:project_helper/tasks/gen_indexes_task.dart';

/// Command to generate index files
class GenIndexesCommand extends TaskCommand {
  GenIndexesCommand(Logger logger) : super(GenerateIndexesTask(), logger);
}
