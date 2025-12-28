import 'package:file_picker/file_picker.dart';
import 'package:openapi/openapi.dart';
import 'package:oq_editor/models/media_file_reference.dart';
import 'package:video_player/video_player.dart';

/// UI wrapper for media file with metadata
/// Used in question editor dialog to track file metadata before saving
class UiMediaFile {
  UiMediaFile({
    required this.reference,
    required this.type,
    required this.order,
    int? displayTime,
  }) : displayTime = displayTime ?? 5000;

  /// The underlying file reference (for hash calculation and upload)
  final MediaFileReference reference;

  /// Media type (UI metadata, will be stored in PackageQuestionFile)
  final PackageFileType type;

  /// Display duration in milliseconds (UI metadata)
  int displayTime;

  /// Order in the list (UI metadata)
  final int order;

  /// Convenience getters that delegate to the underlying reference
  String get fileName => reference.fileName;
  int? get fileSize => reference.fileSize;
  String? get extension => reference.extension;
  PlatformFile get platformFile => reference.platformFile;

  /// Video controller (only for video/audio files)
  VideoPlayerController? get sharedController => reference.sharedController;
  set sharedController(VideoPlayerController? controller) {
    reference.sharedController = controller;
  }

  /// Dispose video controller if exists
  Future<void> disposeController() async {
    await reference.disposeController();
  }
}
