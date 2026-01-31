import 'dart:io';
import 'package:args/args.dart';
import 'package:mason_logger/mason_logger.dart';
import 'package:project_helper/build_task.dart';
import 'package:project_helper/utils.dart';
import 'package:path/path.dart' as p;
import 'dart:convert';

/// Task to format code with exceptions
class FormatExceptionTask implements BuildTask {
  @override
  String get name => 'format_exception';

  @override
  String get description =>
      'Format code with exception paths from format_exceptions.json';

  @override
  Future<bool> execute(
    String workingDirectory, {
    required Logger logger,
    required ArgResults? argResults,
    Progress? progress,
    bool verbose = false,
  }) async {
    progress?.update('Loading format exceptions...');

    // Check if format_exceptions.json exists
    final exceptionsFile = File(
      p.join(workingDirectory, 'format_exceptions.json'),
    );
    if (!await exceptionsFile.exists()) {
      logger.warn('⚠ No format_exceptions.json found, skipping...');
      return true;
    }

    try {
      // Read and parse the exceptions file
      final content = await exceptionsFile.readAsString();
      final settings = jsonDecode(content) as Map<String, dynamic>;
      final paths = (settings['paths'] as List<dynamic>)
          .map((e) => e.toString())
          .toSet()
          .toList();

      if (paths.isEmpty) {
        logger.info('No exception paths to format');
        return true;
      }

      progress?.update('Formatting exception paths...');
      if (verbose) {
        logger.info('Formatting ${paths.length} exception paths');
      }

      // Run dart format on the exception paths
      final command = getDartCommand();
      final result = await runCommand(
        [...command, 'format', ...paths],
        workingDirectory: workingDirectory,
        verbose: verbose,
        logger: logger,
      );

      if (result.exitCode != 0) {
        logger.err('✗ Format exception failed');
        return false;
      }

      if (verbose) logger.success('✓ Format exception completed');
      return true;
    } catch (e) {
      logger.err('✗ Error reading format_exceptions.json: $e');
      return false;
    }
  }
}
