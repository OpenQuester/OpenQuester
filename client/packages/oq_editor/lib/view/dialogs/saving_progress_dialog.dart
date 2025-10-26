import 'dart:async';
import 'package:flutter/material.dart';
import 'package:oq_editor/models/oq_editor_translations.dart';
import 'package:oq_editor/models/package_upload_state.dart';
import 'package:oq_shared/oq_shared.dart';

/// Progress dialog shown during package save
/// Shows linear progress bar if progressStream is provided
class SavingProgressDialog extends StatelessWidget {
  const SavingProgressDialog({
    required this.translations,
    this.progressStream,
    super.key,
  });

  /// Optional stream of upload progress states
  /// If null, shows indeterminate progress
  final Stream<PackageUploadState>? progressStream;
  final OqEditorTranslations translations;

  @override
  Widget build(BuildContext context) {
    return Dialog(
      constraints: const BoxConstraints(
        maxWidth: UiModeUtils.maximumDialogWidth,
      ),
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: progressStream != null
            ? _buildProgressStreamView(context)
            : _buildIndeterminateView(context),
      ),
    );
  }

  Widget _buildProgressStreamView(BuildContext context) {
    return StreamBuilder<PackageUploadState>(
      stream: progressStream,
      initialData: const PackageUploadState.idle(),
      builder: (context, snapshot) {
        // Default values
        var progress = 0.0;
        var message = translations.preparingUpload;

        if (snapshot.hasData) {
          snapshot.data!.map(
            idle: (_) {
              progress = 0.0;
              message = translations.initializing;
            },
            uploading: (s) {
              progress = s.progress;
              message = s.message ?? translations.uploading;
            },
            completed: (_) {
              progress = 1.0;
              message = translations.uploadComplete;
            },
            error: (s) {
              progress = 0.0;
              message = '${translations.errorGeneric}: ${s.error}';
            },
          );
        }

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
              translations.savingPackage,
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 8),
            Text(
              message,
              style: Theme.of(context).textTheme.bodySmall,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 4),
            Text(
              '${(progress * 100).toInt()}%',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                fontWeight: FontWeight.bold,
                color: Theme.of(context).colorScheme.primary,
              ),
            ),
          ],
        );
      },
    );
  }

  Widget _buildIndeterminateView(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        const LinearProgressIndicator(),
        const SizedBox(height: 16),
        Text(
          translations.savingPackage,
          style: Theme.of(context).textTheme.titleMedium,
        ),
        const SizedBox(height: 8),
        Text(
          translations.pleaseWait,
          style: Theme.of(context).textTheme.bodySmall,
          textAlign: TextAlign.center,
        ),
      ],
    );
  }
}
