import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:openapi/openapi.dart';
import 'package:oq_editor/models/media_file_reference.dart';
import 'package:oq_editor/view/widgets/audio_preview_widget.dart';
import 'package:oq_editor/view/widgets/video_preview_widget.dart';
import 'package:universal_io/io.dart';

/// Widget to preview media files (images, videos, audio)
class MediaPreviewWidget extends StatelessWidget {
  const MediaPreviewWidget({
    required this.mediaFile,
    required this.type,
    this.size = 80,
    super.key,
  });

  final MediaFileReference mediaFile;
  final PackageFileType type;
  final double size;

  @override
  Widget build(BuildContext context) {
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
    // Use bytes if available (works on both web and native)
    if (mediaFile.platformFile.bytes != null) {
      return Image.memory(
        mediaFile.platformFile.bytes!,
        fit: BoxFit.cover,
        errorBuilder: (context, error, stackTrace) => _buildErrorPreview(),
      );
    }

    // On native platforms, use file path if bytes not available
    if (!kIsWeb && mediaFile.platformFile.path != null) {
      return Image.file(
        File(mediaFile.platformFile.path!),
        fit: BoxFit.cover,
        errorBuilder: (context, error, stackTrace) => _buildErrorPreview(),
      );
    }

    return _buildErrorPreview();
  }

  Widget _buildVideoPreview(BuildContext context) {
    return VideoPreviewWidget(
      mediaFile: mediaFile,
      size: size,
    );
  }

  Widget _buildAudioPreview(BuildContext context) {
    return AudioPreviewWidget(
      mediaFile: mediaFile,
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
