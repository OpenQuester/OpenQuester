import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:nb_utils/nb_utils.dart';
import 'package:openapi/openapi.dart';
import 'package:oq_editor/models/media_file_reference.dart';
import 'package:oq_editor/models/ui_media_file.dart';
import 'package:oq_editor/view/dialogs/media_preview_dialog.dart';
import 'package:oq_editor/view/widgets/audio_preview_widget.dart';
import 'package:oq_editor/view/widgets/video_preview_widget.dart';
import 'package:oq_shared/oq_shared.dart';
import 'package:universal_io/io.dart';
import 'package:video_player/video_player.dart';

/// Widget to preview media files (images, videos, audio)
class MediaPreviewWidget extends StatefulWidget {
  const MediaPreviewWidget({
    required this.mediaFile,
    required this.type,
    this.size = 80,
    this.fit = BoxFit.cover,
    this.enablePlayback = false,
    this.interactive = false,
    this.autoPlay = false,
    this.onVolumeChanged,
    this.onTap,
    super.key,
  }) : _url = null;

  /// Creates a preview widget from a URL
  const MediaPreviewWidget.fromUrl({
    required String url,
    required this.type,
    this.size = 80,
    this.fit = BoxFit.cover,
    this.enablePlayback = false,
    this.interactive = false,
    this.autoPlay = false,
    this.onVolumeChanged,
    this.onTap,
    super.key,
  }) : mediaFile = null,
       _url = url;

  final MediaFileReference? mediaFile;
  final PackageFileType type;
  final double? size;
  final String? _url;
  final BoxFit fit;

  /// If true, video/audio will have players with controls
  final bool enablePlayback;

  /// If true, images will have InteractiveViewer for zoom
  final bool interactive;

  /// If true, video/audio will start playing automatically
  final bool autoPlay;

  /// Callback when volume changes (0.0 to 1.0)
  final ValueChanged<double>? onVolumeChanged;

  /// Callback when the widget is tapped. If null, opens MediaPreviewDialog
  final VoidCallback? onTap;

  @override
  State<MediaPreviewWidget> createState() => _MediaPreviewWidgetState();
}

class _MediaPreviewWidgetState extends State<MediaPreviewWidget> {
  bool _isHovering = false;

