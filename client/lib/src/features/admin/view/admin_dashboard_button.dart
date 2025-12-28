import 'package:flutter/material.dart';
import 'package:openquester/common_imports.dart';

class AdminDashboardButton extends WatchingWidget {
  const AdminDashboardButton({super.key});

  @override
  Widget build(BuildContext context) {
    final user = watchValue((ProfileController e) => e.user);
    final hasAdminAccess = user.havePermission(PermissionName.adminPanelAccess);

    // Only show button if user has admin access
    if (!hasAdminAccess) {
      return const SizedBox.shrink();
    }

    return FloatingActionButton.extended(
      heroTag: 'admin_dashboard',
      foregroundColor: context.theme.colorScheme.onErrorContainer,
      backgroundColor: context.theme.colorScheme.errorContainer,
      onPressed: () => const AdminDashboardRoute().push<void>(context),
      label: Text(LocaleKeys.admin_dashboard.tr()),
      icon: const Icon(Icons.admin_panel_settings),
    );
  }
}
