import 'package:flutter/material.dart';
import 'package:openquester/common_imports.dart';

class AdminDashboardButton extends WatchingWidget {
  const AdminDashboardButton({
    required this.wideMode,
    super.key,
  });
  final bool wideMode;

  @override
  Widget build(BuildContext context) {
    final user = watchValue((ProfileController e) => e.user);
    final hasAdminAccess = user.havePermission(PermissionName.adminPanelAccess);

    // Only show button if user has admin access
    if (!hasAdminAccess) {
      return const SizedBox.shrink();
    }

    if (wideMode) {
      return FloatingActionButton.extended(
        heroTag: 'admin_dashboard',
        foregroundColor: context.theme.colorScheme.onSurfaceVariant,
        backgroundColor: context.theme.colorScheme.secondaryContainer,
        onPressed: () => const AdminDashboardRoute().push<void>(context),
        shape: context.theme.floatingActionButtonTheme.shape,
        tooltip: LocaleKeys.admin_dashboard.tr(),
        label: Text(LocaleKeys.admin_admin.tr()),
        icon: const Icon(Icons.admin_panel_settings),
      );
    }

    return FloatingActionButton.small(
      heroTag: 'admin_dashboard',
      foregroundColor: context.theme.colorScheme.onSurfaceVariant,
      backgroundColor: context.theme.colorScheme.secondaryContainer,
      onPressed: () => const AdminDashboardRoute().push<void>(context),
      tooltip: LocaleKeys.admin_dashboard.tr(),
      child: const Icon(Icons.admin_panel_settings),
    );
  }
}
