import 'package:flutter/material.dart';
import 'package:oq_editor/models/media_file_reference.dart';
import 'package:oq_editor/utils/media_utils.dart';
import 'package:oq_editor/view/dialogs/media_preview_dialog.dart';
import 'package:oq_editor/view/widgets/media_preview_widget.dart';

/// List tile displaying a media file with preview and actions
class MediaFileListTile extends StatelessWidget {
  const MediaFileListTile({
    required this.mediaFile,
    required this.onEditDisplayTime,
    required this.onRemove,
    super.key,
  });

  final MediaFileReference mediaFile;
  final VoidCallback onEditDisplayTime;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.symmetric(vertical: 4),
      child: ListTile(
        leading: GestureDetector(
          onTap: () => MediaPreviewDialog.show(context, mediaFile),
          child: MediaPreviewWidget(mediaFile: mediaFile),
        ),
        title: Text(
          mediaFile.fileName,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        subtitle: Text(
          _buildSubtitle(),
          style: Theme.of(context).textTheme.bodySmall,
        ),
        trailing: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            IconButton(
              icon: const Icon(Icons.open_in_full),
              onPressed: () => MediaPreviewDialog.show(context, mediaFile),
              tooltip: 'Preview',
            ),
            IconButton(
              icon: const Icon(Icons.timer),
              onPressed: onEditDisplayTime,
              tooltip: 'Edit display time',
            ),
            IconButton(
              icon: const Icon(Icons.delete),
              onPressed: onRemove,
              tooltip: 'Remove file',
            ),
          ],
        ),
      ),
    );
  }

  String _buildSubtitle() {
    final parts = <String>[
      // Type
      mediaFile.type.name,
      // Display time
      'Display: ${mediaFile.displayTime}ms',
    ];

    // File size
    if (mediaFile.fileSize != null) {
      parts.add(formatFileSize(mediaFile.fileSize!));
    }

    return parts.join(' • ');
  }
}
