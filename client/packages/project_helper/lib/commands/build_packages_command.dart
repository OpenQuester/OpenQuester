import 'package:mason_logger/mason_logger.dart';
import 'package:project_helper/commands/task_command.dart';
import 'package:project_helper/tasks/build_packages_task.dart';

/// Command to build packages
class BuildPackagesCommand extends TaskCommand {
  BuildPackagesCommand(Logger logger) : super(BuildPackagesTask(), logger);
}
