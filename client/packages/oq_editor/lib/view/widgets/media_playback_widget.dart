import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:openapi/openapi.dart';
import 'package:oq_editor/models/media_file_reference.dart';
import 'package:oq_editor/utils/blob_helper.dart';
import 'package:oq_shared/oq_shared.dart';
import 'package:path_provider/path_provider.dart';
import 'package:universal_io/io.dart';
import 'package:video_player/video_player.dart';

/// Widget to preview video/audio files with playback controls
class MediaPlaybackWidget extends StatefulWidget {
  const MediaPlaybackWidget({
    required this.mediaFile,
    required this.type,
    this.size,
    this.enableControls = true,
    this.showControls = true,
    this.onControllerInitialized,
    this.autoPlay = false,
    this.onVolumeChanged,
    super.key,
  });

  final MediaFileReference mediaFile;
  final PackageFileType type;
  final double? size;
  final bool enableControls;
  final bool showControls;
  final VoidCallback? onControllerInitialized;
  final bool autoPlay;
  final ValueChanged<double>? onVolumeChanged;

  @override
  State<MediaPlaybackWidget> createState() => _MediaPlaybackWidgetState();
}

class _MediaPlaybackWidgetState extends State<MediaPlaybackWidget> {
  VideoPlayerController? get _controller => widget.mediaFile.sharedController;
  bool _isInitialized = false;
  bool _hasError = false;
  bool _isInitializing = false;

  @override
  void initState() {
    super.initState();
    if (_controller != null && _controller!.value.isInitialized) {
      _isInitialized = true;
    } else if (widget.autoPlay) {
      unawaited(_initializeMedia(shouldPlay: true));
    }
  }

