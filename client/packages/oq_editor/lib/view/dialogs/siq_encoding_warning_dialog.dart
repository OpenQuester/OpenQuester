import 'package:flutter/material.dart';
import 'package:oq_editor/models/oq_editor_translations.dart';
import 'package:oq_shared/oq_shared.dart';

/// Dialog that warns about SIQ file encoding issues before import
class SiqEncodingWarningDialog extends StatelessWidget {
  const SiqEncodingWarningDialog({
    required this.translations,
    super.key,
  });

  final OqEditorTranslations translations;

  @override
  Widget build(BuildContext context) {
    return Dialog(
      constraints: const BoxConstraints(
        maxWidth: UiModeUtils.maximumDialogWidth,
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
                    translations.siqEncodingWarningTitle,
                    style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),

            // Main warning message
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
              child: Text(
                translations.siqEncodingWarningMessage,
                style: Theme.of(context).textTheme.bodyMedium,
              ),
            ),
            const SizedBox(height: 24),

            // Action buttons
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                // Cancel button
                TextButton(
                  onPressed: () => Navigator.of(context).pop(false),
                  child: Text(
                    MaterialLocalizations.of(context).cancelButtonLabel,
                  ),
                ),
                const SizedBox(width: 12),

                // Continue button (recommended)
                FilledButton.icon(
                  onPressed: () => Navigator.of(context).pop(true),
                  icon: const Icon(Icons.file_upload),
                  label: Text(translations.siqImportContinue),
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
