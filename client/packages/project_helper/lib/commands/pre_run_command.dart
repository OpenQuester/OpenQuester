import 'dart:io';
import 'package:args/command_runner.dart';
import 'package:mason_logger/mason_logger.dart';
import 'package:project_helper/build_task.dart';
import 'package:project_helper/tasks/build_packages_task.dart';
import 'package:project_helper/tasks/pre_build_task.dart';
import 'package:project_helper/utils.dart';

/// Command to run the full pre-build process
class PreRunCommand extends Command<void> {
  PreRunCommand(this.logger) {
    argParser.addFlag(
      'verbose',
      abbr: 'v',
      negatable: false,
      help: 'Show verbose output',
    );
  }

  final Logger logger;

  @override
  String get name => 'pre_run';

  @override
  String get description => 'Run the build process without formatting';

  @override
  Future<void> run() async {
    final currentDir = Directory.current.path;
    final overallStopwatch = Stopwatch()..start();
    final verbose = argResults?['verbose'] as bool? ?? false;

    logger.info('🚀 OpenQuester Pre-Run');
    logger.info('');

    try {
      // Build packages first
      final buildPackagesTask = BuildPackagesTask(skipFormat: true);
      await _executeTask(buildPackagesTask, currentDir, verbose);

      // Run pre_build tasks for the current directory
      final preBuildTask = PreBuildTask(skipFormat: true);
      await _executeTask(preBuildTask, currentDir, verbose);

      overallStopwatch.stop();
      logger.info('');
      logger.success(
        '✓ Pre-Build Complete! Total time: ${formatDuration(overallStopwatch.elapsed)}',
      );
    } catch (e) {
      overallStopwatch.stop();
      logger.err(
        '✗ Pre-Build Failed after ${formatDuration(overallStopwatch.elapsed)}',
      );
      rethrow;
    }
  }

  Future<void> _executeTask(
    BuildTask task,
    String workingDirectory,
    bool verbose,
  ) async {
    final progress = logger.progress(task.name);

    final stopwatch = Stopwatch()..start();

    try {
      final success = await task.execute(
        workingDirectory,
        logger: logger,
        progress: progress,
        verbose: verbose,
      );
      stopwatch.stop();

      if (success) {
        progress.complete(
          '✓ ${task.description} (${formatDuration(stopwatch.elapsed)})',
        );
      } else {
        progress.fail(
          '✗ ${task.description} failed (${formatDuration(stopwatch.elapsed)})',
        );
        throw Exception('${task.name} failed');
      }
    } catch (e) {
      stopwatch.stop();
      progress.fail(
        '✗ ${task.description} failed (${formatDuration(stopwatch.elapsed)})',
      );
      rethrow;
    }
  }
}
