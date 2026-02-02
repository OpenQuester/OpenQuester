import 'package:flutter/material.dart';
import 'package:oq_editor/models/oq_editor_translations.dart';
import 'package:oq_shared/oq_shared.dart';

enum EncodingWarningAction {
  upload,
  export,
}

class EncodingWarningDialog extends StatelessWidget {
  const EncodingWarningDialog({
    required this.translations,
    required this.totalSizeMB,
    super.key,
  });

  final OqEditorTranslations translations;
  final double totalSizeMB;

  @override
  Widget build(BuildContext context) {
    return Dialog(
      constraints: BoxConstraints(
        maxWidth: UiModeUtils.maximumDialogWidth(context),
      ),
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Title with warning icon
            Row(
              children: [
                Icon(
                  Icons.warning_amber_rounded,
                  size: 32,
                  color: Theme.of(context).colorScheme.error,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    translations.encodingNotSupportedTitle,
                    style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),

            // Main message
            Text(
              translations.encodingNotSupportedMessage,
              style: Theme.of(context).textTheme.bodyLarge,
            ),
            const SizedBox(height: 12),

            // Details with size information
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Theme.of(
                  context,
                ).colorScheme.errorContainer.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(
                  color: Theme.of(
                    context,
                  ).colorScheme.error.withValues(alpha: 0.2),
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    translations.encodingNotSupportedDetails(totalSizeMB),
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    translations.exportRecommended,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      fontWeight: FontWeight.w500,
                      color: Theme.of(context).colorScheme.primary,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // Action buttons
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                // Upload now button
                TextButton.icon(
                  onPressed: () => Navigator.of(context).pop(
                    EncodingWarningAction.upload,
                  ),
                  icon: const Icon(Icons.cloud_upload),
                  label: Text(translations.uploadNowButton),
                  style: TextButton.styleFrom(
                    foregroundColor: Theme.of(context).colorScheme.error,
                  ),
                ),
                const SizedBox(width: 12),

                // Export and upload button (recommended)
                FilledButton.icon(
                  onPressed: () => Navigator.of(context).pop(
                    EncodingWarningAction.export,
                  ),
                  icon: const Icon(Icons.download),
                  label: Text(translations.exportAndUploadButton),
                  style: FilledButton.styleFrom(
                    backgroundColor: Theme.of(context).colorScheme.primary,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
