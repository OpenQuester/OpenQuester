import 'dart:io';
import 'package:path/path.dart' as p;
import 'package:yaml/yaml.dart';
import 'package:project_helper/package_handler.dart';
import 'package:project_helper/package_priority.dart';
import 'package:project_helper/utils.dart';

/// Builds packages with support for custom handlers and priorities
class PackageBuilder {
  PackageBuilder({
    required this.customHandlers,
    required this.packagePriorities,
  });

  final List<PackageHandler> customHandlers;
  final List<PackagePriority> packagePriorities;

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
    printSection('Building package: $packageName');

    // Check for custom handler
    final handler = getHandler(packageName);
    if (handler != null) {
      print('Using custom handler for $packageName');
      final result = await handler.execute(packagePath);
      if (!result) {
        return false;
      }
    }

    // Run build_runner
    print('Running build_runner...');
    final isFlutter = await isFlutterPackage(packagePath);
    final dartCmd = getDartCommand();

    List<String> buildArgs;
    if (isFlutter) {
      buildArgs = ['flutter', 'pub', 'run', 'build_runner', 'build', '-d'];
    } else {
      buildArgs = ['dart', 'run', 'build_runner', 'build', '-d'];
    }

    final result = await runCommand(
      dartCmd,
      buildArgs,
      workingDirectory: packagePath,
    );

    if (result.exitCode != 0) {
      print('✗ build_runner failed for $packageName');
      return false;
    }

    print('✓ $packageName built successfully');
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
      print('No packages found');
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

      print('');
      print('Building packages with priority $priority: ${packagesAtPriority.join(', ')}');

      // Build packages at the same priority concurrently
      final futures = packagesAtPriority.map((packageName) {
        final packagePath = p.join(basePath, 'packages', packageName);
        return buildPackage(packagePath, packageName);
      });

      final results = await Future.wait(futures);

      // Check if all succeeded
      if (results.any((r) => !r)) {
        print('✗ Some packages failed to build');
        return false;
      }
    }

    print('');
    print('✓ All packages built successfully');
    return true;
  }
}
