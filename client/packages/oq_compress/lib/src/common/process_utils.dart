import 'package:universal_io/io.dart';

Future<String?> runProcess(String executable, List<String> arguments) async {
  final result = await Process.run(
    executable,
    arguments,
  ).timeout(const Duration(minutes: 5));
  if (result.exitCode != 0) {
    final command = [executable, ...arguments].join(' ');
    final commandAndError = [command, result.stderr.toString()].join('\n');
    throw Exception(commandAndError);
  }
  return result.stdout.toString();
}
