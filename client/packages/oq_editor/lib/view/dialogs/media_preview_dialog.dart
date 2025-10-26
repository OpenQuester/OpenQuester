import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:nb_utils/nb_utils.dart';
import 'package:openapi/openapi.dart';
import 'package:oq_editor/models/ui_media_file.dart';
import 'package:oq_editor/utils/blob_helper.dart';
import 'package:oq_shared/oq_shared.dart';
import 'package:path_provider/path_provider.dart';
import 'package:universal_io/io.dart';
import 'package:video_player/video_player.dart';

/// Fullscreen dialog to preview media files (images, videos, audio)
class MediaPreviewDialog extends StatelessWidget {
  const MediaPreviewDialog({
    required this.mediaFile,
    super.key,
  });

  final UiMediaFile mediaFile;

  /// Show the media preview dialog
  static Future<void> show(
    BuildContext context,
    UiMediaFile mediaFile,
  ) {
    return showDialog<void>(
      context: context,
      builder: (context) => MediaPreviewDialog(mediaFile: mediaFile),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      backgroundColor: Colors.black,
      insetPadding: const EdgeInsets.all(16),
      child: Stack(
        children: [
          // Media content
          Positioned.fill(
            child: Column(
              children: [
                _buildMediaContent(context).center().expand(),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.black.withValues(alpha: 0.7),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        mediaFile.platformFile.name,
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w600,
                          fontSize: 14,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        _getFileInfo(),
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.7),
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),

          // Close button
          Positioned(
            top: 8,
            right: 8,
            child: IconButton(
              icon: const Icon(Icons.close, color: Colors.white),
              onPressed: () => Navigator.of(context).pop(),
              style: IconButton.styleFrom(
                backgroundColor: Colors.black.withValues(alpha: 0.5),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMediaContent(BuildContext context) {
    switch (mediaFile.type) {
      case PackageFileType.image:
        return _ImagePreview(mediaFile: mediaFile);
      case PackageFileType.video:
        return _VideoPreview(mediaFile: mediaFile);
      case PackageFileType.audio:
        return _AudioPreview(mediaFile: mediaFile);
      case PackageFileType.$unknown:
        return const Icon(
          Icons.file_present,
          color: Colors.white,
          size: 64,
        );
    }
  }

  String _getFileInfo() {
    final size = mediaFile.platformFile.size;
    final sizeStr = _formatFileSize(size);
    final type = mediaFile.type.name.toUpperCase();
    final displayTime = mediaFile.displayTime;
    final displayTimeStr = ' • Display: ${displayTime}ms';

    return '$type • $sizeStr$displayTimeStr';
  }

  String _formatFileSize(int bytes) {
    if (bytes < 1024) return '$bytes B';
    if (bytes < 1024 * 1024) {
      return '${(bytes / 1024).toStringAsFixed(1)} KB';
    }
    return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
  }
}

/// Image preview widget
class _ImagePreview extends StatelessWidget {
  const _ImagePreview({required this.mediaFile});

  final UiMediaFile mediaFile;

  @override
  Widget build(BuildContext context) {
    // On web, use bytes if available
    final bytes = mediaFile.platformFile.bytesSync;
    if (kIsWeb && bytes != null) {
      return InteractiveViewer(
        child: Image.memory(
          bytes,
          fit: BoxFit.contain,
          errorBuilder: (context, error, stackTrace) => _buildErrorWidget(),
        ),
      );
    }

    // On native platforms, use file path
    if (!kIsWeb && mediaFile.platformFile.path != null) {
      return InteractiveViewer(
        child: Image.file(
          File(mediaFile.platformFile.path!),
          fit: BoxFit.contain,
          errorBuilder: (context, error, stackTrace) => _buildErrorWidget(),
        ),
      );
    }

    return _buildErrorWidget();
  }

  Widget _buildErrorWidget() {
    return const Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(Icons.broken_image, color: Colors.red, size: 64),
        SizedBox(height: 16),
        Text(
          'Failed to load image',
          style: TextStyle(color: Colors.white),
        ),
      ],
    );
  }
}

/// Video preview widget with full controls
class _VideoPreview extends StatefulWidget {
  const _VideoPreview({required this.mediaFile});

  final UiMediaFile mediaFile;

  @override
  State<_VideoPreview> createState() => _VideoPreviewState();
}

class _VideoPreviewState extends State<_VideoPreview> {
  VideoPlayerController? get _controller => widget.mediaFile.sharedController;
  bool _isInitialized = false;
  bool _hasError = false;

  @override
  void initState() {
    super.initState();
    unawaited(_initializeVideo());
  }

  Future<void> _initializeVideo() async {
    // If controller already exists and is initialized, use it
    if (_controller != null && _controller!.value.isInitialized) {
      if (mounted) {
        setState(() {
          _isInitialized = true;
        });
      }
      return;
    }

    try {
      final platformFile = widget.mediaFile.platformFile;

      if (kIsWeb) {
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
          final tempFile = File(
            '${tempDir.path}/video_${DateTime.now().millisecondsSinceEpoch}.${widget.mediaFile.extension ?? 'mp4'}',
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
    // Don't dispose controller here - it's shared
    // It will be disposed when MediaFileReference is removed
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

/// Audio preview widget with full controls
class _AudioPreview extends StatefulWidget {
  const _AudioPreview({required this.mediaFile});

  final UiMediaFile mediaFile;

  @override
  State<_AudioPreview> createState() => _AudioPreviewState();
}

class _AudioPreviewState extends State<_AudioPreview> {
  VideoPlayerController? get _controller => widget.mediaFile.sharedController;
  bool _isInitialized = false;
  bool _hasError = false;

  @override
  void initState() {
    super.initState();
    unawaited(_initializeAudio());
  }

  Future<void> _initializeAudio() async {
    // If controller already exists and is initialized, use it
    if (_controller != null && _controller!.value.isInitialized) {
      if (mounted) {
        setState(() {
          _isInitialized = true;
        });
      }
      return;
    }

    try {
      final platformFile = widget.mediaFile.platformFile;

      if (kIsWeb) {
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
          final tempFile = File(
            '${tempDir.path}/audio_${DateTime.now().millisecondsSinceEpoch}.${widget.mediaFile.extension ?? 'mp3'}',
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
    // Don't dispose controller here - it's shared
    // It will be disposed when MediaFileReference is removed
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
