import 'dart:io';
import 'package:mason_logger/mason_logger.dart';
import 'package:path/path.dart' as p;
import 'package:yaml/yaml.dart';
import 'package:project_helper/package_handler.dart';
import 'package:project_helper/package_priority.dart';
import 'package:project_helper/utils.dart';
import 'package:project_helper/tasks/gen_files_task.dart';

/// Builds packages with support for custom handlers and priorities
class PackageBuilder {
  PackageBuilder({
    required this.customHandlers,
    required this.packagePriorities,
    required this.logger,
    this.progress,
    this.verbose = false,
  });

  final List<PackageHandler> customHandlers;
  final List<PackagePriority> packagePriorities;
  final Logger logger;
  final Progress? progress;
  final bool verbose;

  /// Get priority for a package
  int getPriority(String packageName) {
    final priority = packagePriorities
        .where((p) => p.packageName == packageName)
        .firstOrNull;
    return priority?.priority ?? PackagePriority.defaultPriority;
  }

  /// Get custom handler for a package
  PackageHandler? getHandler(String packageName) {
    return customHandlers
        .where((h) => h.packageName == packageName)
        .firstOrNull;
  }

  /// Check if a directory contains a Dart/Flutter package
  Future<bool> isDartPackage(String path) async {
    final pubspecFile = File(p.join(path, 'pubspec.yaml'));
    return await pubspecFile.exists();
  }

  /// Check if a package uses Flutter
  Future<bool> isFlutterPackage(String packagePath) async {
    final pubspecFile = File(p.join(packagePath, 'pubspec.yaml'));
    if (!await pubspecFile.exists()) {
      return false;
    }

    try {
      final content = await pubspecFile.readAsString();
      final yaml = loadYaml(content) as Map;
      final dependencies = yaml['dependencies'] as Map?;
      return dependencies?.containsKey('flutter') ?? false;
    } catch (e) {
      return false;
    }
  }

  /// Build a single package
  Future<bool> buildPackage(String packagePath, String packageName) async {
    progress?.update('Building package: $packageName');
    if (verbose) logger.info('Building package: $packageName');

    // Check for custom handler
    final handler = getHandler(packageName);
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

    // Run build_runner
    progress?.update('Running build_runner for $packageName...');

    final genFilesTask = GenerateFilesTask();
    final result = await genFilesTask.execute(
      packagePath,
      logger: logger,
      progress: progress,
      verbose: verbose,
    );

    if (!result) {
      logger.err('✗ build_runner failed for $packageName');
      return false;
    }

    logger.success('✓ $packageName built successfully');
    return true;
  }

  /// Discover packages in a directory
  Future<List<String>> discoverPackages(String basePath) async {
    final packagesDir = Directory(p.join(basePath, 'packages'));
    if (!await packagesDir.exists()) {
      return [];
    }

    final packages = <String>[];
    await for (final entity in packagesDir.list()) {
      if (entity is Directory) {
        final packageName = p.basename(entity.path);
        if (await isDartPackage(entity.path)) {
          packages.add(packageName);
        }
      }
    }

    return packages;
  }

  /// Build packages with priority ordering
  Future<bool> buildPackages(String basePath) async {
    final packages = await discoverPackages(basePath);

    if (packages.isEmpty) {
      logger.warn('No packages found');
      return true;
    }

    // Group packages by priority
    final packagesByPriority = <int, List<String>>{};
    for (final packageName in packages) {
      final priority = getPriority(packageName);
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
        final packagePath = p.join(basePath, 'packages', packageName);
        return buildPackage(packagePath, packageName);
      });

      final results = await Future.wait(futures);

      // Check if all succeeded
      if (results.any((r) => !r)) {
        logger.err('✗ Some packages failed to build');
        return false;
      }
    }

    if (verbose) logger.success('✓ All packages built successfully');
    return true;
  }
}
