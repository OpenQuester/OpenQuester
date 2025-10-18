import 'package:crypto/crypto.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/foundation.dart';
import 'package:universal_io/io.dart';
import 'package:video_player/video_player.dart';

/// Reference to a media file selected for a question
/// Stores file path instead of bytes for memory efficiency
/// Type, order, and displayTime are stored in PackageQuestionFile models
class MediaFileReference {
  MediaFileReference({
    required this.platformFile,
  });

  /// Platform file reference (contains path, not bytes)
  final PlatformFile platformFile;

  /// Shared video player controller for video/audio files
  /// This allows preview and dialog to use the same controller
  VideoPlayerController? sharedController;

  /// Cached MD5 hash
  String? _cachedHash;

  /// Get file name
  String get fileName => platformFile.name;

  /// Get file size
  int? get fileSize => platformFile.size;

  /// Get file extension
  String? get extension => platformFile.extension;

  /// Calculate MD5 hash of file content
  /// Caches the result to avoid recalculation
  Future<String> calculateHash() async {
    if (_cachedHash != null) return _cachedHash!;

    final bytes = platformFile.bytes;
    if (bytes != null) {
      _cachedHash = await compute(
        (bytes) => md5.convert(bytes).toString(),
        bytes,
      );
    } else if (platformFile.path != null) {
      // Read file from path if bytes not available
      final file = await _readAndHash(platformFile.path!);
      _cachedHash = file;
    } else {
      throw Exception('Cannot calculate hash: no bytes or path available');
    }

    return _cachedHash!;
  }

  /// Dispose shared controller if exists
  Future<void> disposeController() async {
    await sharedController?.dispose();
    sharedController = null;
  }

  /// Helper function for compute isolate
  static Future<String> _readAndHash(String path) async {
    final bytes = await File(path).readAsBytes();
    return compute((bytes) => md5.convert(bytes).toString(), bytes);
  }
}
