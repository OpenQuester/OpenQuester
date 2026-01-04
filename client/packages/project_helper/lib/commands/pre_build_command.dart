import 'dart:io';
import 'package:args/command_runner.dart';
import 'package:mason_logger/mason_logger.dart';
import 'package:project_helper/build_task.dart';
import 'package:project_helper/tasks/build_packages_task.dart';
import 'package:project_helper/tasks/pre_build_task.dart';
import 'package:project_helper/utils.dart';
import 'package:meta/meta.dart';

/// Command to run the full pre-build process
class PreBuildCommand extends Command<void> {
  PreBuildCommand(this.logger) {
    setFlags();
  }

  final Logger logger;

  @override
  String get name => 'pre_build';

  @override
  String get description => 'Run the full pre-build process';

  @protected
  void setFlags() {
    argParser
      ..addFlag(
        'skip-packages',
        abbr: 'p',
        negatable: false,
        help: 'Skip building packages',
      )
      ..addFlag(
        'skip-format',
        abbr: 'f',
        negatable: false,
        help: 'Skip code formatting',
      )
      ..addFlag(
        'no-puro',
        abbr: 'n',
        negatable: false,
        help: 'Disable puro (use system Flutter/Dart)',
      )
      ..addFlag(
        'verbose',
        abbr: 'v',
        negatable: false,
        help: 'Show verbose output',
      );
  }

  @override
  Future<void> run() async {
    final currentDir = Directory.current.path;
    final skipPackages = argResults?['skip-packages'] as bool? ?? false;
    final skipFormat = argResults?['skip-format'] as bool? ?? false;
    final noPuro = argResults?['no-puro'] as bool? ?? false;
    final verbose = argResults?['verbose'] as bool? ?? false;

    // Handle puro flag
    if (noPuro) {
      setDisablePuroFromCommand(true);
    }

    logger.info('🚀 OpenQuester Pre-Build');
    logger.info('');

    await runPrebuild(skipPackages, currentDir, verbose, skipFormat);
  }

  @protected
  Future<void> runPrebuild(
    bool skipPackages,
    String currentDir,
    bool verbose,
    bool skipFormat,
  ) async {
    final overallStopwatch = Stopwatch()..start();

    try {
      // Build packages first (if not skipped)
      if (!skipPackages) {
        final buildPackagesTask = BuildPackagesTask(skipFormat: skipFormat);
        await _executeTask(buildPackagesTask, currentDir, verbose);
      }

      // Run pre_build tasks for the current directory
      final preBuildTask = PreBuildTask(skipFormat: skipFormat);
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
