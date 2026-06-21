import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:universal_io/io.dart';

final bool isDesktopPlatform =
    // ignore: avoid_bool_literals_in_conditional_expressions
    kIsWeb || kIsWasm
    ? true
    : Platform.isLinux || Platform.isWindows || Platform.isMacOS;

String hexToBase64(String hex) {
  // Convert the hex string into a list of bytes.
  final bytes = <int>[];
  for (var i = 0; i < hex.length; i += 2) {
    final byte = int.parse(hex.substring(i, i + 2), radix: 16);
    bytes.add(byte);
  }
  // Convert the list of bytes to a Base64 encoded string.
  return base64Encode(bytes);
}
