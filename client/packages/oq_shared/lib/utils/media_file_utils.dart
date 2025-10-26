import 'dart:typed_data';

import 'package:file_picker/file_picker.dart';
import 'package:oq_shared/utils/extensions.dart';

/// Shared utilities for media file operations
/// Used across packages to eliminate code duplication
class SharedMediaFileUtils {
  /// Read bytes from PlatformFile (web or native)
  /// Common utility used across all packages
  static Future<Uint8List> readMediaBytes(PlatformFile platformFile) async {
    return platformFile.readBytes();
  }

  /// Create PlatformFile from bytes
  /// Used when importing files and converting bytes back to platform files
  static PlatformFile createPlatformFileFromBytes({
    required String name,
    required Uint8List bytes,
  }) {
    return PlatformFile(
      name: name,
      size: bytes.length,
      bytes: bytes,
    );
  }
}
