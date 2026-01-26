import 'package:flutter/material.dart';
import 'package:oq_editor/models/oq_editor_translations.dart';
import 'package:oq_shared/oq_shared.dart';

/// Progress dialog specifically for encoding operations
/// Shows encoding progress with detailed steps
class EncodingProgressDialog extends StatelessWidget {
  const EncodingProgressDialog({
    required this.translations,
    required this.progressStream,
    required this.title,
    super.key,
  });

  /// Progress stream for encoding operations
  final Stream<double> progressStream;

  /// Translations provider
  final OqEditorTranslations translations;

  /// Dialog title (e.g., "Encoding for Export", "Encoding for Upload")
  final String title;

  @override
  Widget build(BuildContext context) {
    return Dialog(
      constraints: BoxConstraints(
        maxWidth: UiModeUtils.maximumDialogWidth(context),
      ),
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: StreamBuilder<double>(
          stream: progressStream,
          initialData: 0,
          builder: (context, snapshot) {
            final progress = snapshot.data ?? 0;
            final progressPercentage = (progress * 100).toInt();

            return Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                LinearProgressIndicator(
                  value: progress,
                  minHeight: 8,
                  backgroundColor: Colors.grey[300],
                ),
                const SizedBox(height: 16),
                Text(
                  title,
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: 8),
                Text(
                  _getProgressMessage(progress),
                  style: Theme.of(context).textTheme.bodySmall,
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 4),
                Text(
                  '$progressPercentage%',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    fontWeight: FontWeight.bold,
                    color: Theme.of(context).colorScheme.primary,
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }

  String _getProgressMessage(double progress) {
    if (progress <= 0.3) {
      return translations.preparingFiles;
    } else if (progress <= 0.9) {
      return translations.compressingFiles;
    } else {
      return translations.finalizingEncoding;
    }
  }
}
