import 'package:file_picker/file_picker.dart';
import 'package:openapi/openapi.dart';
import 'package:video_player/video_player.dart';

/// Reference to a media file selected for a question
/// Stores file path instead of bytes for memory efficiency
class MediaFileReference {
  MediaFileReference({
    required this.platformFile,
    required this.type,
    required this.order,
    int? displayTime,
  }) : displayTime = displayTime ?? 5000;

  /// Platform file reference (contains path, not bytes)
  final PlatformFile platformFile;

  /// Media type
  final PackageFileType type;

  /// Display duration in milliseconds
  int displayTime;

  /// Order in the list
  final int order;

  /// Shared video player controller for video/audio files
  /// This allows preview and dialog to use the same controller
  VideoPlayerController? sharedController;

  /// Get file name
  String get fileName => platformFile.name;

  /// Get file size
  int? get fileSize => platformFile.size;

  /// Get file extension
  String? get extension => platformFile.extension;

  /// Dispose shared controller if exists
  void disposeController() {
    sharedController?.dispose().ignore();
    sharedController = null;
  }
}
