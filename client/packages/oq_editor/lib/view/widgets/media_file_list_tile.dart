import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';
import 'package:nb_utils/nb_utils.dart';
import 'package:oq_editor/controllers/oq_editor_controller.dart';
import 'package:oq_editor/models/ui_media_file.dart';
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

  final UiMediaFile mediaFile;
  final VoidCallback onEditDisplayTime;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    final controller = GetIt.I<OqEditorController>();
    final translations = controller.translations;

    final title = Text(
      mediaFile.fileName,
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
    );
    final subtitle = Text(
      _buildSubtitle(),
      style: Theme.of(context).textTheme.bodySmall,
    );

    return LayoutBuilder(
      builder: (context, constrains) {
        final overflow = constrains.maxWidth < 500;
        return Card(
          margin: const EdgeInsets.symmetric(vertical: 4),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              ListTile(
                leading: MediaPreviewWidget(
                  mediaFile: mediaFile.reference,
                  type: mediaFile.type,
                ),
                title: overflow ? null : title,
                subtitle: overflow ? null : subtitle,
                trailing: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    IconButton(
                      icon: const Icon(Icons.open_in_full),
                      onPressed: () =>
                          MediaPreviewDialog.show(context, mediaFile),
                      tooltip: translations.preview,
                    ),
                    IconButton(
                      icon: const Icon(Icons.timer),
                      onPressed: onEditDisplayTime,
                      tooltip: translations.editDisplayTime,
                    ),
                    IconButton(
                      icon: const Icon(Icons.delete),
                      onPressed: onRemove,
                      tooltip: translations.removeFile,
                    ),
                  ],
                ),
              ),
              if (overflow)
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [title, subtitle],
                ).paddingSymmetric(horizontal: 16).paddingTop(8),
            ],
          ),
        );
      },
    );
  }

  String _buildSubtitle() {
    final controller = GetIt.I<OqEditorController>();
    final translations = controller.translations;

    final parts = <String>[
      // Type
      mediaFile.type.name,
      // Display time
      translations.displayTimeValue(mediaFile.displayTime),
    ];

    // File size
    if (mediaFile.fileSize != null) {
      parts.add(formatFileSize(mediaFile.fileSize!));
    }

    return parts.join(' • ');
  }
}
