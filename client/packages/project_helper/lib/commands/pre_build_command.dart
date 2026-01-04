import 'dart:io';
import 'package:args/command_runner.dart';
import 'package:mason_logger/mason_logger.dart';
import 'package:project_helper/tasks/build_packages_task.dart';
import 'package:project_helper/tasks/gen_files_task.dart';
import 'package:project_helper/tasks/gen_locale_task.dart';
import 'package:project_helper/tasks/gen_indexes_task.dart';
import 'package:project_helper/tasks/format_task.dart';
import 'package:project_helper/utils.dart';

/// Command to run the full pre-build process
class PreBuildCommand extends Command<void> {
  PreBuildCommand(this.logger) {
    argParser
      ..addFlag(
        'skip-packages',
        abbr: 'sp',
        negatable: false,
        help: 'Skip building packages',
      )
      ..addFlag(
        'skip-format',
        abbr: 'sf',
        negatable: false,
        help: 'Skip code formatting',
      )
      ..addFlag(
        'no-puro',
        abbr: 'n',
        negatable: false,
        help: 'Disable puro (use system Flutter/Dart)',
      );
  }

  final Logger logger;

  @override
  String get name => 'pre_build';

  @override
  String get description => 'Run the full pre-build process';

  @override
  Future<void> run() async {
    final currentDir = Directory.current.path;
    final skipPackages = argResults?['skip-packages'] as bool? ?? false;
    final skipFormat = argResults?['skip-format'] as bool? ?? false;
    final noPuro = argResults?['no-puro'] as bool? ?? false;

    // Handle puro flag
    if (noPuro) {
      setDisablePuroFromCommand(true);
    }

    final overallStopwatch = Stopwatch()..start();

    logger.info('🚀 OpenQuester Pre-Build');
    print('');

    try {
      // Build packages first (if not skipped)
      if (!skipPackages) {
        final buildPackagesTask = BuildPackagesTask();
        await _executeTask(buildPackagesTask, currentDir);
      }

      // Generate files
      final genFilesTask = GenerateFilesTask();
      await _executeTask(genFilesTask, currentDir);

      // Generate locale
      final genLocaleTask = GenerateLocaleTask();
      await _executeTask(genLocaleTask, currentDir);

      // Generate indexes
      final genIndexesTask = GenerateIndexesTask();
      await _executeTask(genIndexesTask, currentDir);

      // Format code
      if (!skipFormat) {
        final formatTask = FormatTask();
        await _executeTask(formatTask, currentDir);
      }

      overallStopwatch.stop();
      print('');
      logger.success(
        '✓ Pre-Build Complete! Total time: ${_formatDuration(overallStopwatch.elapsed)}',
      );
    } catch (e) {
      overallStopwatch.stop();
      logger.err('✗ Pre-Build Failed after ${_formatDuration(overallStopwatch.elapsed)}');
      rethrow;
    }
  }

  Future<void> _executeTask(dynamic task, String workingDirectory) async {
    final progress = logger.progress('${task.name}');
    final stopwatch = Stopwatch()..start();

    try {
      final success = await task.execute(workingDirectory);
      stopwatch.stop();

      if (success) {
        progress.complete(
          '✓ ${task.description} (${_formatDuration(stopwatch.elapsed)})',
        );
      } else {
        progress.fail(
          '✗ ${task.description} failed (${_formatDuration(stopwatch.elapsed)})',
        );
        throw Exception('${task.name} failed');
      }
    } catch (e) {
      stopwatch.stop();
      progress.fail(
        '✗ ${task.description} failed (${_formatDuration(stopwatch.elapsed)})',
      );
      rethrow;
    }
  }

  String _formatDuration(Duration duration) {
    final minutes = duration.inMinutes;
    final seconds = duration.inSeconds % 60;
    final milliseconds = duration.inMilliseconds % 1000;

    if (minutes > 0) {
      return '${minutes}m ${seconds}s ${milliseconds}ms';
    } else if (seconds > 0) {
      return '${seconds}s ${milliseconds}ms';
    } else {
      return '${milliseconds}ms';
    }
  }
}
