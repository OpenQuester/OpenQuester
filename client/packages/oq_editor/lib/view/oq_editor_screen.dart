import 'dart:async';

import 'package:flutter/material.dart';
import 'package:oq_editor/controllers/oq_editor_controller.dart';
import 'package:oq_editor/models/editor_step.dart';
import 'package:oq_editor/models/oq_editor_translations.dart';
import 'package:oq_editor/models/package_upload_state.dart';
import 'package:oq_editor/view/screens/package_info_screen.dart';
import 'package:oq_editor/view/screens/questions_list_screen.dart';
import 'package:oq_editor/view/screens/round_editor_screen.dart';
import 'package:oq_editor/view/screens/rounds_list_screen.dart';
import 'package:oq_editor/view/screens/theme_editor_screen.dart';
import 'package:oq_editor/view/screens/themes_grid_screen.dart';
import 'package:oq_shared/oq_shared.dart';
import 'package:watch_it/watch_it.dart';

class OqEditorScreen extends WatchingWidget {
  const OqEditorScreen({required this.controller, super.key});
  final OqEditorController controller;

  @override
  Widget build(BuildContext context) {
    callOnce(
      (context) => GetIt.I.registerSingleton<OqEditorController>(controller),
      dispose: () =>
          GetIt.I.unregister<OqEditorController>(instance: controller),
    );

    final currentStep = watchValue((OqEditorController c) => c.currentStep);
    final refreshKey = watchValue((OqEditorController c) => c.refreshKey);

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) async {
        if (didPop) return;

        final shouldPop = await _showExitDialog(context);
        if ((shouldPop ?? false) && context.mounted) {
          Navigator.of(context).pop();
        }
      },
      child: Scaffold(
        body: MaxSizeContainer(
          child: Scaffold(
            appBar: AppBar(
              title: Text(controller.translations.editorTitle),
              actions: [
                // Import button
                IconButton(
                  icon: const Icon(Icons.upload_file),
                  onPressed: () => _handleImport(context),
                  tooltip: controller.translations.importPackageTooltip,
                ),
                // Export button
                Builder(
                  builder: (buttonContext) => LoadingButtonBuilder(
                    onPressed: () => _handleExport(buttonContext),
                    onError: (error, stackTrace) {
                      if (buttonContext.mounted) {
                        ScaffoldMessenger.of(buttonContext).showSnackBar(
                          SnackBar(
                            content: Text(
                              '${controller.translations.errorExporting}: '
                              '$error',
                            ),
                            backgroundColor: Colors.red,
                          ),
                        );
                      }
                    },
                    builder: (context, child, onPressed) {
                      return IconButton(
                        icon: child,
                        onPressed: onPressed,
                        tooltip: controller.translations.exportPackageTooltip,
                      );
                    },
                    child: const Icon(Icons.download),
                  ),
                ),
                // Save button
                Builder(
                  builder: (buttonContext) => LoadingButtonBuilder(
                    onPressed: () => _handleSave(buttonContext),
                    onError: (error, stackTrace) {
                      if (buttonContext.mounted) {
                        ScaffoldMessenger.of(buttonContext).showSnackBar(
                          SnackBar(
                            content: Text(
                              '${controller.translations.errorSaving}: $error',
                            ),
                            backgroundColor: Colors.red,
                          ),
                        );
                      }
                    },
                    builder: (context, child, onPressed) {
                      return IconButton(
                        icon: child,
                        onPressed: onPressed,
                        tooltip: controller.translations.saveButton,
                      );
                    },
                    child: const Icon(Icons.save),
                  ),
                ),
              ],
            ),
            body: AnimatedSwitcher(
              key: ValueKey(refreshKey),
              duration: const Duration(milliseconds: 300),
              switchInCurve: Curves.easeInOut,
              switchOutCurve: Curves.easeInOut,
              transitionBuilder: (child, animation) {
                return FadeTransition(
                  opacity: animation,
                  child: SlideTransition(
                    position: Tween<Offset>(
                      begin: const Offset(0.1, 0),
                      end: Offset.zero,
                    ).animate(animation),
                    child: child,
                  ),
                );
              },
              child: _buildCurrentScreen(currentStep),
            ),
          ),
        ),
      ),
    );
  }

  /// Show exit dialog with options to discard, save, or save as file
  Future<bool?> _showExitDialog(BuildContext context) async {
    return showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(controller.translations.unsavedChanges),
        content: Text(controller.translations.unsavedChangesMessage),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: Text(controller.translations.continueEditing),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            style: TextButton.styleFrom(
              foregroundColor: Colors.red,
            ),
            child: Text(controller.translations.discardChanges),
          ),
          TextButton(
            onPressed: () async {
              Navigator.of(context).pop(false);
              await _handleExport(context);
            },
            child: Text(controller.translations.saveAsFile),
          ),
          FilledButton(
            onPressed: () async {
              Navigator.of(context).pop(false);
              await _handleSave(context);
            },
            child: Text(controller.translations.saveToServer),
          ),
        ],
      ),
    );
  }

  Future<void> _handleSave(BuildContext context) async {
    // Show progress dialog
    if (!context.mounted) return;

    unawaited(
      showDialog<void>(
        context: context,
        barrierDismissible: false,
        builder: (_) => _SavingProgressDialog(
          progressStream: controller.onSaveProgressStream,
          translations: controller.translations,
        ),
      ),
    );

    try {
      await controller.savePackage();

      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(controller.translations.saveButton),
            backgroundColor: Colors.green,
          ),
        );
      }
    } catch (error) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              '${controller.translations.errorGeneric}: $error',
            ),
            backgroundColor: Colors.red,
          ),
        );
      }
    } finally {
      if (context.mounted) {
        Navigator.of(context).pop(); // Ensure progress dialog is closed
      }
    }
  }

  Future<void> _handleImport(BuildContext context) async {
    try {
      await controller.importPackage();
      if (!context.mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(controller.translations.packageImportedSuccessfully),
          backgroundColor: Colors.green,
        ),
      );
    } catch (error) {
      if (!context.mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('${controller.translations.errorImporting}: $error'),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  Future<void> _handleExport(BuildContext context) async {
    await controller.exportPackage();
    if (!context.mounted) return;

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(controller.translations.packageExportedSuccessfully),
        backgroundColor: Colors.green,
      ),
    );
  }

  Widget _buildCurrentScreen(EditorStep step) {
    // Use different keys to force AnimatedSwitcher to animate
    switch (step) {
      case EditorStep.packageInfo:
        return const PackageInfoScreen(key: ValueKey('package_info'));
      case EditorStep.roundsList:
        return const RoundsListScreen(key: ValueKey('rounds_list'));
      case EditorStep.roundEditor:
        return const RoundEditorScreen(key: ValueKey('round_editor'));
      case EditorStep.themesGrid:
        return const ThemesGridScreen(key: ValueKey('themes_grid'));
      case EditorStep.themeEditor:
        return const ThemeEditorScreen(key: ValueKey('theme_editor'));
      case EditorStep.questionsList:
        return const QuestionsListScreen(key: ValueKey('questions_list'));
    }
  }
}

/// Progress dialog shown during package save
/// Shows linear progress bar if progressStream is provided
class _SavingProgressDialog extends StatelessWidget {
  const _SavingProgressDialog({
    required this.translations,
    this.progressStream,
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
