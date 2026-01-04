import 'dart:io';
import 'package:path/path.dart' as p;
import 'package:project_helper/build_task.dart';
import 'package:project_helper/package_builder.dart';
import 'package:project_helper/package_priority.dart';
import 'package:project_helper/handlers/openapi_handler.dart';

/// Task to build packages
class BuildPackagesTask implements BuildTask {
  @override
  String get name => 'build_packages';

  @override
  String get description => 'Build all packages in packages/ directory';

  @override
  Future<bool> execute(String workingDirectory) async {
    final packagesDir = Directory(p.join(workingDirectory, 'packages'));
    if (!await packagesDir.exists()) {
      print('⚠ No packages directory found, skipping...');
      return true;
    }

    // Configure package builder
    final packageBuilder = PackageBuilder(
      customHandlers: [
        OpenApiPackageHandler(),
      ],
      packagePriorities: [
        const PackagePriority('openapi', -1),
      ],
    );

    final success = await packageBuilder.buildPackages(workingDirectory);
    return success;
  }
}
