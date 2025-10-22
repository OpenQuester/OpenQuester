import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:oq_editor/models/media_file_reference.dart';
import 'package:oq_editor/utils/blob_helper.dart';
import 'package:path_provider/path_provider.dart';
import 'package:universal_io/io.dart';
import 'package:video_player/video_player.dart';

/// Widget to preview audio files with playback controls using VideoPlayer
class AudioPreviewWidget extends StatefulWidget {
  const AudioPreviewWidget({
    required this.mediaFile,
    this.size = 80,
    super.key,
  });

  final MediaFileReference mediaFile;
  final double size;

  @override
  State<AudioPreviewWidget> createState() => _AudioPreviewWidgetState();
}

class _AudioPreviewWidgetState extends State<AudioPreviewWidget> {
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
          final url = createBlobUrl(platformFile.bytes!);
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
          final extension = platformFile.extension ?? 'mp3';
          final tempFile = File(
            '${tempDir.path}/audio_${DateTime.now().millisecondsSinceEpoch}.$extension',
          );
          await tempFile.writeAsBytes(platformFile.bytes!);
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
    return Stack(
      alignment: Alignment.center,
      children: [
        // Background gradient
        Container(
          width: widget.size,
          height: widget.size,
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

        // Content
        if (_hasError)
          _buildErrorIcon(context)
        else if (!_isInitialized || _controller == null)
          _buildLoadingIndicator(context)
        else
          _buildPlayControls(context),

        // Progress indicator
        if (_isInitialized &&
            _controller != null &&
            _controller!.value.isPlaying)
          Positioned(
            bottom: 0,
            left: 0,
            right: 0,
            child: ValueListenableBuilder(
              valueListenable: _controller!,
              builder: (context, value, child) {
                final duration = value.duration.inMilliseconds;
                final position = value.position.inMilliseconds;
                return LinearProgressIndicator(
                  value: duration > 0 ? position / duration : 0,
                  backgroundColor: Colors.transparent,
                  valueColor: AlwaysStoppedAnimation<Color>(
                    Theme.of(context).colorScheme.primary,
                  ),
                );
              },
            ),
          ),

        // Duration indicator
        if (_isInitialized && _controller != null)
          Positioned(
            bottom: 4,
            right: 4,
            child: ValueListenableBuilder(
              valueListenable: _controller!,
              builder: (context, value, child) {
                final displayDuration = value.isPlaying
                    ? value.position
                    : value.duration;
                return Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 6,
                    vertical: 2,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.black.withValues(alpha: 0.7),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    _formatDuration(displayDuration),
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 10,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                );
              },
            ),
          ),
      ],
    );
  }

  Widget _buildPlayControls(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: _togglePlayPause,
        borderRadius: BorderRadius.circular(8),
        child: Center(
          child: ValueListenableBuilder(
            valueListenable: _controller!,
            builder: (context, value, child) {
              return Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Theme.of(
                    context,
                  ).colorScheme.primary.withValues(alpha: 0.9),
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  value.isPlaying ? Icons.pause : Icons.play_arrow,
                  color: Theme.of(context).colorScheme.onPrimary,
                  size: widget.size * 0.35,
                ),
              );
            },
          ),
        ),
      ),
    );
  }

  Future<void> _togglePlayPause() async {
    if (_controller == null || !_isInitialized) return;

    if (_controller!.value.isPlaying) {
      await _controller!.pause();
    } else {
      await _controller!.play();
    }
  }

  Widget _buildLoadingIndicator(BuildContext context) {
    return SizedBox(
      width: widget.size * 0.4,
      height: widget.size * 0.4,
      child: CircularProgressIndicator(
        strokeWidth: 2,
        color: Theme.of(context).colorScheme.primary,
      ),
    );
  }

  Widget _buildErrorIcon(BuildContext context) {
    return Icon(
      Icons.music_off,
      size: widget.size * 0.5,
      color: Theme.of(context).colorScheme.error,
    );
  }

  String _formatDuration(Duration duration) {
    final minutes = duration.inMinutes;
    final seconds = duration.inSeconds.remainder(60);
    return '${minutes.toString().padLeft(1, '0')}:'
        '${seconds.toString().padLeft(2, '0')}';
  }
}
