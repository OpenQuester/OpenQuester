import 'dart:convert';

import 'package:universal_io/io.dart';

Future<int> main() async {
  final settings =
      jsonDecode(File('format_exceptions.json').readAsStringSync())
          as Map<String, dynamic>;
  final paths = (settings['paths'] as List<dynamic>)
      .map((e) => e.toString())
      .toSet();
  final result = await Process.run('dart', ['format', ...paths]);
  // ignore: avoid_print
  print(result.stdout);
  return 0;
}
