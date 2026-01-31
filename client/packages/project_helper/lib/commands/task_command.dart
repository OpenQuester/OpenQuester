import 'dart:io';
import 'package:args/command_runner.dart';
import 'package:mason_logger/mason_logger.dart';
import 'package:project_helper/build_task.dart';
import 'package:project_helper/utils.dart';

/// Base class for task commands
abstract class TaskCommand extends Command<void> {
  TaskCommand(this.task, this.logger) {
    setupArgs();
  }

  final BuildTask task;
  final Logger logger;

  @override
  String get name => task.name;

  @override
  String get description => task.description;

  void setupArgs() {
    argParser
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

    // Handle puro flag
    final noPuro = argResults?['no-puro'] as bool? ?? false;
    if (noPuro) {
      setDisablePuroFromCommand(true);
    }

    final verbose = argResults?['verbose'] as bool? ?? false;

    final progress = logger.progress('Running ${task.name}');
    final stopwatch = Stopwatch()..start();

    try {
      final success = await task.execute(
        currentDir,
        logger: logger,
        progress: progress,
        verbose: verbose,
        argResults: argResults,
      );
      stopwatch.stop();

      if (success) {
        progress.complete(
          '✓ ${task.description} completed in ${formatDuration(stopwatch.elapsed)}',
        );
      } else {
        progress.fail(
          '✗ ${task.description} failed after ${formatDuration(stopwatch.elapsed)}',
        );
        throw Exception('Task failed');
      }
    } catch (e) {
      stopwatch.stop();
      progress.fail(
        '✗ ${task.description} failed after ${formatDuration(stopwatch.elapsed)}',
      );
      rethrow;
    }
  }
}
