import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:oq_editor/models/media_file_reference.dart';
import 'package:oq_editor/utils/blob_helper.dart';
import 'package:path_provider/path_provider.dart';
import 'package:universal_io/io.dart';
import 'package:video_player/video_player.dart';

/// Widget to preview video files with playback controls
class VideoPreviewWidget extends StatefulWidget {
  const VideoPreviewWidget({
    required this.mediaFile,
    this.size = 80,
    super.key,
  });

  final MediaFileReference mediaFile;
  final double size;

  @override
  State<VideoPreviewWidget> createState() => _VideoPreviewWidgetState();
}

class _VideoPreviewWidgetState extends State<VideoPreviewWidget> {
  VideoPlayerController? get _controller => widget.mediaFile.sharedController;
  bool _isInitialized = false;
  bool _hasError = false;

  @override
  void initState() {
    super.initState();
    _initializeVideo().ignore();
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
          final extension = platformFile.extension ?? 'mp4';
          final tempFile = File(
            '${tempDir.path}/video_${DateTime.now().millisecondsSinceEpoch}.$extension',
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
    if (_hasError) {
      return _buildErrorPreview(context);
    }

    if (!_isInitialized || _controller == null) {
      return _buildLoadingPreview(context);
    }

    return Stack(
      alignment: Alignment.center,
      children: [
        // Video frame
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

        // Play/Pause overlay
        Positioned.fill(
          child: Material(
            color: Colors.transparent,
            child: InkWell(
              onTap: _togglePlayPause,
              child: Container(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      Colors.black.withValues(alpha: 0.3),
                      Colors.transparent,
                      Colors.black.withValues(alpha: 0.3),
                    ],
                  ),
                ),
                child: Center(
                  child: AnimatedOpacity(
                    opacity: _controller!.value.isPlaying ? 0.0 : 1.0,
                    duration: const Duration(milliseconds: 200),
                    child: Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: Colors.black.withValues(alpha: 0.6),
                        shape: BoxShape.circle,
                      ),
                      child: Icon(
                        Icons.play_arrow,
                        color: Colors.white,
                        size: widget.size * 0.4,
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),

        // Duration indicator
        Positioned(
          bottom: 4,
          right: 4,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
            decoration: BoxDecoration(
              color: Colors.black.withValues(alpha: 0.7),
              borderRadius: BorderRadius.circular(4),
            ),
            child: Text(
              _formatDuration(_controller!.value.duration),
              style: const TextStyle(
                color: Colors.white,
                fontSize: 10,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
        ),
      ],
    );
  }

  void _togglePlayPause() {
    if (_controller == null || !_isInitialized) return;

    if (_controller!.value.isPlaying) {
      _controller!.pause().ignore();
    } else {
      _controller!.play().ignore();
    }
    setState(() {});
  }

  Widget _buildLoadingPreview(BuildContext context) {
    return Center(
      child: SizedBox(
        width: widget.size * 0.4,
        height: widget.size * 0.4,
        child: CircularProgressIndicator(
          strokeWidth: 2,
          color: Theme.of(context).colorScheme.primary,
        ),
      ),
    );
  }

  Widget _buildErrorPreview(BuildContext context) {
    return Center(
      child: Icon(
        Icons.video_library,
        size: widget.size * 0.5,
        color: Theme.of(context).colorScheme.error,
      ),
    );
  }

  String _formatDuration(Duration duration) {
    final minutes = duration.inMinutes;
    final seconds = duration.inSeconds.remainder(60);
    return '${minutes.toString().padLeft(1, '0')}:'
        '${seconds.toString().padLeft(2, '0')}';
  }
}
