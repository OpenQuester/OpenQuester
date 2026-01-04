import 'package:mason_logger/mason_logger.dart';
import 'package:project_helper/command_runner.dart';

Future<void> main(List<String> arguments) async {
  final logger = Logger();
  final runner = OqHelperCommandRunner(logger: logger);
  
  try {
    await runner.run(arguments);
  } catch (e) {
    logger.err('$e');
    return;
  }
}
