import 'dart:io';
import 'package:mason_logger/mason_logger.dart';
import 'package:path/path.dart' as p;

/// Global flag to disable puro (can be set from command arguments)
bool _disablePuroFromCommand = false;

/// Set whether to disable puro from command arguments
void setDisablePuroFromCommand(bool disable) {
  _disablePuroFromCommand = disable;
}

/// Format a duration into a human-readable string
/// Returns format like "1m 23s 456ms", "45s 123ms", or "789ms"
String formatDuration(Duration duration) {
  final minutes = duration.inMinutes;
  final seconds = duration.inSeconds % 60;
  final milliseconds = duration.inMilliseconds % 1000;

  if (minutes > 0) {
    return '${minutes}m ${seconds}s ${milliseconds}ms';
  } else if (seconds > 0) {
    return '${seconds}s ${milliseconds}ms';
  } else {
    return '${milliseconds}ms';
  }
}

/// Run a command and return the process result
Future<ProcessResult> runCommand(
  List<String> arguments, {
  String? workingDirectory,
  bool verbose = false,
  Logger? logger,
}) async {
  final executable = arguments.first;
  final args = arguments.sublist(1); // Don't mutate the input list
  final commandStr = '$executable ${args.join(' ')}';
  logger?.detail('Running: $commandStr');

  final process = await Process.start(
    executable,
    args,
    workingDirectory: workingDirectory,
    mode: verbose ? ProcessStartMode.inheritStdio : ProcessStartMode.normal,
  );

  if (verbose) {
    final exitCode = await process.exitCode;
    return ProcessResult(process.pid, exitCode, '', '');
  } else {
    // Read stdout and stderr concurrently with waiting for exit code
    // to avoid blocking when buffers fill up
    final results = await Future.wait([
      process.stdout.transform(const SystemEncoding().decoder).join(),
      process.stderr.transform(const SystemEncoding().decoder).join(),
      process.exitCode,
    ]);

    return ProcessResult(
      process.pid,
      results[2] as int,
      results[0] as String,
      results[1] as String,
    );
  }
}

/// Check if puro should be used
/// Priority: command parameter > environment variable
bool shouldUsePuro() {
  // Command parameter takes precedence
  if (_disablePuroFromCommand) {
    return false;
  }

  // Check environment variable
  final dontUsePuro = Platform.environment['DONT_USE_PURO'];
  return dontUsePuro != 'true';
}

/// Get the flutter command with optional puro prefix
List<String> getFlutterCommand() {
  return shouldUsePuro() ? ['puro', 'flutter'] : ['flutter'];
}

/// Get the dart command with optional puro prefix
List<String> getDartCommand() {
  return shouldUsePuro() ? ['puro', 'dart'] : ['dart'];
}

/// Discover packages in a packages directory
/// Returns a list of package names that have a pubspec.yaml file
Future<List<String>> discoverPackages(Directory packagesDir) async {
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
