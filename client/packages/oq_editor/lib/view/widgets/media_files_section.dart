import 'package:flutter/material.dart';
import 'package:oq_editor/models/media_file_reference.dart';
import 'package:oq_editor/view/widgets/media_file_list_tile.dart';

/// Section widget for managing media files
class MediaFilesSection extends StatelessWidget {
  const MediaFilesSection({
    required this.title,
    required this.files,
    required this.onAdd,
    required this.onEditDisplayTime,
    required this.onRemove,
    super.key,
  });

  final String title;
  final List<MediaFileReference> files;
  final VoidCallback onAdd;
  final void Function(int index) onEditDisplayTime;
  final void Function(int index) onRemove;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.add),
                  onPressed: onAdd,
                  tooltip: 'Add media file',
                ),
              ],
            ),
            if (files.isEmpty)
              const Padding(
                padding: EdgeInsets.all(8),
                child: Text('No media files added'),
              )
            else
              ...files.asMap().entries.map((entry) {
                final index = entry.key;
                final file = entry.value;
                return MediaFileListTile(
                  mediaFile: file,
                  onEditDisplayTime: () => onEditDisplayTime(index),
                  onRemove: () => onRemove(index),
                );
              }),
          ],
        ),
      ),
    );
  }
}
