import 'package:project_helper/command_runner.dart';

Future<void> main(List<String> arguments) async {
  final runner = OqHelperCommandRunner();
  await runner.run(arguments);
}
