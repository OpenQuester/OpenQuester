import 'dart:async';

import 'package:auto_route/auto_route.dart';
import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';
import 'package:nb_utils/nb_utils.dart';
import 'package:oq_editor/controllers/editor_navigation_controller.dart';
import 'package:oq_editor/controllers/oq_editor_controller.dart';
import 'package:oq_editor/models/editor_navigation_state.dart';
import 'package:oq_editor/models/package_encoding_exceptions.dart';
import 'package:oq_editor/utils/package_encoding_helper.dart';
import 'package:oq_editor/view/dialogs/encoding_progress_dialog.dart';
import 'package:oq_editor/view/widgets/editor_breadcrumb.dart';
import 'package:oq_editor/view/widgets/editor_dashboard.dart';
import 'package:oq_editor/view/widgets/editor_search.dart';
import 'package:oq_editor/view/widgets/editor_sidebar.dart';
import 'package:oq_editor/view/widgets/package_size_indicator.dart';
import 'package:oq_shared/oq_shared.dart';
import 'package:watch_it/watch_it.dart';

class OqEditorBody extends WatchingStatefulWidget {
  const OqEditorBody({
    required this.controller,
    required this.child,
    super.key,
  });
  final OqEditorController controller;
  final Widget child;

  @override
  State<OqEditorBody> createState() => _OqEditorBodyState();
}

class _OqEditorBodyState extends State<OqEditorBody> {
  late final EditorNavigationController _navController;

  OqEditorController get controller => widget.controller;

  @override
  void initState() {
    super.initState();
    _navController = EditorNavigationController();
    // Register the navigation controller
    if (!GetIt.I.isRegistered<EditorNavigationController>()) {
      GetIt.I.registerSingleton<EditorNavigationController>(_navController);
    }
  }

  @override
  void dispose() {
    if (GetIt.I.isRegistered<EditorNavigationController>()) {
      GetIt.I.unregister<EditorNavigationController>(instance: _navController);
    }
    _navController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final navController = watchIt<EditorNavigationController>();
    final isWideMode = UiModeUtils.wideModeOn(context);
    final location = navController.location;

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) async {
        if (didPop) return;
        unawaited(
          Future.microtask(() async {
            if (context.mounted) await _backButtonHandler(context);
          }),
        );
      },
      child: Scaffold(
        body: Row(
          children: [
            // Sidebar (desktop only)
            if (isWideMode) const EditorSidebar(),

            // Main content area
            Expanded(
              child: Column(
                children: [
                  // App bar
                  _buildAppBar(context, isWideMode),

                  // Breadcrumb navigation
                  const EditorBreadcrumb(),

                  // Package size indicator
                  PackageSizeIndicator(controller: controller),

                  // Main content
                  Expanded(
                    child: _buildMainContent(location),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildAppBar(BuildContext context, bool isWideMode) {
    return Container(
      height: 64,
      padding: const EdgeInsets.symmetric(horizontal: 8),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        border: Border(
          bottom: BorderSide(
            color: Theme.of(context).colorScheme.outlineVariant,
          ),
        ),
      ),
      child: Row(
        children: [
          // Back button / Menu
          if (!isWideMode)
            IconButton(
              icon: const Icon(Icons.menu),
              onPressed: () => _showMobileDrawer(context),
              tooltip: 'Menu',
            )
          else
            IconButton(
              icon: const Icon(Icons.arrow_back),
              onPressed: () => _backButtonHandler(context),
              tooltip: controller.translations.backButton,
            ),

          const SizedBox(width: 8),

          // Title
          Expanded(
            child: Text(
              controller.translations.editorTitle,
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
            ),
          ),

          // Search
          if (isWideMode)
            const SizedBox(
              width: 300,
              child: EditorSearchBar(),
            )
          else
            const EditorSearchButton(),

          const SizedBox(width: 8),

          // Actions
          _buildActionButtons(context),
        ],
      ),
    );
  }

  Widget _buildActionButtons(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        // Import button
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
              return FilledButton.icon(
                icon: child,
                label: Text(controller.translations.saveButton),
                onPressed: onPressed,
              );
            },
            child: const Icon(Icons.save, size: 18),
          ),
        ),
      ],
    );
  }

  Widget _buildMainContent(EditorNavigationLocation location) {
    // Show dashboard for DashboardLocation
    if (location is DashboardLocation) {
      return const EditorDashboard();
    }

    // For all other locations, show the router content
    return widget.child;
  }

  void _showMobileDrawer(BuildContext context) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (context) => DraggableScrollableSheet(
        initialChildSize: 0.7,
        minChildSize: 0.3,
        maxChildSize: 0.9,
        expand: false,
        builder: (context, scrollController) => Column(
          children: [
            Container(
              width: 40,
              height: 4,
              margin: const EdgeInsets.symmetric(vertical: 12),
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.outline,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            Expanded(
              child: SingleChildScrollView(
                controller: scrollController,
                child: const EditorSidebar(),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _backButtonHandler(BuildContext context) async {
    final router = context.router;

    if (router.pageCount < 2) {
      final exit = await _showExitDialog(context);
      if (exit ?? false) router.parent()?.pop();
    } else {
      router.pop();
    }
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
}
