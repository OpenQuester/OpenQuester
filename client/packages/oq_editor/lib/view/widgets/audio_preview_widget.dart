import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:nb_utils/nb_utils.dart';
import 'package:oq_editor/models/media_file_reference.dart';
import 'package:oq_editor/utils/blob_helper.dart';
import 'package:oq_editor/view/widgets/media_playback_widget.dart';
import 'package:oq_shared/oq_shared.dart';
import 'package:path_provider/path_provider.dart';
import 'package:universal_io/io.dart';
import 'package:video_player/video_player.dart';

/// Widget to preview audio files with playback controls using VideoPlayer
class AudioPreviewWidget extends StatefulWidget {
  const AudioPreviewWidget({
    required this.mediaFile,
    this.size = 80,
    this.enableControls = true,
    this.onControllerInitialized,
    this.autoPlay = false,
    this.onVolumeChanged,
    super.key,
  });

  final MediaFileReference mediaFile;
  final double? size;
  final bool enableControls;
  final VoidCallback? onControllerInitialized;
  final bool autoPlay;
  final ValueChanged<double>? onVolumeChanged;

  @override
  State<AudioPreviewWidget> createState() => _AudioPreviewWidgetState();
}

class _AudioPreviewWidgetState extends State<AudioPreviewWidget> {
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
      unawaited(_initializeAudio());
    }
  }

  Future<void> _initializeAudio() async {
    if (_isInitializing) return;

    // If controller already exists and is initialized, use it
    if (_controller != null && _controller!.value.isInitialized) {
      if (mounted) {
        setState(() {
          _isInitialized = true;
        });
      }
      return;
    }

    if (mounted) setState(() => _isInitializing = true);

    try {
      final platformFile = widget.mediaFile.platformFile;
      final url = widget.mediaFile.url;

      if (url != null) {
        final (controller, tmpFile) = await VideoPlayerUtils.createController(
          url: url,
          fileExtension: widget.mediaFile.extension ?? 'mp3',
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
          final extension = platformFile.extension ?? 'mp3';
          final tempFile = File(
            '${tempDir.path}/audio_${DateTime.now().millisecondsSinceEpoch}.$extension',
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
        if (widget.autoPlay) {
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
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_hasError) {
      return _buildErrorIcon(context);
    }

    if (_isInitializing) {
      return _buildLoadingIndicator(context);
    }

    if (!_isInitialized || _controller == null) {
      return _buildPlaceholder(context);
    }

    if (widget.enableControls) {
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
            VideoControls(
              controller: _controller!,
              onVolumeChanged: widget.onVolumeChanged,
            ).constrained(const BoxConstraints(maxWidth: 1000)),
          ],
        ),
      );
    }

    return Stack(
      alignment: Alignment.center,
      children: [
        // Background gradient
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

        // Content
        Icon(
          Icons.audiotrack,
          size: (widget.size ?? 80) * 0.5,
          color: Theme.of(context).colorScheme.onPrimaryContainer,
        ),
      ],
    );
  }

  Widget _buildPlaceholder(BuildContext context) {
    return GestureDetector(
      onTap: () => unawaited(_initializeAudio()),
      child: Container(
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
        child: Center(
          child: Icon(
            Icons.play_circle_outline,
            color: Theme.of(context).colorScheme.onPrimaryContainer,
            size: (widget.size ?? 80) * 0.5,
          ),
        ),
      ),
    );
  }

  Widget _buildLoadingIndicator(BuildContext context) {
    return SizedBox(
      width: (widget.size ?? 80) * 0.4,
      height: (widget.size ?? 80) * 0.4,
      child: CircularProgressIndicator(
        strokeWidth: 2,
        color: Theme.of(context).colorScheme.primary,
      ),
    ).center();
  }

  Widget _buildErrorIcon(BuildContext context) {
    return Icon(
      Icons.music_off,
      size: (widget.size ?? 80) * 0.5,
      color: Theme.of(context).colorScheme.error,
    );
  }
}
