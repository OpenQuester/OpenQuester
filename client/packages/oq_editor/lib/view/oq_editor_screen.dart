import 'dart:async';

import 'package:auto_route/auto_route.dart';
import 'package:flutter/material.dart';
import 'package:oq_editor/controllers/oq_editor_controller.dart';
import 'package:oq_editor/models/package_encoding_exceptions.dart';
import 'package:oq_editor/utils/package_encoding_helper.dart';
import 'package:oq_editor/view/dialogs/encoding_progress_dialog.dart';
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

    return Scaffold(
      body: MaxSizeContainer(
        child: Scaffold(
          appBar: AppBar(
            title: Text(controller.translations.editorTitle),
            leading: BackButton(
              onPressed: () async {
                final routerContext =
                    controller.navigationContext.currentContext ?? context;
                final shouldPop = await _showExitDialog(routerContext);
                if (shouldPop ?? false) {
                  if (routerContext.mounted) {
                    routerContext.router.pop();
                  }
                }
              },
            ),
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
          body: AutoRouter(
            navigatorKey: controller.navigationContext,
          ),
        ),
      ),
    );
  }

  /// Show exit dialog with options to discard, save, or save as file
  Future<bool?> _showExitDialog(BuildContext context) async {
    return showDialog<bool>(
      context: context,
      useRootNavigator: false,
      builder: (context) => AlertDialog(
        title: Text(controller.translations.leaveWarning),
        actions: [
          TextButton(
            onPressed: () => context.router.pop(false),
            child: Text(controller.translations.continueEditing),
          ),
          TextButton(
            onPressed: () => context.router.pop(true),
            style: TextButton.styleFrom(
              foregroundColor: Colors.red,
            ),
            child: Text(controller.translations.leave),
          ),
          TextButton(
            onPressed: () async {
              unawaited(_handleExport(context));
              await context.router.maybePop(false);
            },
            child: Text(controller.translations.saveAsFile),
          ),
          FilledButton(
            onPressed: () async {
              unawaited(_handleSave(context));
              await context.router.maybePop(false);
            },
            child: Text(controller.translations.saveToServer),
          ),
        ],
      ),
    );
  }

  Future<void> _handleSave(BuildContext context) async {
    if (!context.mounted) return;

    try {
      // Use shared encoding helper for all encoding and progress handling
      await PackageEncodingHelper.executePackageUpload(
        context,
        controller: controller,
        uploadFunction: controller.savePackage,
        translations: controller.translations,
      );

      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(controller.translations.saveButton),
            backgroundColor: Colors.green,
          ),
        );
      }
    } on UploadCancelledException {
      // User cancelled - check if they want to export instead
      if (!context.mounted) return;
      await _handleExport(context);
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

  /// Build package size indicator for the app bar bottom
  PreferredSizeWidget? _buildPackageSizeIndicator() {
    return PreferredSize(
      preferredSize: const Size.fromHeight(32),
      child: PackageSizeIndicator(controller: controller),
    );
  }
}
