import 'package:mason_logger/mason_logger.dart';
import 'package:project_helper/build_task.dart';
import 'package:project_helper/tasks/gen_files_task.dart';
import 'package:project_helper/tasks/gen_locale_task.dart';
import 'package:project_helper/tasks/gen_indexes_task.dart';
import 'package:project_helper/tasks/format_task.dart';

/// Task to run the complete pre-build process
/// This includes gen_files, gen_locale, gen_indexes, and format
class PreBuildTask implements BuildTask {
  PreBuildTask({this.skipFormat = false});

  final bool skipFormat;

  @override
  String get name => 'pre_build';

  @override
  String get description => 'Run complete pre-build process';

  @override
  Future<bool> execute(
    String workingDirectory, {
    required Logger logger,
    Progress? progress,
    bool verbose = false,
  }) async {
    // 1. Generate files (build_runner)
    final genFilesTask = GenerateFilesTask();
    if (!await genFilesTask.execute(
      workingDirectory,
      logger: logger,
      progress: progress,
      verbose: verbose,
    )) {
      if (verbose) logger.err('✗ gen_files failed');
      return false;
    }

    // 2. Generate locale (if applicable)
    final genLocaleTask = GenerateLocaleTask();
    if (!await genLocaleTask.execute(
      workingDirectory,
      logger: logger,
      progress: progress,
      verbose: verbose,
    )) {
      if (verbose) logger.err('✗ gen_locale failed');
      return false;
    }

    // 3. Generate indexes (if applicable)
    final genIndexesTask = GenerateIndexesTask();
    if (!await genIndexesTask.execute(
      workingDirectory,
      logger: logger,
      progress: progress,
      verbose: verbose,
    )) {
      if (verbose) logger.err('✗ gen_indexes failed');
      return false;
    }

    // 4. Format code (if not skipped)
    if (!skipFormat) {
      final formatTask = FormatTask();
      if (!await formatTask.execute(
        workingDirectory,
        logger: logger,
        progress: progress,
        verbose: verbose,
      )) {
        if (verbose) logger.err('✗ format failed');
        return false;
      }
    }

    return true;
  }
}
