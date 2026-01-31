import 'dart:io';
import 'package:args/command_runner.dart';
import 'package:mason_logger/mason_logger.dart';
import 'package:project_helper/tasks/format_task.dart';
import 'package:project_helper/utils.dart';

/// Command to format code
class FormatCommand extends Command<void> {
  FormatCommand(this.logger) {
    argParser
      ..addFlag(
        'all-packages',
        abbr: 'a',
        negatable: false,
        help: 'Format all packages in packages/ directory',
      )
      ..addFlag(
        'fatal-infos',
        negatable: false,
        help: 'Treat info level issues as fatal',
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
        defaultsTo: 'project_helper,openapi',
        help:
            'Comma-separated list of package names to ignore (default: project_helper,openapi)',
      );
  }

  final Logger logger;

  @override
  String get name => 'format';

  @override
  String get description => 'Format Dart code';

  @override
  Future<void> run() async {
    final currentDir = Directory.current.path;
    final allPackages = argResults?['all-packages'] as bool? ?? false;
    final fatalInfos = argResults?['fatal-infos'] as bool? ?? false;
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

    final startTime = DateTime.now();
    final progress = logger.progress('Formatting code');

    try {
      final task = FormatTask(
        allPackages: allPackages,
        fatalInfos: fatalInfos,
        ignorePackages: ignorePackages,
      );

      final success = await task.execute(
        currentDir,
        logger: logger,
        progress: progress,
        verbose: verbose,
        argResults: argResults,
      );

      final duration = DateTime.now().difference(startTime);
      progress.complete(
        success
            ? '✓ Code formatted! Time: ${formatDuration(duration)}'
            : '✗ Code formatting failed! Time: ${formatDuration(duration)}',
      );

      if (!success) {
        exit(1);
      }
    } catch (e) {
      progress.fail('✗ Code formatting failed: $e');
      exit(1);
    }
  }
}
