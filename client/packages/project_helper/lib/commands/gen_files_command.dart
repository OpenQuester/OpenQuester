import 'package:mason_logger/mason_logger.dart';
import 'package:project_helper/commands/task_command.dart';
import 'package:project_helper/tasks/gen_files_task.dart';

/// Command to generate files using build_runner
class GenFilesCommand extends TaskCommand {
  GenFilesCommand(Logger logger) : super(GenerateFilesTask(), logger);

  @override
  void setupArgs() {
    super.setupArgs();
    argParser.addFlag(
      'clean-cache',
      negatable: false,
      help: 'Clean build cache before generating files',
    );
  }
}
