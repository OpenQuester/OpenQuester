import 'dart:io';
import 'package:mason_logger/mason_logger.dart';
import 'package:path/path.dart' as p;
import 'package:project_helper/build_task.dart';
import 'package:project_helper/package_handler.dart';
import 'package:project_helper/handlers/openapi_handler.dart';
import 'package:project_helper/tasks/pre_build_task.dart';

/// Task to build packages by running pre_build on each
class BuildPackagesTask implements BuildTask {
  @override
  String get name => 'build_packages';

  @override
  String get description => 'Build all packages in packages/ directory';

  @override
  Future<bool> execute(
    String workingDirectory, {
    required Logger logger,
    Progress? progress,
    bool verbose = false,
  }) async {
    final packagesDir = Directory(p.join(workingDirectory, 'packages'));
    if (!await packagesDir.exists()) {
      logger.warn('⚠ No packages directory found, skipping...');
      return true;
    }

    // Custom handlers for specific packages
    final customHandlers = <String, PackageHandler>{
      'openapi': OpenApiPackageHandler(),
    };

    // Package priorities
    final packagePriorities = <String, int>{'openapi': -1};

    // Discover packages
    final packages = await _discoverPackages(packagesDir);
    if (packages.isEmpty) {
      logger.info('No packages found');
      return true;
    }

    // Group packages by priority
    final packagesByPriority = <int, List<String>>{};
    for (final packageName in packages) {
      final priority = packagePriorities[packageName] ?? 999;
      packagesByPriority.putIfAbsent(priority, () => []).add(packageName);
    }

    // Sort priorities
    final sortedPriorities = packagesByPriority.keys.toList()..sort();

    // Build packages in priority order
    for (final priority in sortedPriorities) {
      final packagesAtPriority = packagesByPriority[priority]!;

      if (verbose) {
        logger.info(
          'Building packages with priority $priority: ${packagesAtPriority.join(', ')}',
        );
      }

      // Build packages at the same priority concurrently
      final futures = packagesAtPriority.map((packageName) {
        final packagePath = p.join(workingDirectory, 'packages', packageName);
        return _buildPackage(
          packagePath,
          packageName,
          customHandlers[packageName],
          logger,
          progress,
          verbose,
        );
      });

      final results = await Future.wait(futures);

      // Check if all succeeded
      if (results.any((r) => !r)) {
        logger.err('✗ Some packages failed to build');
        return false;
      }
    }

    logger.success('✓ All packages built successfully');
    return true;
  }

  Future<List<String>> _discoverPackages(Directory packagesDir) async {
    final packages = <String>[];
    await for (final entity in packagesDir.list()) {
      if (entity is Directory) {
        final packageName = p.basename(entity.path);
        final pubspecFile = File(p.join(entity.path, 'pubspec.yaml'));
        if (await pubspecFile.exists()) {
          packages.add(packageName);
        }
      }
    }
    return packages;
  }

  Future<bool> _buildPackage(
    String packagePath,
    String packageName,
    PackageHandler? handler,
    Logger logger,
    Progress? progress,
    bool verbose,
  ) async {
    progress?.update('Building package: $packageName');
    if (verbose) logger.info('Building package: $packageName');

    // Run custom handler first if available
    if (handler != null) {
      if (verbose) logger.info('Using custom handler for $packageName');
      final result = await handler.execute(
        packagePath,
        logger: logger,
        progress: progress,
        verbose: verbose,
      );
      if (!result) {
        return false;
      }
    }

    // Run pre_build tasks for the package using PreBuildTask
    final preBuildTask = PreBuildTask();
    final success = await preBuildTask.execute(
      packagePath,
      logger: logger,
      progress: progress,
      verbose: verbose,
    );

    if (!success) {
      logger.err('✗ pre_build failed for $packageName');
      return false;
    }

    logger.success('✓ $packageName built successfully');
    return true;
  }
}

