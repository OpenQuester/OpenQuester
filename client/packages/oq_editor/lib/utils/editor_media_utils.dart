import 'dart:typed_data';

import 'package:oq_editor/models/media_file_reference.dart';
import 'package:oq_shared/oq_shared.dart';

/// Utilities for media file operations within the editor package
/// Consolidates common operations to reduce duplication
class EditorMediaUtils {
  /// Convert MediaFileReference map to bytes map
  /// Helper for processing media files before operations
  static Future<Map<String, Uint8List>> convertMediaFilesToBytes(
    Map<String, MediaFileReference> mediaFilesByHash,
  ) async {
    final filesBytesByHash = <String, Uint8List>{};

    for (final entry in mediaFilesByHash.entries) {
      final hash = entry.key;
      final mediaFile = entry.value;
      final bytes = await mediaFile.platformFile.readBytes();
      filesBytesByHash[hash] = bytes;
    }

    return filesBytesByHash;
  }

  /// Convert bytes map to MediaFileReference map
  /// Used when importing files and converting bytes back to references
  static Map<String, MediaFileReference> convertBytesToMediaFiles(
    Map<String, Uint8List> mediaFilesByHash,
  ) {
    final filesBytesByHash = <String, MediaFileReference>{};

    for (final entry in mediaFilesByHash.entries) {
      final hash = entry.key;
      final bytes = createMediaFileFromBytes(bytes: entry.value, hash: hash);
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
    final platformFile = SharedMediaFileUtils.createPlatformFileFromBytes(
      name: originalName ?? hash,
      bytes: bytes,
    );

    return MediaFileReference(platformFile: platformFile);
  }
}