  @override
  Widget build(BuildContext context) {
    // For fullscreen playback mode, don't add the container wrapper
    if (widget.enablePlayback &&
        (widget.type == PackageFileType.video ||
            widget.type == PackageFileType.audio)) {
      return _buildPreviewContent(context);
    }

    return GestureDetector(
      onTap: () => _handleTap(context),
      child: MouseRegion(
        onEnter: (_) => setState(() => _isHovering = true),
        onExit: (_) => setState(() => _isHovering = false),
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
                // Hover overlay with icon
                if (_isHovering && !widget.enablePlayback)
                  Positioned.fill(
                    child: Container(
                      decoration: BoxDecoration(
                        color: Colors.black.withValues(alpha: 0.5),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Center(
                        child: Icon(
                          Icons.open_in_full,
                          color: Colors.white,
                          size: (widget.size ?? 80) * 0.3,
                        ),
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
      if (widget._url != null) {
        await MediaPreviewDialog.showFromUrl(
          context,
          widget._url!,
          widget.type,
        );
      } else if (widget.mediaFile != null) {
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
    final url = widget._url ?? widget.mediaFile?.url;

    Widget imageWidget;
    if (url != null) {
      imageWidget = Image.network(
        url,
        fit: widget.fit,
        errorBuilder: (context, error, stackTrace) => _buildErrorPreview(),
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
    // For URL-based previews with playback enabled, show actual player
    final url = widget._url ?? widget.mediaFile?.url;
    if (widget.enablePlayback && url != null) {
      return _UrlVideoPreview(
        url: url,
        autoPlay: widget.autoPlay,
        onVolumeChanged: widget.onVolumeChanged,
      );
    }

    // For URL-based previews without playback, show a video icon placeholder
    if (url != null) {
      return Center(
        child: Icon(
          Icons.play_circle_outline,
          size: (widget.size ?? 80) * 0.5,
          color: Theme.of(context).colorScheme.onSurfaceVariant,
        ),
      );
    }

    // For file-based previews, use existing widget
    return VideoPreviewWidget(
      mediaFile: widget.mediaFile!,
      size: widget.size ?? 80,
    );
  }

  Widget _buildAudioPreview(BuildContext context) {
    // For URL-based previews with playback enabled, show actual player
    final url = widget._url ?? widget.mediaFile?.url;
    if (widget.enablePlayback && url != null) {
      return _UrlAudioPreview(
        url: url,
        autoPlay: widget.autoPlay,
        onVolumeChanged: widget.onVolumeChanged,
      );
    }

    // For URL-based previews without playback, show an audio icon placeholder
    if (url != null) {
      return Center(
        child: Icon(
          Icons.audiotrack,
          size: (widget.size ?? 80) * 0.5,
          color: Theme.of(context).colorScheme.onSurfaceVariant,
        ),
      );
    }

    // For file-based previews, use existing widget
    return AudioPreviewWidget(
      mediaFile: widget.mediaFile!,
      size: widget.size ?? 80,
    );
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

/// Video preview widget for URL-based media
class _UrlVideoPreview extends StatefulWidget {
  const _UrlVideoPreview({
    required this.url,
    this.autoPlay = false,
    this.onVolumeChanged,
  });

  final String url;
  final bool autoPlay;
  final ValueChanged<double>? onVolumeChanged;

  @override
  State<_UrlVideoPreview> createState() => _UrlVideoPreviewState();
}

class _UrlVideoPreviewState extends State<_UrlVideoPreview> {
  VideoPlayerController? _controller;
  File? _tmpFile;
  bool _isInitialized = false;
  bool _hasError = false;
  final _focusNode = FocusNode();

  @override
  void initState() {
    super.initState();
    unawaited(_initializeVideo());
  }

  Future<void> _initializeVideo() async {
    try {
      final (controller, tmpFile) = await VideoPlayerUtils.createController(
        url: widget.url,
        fileExtension: 'webm',
      );
      _controller = controller;
      _tmpFile = tmpFile;
      await _controller!.initialize();
      if (mounted) {
        setState(() {
          _isInitialized = true;
        });
        // Auto-play if enabled
        if (widget.autoPlay) {
          unawaited(_controller!.play());
        }
        _focusNode.requestFocus();
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _hasError = true;
        });
      }
    }
  }

  @override
  void dispose() {
    _focusNode.dispose();
    unawaited(_controller?.dispose());
    _tmpFile?.delete().ignore();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_hasError) {
      return _buildErrorWidget();
    }

    if (!_isInitialized || _controller == null) {
      return const CircularProgressIndicator(color: Colors.white);
    }

    return Focus(
      focusNode: _focusNode,
      onKeyEvent: (node, event) {
        if (event is KeyDownEvent &&
            event.logicalKey == LogicalKeyboardKey.space) {
          _togglePlayPause();
          return KeyEventResult.handled;
        }
        return KeyEventResult.ignored;
      },
      child: GestureDetector(
        onTap: () {
          _focusNode.requestFocus();
          _togglePlayPause();
        },
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            AspectRatio(
              aspectRatio: _controller!.value.aspectRatio,
              child: VideoPlayer(_controller!),
            ).center().expand(),
            const SizedBox(height: 16),
            _VideoControls(
              controller: _controller!,
              onVolumeChanged: widget.onVolumeChanged,
            ),
          ],
        ),
      ),
    );
  }

  void _togglePlayPause() {
    if (_controller?.value.isPlaying ?? false) {
      _controller?.pause().ignore();
    } else {
      _controller?.play().ignore();
    }
  }

  Widget _buildErrorWidget() {
    return const Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(Icons.error_outline, color: Colors.red, size: 64),
        SizedBox(height: 16),
        Text(
          'Failed to load video',
          style: TextStyle(color: Colors.white),
        ),
      ],
    );
  }
}

/// Audio preview widget for URL-based media
class _UrlAudioPreview extends StatefulWidget {
  const _UrlAudioPreview({
    required this.url,
    this.autoPlay = false,
    this.onVolumeChanged,
  });

  final String url;
  final bool autoPlay;
  final ValueChanged<double>? onVolumeChanged;

  @override
  State<_UrlAudioPreview> createState() => _UrlAudioPreviewState();
}

class _UrlAudioPreviewState extends State<_UrlAudioPreview> {
  VideoPlayerController? _controller;
  File? _tmpFile;
  bool _isInitialized = false;
  bool _hasError = false;

  @override
  void initState() {
    super.initState();
    unawaited(_initializeAudio());
  }

  Future<void> _initializeAudio() async {
    try {
      final (controller, tmpFile) = await VideoPlayerUtils.createController(
        url: widget.url,
        fileExtension: 'webp',
      );
      _controller = controller;
      _tmpFile = tmpFile;
      await _controller!.initialize();
      if (mounted) {
        setState(() {
          _isInitialized = true;
        });
        // Auto-play if enabled
        if (widget.autoPlay) {
          unawaited(_controller!.play());
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _hasError = true;
        });
      }
    }
  }

  @override
  void dispose() {
    unawaited(_controller?.dispose());
    _tmpFile?.delete().ignore();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_hasError) {
      return _buildErrorWidget();
    }

    if (!_isInitialized || _controller == null) {
      return const CircularProgressIndicator(color: Colors.white);
    }

    return SingleChildScrollView(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Audio visualizer icon
          Container(
            width: 200,
            height: 200,
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  Theme.of(context).colorScheme.primaryContainer,
                  Theme.of(context).colorScheme.secondaryContainer,
                ],
              ),
              borderRadius: BorderRadius.circular(16),
            ),
            child: ValueListenableBuilder(
              valueListenable: _controller!,
              builder: (context, value, child) {
                return Center(
                  child: Icon(
                    value.isPlaying ? Icons.music_note : Icons.music_note,
                    size: 80,
                    color: Colors.white,
                  ),
                );
              },
            ),
          ),
          const SizedBox(height: 24),
          _VideoControls(
            controller: _controller!,
            onVolumeChanged: widget.onVolumeChanged,
          ).constrained(const BoxConstraints(maxWidth: 1000)),
        ],
      ),
    );
  }

  Widget _buildErrorWidget() {
    return const Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(Icons.error_outline, color: Colors.red, size: 64),
        SizedBox(height: 16),
        Text(
          'Failed to load audio',
          style: TextStyle(color: Colors.white),
        ),
      ],
    );
  }
}

