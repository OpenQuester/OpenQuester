import 'package:flutter/material.dart';
import 'package:nb_utils/nb_utils.dart';
import 'package:openapi/openapi.dart';
import 'package:oq_editor/models/ui_media_file.dart';
import 'package:oq_editor/view/widgets/media_preview_widget.dart';

/// Fullscreen dialog to preview media files (images, videos, audio)
class MediaPreviewDialog extends StatelessWidget {
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
    final type = _type ?? mediaFile!.type;

    // Use MediaPreviewWidget with fullscreen settings for URL-based media
    if (_url != null) {
      return MediaPreviewWidget.fromUrl(
        url: _url,
        type: type,
        fit: BoxFit.contain,
        enablePlayback: true,
        interactive: true,
        autoPlay: autoPlay,
        size: null,
      );
    }

    // Use MediaPreviewWidget with fullscreen settings for file-based media
    return MediaPreviewWidget(
      mediaFile: mediaFile!.reference,
      type: type,
      fit: BoxFit.contain,
      enablePlayback: true,
      interactive: true,
      autoPlay: autoPlay,
      size: null,
    );
  }

  String _getFileName() {
    if (_fileName != null) return _fileName;
    if (_url != null) return _url.split('/').last;
    return mediaFile!.platformFile.name;
  }

  String _getFileInfo() {
    // For URL-based preview
    if (_url != null) {
      final type = _type!.name.toUpperCase();
      return type;
    }

    // For UiMediaFile-based preview
    final size = mediaFile!.platformFile.size;
    final sizeStr = _formatFileSize(size);
    final type = mediaFile!.type.name.toUpperCase();
    final displayTime = mediaFile!.displayTime;
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
