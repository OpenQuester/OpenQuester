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
        try {
          final result = await getIt<PackageUploadController>().pickAndUpload();

          if (result != null) {
            await getIt<ToastController>().show(
              LocaleKeys.package_uploaded.tr(),
              type: ToastType.success,
            );
          }
          if (afterUpload != null && result != null) {
            final package = await getIt<PackageController>().getPackage(result);
            afterUpload!(package.toListItem());
          }
        } catch (e) {
          if (!context.mounted) return;
          await getIt<ToastController>().show(e);
        }
      },
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
}
