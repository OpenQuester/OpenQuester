import 'dart:async';

import 'package:flutter/material.dart';
import 'package:openquester/openquester.dart';
import 'package:oq_editor/view/dialogs/encoding_progress_dialog.dart';

class UploadPackageButton extends WatchingWidget {
  const UploadPackageButton({this.afterUpload, super.key});
  final void Function(PackageListItem package)? afterUpload;

  @override
  Widget build(BuildContext context) {
    final controller = watchIt<PackageUploadController>();

    return LoadingButtonBuilder(
      onPressed: () => _handleUpload(context),
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

      if (result == null) return;
      if (!context.mounted) return;

      await getIt<ToastController>().show(
        LocaleKeys.package_uploaded.tr(),
        type: ToastType.success,
      );

      if (afterUpload != null) {
        final package = await getIt<PackageController>().getPackage(result);
        afterUpload!(package.toListItem());
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
        builder: (_) => EncodingProgressDialog(
          progressStream: controller.encodingProgressStream,
          translations: const AppOqEditorTranslations(),
          title: const AppOqEditorTranslations().encodingForExport,
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
