import 'package:mason_logger/mason_logger.dart';

/// Interface for build tasks
/// Each task can be run independently as a command or as part of a larger workflow
abstract class BuildTask {
  /// Name of the task
  String get name;

  /// Description of the task
  String get description;

  /// Execute the task
  /// Returns true if successful, false otherwise
  Future<bool> execute(
    String workingDirectory, {
    required Logger logger,
    Progress? progress,
    bool verbose = false,
  });
}
