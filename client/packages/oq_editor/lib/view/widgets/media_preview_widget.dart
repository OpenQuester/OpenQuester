import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:nb_utils/nb_utils.dart';
import 'package:openapi/openapi.dart';
import 'package:oq_editor/models/media_file_reference.dart';
import 'package:oq_editor/view/widgets/audio_preview_widget.dart';
import 'package:oq_editor/view/widgets/video_preview_widget.dart';
import 'package:oq_shared/oq_shared.dart';
import 'package:universal_io/io.dart';
import 'package:video_player/video_player.dart';

/// Widget to preview media files (images, videos, audio)
class MediaPreviewWidget extends StatelessWidget {
  const MediaPreviewWidget({
    required this.mediaFile,
    required this.type,
    this.size = 80,
    this.fit = BoxFit.cover,
    this.enablePlayback = false,
    this.interactive = false,
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
    super.key,
  }) : mediaFile = null,
       _url = url;

  final MediaFileReference? mediaFile;
  final PackageFileType type;
  final double size;
  final String? _url;
  final BoxFit fit;
  final bool enablePlayback; // If true, video/audio will have players with controls
  final bool interactive; // If true, images will have InteractiveViewer for zoom

  @override
  Widget build(BuildContext context) {
    // For fullscreen playback mode, don't add the container wrapper
    if (enablePlayback && (type == PackageFileType.video || type == PackageFileType.audio)) {
      return _buildPreviewContent(context);
    }

    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(8),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(8),
        child: _buildPreviewContent(context),
      ),
    );
  }

  Widget _buildPreviewContent(BuildContext context) {
    switch (type) {
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
    final url = _url ?? mediaFile?.url;
    
    Widget imageWidget;
    if (url != null) {
      imageWidget = Image.network(
        url,
        fit: fit,
        errorBuilder: (context, error, stackTrace) => _buildErrorPreview(),
      );
    } else {
      // Use bytes if available (works on both web and native)
      final bytes = mediaFile?.platformFile.bytesSync;
      if (bytes != null) {
        imageWidget = Image.memory(
          bytes,
          fit: fit,
          errorBuilder: (context, error, stackTrace) => _buildErrorPreview(),
        );
      } else if (!kIsWeb && mediaFile?.platformFile.path != null) {
        // On native platforms, use file path if bytes not available
        imageWidget = Image.file(
          File(mediaFile!.platformFile.path!),
          fit: fit,
          errorBuilder: (context, error, stackTrace) => _buildErrorPreview(),
        );
      } else {
        return _buildErrorPreview();
      }
    }

    // Wrap with InteractiveViewer for fullscreen mode
    if (interactive) {
      return InteractiveViewer(child: imageWidget);
    }
    
    return imageWidget;
  }

  Widget _buildVideoPreview(BuildContext context) {
    // For URL-based previews with playback enabled, show actual player
    final url = _url ?? mediaFile?.url;
    if (enablePlayback && url != null) {
      return _UrlVideoPreview(url: url);
    }
    
    // For URL-based previews without playback, show a video icon placeholder
    if (url != null) {
      return Center(
        child: Icon(
          Icons.play_circle_outline,
          size: size * 0.5,
          color: Theme.of(context).colorScheme.onSurfaceVariant,
        ),
      );
    }
    
    // For file-based previews, use existing widget
    return VideoPreviewWidget(
      mediaFile: mediaFile!,
      size: size,
    );
  }

  Widget _buildAudioPreview(BuildContext context) {
    // For URL-based previews with playback enabled, show actual player
    final url = _url ?? mediaFile?.url;
    if (enablePlayback && url != null) {
      return _UrlAudioPreview(url: url);
    }
    
    // For URL-based previews without playback, show an audio icon placeholder
    if (url != null) {
      return Center(
        child: Icon(
          Icons.audiotrack,
          size: size * 0.5,
          color: Theme.of(context).colorScheme.onSurfaceVariant,
        ),
      );
    }
    
    // For file-based previews, use existing widget
    return AudioPreviewWidget(
      mediaFile: mediaFile!,
      size: size,
    );
  }

  Widget _buildDefaultPreview(BuildContext context) {
    return Center(
      child: Icon(
        Icons.file_present,
        size: size * 0.5,
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
  const _UrlVideoPreview({required this.url});

  final String url;

  @override
  State<_UrlVideoPreview> createState() => _UrlVideoPreviewState();
}

class _UrlVideoPreviewState extends State<_UrlVideoPreview> {
  VideoPlayerController? _controller;
  bool _isInitialized = false;
  bool _hasError = false;

  @override
  void initState() {
    super.initState();
    unawaited(_initializeVideo());
  }

  Future<void> _initializeVideo() async {
    try {
      _controller = VideoPlayerController.networkUrl(
        Uri.parse(widget.url),
      );
      await _controller!.initialize();
      if (mounted) {
        setState(() {
          _isInitialized = true;
        });
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
    _controller?.dispose();
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

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        AspectRatio(
          aspectRatio: _controller!.value.aspectRatio,
          child: VideoPlayer(_controller!),
        ).center().expand(),
        const SizedBox(height: 16),
        _VideoControls(controller: _controller!),
      ],
    );
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
  const _UrlAudioPreview({required this.url});

  final String url;

  @override
  State<_UrlAudioPreview> createState() => _UrlAudioPreviewState();
}

class _UrlAudioPreviewState extends State<_UrlAudioPreview> {
  VideoPlayerController? _controller;
  bool _isInitialized = false;
  bool _hasError = false;

  @override
  void initState() {
    super.initState();
    unawaited(_initializeAudio());
  }

  Future<void> _initializeAudio() async {
    try {
      _controller = VideoPlayerController.networkUrl(
        Uri.parse(widget.url),
      );
      await _controller!.initialize();
      if (mounted) {
        setState(() {
          _isInitialized = true;
        });
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
    _controller?.dispose();
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
          _VideoControls(controller: _controller!),
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
class _VideoControls extends StatelessWidget {
  const _VideoControls({required this.controller});

  final VideoPlayerController controller;

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder(
      valueListenable: controller,
      builder: (context, value, child) {
        return Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          decoration: BoxDecoration(
            color: Colors.black.withValues(alpha: 0.5),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              IconButton(
                icon: Icon(
                  value.isPlaying ? Icons.pause : Icons.play_arrow,
                  color: Colors.white,
                ),
                onPressed: () {
                  if (value.isPlaying) {
                    controller.pause().ignore();
                  } else {
                    controller.play().ignore();
                  }
                },
              ),
              const SizedBox(width: 8),
              Text(
                _formatDuration(value.position),
                style: const TextStyle(color: Colors.white, fontSize: 12),
              ),
              const SizedBox(width: 8),
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
                      controller
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
              const SizedBox(width: 8),
              Text(
                _formatDuration(value.duration),
                style: const TextStyle(color: Colors.white, fontSize: 12),
              ),
            ],
          ),
        );
      },
    );
  }

  String _formatDuration(Duration duration) {
    final minutes = duration.inMinutes;
    final seconds = duration.inSeconds.remainder(60);
    return '${minutes.toString().padLeft(2, '0')}:'
        '${seconds.toString().padLeft(2, '0')}';
  }
}
