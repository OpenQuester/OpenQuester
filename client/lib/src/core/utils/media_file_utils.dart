import 'dart:typed_data';

import 'package:oq_editor/models/media_file_reference.dart';
import 'package:oq_shared/oq_shared.dart';

/// Utility class for media file operations
/// Provides common file reading functionality used across controllers
class MediaFileUtils {
  /// Read bytes from MediaFileReference (web or native)
  /// Handles both in-memory bytes and file path scenarios
  static Future<Uint8List> readMediaBytes(MediaFileReference media) async {
    return SharedMediaFileUtils.readMediaBytes(media.platformFile);
  }

  /// Convert MediaFileReference map to bytes map
  /// Helper for processing media files before upload
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
}
