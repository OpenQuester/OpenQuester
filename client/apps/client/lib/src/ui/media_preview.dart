import 'dart:async';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:openapi/openapi.dart';
import 'package:video_player/video_player.dart';

class MediaPreviewDialog extends StatelessWidget {
  const MediaPreviewDialog.fromUrl({
    required this.url,
    required this.type,
    this.showInfo = true,
    super.key,
  });

  final String url;
  final PackageFileType type;
  final bool showInfo;

  Future<void> show(BuildContext context) => showDialog<void>(
    context: context,
    builder: (_) => this,
  );

  @override
  Widget build(BuildContext context) {
    return Dialog(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 900, maxHeight: 700),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            AppBar(
              automaticallyImplyLeading: false,
              title: showInfo ? Text(type.name) : null,
              actions: [
                IconButton(
                  onPressed: () => Navigator.pop(context),
                  icon: const Icon(Icons.close),
                ),
              ],
            ),
            Flexible(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: MediaPreviewWidget(
                  url: url,
                  type: type,
                  size: 640,
                  enablePlayback: true,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class MediaPreviewWidget extends StatefulWidget {
  const MediaPreviewWidget({
    required String this.url,
    required this.type,
    required this.size,
    required this.enablePlayback,
    super.key,
  }) : bytes = null,
       mimeType = null;

  const MediaPreviewWidget.fromBytes({
    required Uint8List this.bytes,
    required this.type,
    required this.size,
    required this.enablePlayback,
    this.mimeType,
    super.key,
  }) : url = null;

  final String? url;
  final Uint8List? bytes;
  final String? mimeType;
  final PackageFileType type;
  final double size;
  final bool enablePlayback;

  @override
  State<MediaPreviewWidget> createState() => _MediaPreviewWidgetState();
}

class _MediaPreviewWidgetState extends State<MediaPreviewWidget> {
  VideoPlayerController? _controller;
  Future<void>? _initialization;

  @override
  void initState() {
    super.initState();
    if (widget.enablePlayback &&
        (widget.type == PackageFileType.audio ||
            widget.type == PackageFileType.video)) {
      final source =
          widget.url ??
          Uri.dataFromBytes(
            widget.bytes!,
            mimeType: widget.mimeType ?? _mimeType(widget.type),
          ).toString();
      _controller = VideoPlayerController.networkUrl(Uri.parse(source));
      _initialization = _controller!.initialize();
    }
  }

  @override
  void dispose() {
    final controller = _controller;
    if (controller != null) unawaited(controller.dispose());
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final child = widget.type == PackageFileType.image
        ? widget.bytes != null
              ? Image.memory(
                  widget.bytes!,
                  fit: BoxFit.contain,
                  errorBuilder: (_, _, _) =>
                      const Icon(Icons.broken_image_outlined),
                )
              : Image.network(
                  widget.url!,
                  fit: BoxFit.contain,
                  errorBuilder: (_, _, _) =>
                      const Icon(Icons.broken_image_outlined),
                )
        : !widget.enablePlayback
        ? Center(
            child: Icon(
              widget.type == PackageFileType.audio
                  ? Icons.audio_file_outlined
                  : Icons.video_file_outlined,
            ),
          )
        : FutureBuilder<void>(
            future: _initialization,
            builder: (context, snapshot) {
              if (snapshot.connectionState != ConnectionState.done) {
                return const Center(child: CircularProgressIndicator());
              }
              if (widget.type == PackageFileType.audio) {
                return IconButton.filledTonal(
                  iconSize: 48,
                  onPressed: widget.enablePlayback ? _togglePlayback : null,
                  icon: Icon(
                    _controller!.value.isPlaying
                        ? Icons.pause
                        : Icons.play_arrow,
                  ),
                );
              }
              return AspectRatio(
                aspectRatio: _controller!.value.aspectRatio,
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    VideoPlayer(_controller!),
                    IconButton.filledTonal(
                      onPressed: widget.enablePlayback ? _togglePlayback : null,
                      icon: Icon(
                        _controller!.value.isPlaying
                            ? Icons.pause
                            : Icons.play_arrow,
                      ),
                    ),
                  ],
                ),
              );
            },
          );

    return SizedBox.square(
      dimension: widget.size,
      child: Card(clipBehavior: Clip.antiAlias, child: child),
    );
  }

  void _togglePlayback() {
    setState(() {
      if (_controller!.value.isPlaying) {
        unawaited(_controller!.pause());
      } else {
        unawaited(_controller!.play());
      }
    });
  }

  static String _mimeType(PackageFileType type) => switch (type) {
    PackageFileType.audio => 'audio/mpeg',
    PackageFileType.video => 'video/mp4',
    PackageFileType.image => 'image/png',
    PackageFileType.$unknown => 'application/octet-stream',
  };
}