/// Video player controls
class _VideoControls extends StatefulWidget {
  const _VideoControls({
    required this.controller,
    this.onVolumeChanged,
  });

  final VideoPlayerController controller;
  final ValueChanged<double>? onVolumeChanged;

  @override
  State<_VideoControls> createState() => _VideoControlsState();
}

class _VideoControlsState extends State<_VideoControls> {
  double _volume = 0.5;

  @override
  void initState() {
    super.initState();
    // Set initial volume
    unawaited(widget.controller.setVolume(_volume));
  }

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder(
      valueListenable: widget.controller,
      builder: (context, value, child) {
        return Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          decoration: BoxDecoration(
            color: Colors.black.withValues(alpha: 0.5),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            spacing: 8,
            children: [
              IconButton(
                icon: Icon(
                  value.isPlaying ? Icons.pause : Icons.play_arrow,
                  color: Colors.white,
                ),
                onPressed: () {
                  if (value.isPlaying) {
                    widget.controller.pause().ignore();
                  } else {
                    widget.controller.play().ignore();
                  }
                },
              ),
              Text(
                _formatDuration(value.position),
                style: const TextStyle(color: Colors.white, fontSize: 12),
              ),
              Expanded(
                child: SliderTheme(
                  data: SliderTheme.of(context).copyWith(
                    trackHeight: 2,
                    thumbShape: const RoundSliderThumbShape(
                      enabledThumbRadius: 6,
                    ),
                  ),
                  child: Slider(
                    value: value.position.inMilliseconds.toDouble(),
                    max: value.duration.inMilliseconds.toDouble(),
                    onChanged: (newValue) {
                      widget.controller
                          .seekTo(
                            Duration(milliseconds: newValue.toInt()),
                          )
                          .ignore();
                    },
                    activeColor: Colors.white,
                    inactiveColor: Colors.white.withValues(alpha: 0.3),
                  ),
                ),
              ),
              Text(
                _formatDuration(value.duration),
                style: const TextStyle(color: Colors.white, fontSize: 12),
              ),
              // Volume control
              _buildVolumeControl(),
            ],
          ),
        );
      },
    );
  }

  Widget _buildVolumeControl() {
    return PopupMenuButton<void>(
      icon: Icon(
        _volume == 0
            ? Icons.volume_off
            : _volume < 0.5
            ? Icons.volume_down
            : Icons.volume_up,
        color: Colors.white,
      ),
      offset: const Offset(0, -120),
      color: Colors.black.withValues(alpha: 0.9),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      itemBuilder: (context) => [
        PopupMenuItem<void>(
          enabled: false,
          child: StatefulBuilder(
            builder: (context, setVolumeState) {
              return SizedBox(
                width: 40,
                height: 100,
                child: RotatedBox(
                  quarterTurns: 3,
                  child: SliderTheme(
                    data: SliderTheme.of(context).copyWith(
                      trackHeight: 2,
                      thumbShape: const RoundSliderThumbShape(
                        enabledThumbRadius: 6,
                      ),
                    ),
                    child: Slider(
                      value: _volume,
                      onChanged: (value) {
                        setVolumeState(() {
                          _volume = value;
                        });
                        widget.controller.setVolume(value).ignore();
                        widget.onVolumeChanged?.call(value);
                      },
                      activeColor: Colors.white,
                      inactiveColor: Colors.white.withValues(alpha: 0.3),
                    ),
                  ),
                ),
              );
            },
          ),
        ),
      ],
    );
  }

  String _formatDuration(Duration duration) {
    final minutes = duration.inMinutes;
    final seconds = duration.inSeconds.remainder(60);
    return '${minutes.toString().padLeft(2, '0')}:'
        '${seconds.toString().padLeft(2, '0')}';
  }
}
