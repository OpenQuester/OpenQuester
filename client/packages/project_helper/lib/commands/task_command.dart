import 'dart:io';
import 'package:args/command_runner.dart';
import 'package:mason_logger/mason_logger.dart';
import 'package:project_helper/build_task.dart';
import 'package:project_helper/utils.dart';

/// Base class for task commands
abstract class TaskCommand extends Command<void> {
  TaskCommand(this.task, this.logger) {
    argParser.addFlag(
      'no-puro',
      abbr: 'n',
      negatable: false,
      help: 'Disable puro (use system Flutter/Dart)',
    );
  }

  final BuildTask task;
  final Logger logger;

  @override
  String get name => task.name;

  @override
  String get description => task.description;

  @override
  Future<void> run() async {
    final currentDir = Directory.current.path;
    
    // Handle puro flag
    final noPuro = argResults?['no-puro'] as bool? ?? false;
    if (noPuro) {
      setDisablePuroFromCommand(true);
    }

    final progress = logger.progress('Running ${task.name}');
    final stopwatch = Stopwatch()..start();

    try {
      final success = await task.execute(currentDir);
      stopwatch.stop();

      if (success) {
        progress.complete('✓ ${task.description} completed in ${_formatDuration(stopwatch.elapsed)}');
      } else {
        progress.fail('✗ ${task.description} failed after ${_formatDuration(stopwatch.elapsed)}');
        throw Exception('Task failed');
      }
    } catch (e) {
      stopwatch.stop();
      progress.fail('✗ ${task.description} failed after ${_formatDuration(stopwatch.elapsed)}');
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
