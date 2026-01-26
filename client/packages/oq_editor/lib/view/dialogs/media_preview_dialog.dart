import 'dart:async';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:nb_utils/nb_utils.dart';
import 'package:openapi/openapi.dart';
import 'package:oq_editor/models/media_file_reference.dart';
import 'package:oq_editor/models/ui_media_file.dart';
import 'package:oq_editor/view/widgets/media_playback_widget.dart';
import 'package:oq_editor/view/widgets/media_preview_widget.dart';

/// Fullscreen dialog to preview media files (images, videos, audio)
class MediaPreviewDialog extends StatefulWidget {
  const MediaPreviewDialog({
    required this.mediaFile,
    this.autoPlay = true,
    super.key,
  }) : _url = null,
       _type = null,
       _fileName = null;

  /// Create a dialog from a URL
  const MediaPreviewDialog.fromUrl({
    required String url,
    required PackageFileType type,
    String? fileName,
    this.autoPlay = true,
    super.key,
  }) : mediaFile = null,
       _url = url,
       _type = type,
       _fileName = fileName;

  final UiMediaFile? mediaFile;
  final String? _url;
  final PackageFileType? _type;
  final String? _fileName;
  final bool autoPlay;

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

  /// Show the media preview dialog from URL
  static Future<void> showFromUrl(
    BuildContext context,
    String url,
    PackageFileType type, {
    String? fileName,
  }) {
    return showDialog<void>(
      context: context,
      builder: (context) => MediaPreviewDialog.fromUrl(
        url: url,
        type: type,
        fileName: fileName,
      ),
    );
  }

  @override
  State<MediaPreviewDialog> createState() => _MediaPreviewDialogState();
}

class _MediaPreviewDialogState extends State<MediaPreviewDialog> {
  MediaFileReference? _localReference;

  MediaFileReference get _reference {
    if (widget.mediaFile != null) {
      return widget.mediaFile!.reference;
    }
    return _localReference!;
  }

  PackageFileType get _type => widget._type ?? widget.mediaFile!.type;

  @override
  void initState() {
    super.initState();
    if (widget._url != null) {
      _localReference = MediaFileReference(
        platformFile: PlatformFile(name: 'remote', size: 0),
        url: widget._url,
      );
    }
  }

  @override
  void dispose() {
    if (_localReference != null) {
      unawaited(_localReference!.disposeController());
    }
    super.dispose();
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
                        _getFileName(),
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
                      if (_shouldShowControls()) ...[
                        const SizedBox(height: 8),
                        VideoControls(
                          controller: _reference.sharedController!,
                        ),
                      ],
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

  bool _shouldShowControls() {
    return (_type == PackageFileType.video || _type == PackageFileType.audio) &&
        _reference.sharedController != null &&
        _reference.sharedController!.value.isInitialized;
  }

  Widget _buildMediaContent(BuildContext context) {
    return MediaPreviewWidget(
      mediaFile: _reference,
      type: _type,
      fit: BoxFit.contain,
      enablePlayback: true,
      enableControls: true, // Enable player mode
      showControls: false, // Hide internal controls
      interactive: true,
      autoPlay: widget.autoPlay,
      size: null,
      onControllerInitialized: () {
        if (mounted) setState(() {});
      },
    );
  }

  String _getFileName() {
    if (widget._fileName != null) return widget._fileName!;
    if (widget._url != null) return widget._url!.split('/').last;
    return widget.mediaFile!.platformFile.name;
  }

  String _getFileInfo() {
    // For URL-based preview
    if (widget._url != null) {
      final type = widget._type!.name.toUpperCase();
      return type;
    }

    // For UiMediaFile-based preview
    final size = widget.mediaFile!.platformFile.size;
    final sizeStr = _formatFileSize(size);
    final type = widget.mediaFile!.type.name.toUpperCase();
    final displayTime = widget.mediaFile!.displayTime;
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
