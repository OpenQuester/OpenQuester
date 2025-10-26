import 'package:flutter/material.dart';
import 'package:oq_editor/controllers/oq_editor_controller.dart';
import 'package:watch_it/watch_it.dart';

/// Package size indicator widget that shows the total size of media files
class PackageSizeIndicator extends WatchingWidget {
  const PackageSizeIndicator({
    required this.controller,
    super.key,
  });
  final OqEditorController controller;

  @override
  Widget build(BuildContext context) {
    final totalSizeMB = watchValue<OqEditorController, double>(
      (c) => c.totalSizeMBNotifier,
    );

    if (totalSizeMB <= 0) {
      return const SizedBox.shrink();
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surfaceContainer,
        border: Border(
          top: BorderSide(
            color: Theme.of(context).colorScheme.outline.withValues(alpha: 0.2),
          ),
        ),
      ),
      child: Row(
        children: [
          Icon(
            Icons.folder_outlined,
            size: 16,
            color: Theme.of(context).colorScheme.onSurfaceVariant,
          ),
          const SizedBox(width: 8),
          Text(
            controller.translations.packageSizeMB(totalSizeMB),
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: Theme.of(context).colorScheme.onSurfaceVariant,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }
}
