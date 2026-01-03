import 'dart:async';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:openapi/openapi.dart';
import 'package:oq_editor/models/media_file_reference.dart';
import 'package:oq_editor/models/ui_media_file.dart';
import 'package:oq_editor/view/dialogs/media_preview_dialog.dart';
import 'package:oq_editor/view/widgets/media_playback_widget.dart';
import 'package:oq_shared/oq_shared.dart';
import 'package:universal_io/io.dart';

/// Widget to preview media files (images, videos, audio)
class MediaPreviewWidget extends StatefulWidget {
  const MediaPreviewWidget({
    required this.mediaFile,
    required this.type,
    this.size = 80,
    this.fit = BoxFit.cover,
    this.enablePlayback = false,
    this.enableControls = false,
    this.showControls = true,
    this.interactive = false,
    this.autoPlay = false,
    this.onVolumeChanged,
    this.onTap,
    this.onControllerInitialized,
    super.key,
  });

  /// Creates a preview widget from a URL
  MediaPreviewWidget.fromUrl({
    required String url,
    required this.type,
    this.size = 80,
    this.fit = BoxFit.cover,
    this.enablePlayback = false,
    this.enableControls = false,
    this.showControls = true,
    this.interactive = false,
    this.autoPlay = false,
    this.onVolumeChanged,
    this.onTap,
    this.onControllerInitialized,
    super.key,
  }) : mediaFile = MediaFileReference(
         platformFile: PlatformFile(name: 'remote', size: 0),
         url: url,
       );

  final MediaFileReference? mediaFile;
  final PackageFileType type;
  final double? size;
  final BoxFit fit;

  /// If true, video/audio will have players
  final bool enablePlayback;

  /// If true, video/audio will have players with controls
  final bool enableControls;

  /// If true, video/audio will show internal controls (if enableControls is true)
  final bool showControls;

  /// If true, images will have InteractiveViewer for zoom
  final bool interactive;

  /// If true, video/audio will start playing automatically
  final bool autoPlay;

  /// Callback when volume changes (0.0 to 1.0)
  final ValueChanged<double>? onVolumeChanged;

  /// Callback when the widget is tapped. If null, opens MediaPreviewDialog
  final VoidCallback? onTap;

  /// Callback when the media controller is initialized
  final VoidCallback? onControllerInitialized;

  @override
  State<MediaPreviewWidget> createState() => _MediaPreviewWidgetState();
}

class _MediaPreviewWidgetState extends State<MediaPreviewWidget> {
  bool _showControls = false;
  bool _forcePlay = false;
  Timer? _hideTimer;

  @override
  void dispose() {
    _hideTimer?.cancel();
    super.dispose();
  }

  void _startHideTimer() {
    _hideTimer?.cancel();
    _hideTimer = Timer(const Duration(milliseconds: 1500), () {
      if (mounted) setState(() => _showControls = false);
    });
  }

