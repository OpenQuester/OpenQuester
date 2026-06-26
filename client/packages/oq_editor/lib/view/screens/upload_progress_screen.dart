import 'dart:async';

import 'package:auto_route/auto_route.dart';
import 'package:flutter/material.dart';
import 'package:oq_editor/controllers/oq_editor_controller.dart';
import 'package:oq_editor/domain/package_editor_operation_state.dart';
import 'package:watch_it/watch_it.dart';

@RoutePage()
class UploadProgressScreen extends WatchingStatefulWidget {
  const UploadProgressScreen({super.key});

  @override
  State<UploadProgressScreen> createState() => _UploadProgressScreenState();
}

class _UploadProgressScreenState extends State<UploadProgressScreen> {
  late final OqEditorController controller = GetIt.I<OqEditorController>();
  bool _uploadStarted = false;

  @override
  void initState() {
    super.initState();
    unawaited(_startUpload());
  }

  Future<void> _startUpload() async {
    if (_uploadStarted) return;
    _uploadStarted = true;
    try {
      await controller.savePackage();
    } catch (_) {
      // The controller owns user-facing error state and process logs.
    }
  }

  Future<void> _retryUpload() async {
    setState(() {
      _uploadStarted = false;
    });
    controller.clearOperationLogs();
    await _startUpload();
  }

  @override
  Widget build(BuildContext context) {
    final translations = controller.translations;
    final operation = watch(controller.operationState).value;
    final progress = operation.map(
      idle: (_) => 0.0,
      running: (state) => state.progress,
      completed: (_) => 1.0,
      failed: (_) => null,
    );
    final message = operation.map(
      idle: (_) => translations.initializing,
      running: (state) => state.message ?? translations.pleaseWait,
      completed: (state) => state.message ?? translations.uploadSucceeded,
      failed: (state) => state.error.toString(),
    );

    return Scaffold(
      appBar: AppBar(
        title: Text(translations.uploadPackageTitle),
        actions: [
          IconButton(
            icon: const Icon(Icons.receipt_long_outlined),
            onPressed: () => _showProcessLogs(context),
            tooltip: translations.showProcessLogs,
          ),
        ],
      ),
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 560),
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _UploadStatusHeader(
                  operation: operation,
                  message: message,
                ),
                const SizedBox(height: 24),
                LinearProgressIndicator(value: progress),
                const SizedBox(height: 8),
                Text(
                  _phaseLabel(operation),
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
                ),
                const SizedBox(height: 24),
                _UploadActions(
                  operation: operation,
                  onRetry: _retryUpload,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  String _phaseLabel(PackageEditorOperationState operation) {
    return operation.map(
      idle: (_) => controller.translations.initializing,
      running: (state) => switch (state.phase) {
        PackageEditorOperationPhase.importPicking =>
          controller.translations.importPackage,
        PackageEditorOperationPhase.importParsing =>
          controller.translations.errorImporting,
        PackageEditorOperationPhase.encoding =>
          controller.translations.encodingForUpload,
        PackageEditorOperationPhase.exporting =>
          controller.translations.exportPackage,
        PackageEditorOperationPhase.creatingPackage =>
          controller.translations.creatingPackage,
        PackageEditorOperationPhase.uploadingMedia =>
          controller.translations.uploading,
        PackageEditorOperationPhase.finalizing =>
          controller.translations.finalizingEncoding,
      },
      completed: (_) => controller.translations.uploadSucceeded,
      failed: (_) => controller.translations.uploadFailed,
    );
  }

  Future<void> _showProcessLogs(BuildContext context) async {
    await showDialog<void>(
      context: context,
      useRootNavigator: false,
      builder: (context) => AlertDialog(
        title: Text(controller.translations.processLogs),
        content: SizedBox(
          width: 640,
          child: SingleChildScrollView(
            child: SelectableText(controller.operationLogText),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => context.router.pop(),
            child: Text(controller.translations.closeButton),
          ),
        ],
      ),
    );
  }
}

class _UploadStatusHeader extends StatelessWidget {
  const _UploadStatusHeader({
    required this.operation,
    required this.message,
  });

  final PackageEditorOperationState operation;
  final String message;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final icon = operation.map(
      idle: (_) => Icons.hourglass_empty,
      running: (_) => Icons.cloud_upload_outlined,
      completed: (_) => Icons.check_circle_outline,
      failed: (_) => Icons.error_outline,
    );
    final color = operation.map(
      idle: (_) => colorScheme.primary,
      running: (_) => colorScheme.primary,
      completed: (_) => colorScheme.primary,
      failed: (_) => colorScheme.error,
    );

    return Row(
      children: [
        Icon(icon, size: 40, color: color),
        const SizedBox(width: 16),
        Expanded(
          child: Text(
            message,
            style: Theme.of(context).textTheme.titleMedium,
          ),
        ),
      ],
    );
  }
}

class _UploadActions extends StatelessWidget {
  const _UploadActions({
    required this.operation,
    required this.onRetry,
  });

  final PackageEditorOperationState operation;
  final Future<void> Function() onRetry;

  @override
  Widget build(BuildContext context) {
    final controller = GetIt.I<OqEditorController>();
    final translations = controller.translations;
    final isRunning = operation.isRunning;
    final failed = operation is PackageEditorOperationFailed;

    return OverflowBar(
      alignment: MainAxisAlignment.end,
      spacing: 8,
      overflowSpacing: 8,
      children: [
        TextButton(
          onPressed: isRunning ? null : () => context.router.maybePop(),
          child: Text(translations.backToEditor),
        ),
        if (failed)
          FilledButton.icon(
            onPressed: onRetry,
            icon: const Icon(Icons.refresh),
            label: Text(translations.retryUpload),
          ),
      ],
    );
  }
}
