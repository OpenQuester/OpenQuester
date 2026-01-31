import 'dart:io';
import 'package:args/command_runner.dart';
import 'package:mason_logger/mason_logger.dart';
import 'package:project_helper/tasks/build_packages_task.dart';
import 'package:project_helper/utils.dart';

/// Command to build packages
class BuildPackagesCommand extends Command<void> {
  BuildPackagesCommand(this.logger) {
    argParser
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
      )
      ..addOption(
        'ignore-packages',
        abbr: 'i',
        defaultsTo: 'project_helper',
        help:
            'Comma-separated list of package names to ignore (default: project_helper)',
      );
  }

  final Logger logger;

  @override
  String get name => 'build_packages';

  @override
  String get description => 'Build all packages in packages/ directory';

  @override
  Future<void> run() async {
    final currentDir = Directory.current.path;
    final skipFormat = argResults?['skip-format'] as bool? ?? false;
    final noPuro = argResults?['no-puro'] as bool? ?? false;
    final verbose = argResults?['verbose'] as bool? ?? false;
    final ignorePackagesStr =
        argResults?['ignore-packages'] as String? ?? 'project_helper';
    final ignorePackages = ignorePackagesStr
        .split(',')
        .map((e) => e.trim())
        .where((e) => e.isNotEmpty)
        .toList();

    // Handle puro flag
    if (noPuro) {
      setDisablePuroFromCommand(true);
    }

    final task = BuildPackagesTask(
      skipFormat: skipFormat,
      ignorePackages: ignorePackages,
    );

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