  @override
  Widget build(BuildContext context) {
    // For fullscreen playback mode, don't add the container wrapper
    if (widget.enableControls &&
        (widget.type == PackageFileType.video ||
            widget.type == PackageFileType.audio)) {
      final content = _buildPreviewContent(context);
      if (widget.size != null) {
        return SizedBox(
          width: widget.size,
          height: widget.size,
          child: content,
        );
      }
      return content;
    }

    return GestureDetector(
      onTap: () {
        if (_showControls) {
          if (!widget.enablePlayback) {
            unawaited(_handleTap(context));
          } else {
            setState(() => _showControls = false);
          }
        } else {
          setState(() => _showControls = true);
          _startHideTimer();
        }
      },
      child: MouseRegion(
        onEnter: (_) {
          _hideTimer?.cancel();
          setState(() => _showControls = true);
        },
        onExit: (_) => setState(() => _showControls = false),
        child: Container(
          width: widget.size,
          height: widget.size,
          decoration: BoxDecoration(
            color: Theme.of(context).colorScheme.surfaceContainerHighest,
            borderRadius: BorderRadius.circular(8),
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: Stack(
              fit: StackFit.expand,
              children: [
                _buildPreviewContent(context),
                // Hover/Touch overlay
                if (_showControls)
                  Positioned.fill(
                    child: Container(
                      decoration: BoxDecoration(
                        color: Colors.black.withValues(alpha: 0.5),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Stack(
                        children: [
                          // Center Play Button (Audio/Video)
                          if (widget.type == PackageFileType.video ||
                              widget.type == PackageFileType.audio)
                            Center(
                              child: IconButton(
                                icon: Icon(
                                  (widget
                                              .mediaFile
                                              ?.sharedController
                                              ?.value
                                              .isPlaying ??
                                          false)
                                      ? Icons.pause_circle_outline
                                      : Icons.play_circle_outline,
                                  color: Colors.white,
                                  size: (widget.size ?? 80) * 0.4,
                                ),
                                onPressed: () {
                                  final controller =
                                      widget.mediaFile?.sharedController;
                                  if (controller != null &&
                                      controller.value.isInitialized) {
                                    if (controller.value.isPlaying) {
                                      unawaited(controller.pause());
                                    } else {
                                      unawaited(controller.play());
                                    }
                                    // Refresh UI to update icon
                                    setState(() {});
                                  } else {
                                    // Initialize and play
                                    setState(() {
                                      _forcePlay = true;
                                    });
                                  }
                                  // Reset timer on interaction
                                  _startHideTimer();
                                },
                              ),
                            ),

                          // Top Right Open Button
                          Positioned(
                            top: 0,
                            right: 0,
                            child: IconButton(
                              icon: Icon(
                                Icons.open_in_full,
                                color: Colors.white,
                                size: (widget.size ?? 80) * 0.25,
                              ),
                              onPressed: () => _handleTap(context),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _handleTap(BuildContext context) async {
    if (widget.onTap != null) {
      widget.onTap!();
    } else {
      // Default behavior: open preview dialog
      if (widget.mediaFile != null) {
        await MediaPreviewDialog.show(
          context,
          UiMediaFile(
            reference: widget.mediaFile!,
            type: widget.type,
            order: 0,
          ),
        );
      }
    }
  }

  Widget _buildPreviewContent(BuildContext context) {
    switch (widget.type) {
      case PackageFileType.image:
        return _buildImagePreview();
      case PackageFileType.video:
        return _buildVideoPreview(context);
      case PackageFileType.audio:
        return _buildAudioPreview(context);
      case PackageFileType.$unknown:
        return _buildDefaultPreview(context);
    }
  }

  Widget _buildImagePreview() {
    // Use URL if available (from remote or MediaFileReference)
    final url = widget.mediaFile?.url;

    Widget imageWidget;
    if (url != null) {
      imageWidget = ImageWidget(
        url: url,
        fit: widget.fit,
        placeholder: _buildErrorPreview(),
      );
    } else {
      // Use bytes if available (works on both web and native)
      final bytes = widget.mediaFile?.platformFile.bytesSync;
      if (bytes != null) {
        imageWidget = Image.memory(
          bytes,
          fit: widget.fit,
          errorBuilder: (context, error, stackTrace) => _buildErrorPreview(),
        );
      } else if (!kIsWeb && widget.mediaFile?.platformFile.path != null) {
        // On native platforms, use file path if bytes not available
        imageWidget = Image.file(
          File(widget.mediaFile!.platformFile.path!),
          fit: widget.fit,
          errorBuilder: (context, error, stackTrace) => _buildErrorPreview(),
        );
      } else {
        return _buildErrorPreview();
      }
    }

    // Wrap with InteractiveViewer for fullscreen mode
    if (widget.interactive) {
      return InteractiveViewer(child: imageWidget);
    }

    return imageWidget;
  }

  Widget _buildVideoPreview(BuildContext context) {
    // For file/URL previews without playback, use existing widget
    if (widget.mediaFile != null) {
      return MediaPlaybackWidget(
        mediaFile: widget.mediaFile!,
        type: PackageFileType.video,
        size: widget.size,
        enableControls: widget.enableControls,
        showControls: widget.showControls,
        autoPlay: widget.autoPlay || _forcePlay,
        onVolumeChanged: widget.onVolumeChanged,
        onControllerInitialized: () {
          if (mounted) setState(() {});
          widget.onControllerInitialized?.call();
        },
      );
    }

    return _buildErrorPreview();
  }

  Widget _buildAudioPreview(BuildContext context) {
    // For file/URL previews without playback, use existing widget
    if (widget.mediaFile != null) {
      return MediaPlaybackWidget(
        mediaFile: widget.mediaFile!,
        type: PackageFileType.audio,
        size: widget.size,
        enableControls: widget.enableControls,
        showControls: widget.showControls,
        autoPlay: widget.autoPlay || _forcePlay,
        onVolumeChanged: widget.onVolumeChanged,
        onControllerInitialized: () {
          if (mounted) setState(() {});
          widget.onControllerInitialized?.call();
        },
      );
    }

    return _buildErrorPreview();
  }

  Widget _buildDefaultPreview(BuildContext context) {
    return Center(
      child: Icon(
        Icons.file_present,
        size: (widget.size ?? 80) * 0.5,
        color: Theme.of(context).colorScheme.onSurfaceVariant,
      ),
    );
  }

  Widget _buildErrorPreview() {
    return const Center(
      child: Icon(Icons.broken_image, color: Colors.red),
    );
  }
}
