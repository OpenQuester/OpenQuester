import 'dart:io';
import 'package:mason_logger/mason_logger.dart';
import 'package:path/path.dart' as p;
import 'package:project_helper/package_handler.dart';
import 'package:project_helper/utils.dart';

/// Custom handler for the openapi package
/// Removes lib/src folder and runs swagger_parser command
class OpenApiPackageHandler implements PackageHandler {
  @override
  String get packageName => 'openapi';

  @override
  Future<bool> execute(
    String packagePath, {
    required Logger logger,
    Progress? progress,
    bool verbose = false,
  }) async {
    progress?.update('OpenAPI: Preparing...');

    // Remove lib/src folder if it exists
    final libSrcPath = p.join(packagePath, 'lib', 'src');
    final libSrcDir = Directory(libSrcPath);

    if (await libSrcDir.exists()) {
      progress?.update('OpenAPI: Removing lib/src folder...');
      try {
        await libSrcDir.delete(recursive: true);
        if (verbose) logger.detail('✓ lib/src folder removed');
      } catch (e) {
        logger.err('✗ Failed to remove lib/src folder: $e');
        return false;
      }
    }

    // Run swagger_parser
    progress?.update('OpenAPI: Running swagger_parser...');
    final cmd = getDartCommand();
    final args = [...cmd, 'run', 'swagger_parser'];

    final result = await runCommand(
      args,
      workingDirectory: packagePath,
      verbose: verbose,
      logger: logger,
    );

    if (result.exitCode != 0) {
      logger.err('✗ swagger_parser failed');
      if (!verbose) logger.err(result.stderr.toString());
      return false;
    }

    if (verbose) logger.success('✓ swagger_parser completed successfully');
    return true;
  }
}
