import 'dart:async';

import 'package:flutter/material.dart';
import 'package:openquester/openquester.dart';

class UploadPackageButton extends WatchingWidget {
  const UploadPackageButton({this.afterUpload, super.key});

  final void Function(PackageListItem package)? afterUpload;

  @override
  Widget build(BuildContext context) {
    final controller = watchIt<PackageUploadController>();

    return LoadingButtonBuilder(
      onPressed: () async {
        await _handleUpload(context);
      },
      onError: handleError,
      child: const Icon(Icons.upload),
      builder: (context, child, onPressed) {
        return FilledButton.icon(
          key: const Key('upload_key'),
          onPressed: onPressed,
          label: Text(
            [
              LocaleKeys.upload.tr(),
              if (controller.loading && controller.progress != 0)
                [(100 * controller.progress).ceil(), '%'].join(),
            ].join(' '),
          ),
          icon: child,
        );
      },
    );
  }

  Future<void> _handleUpload(BuildContext context) async {
    final controller = getIt<PackageUploadController>();
    VoidCallback? closeEncodingDialog;

    try {
      // Start upload process (includes file picking)
      final uploadFuture = controller.pickAndUpload();

      // Show encoding progress dialog after a short delay
      // This gives time for the file to be picked and parsed
      await Future<void>.delayed(const Duration(milliseconds: 500));

      if (controller.loading && context.mounted) {
        // Show encoding dialog if still loading
        closeEncodingDialog = _showEncodingDialog(context, controller);
      }

      final result = await uploadFuture;

      // Close encoding dialog if shown
      closeEncodingDialog?.call();

      if (result != null) {
        if (!context.mounted) return;

        await getIt<ToastController>().show(
          LocaleKeys.package_uploaded.tr(),
          type: ToastType.success,
        );

        if (afterUpload != null) {
          final package = await getIt<PackageController>().getPackage(result);
          afterUpload!(package.toListItem());
        }
      }
    } catch (e) {
      closeEncodingDialog?.call();
      if (!context.mounted) return;
      await getIt<ToastController>().show(e);
    }
  }

  VoidCallback? _showEncodingDialog(
    BuildContext context,
    PackageUploadController controller,
  ) {
    if (!context.mounted) return null;

    unawaited(
      showDialog<void>(
        context: context,
        barrierDismissible: false,
        builder: (_) => Dialog(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: StreamBuilder<double>(
              stream: controller.encodingProgressStream,
              initialData: 0,
              builder: (context, snapshot) {
                final progress = snapshot.data ?? 0;

                return Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      LocaleKeys.oq_editor_encoding_for_upload.tr(),
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                    const SizedBox(height: 24),
                    LinearProgressIndicator(
                      value: progress,
                      minHeight: 8,
                    ),
                    const SizedBox(height: 16),
                    Text(
                      '${(progress * 100).toInt()}%',
                      style: Theme.of(context).textTheme.bodyLarge,
                    ),
                  ],
                );
              },
            ),
          ),
        ),
      ),
    );

    return () {
      if (context.mounted) {
        Navigator.of(context).pop(); // Close encoding dialog
      }
    };
  }
}
