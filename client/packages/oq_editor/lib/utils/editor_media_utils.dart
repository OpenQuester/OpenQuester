import 'dart:typed_data';

import 'package:file_picker/file_picker.dart';
import 'package:oq_editor/models/media_file_reference.dart';
import 'package:universal_io/io.dart';

/// Utilities for media file operations within the editor package
/// Consolidates common operations to reduce duplication
class EditorMediaUtils {
  /// Read bytes from MediaFileReference (web or native)
  /// Common utility used across editor controllers
  static Future<Uint8List> readMediaBytes(MediaFileReference media) async {
    final platformFile = media.platformFile;

    if (platformFile.bytes != null) {
      return platformFile.bytes!;
    }

    if (platformFile.path != null) {
      return File(platformFile.path!).readAsBytes();
    }

    throw Exception('Cannot read file bytes for: ${platformFile.name}');
  }

  /// Convert MediaFileReference map to bytes map
  /// Helper for processing media files before operations
  static Future<Map<String, Uint8List>> convertMediaFilesToBytes(
    Map<String, MediaFileReference> mediaFilesByHash,
  ) async {
    final filesBytesByHash = <String, Uint8List>{};

    for (final entry in mediaFilesByHash.entries) {
      final hash = entry.key;
      final mediaFile = entry.value;
      final bytes = await readMediaBytes(mediaFile);
      filesBytesByHash[hash] = bytes;
    }

    return filesBytesByHash;
  }

  /// Create MediaFileReference from file bytes
  /// Used when importing files and converting bytes back to references
  static MediaFileReference createMediaFileFromBytes({
    required String hash,
    required Uint8List bytes,
    String? originalName,
  }) {
    final platformFile = PlatformFile(
      name: originalName ?? hash,
      size: bytes.length,
      bytes: bytes,
    );

    return MediaFileReference(platformFile: platformFile);
  }
}
