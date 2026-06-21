import 'package:flutter/material.dart';
import 'package:openquester/openquester.dart';
import 'package:updat/theme/dialogs/default.dart';
import 'package:updat/updat.dart';

class UpdateBtn extends StatelessWidget {
  const UpdateBtn({super.key});

  @override
  Widget build(BuildContext context) {
    if (!getIt<AutoUpdateController>().showUpdateBtn) {
      return const SizedBox.shrink();
    }

    return UpdatWidget(
      currentVersion: getIt<AutoUpdateController>().getCurrentVersion,
      getLatestVersion: getIt<AutoUpdateController>().getLatestVersion,
      getBinaryUrl: (_) async => '',
      appName: LocaleKeys.openquester.tr(),
      updateDialogBuilder:
          ({
            required appVersion,
            required changelog,
            required checkForUpdate,
            required context,
            required dismissUpdate,
            required latestVersion,
            required launchInstaller,
            required openDialog,
            required startUpdate,
            required status,
          }) {
            defaultDialog(
              context: context,
              latestVersion: latestVersion,
              appVersion: appVersion,
              status: status,
              changelog: changelog,
              checkForUpdate: checkForUpdate,
              openDialog: openDialog,
              startUpdate: getIt<AutoUpdateController>().openInstallFile,
              launchInstaller: launchInstaller,
              dismissUpdate: dismissUpdate,
            );
          },
    );
  }
}
