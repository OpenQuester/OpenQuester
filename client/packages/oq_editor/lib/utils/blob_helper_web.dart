import 'dart:js_interop';
import 'dart:typed_data';

import 'package:universal_web/web.dart' as web;

/// Web implementation for creating blob URLs from bytes
String createBlobUrl(Uint8List bytes) {
  final blob = web.Blob([bytes.toJS].toJS);
  return web.URL.createObjectURL(blob);
}
