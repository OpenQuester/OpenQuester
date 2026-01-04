import 'dart:io';

/// Global flag to disable puro (can be set from command arguments)
bool _disablePuroFromCommand = false;

/// Set whether to disable puro from command arguments
void setDisablePuroFromCommand(bool disable) {
  _disablePuroFromCommand = disable;
}

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
String getFlutterCommand() {
  return shouldUsePuro() ? 'puro flutter' : 'flutter';
}

/// Get the dart command with optional puro prefix
String getDartCommand() {
  return shouldUsePuro() ? 'puro dart' : 'dart';
}
