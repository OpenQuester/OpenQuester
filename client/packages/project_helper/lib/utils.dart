import 'dart:io';
import 'package:mason_logger/mason_logger.dart';

/// Global flag to disable puro (can be set from command arguments)
bool _disablePuroFromCommand = false;

/// Set whether to disable puro from command arguments
void setDisablePuroFromCommand(bool disable) {
  _disablePuroFromCommand = disable;
}

/// Run a command and return the process result
Future<ProcessResult> runCommand(
  List<String> arguments, {
  String? workingDirectory,
  bool verbose = false,
  Logger? logger,
}) async {
  final executable = arguments.first;
  arguments.removeAt(0);
  final commandStr = '$executable ${arguments.join(' ')}';
  logger?.detail('Running: $commandStr');

  final process = await Process.start(
    executable,
    arguments,
    workingDirectory: workingDirectory,
    mode: verbose ? ProcessStartMode.inheritStdio : ProcessStartMode.normal,
  );

  final exitCode = await process.exitCode;

  if (verbose) {
    return ProcessResult(process.pid, exitCode, '', '');
  } else {
    final stdout = await process.stdout
        .transform(const SystemEncoding().decoder)
        .join();
    final stderr = await process.stderr
        .transform(const SystemEncoding().decoder)
        .join();
    return ProcessResult(process.pid, exitCode, stdout, stderr);
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
