import 'dart:io';
import 'package:mason_logger/mason_logger.dart';
import 'package:path/path.dart' as p;
import 'package:project_helper/build_task.dart';
import 'package:project_helper/utils.dart';

/// Task to format code
class FormatTask implements BuildTask {
  FormatTask({
    this.allPackages = false,
    this.fatalInfos = false,
    this.ignorePackages = const [],
  });

  final bool allPackages;
  final bool fatalInfos;
  final List<String> ignorePackages;

  @override
  String get name => 'format';

  @override
  String get description => 'Format Dart code';

  @override
  Future<bool> execute(
    String workingDirectory, {
    required Logger logger,
    Progress? progress,
    bool verbose = false,
  }) async {
    if (allPackages) {
      return await _formatAllPackages(
        workingDirectory,
        logger: logger,
        progress: progress,
        verbose: verbose,
      );
    } else {
      return await _formatSingleDirectory(
        workingDirectory,
        logger: logger,
        progress: progress,
        verbose: verbose,
      );
    }
  }

  Future<bool> _formatSingleDirectory(
    String workingDirectory, {
    required Logger logger,
    Progress? progress,
    bool verbose = false,
  }) async {
    if (verbose) logger.info('Formatting Code');

    progress?.update('Formatting code...');

    final command = getDartCommand();

    final testDir = Directory(p.join(workingDirectory, 'test'));
    final formatTestDir =
        await testDir.exists() && (await testDir.list().toList()).isNotEmpty;

    final args = [...command, 'format', 'lib', if (formatTestDir) 'test'];

    if (fatalInfos) {
      args.add('--set-exit-if-changed');
    }

    final result = await runCommand(
      args,
      workingDirectory: workingDirectory,
      verbose: verbose,
      logger: logger,
    );

    if (result.exitCode != 0) {
      logger.err('✗ Code formatting failed on directory: $workingDirectory');
      if (!verbose) logger.err(result.stderr.toString());
      return false;
    }

    if (verbose) logger.success('✓ Code formatted');
    return true;
  }

  Future<bool> _formatAllPackages(
    String workingDirectory, {
    required Logger logger,
    Progress? progress,
    bool verbose = false,
  }) async {
    if (verbose) logger.info('Formatting Code in all packages');

    // Format current directory first
    progress?.update('Formatting main directory...');
    final mainSuccess = await _formatSingleDirectory(
      workingDirectory,
      logger: logger,
      progress: null,
      verbose: verbose,
    );

    if (!mainSuccess) {
      return false;
    }

    // Discover and format packages
    final packagesDir = Directory(p.join(workingDirectory, 'packages'));
    if (!await packagesDir.exists()) {
      if (verbose) logger.info('No packages directory found');
      return true;
    }

    final packages = await discoverPackages(packagesDir);
    final filteredPackages = packages
        .where((pkg) => !ignorePackages.contains(pkg))
        .toList();

    if (ignorePackages.isNotEmpty && verbose) {
      logger.info('Ignoring packages: ${ignorePackages.join(', ')}');
    }

    if (filteredPackages.isEmpty) {
      if (verbose) logger.info('No packages to format');
      return true;
    }

    if (verbose) {
      logger.info('Formatting ${filteredPackages.length} packages...');
    }

    List<Future<bool>> formatFutures = [];

    // Format each package
    for (final packageName in filteredPackages) {
      final packagePath = p.join(packagesDir.path, packageName);
      progress?.update('Formatting $packageName...');

      formatFutures.add(
        _formatSingleDirectory(
          packagePath,
          logger: logger,
          progress: null,
          verbose: verbose,
        ),
      );
    }

    final formatResults = await Future.wait(formatFutures);
    if (formatResults.any((success) => !success)) {
      logger.err('✗ Code formatting failed in one or more packages');
      return false;
    }

    if (verbose) logger.success('✓ All packages formatted');
    return true;
  }
}
