import 'dart:io';
import 'package:mason_logger/mason_logger.dart';
import 'package:project_helper/command_runner.dart';

Future<void> main(List<String> arguments) async {
  final logger = Logger();
  final runner = OqHelperCommandRunner(logger: logger);

  // Setup signal handling for graceful shutdown on Ctrl+C
  ProcessSignal.sigint.watch().listen((signal) {
    logger.warn('\n✗ Interrupted by user (Ctrl+C)');
    exit(130); // Standard exit code for SIGINT
  });

  try {
    await runner.run(arguments);
    exit(0); // Exit successfully after command completes
  } catch (e) {
    logger.err('$e');
    exit(1);
  }
}
