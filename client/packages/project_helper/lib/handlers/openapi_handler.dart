import 'dart:io';
import 'package:path/path.dart' as p;
import 'package:project_helper/package_handler.dart';
import 'package:project_helper/utils.dart';

/// Custom handler for the openapi package
/// Removes lib/src folder and runs swagger_parser command
class OpenApiPackageHandler implements PackageHandler {
  @override
  String get packageName => 'openapi';

  @override
  Future<bool> execute(String packagePath) async {
    printSection('OpenAPI Package Handler');

    // Remove lib/src folder if it exists
    final libSrcPath = p.join(packagePath, 'lib', 'src');
    final libSrcDir = Directory(libSrcPath);

    if (await libSrcDir.exists()) {
      print('Removing lib/src folder...');
      try {
        await libSrcDir.delete(recursive: true);
        print('✓ lib/src folder removed');
      } catch (e) {
        print('✗ Failed to remove lib/src folder: $e');
        return false;
      }
    }

    // Run swagger_parser
    print('Running swagger_parser...');
    final result = await runCommand(
      'dart',
      ['run', 'swagger_parser'],
      workingDirectory: packagePath,
    );

    if (result.exitCode != 0) {
      print('✗ swagger_parser failed');
      return false;
    }

    print('✓ swagger_parser completed successfully');
    return true;
  }
}
