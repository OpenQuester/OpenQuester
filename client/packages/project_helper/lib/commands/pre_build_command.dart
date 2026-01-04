import 'dart:io';
import 'package:args/command_runner.dart';
import 'package:path/path.dart' as p;
import 'package:project_helper/package_builder.dart';
import 'package:project_helper/package_priority.dart';
import 'package:project_helper/handlers/openapi_handler.dart';
import 'package:project_helper/utils.dart';

/// Command to run the full pre-build process
class PreBuildCommand extends Command<void> {
  PreBuildCommand() {
    argParser.addFlag(
      'skip-packages',
      negatable: false,
      help: 'Skip building packages',
    );
    argParser.addFlag(
      'skip-format',
      negatable: false,
      help: 'Skip code formatting',
    );
  }

  @override
  String get name => 'pre_build';

  @override
  String get description => 'Run the full pre-build process';

  @override
  Future<void> run() async {
    final currentDir = Directory.current.path;
    final skipPackages = argResults?['skip-packages'] as bool? ?? false;
    final skipFormat = argResults?['skip-format'] as bool? ?? false;

    printSection('OpenQuester Pre-Build');

    // Configure package builder
    final packageBuilder = PackageBuilder(
      customHandlers: [
        OpenApiPackageHandler(),
      ],
      packagePriorities: [
        const PackagePriority('openapi', -1),
      ],
    );

    // Build packages first (if not skipped and packages exist)
    if (!skipPackages) {
      final packagesDir = Directory(p.join(currentDir, 'packages'));
      if (await packagesDir.exists()) {
        printSection('Building Packages');
        final success = await packageBuilder.buildPackages(currentDir);
        if (!success) {
          throw Exception('Package build failed');
        }
      }
    }

    // Run pre_run tasks
    await _runPreRun(currentDir);

    // Generate indexes
    await _generateIndexes(currentDir);

    // Format code
    if (!skipFormat) {
      await _formatCode(currentDir);
    }

    printSection('Pre-Build Complete!');
  }

  Future<void> _runPreRun(String currentDir) async {
    printSection('Running Pre-Run Tasks');

    // Generate files (build_runner)
    await _generateFiles(currentDir);

    // Generate workers (if web workers exist)
    await _generateWorkers(currentDir);

    // Generate locale (if localization assets exist)
    await _generateLocale(currentDir);
  }

  Future<void> _generateFiles(String currentDir) async {
    print('Running build_runner...');

    final isFlutter = await _isFlutterPackage(currentDir);
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
      workingDirectory: currentDir,
    );

    if (result.exitCode != 0) {
      throw Exception('build_runner failed');
    }

    print('✓ build_runner completed');
  }

  Future<void> _generateWorkers(String currentDir) async {
    // Check if workers directory exists
    final workersDir = Directory(p.join(currentDir, 'lib', 'workers'));
    if (!await workersDir.exists()) {
      return;
    }

    print('Generating web workers...');

    // For now, just check if workers exist - the actual compilation
    // would need specific worker files defined
    print('⚠ Web workers compilation not yet implemented in oqhelper');
  }

  Future<void> _generateLocale(String currentDir) async {
    // Check if localization directory exists
    final localeDir = Directory(p.join(currentDir, 'assets', 'localization'));
    if (!await localeDir.exists()) {
      return;
    }

    print('Generating localization keys...');

    final dartCmd = getDartCommand();
    final result = await runCommand(
      dartCmd,
      [
        'flutter',
        'pub',
        'run',
        'easy_localization:generate',
        '-f',
        'keys',
        '-o',
        'locale_keys.g.dart',
        '-S',
        'assets/localization/',
      ],
      workingDirectory: currentDir,
    );

    if (result.exitCode != 0) {
      throw Exception('Locale generation failed');
    }

    print('✓ Localization keys generated');
  }

  Future<void> _generateIndexes(String currentDir) async {
    printSection('Generating Index Files');

    final dartCmd = getDartCommand();

    // Install index_generator if needed
    print('Ensuring index_generator is available...');
    await runCommand(
      dartCmd,
      ['dart', 'pub', 'global', 'activate', 'index_generator'],
      workingDirectory: currentDir,
    );

    // Run index_generator
    print('Running index_generator...');
    final result = await runCommand(
      dartCmd,
      ['flutter', 'pub', 'global', 'run', 'index_generator'],
      workingDirectory: currentDir,
    );

    if (result.exitCode != 0) {
      throw Exception('Index generation failed');
    }

    print('✓ Index files generated');
  }

  Future<void> _formatCode(String currentDir) async {
    printSection('Formatting Code');

    final dartCmd = getDartCommand();
    final result = await runCommand(
      dartCmd,
      ['dart', 'format', 'lib', 'packages/*/lib'],
      workingDirectory: currentDir,
    );

    if (result.exitCode != 0) {
      throw Exception('Code formatting failed');
    }

    print('✓ Code formatted');
  }

  Future<bool> _isFlutterPackage(String packagePath) async {
    final pubspecFile = File(p.join(packagePath, 'pubspec.yaml'));
    if (!await pubspecFile.exists()) {
      return false;
    }

    try {
      final content = await pubspecFile.readAsString();
      return content.contains('sdk: flutter');
    } catch (e) {
      return false;
    }
  }
}