  @override
  void didUpdateWidget(MediaPlaybackWidget oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.autoPlay && !oldWidget.autoPlay && !_isInitialized) {
      unawaited(_initializeMedia(shouldPlay: true));
    }
  }

  Future<void> _initializeMedia({bool shouldPlay = false}) async {
    if (_isInitializing) return;

    // If controller already exists and is initialized, use it
    if (_controller != null && _controller!.value.isInitialized) {
      if (mounted) {
        setState(() {
          _isInitialized = true;
        });
        if (shouldPlay) {
          unawaited(_controller!.play());
        }
      }
      return;
    }

    if (mounted) setState(() => _isInitializing = true);

    try {
      final platformFile = widget.mediaFile.platformFile;
      final url = widget.mediaFile.url;

      if (url != null) {
        final defaultExt = widget.type == PackageFileType.audio
            ? 'mp3'
            : 'webm';
        final (controller, tmpFile) = await VideoPlayerUtils.createController(
          url: url,
          fileExtension: widget.mediaFile.extension ?? defaultExt,
          cacheKey: await widget.mediaFile.calculateHash(),
        );
        widget.mediaFile.sharedController = controller;
        widget.mediaFile.tempFile = tmpFile;
      } else if (kIsWeb) {
        if (platformFile.path != null) {
          widget.mediaFile.sharedController = VideoPlayerController.networkUrl(
            Uri.parse(platformFile.path!),
          );
        } else if (platformFile.bytes != null) {
          // Web: Create blob URL from bytes
          final bytes = await platformFile.readBytes();
          final url = createBlobUrl(bytes);
          widget.mediaFile.sharedController = VideoPlayerController.networkUrl(
            Uri.parse(url),
          );
        } else {
          setState(() {
            _hasError = true;
          });
          return;
        }
      } else {
        if (platformFile.path != null) {
          widget.mediaFile.sharedController = VideoPlayerController.file(
            File(platformFile.path!),
          );
        } else if (platformFile.bytes != null) {
          // Native: Create temporary file from bytes
          final tempDir = await getTemporaryDirectory();
          final defaultExt = widget.type == PackageFileType.audio
              ? 'mp3'
              : 'mp4';
          final extension = platformFile.extension ?? defaultExt;
          final tempFile = File(
            '${tempDir.path}/media_${DateTime.now().millisecondsSinceEpoch}.$extension',
          );
          final bytes = await platformFile.readBytes();
          await tempFile.writeAsBytes(bytes);
          widget.mediaFile.sharedController = VideoPlayerController.file(
            tempFile,
          );
        } else {
          setState(() {
            _hasError = true;
          });
          return;
        }
      }

      await _controller!.initialize();
      if (mounted) {
        setState(() {
          _isInitialized = true;
        });
        if (shouldPlay || widget.autoPlay) {
          unawaited(_controller!.play());
        }
        widget.onControllerInitialized?.call();
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _hasError = true;
        });
      }
    } finally {
      if (mounted) setState(() => _isInitializing = false);
    }
  }

  @override
  void dispose() {
    // Don't dispose controller here - it's shared
    // It will be disposed when MediaFileReference is removed
    unawaited(_controller?.pause());
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_hasError) {
      return _buildErrorPreview(context);
    }

    if (_isInitializing) {
      return _buildLoadingPreview(context);
    }

    if (!_isInitialized || _controller == null) {
      return _buildPlaceholder(context);
    }

    if (widget.enableControls) {
      Widget content;
      if (widget.type == PackageFileType.video) {
        content = AspectRatio(
          aspectRatio: _controller!.value.aspectRatio,
          child: VideoPlayer(_controller!),
        );
      } else {
        content = _buildAudioVisualizer(context);
      }

      if (!widget.showControls) {
        return Center(child: content);
      }

      return SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            content,
            const SizedBox(height: 16),
            VideoControls(
              controller: _controller!,
              onVolumeChanged: widget.onVolumeChanged,
            ).constrained(const BoxConstraints(maxWidth: 1000)),
          ],
        ),
      );
    }

    // Compact preview (no controls)
    if (widget.type == PackageFileType.video) {
      return Stack(
        alignment: Alignment.center,
        children: [
          SizedBox(
            width: widget.size,
            height: widget.size,
            child: FittedBox(
              fit: BoxFit.cover,
              child: SizedBox(
                width: _controller!.value.size.width,
                height: _controller!.value.size.height,
                child: VideoPlayer(_controller!),
              ),
            ),
          ),
        ],
      );
    } else {
      return Stack(
        alignment: Alignment.center,
        children: [
          Container(
            constraints: BoxConstraints(
              maxWidth: widget.size ?? 80,
              maxHeight: widget.size ?? 80,
            ),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  Theme.of(context).colorScheme.primaryContainer,
                  Theme.of(context).colorScheme.secondaryContainer,
                ],
              ),
              borderRadius: BorderRadius.circular(8),
            ),
          ),
          Icon(
            Icons.audiotrack,
            size: (widget.size ?? 80) * 0.5,
            color: Theme.of(context).colorScheme.onPrimaryContainer,
          ),
        ],
      );
    }
  }

  Widget _buildAudioVisualizer(BuildContext context) {
    return Container(
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
    );
  }

  Widget _buildPlaceholder(BuildContext context) {
    return GestureDetector(
      onTap: () => unawaited(_initializeMedia(shouldPlay: true)),
      child: Container(
        width: widget.size,
        height: widget.size,
        decoration: widget.type == PackageFileType.audio
            ? BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [
                    Theme.of(context).colorScheme.primaryContainer,
                    Theme.of(context).colorScheme.secondaryContainer,
                  ],
                ),
                borderRadius: BorderRadius.circular(8),
              )
            : BoxDecoration(
                color: Colors.black,
                borderRadius: BorderRadius.circular(8),
              ),
        child: Center(
          child: Icon(
            Icons.play_circle_outline,
            color: widget.type == PackageFileType.audio
                ? Theme.of(context).colorScheme.onPrimaryContainer
                : Colors.white,
            size: (widget.size ?? 80) * 0.5,
          ),
        ),
      ),
    );
  }

  Widget _buildLoadingPreview(BuildContext context) {
    return Center(
      child: CircularProgressIndicator(
        strokeWidth: 2,
        color: Theme.of(context).colorScheme.primary,
      ),
    );
  }

  Widget _buildErrorPreview(BuildContext context) {
    return Center(
      child: Icon(
        widget.type == PackageFileType.audio
            ? Icons.music_off
            : Icons.video_library,
        size: (widget.size ?? 80) * 0.5,
        color: Theme.of(context).colorScheme.error,
      ),
    );
  }
}

/// Video player controls
class VideoControls extends StatefulWidget {
  const VideoControls({
    required this.controller,
    this.onVolumeChanged,
    super.key,
  });

  final VideoPlayerController controller;
  final ValueChanged<double>? onVolumeChanged;

  @override
  State<VideoControls> createState() => _VideoControlsState();
}

class _VideoControlsState extends State<VideoControls> {
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
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
          decoration: BoxDecoration(
            color: Colors.black.withValues(alpha: 0.5),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            spacing: 4,
            children: [
              IconButton(
                visualDensity: VisualDensity.compact,
                icon: Icon(
                  value.isPlaying ? Icons.pause : Icons.play_arrow,
                  color: Colors.white,
                ),
                onPressed: () => widget.controller.playPause().ignore(),
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
      padding: EdgeInsets.zero,
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
