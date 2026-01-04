import 'dart:io';

/// Print a section header
void printSection(String title) {
  print('');
  print('========================================');
  print('  $title');
  print('========================================');
  print('');
}

/// Run a command and return the process result
Future<ProcessResult> runCommand(
  String executable,
  List<String> arguments, {
  String? workingDirectory,
  bool inheritStdio = true,
}) async {
  print('Running: $executable ${arguments.join(' ')}');

  if (inheritStdio) {
    final process = await Process.start(
      executable,
      arguments,
      workingDirectory: workingDirectory,
      mode: ProcessStartMode.inheritStdio,
    );
    final exitCode = await process.exitCode;
    return ProcessResult(process.pid, exitCode, '', '');
  } else {
    return await Process.run(
      executable,
      arguments,
      workingDirectory: workingDirectory,
    );
  }
}

/// Check if DONT_USE_PURO environment variable is set
bool shouldUsePuro() {
  final dontUsePuro = Platform.environment['DONT_USE_PURO'];
  return dontUsePuro != 'true';
}

/// Get the flutter/dart command with optional puro prefix
String getFlutterCommand() {
  return shouldUsePuro() ? 'puro' : 'flutter';
}

/// Get the dart command with optional puro prefix
String getDartCommand() {
  return shouldUsePuro() ? 'puro' : 'dart';
}
