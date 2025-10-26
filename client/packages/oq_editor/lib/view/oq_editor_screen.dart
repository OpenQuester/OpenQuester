import 'dart:async';

import 'package:flutter/material.dart';
import 'package:oq_compress/oq_compress.dart';
import 'package:oq_editor/controllers/oq_editor_controller.dart';
import 'package:oq_editor/models/editor_step.dart';
import 'package:oq_editor/view/dialogs/encoding_progress_dialog.dart';
import 'package:oq_editor/view/dialogs/encoding_warning_dialog.dart';
import 'package:oq_editor/view/dialogs/saving_progress_dialog.dart';
import 'package:oq_editor/view/screens/package_info_screen.dart';
import 'package:oq_editor/view/screens/questions_list_screen.dart';
import 'package:oq_editor/view/screens/round_editor_screen.dart';
import 'package:oq_editor/view/screens/rounds_list_screen.dart';
import 'package:oq_editor/view/screens/theme_editor_screen.dart';
import 'package:oq_editor/view/screens/themes_grid_screen.dart';
import 'package:oq_editor/view/widgets/package_size_indicator.dart';
import 'package:oq_shared/oq_shared.dart';
import 'package:watch_it/watch_it.dart';

class OqEditorScreen extends WatchingWidget {
  const OqEditorScreen({required this.controller, super.key});
  final OqEditorController controller;

  @override
  Widget build(BuildContext context) {
    callOnce(
      (context) {
        if (GetIt.I.isRegistered<OqEditorController>()) return;
        GetIt.I.registerSingleton<OqEditorController>(controller);
      },
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
              bottom: _buildPackageSizeIndicator(),
              actions: [
                // Import button (handles both .oq and .siq files)
                Builder(
                  builder: (buttonContext) => LoadingButtonBuilder(
                    onPressed: () => _handleImport(buttonContext),
                    onError: (error, stackTrace) => _handleButtonError(
                      buttonContext,
                      controller.translations.errorImporting,
                      error,
                      stackTrace,
                    ),
                    builder: (context, child, onPressed) {
                      return IconButton(
                        icon: child,
                        onPressed: onPressed,
                        tooltip: controller.translations.importPackage,
                      );
                    },
                    child: const Icon(Icons.upload_file),
                  ),
                ),
                // Export button
                Builder(
                  builder: (buttonContext) => LoadingButtonBuilder(
                    onPressed: () => _handleExport(buttonContext),
                    onError: (error, stackTrace) => _handleButtonError(
                      buttonContext,
                      controller.translations.errorExporting,
                      error,
                      stackTrace,
                    ),
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
                    onError: (error, stackTrace) => _handleButtonError(
                      buttonContext,
                      controller.translations.errorSaving,
                      error,
                      stackTrace,
                    ),
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
        title: Text(controller.translations.leaveWarning),
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
            child: Text(controller.translations.leave),
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
    if (!context.mounted) return;

    // Check if encoding is supported and if there are media files
    final hasMediaFiles = controller.pendingMediaFiles.isNotEmpty;
    if (hasMediaFiles) {
      final isEncodingSupported = await OqFileEncoder.isSupported();

      if (!isEncodingSupported) {
        if (!context.mounted) return;

        // Show warning dialog for unsupported encoding
        final totalSizeMB = controller.totalMediaFilesSizeMB;
        final action = await showDialog<EncodingWarningAction>(
          context: context,
          builder: (context) => EncodingWarningDialog(
            translations: controller.translations,
            totalSizeMB: totalSizeMB,
          ),
        );

        if (!context.mounted) return;

        switch (action) {
          case EncodingWarningAction.export:
            await _handleExport(context);
            return;
          case EncodingWarningAction.upload:
            // Continue with upload
            break;
          case null:
            // User cancelled
            return;
        }
      }
    }

    // Check if we need to show encoding progress
    var encodingDialogShown = false;

    try {
      // Show encoding progress dialog if there are media files to encode
      if (hasMediaFiles) {
        if (!context.mounted) return;

        encodingDialogShown = true;
        unawaited(
          showDialog<void>(
            context: context,
            barrierDismissible: false,
            builder: (_) => EncodingProgressDialog(
              progressStream: controller.encodingProgressStream,
              translations: controller.translations,
              title: controller.translations.encodingForUpload,
            ),
          ),
        );
      }

      // Start the save process (this will create the encoding stream if needed)
      final future = controller.savePackage();

      // Wait a moment for encoding stream to be created if needed
      if (hasMediaFiles) {
        await Future<void>.delayed(const Duration(milliseconds: 100));
      }

      // Show upload progress dialog after encoding is done or if no
      // encoding needed
      if (context.mounted) {
        unawaited(
          showDialog<void>(
            context: context,
            barrierDismissible: false,
            builder: (_) => SavingProgressDialog(
              progressStream: controller.onSaveProgressStream,
              translations: controller.translations,
            ),
          ),
        );
      }

      await future;

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
        Navigator.of(context).pop(); // Close upload progress dialog
        if (encodingDialogShown) {
          Navigator.of(context).pop(); // Close encoding progress dialog
        }
      }
    }
  }

  Future<void> _handleImport(BuildContext context) async {
    try {
      // Use unified picker to get file with extension detection
      final fileResult = await controller.pickPackageFile();
      if (fileResult == null) return; // User cancelled

      // Import based on detected extension (picker validates extension)
      if (fileResult.extension == 'oq') {
        await controller.importOqPackage(fileResult.bytes);
        if (!context.mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              controller.translations.packageImportedSuccessfully,
            ),
            backgroundColor: Colors.green,
          ),
        );
      } else {
        // SIQ file - no encoding warning needed for import
        await controller.importSiqPackageFromBytes(fileResult.bytes);
        if (!context.mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              controller.translations.siqPackageImportedSuccessfully,
            ),
            backgroundColor: Colors.green,
          ),
        );
      }
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
    // Check if we need to show encoding progress
    final hasMediaFiles = controller.pendingMediaFiles.isNotEmpty;
    var encodingDialogShown = false;

    try {
      // Show encoding progress dialog if there are media files to encode
      if (hasMediaFiles) {
        if (!context.mounted) return;

        encodingDialogShown = true;
        unawaited(
          showDialog<void>(
            context: context,
            barrierDismissible: false,
            builder: (_) => EncodingProgressDialog(
              progressStream: controller.encodingProgressStream,
              translations: controller.translations,
              title: controller.translations.encodingForExport,
            ),
          ),
        );
      }

      await controller.exportPackage();

      if (context.mounted) {
        if (encodingDialogShown) {
          Navigator.of(context).pop(); // Close encoding progress dialog
        }

        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(controller.translations.packageExportedSuccessfully),
            backgroundColor: Colors.green,
          ),
        );
      }
    } catch (error) {
      if (context.mounted) {
        if (encodingDialogShown) {
          Navigator.of(context).pop(); // Close encoding progress dialog
        }

        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              '${controller.translations.errorExporting}: $error',
            ),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  /// Common error handler for button operations
  void _handleButtonError(
    BuildContext context,
    String errorPrefix,
    Object error,
    StackTrace stackTrace,
  ) {
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('$errorPrefix: $error'),
          backgroundColor: Colors.red,
        ),
      );
    }
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

  /// Build package size indicator for the app bar bottom
  PreferredSizeWidget? _buildPackageSizeIndicator() {
    return PreferredSize(
      preferredSize: const Size.fromHeight(32),
      child: PackageSizeIndicator(controller: controller),
    );
  }
}
