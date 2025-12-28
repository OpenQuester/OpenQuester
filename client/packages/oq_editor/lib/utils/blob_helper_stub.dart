import 'dart:typed_data';

/// Stub implementation for non-web platforms
String createBlobUrl(Uint8List bytes) {
  throw UnsupportedError('Blob URLs are only supported on web platforms');
}
