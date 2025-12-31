import 'dart:async';

import 'package:flutter/material.dart';
import 'package:openquester/common_imports.dart';

@RoutePage()
class AdminDashboardScreen extends WatchingWidget {
  const AdminDashboardScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final me = watchValue((ProfileController e) => e.user);
    final hasAdminAccess = me.havePermission(PermissionName.adminPanelAccess);

    // Check admin access
    if (!hasAdminAccess) {
      return Scaffold(
        appBar: AppBar(title: Text(LocaleKeys.admin_dashboard.tr())),
        body: Center(
          child: Text(
            LocaleKeys.admin_no_permission.tr(),
            style: context.textTheme.titleMedium,
          ),
        ),
      );
    }

    return DefaultTabController(
      length: 3,
      child: ColoredBox(
        color: context.theme.colorScheme.surface,
        child: MaxSizeContainer(
          child: Scaffold(
            appBar: AppBar(
              title: Text(LocaleKeys.admin_dashboard.tr()),
              bottom: TabBar(
                tabs: [
                  Tab(
                    icon: const Icon(Icons.dashboard_outlined),
                    text: LocaleKeys.admin_overview.tr(),
                  ),
                  if (me.havePermission(PermissionName.viewUsersInfo))
                    Tab(
                      icon: const Icon(Icons.people_outlined),
                      text: LocaleKeys.admin_users.tr(),
                    ),
                  if (me.havePermission(PermissionName.viewSystemHealth))
                    Tab(
                      icon: const Icon(Icons.health_and_safety_outlined),
                      text: LocaleKeys.admin_system_health.tr(),
                    ),
                ],
              ),
            ),
            body: TabBarView(
              children: [
                const _OverviewTab(),
                if (me.havePermission(PermissionName.viewUsersInfo))
                  const _UsersTab(),
                if (me.havePermission(PermissionName.viewSystemHealth))
                  const _SystemHealthTab(),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _OverviewTab extends WatchingStatefulWidget {
  const _OverviewTab();

  @override
  State<_OverviewTab> createState() => _OverviewTabState();
}

class _OverviewTabState extends State<_OverviewTab> {
  @override
  void initState() {
    super.initState();
    unawaited(_loadData());
  }

  Future<void> _loadData() async {
    await getIt<AdminController>().loadDashboardData();
  }

  @override
  Widget build(BuildContext context) {
    final controller = watchIt<AdminController>();
    final data = controller.dashboardData;

    if (controller.isLoading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (controller.error != null) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              controller.error!,
              style: context.textTheme.bodyLarge,
            ),
            const SizedBox(height: 16),
            ElevatedButton.icon(
              onPressed: _loadData,
              icon: const Icon(Icons.refresh),
              label: Text(LocaleKeys.admin_refresh.tr()),
            ),
          ],
        ),
      );
    }

    if (data == null) {
      return Center(child: Text(LocaleKeys.admin_loading.tr()));
    }

    return SingleChildScrollView(
      padding: 16.all,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        spacing: 16,
        children: [
          // Statistics cards
          Wrap(
            spacing: 16,
            runSpacing: 16,
            children: [
              _StatCard(
                title: LocaleKeys.admin_total_users.tr(),
                value: '${data.totalUsers}',
                icon: Icons.people,
                color: Colors.blue,
              ),
              _StatCard(
                title: LocaleKeys.admin_active_users.tr(),
                value: '${data.activeUsers}',
                icon: Icons.person,
                color: Colors.green,
              ),
              _StatCard(
                title: LocaleKeys.admin_deleted_users.tr(),
                value: '${data.deletedUsers}',
                icon: Icons.person_off,
                color: Colors.red,
              ),
            ],
          ),
          const SizedBox(height: 24),

          // System health summary
          Text(
            LocaleKeys.admin_system_health.tr(),
            style: context.textTheme.titleLarge,
          ),
          const SizedBox(height: 8),
          Card(
            child: Padding(
              padding: 16.all,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                spacing: 8,
                children: [
                  _HealthRow(
                    label: LocaleKeys.admin_redis_connected.tr(),
                    value: data.systemHealth.redisConnected
                        ? LocaleKeys.yes.tr()
                        : LocaleKeys.no.tr(),
                    isHealthy: data.systemHealth.redisConnected,
                  ),
                  _HealthRow(
                    label: LocaleKeys.admin_redis_keys.tr(),
                    value: '${data.systemHealth.redisKeys}',
                    isHealthy: true,
                  ),
                  _HealthRow(
                    label: LocaleKeys.admin_server_uptime.tr(),
                    value: Duration(
                      seconds: data.systemHealth.serverUptimeSeconds.toInt(),
                    ).f(),
                    isHealthy: true,
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 24),

          // Recent users
          Text(
            LocaleKeys.admin_recent_users.tr(),
            style: context.textTheme.titleLarge,
          ),
          const SizedBox(height: 8),
          Card(
            child: ListView.separated(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: data.recentUsers.length,
              separatorBuilder: (_, _) => const Divider(height: 1),
              itemBuilder: (context, index) {
                final user = data.recentUsers[index];
                return ListTile(
                  leading: user.avatar != null
                      ? CircleAvatar(
                          backgroundImage: NetworkImage(user.avatar!),
                        )
                      : const CircleAvatar(child: Icon(Icons.person)),
                  title: Text(user.username),
                  subtitle: Text('ID: ${user.id}'),
                  trailing: Text(
                    user.createdAt.toRelativeString(),
                    style: context.textTheme.bodySmall,
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard({
    required this.title,
    required this.value,
    required this.icon,
    required this.color,
  });

  final String title;
  final String value;
  final IconData icon;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 200,
      child: Card(
        child: Padding(
          padding: 16.all,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            spacing: 8,
            children: [
              Row(
                children: [
                  Icon(icon, color: color, size: 32),
                  const Spacer(),
                  Text(
                    value,
                    style: context.textTheme.headlineMedium?.copyWith(
                      color: color,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
              Text(
                title,
                style: context.textTheme.bodyMedium,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _HealthRow extends StatelessWidget {
  const _HealthRow({
    required this.label,
    required this.value,
    required this.isHealthy,
  });

  final String label;
  final String value;
  final bool isHealthy;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: context.textTheme.bodyMedium),
        Row(
          spacing: 8,
          children: [
            Text(
              value,
              style: context.textTheme.bodyMedium?.copyWith(
                fontWeight: FontWeight.w600,
              ),
            ),
            Icon(
              isHealthy ? Icons.check_circle : Icons.error,
              color: isHealthy ? Colors.green : Colors.red,
              size: 20,
            ),
          ],
        ),
      ],
    );
  }
}

class _UsersTab extends WatchingStatefulWidget {
  const _UsersTab();

  @override
  State<_UsersTab> createState() => _UsersTabState();
}

class _UsersTabState extends State<_UsersTab> {
  @override
  void initState() {
    super.initState();
    unawaited(_loadData());
  }

  Future<void> _loadData() async {
    await getIt<AdminController>().loadUsersList(
      sortBy: UsersSortBy.createdAt,
      order: OrderDirection.desc,
      limit: 50,
      offset: 0,
    );
  }

  @override
  Widget build(BuildContext context) {
    final controller = watchIt<AdminController>();
    final data = controller.userListData;

    if (controller.isLoading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (controller.error != null) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              controller.error!,
              style: context.textTheme.bodyLarge,
            ),
            const SizedBox(height: 16),
            ElevatedButton.icon(
              onPressed: _loadData,
              icon: const Icon(Icons.refresh),
              label: Text(LocaleKeys.admin_refresh.tr()),
            ),
          ],
        ),
      );
    }

    if (data == null) {
      return Center(child: Text(LocaleKeys.admin_loading.tr()));
    }

    return Column(
      children: [
        // Stats
        Container(
          padding: 16.all,
          color: context.theme.colorScheme.surfaceContainerHighest,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              _StatChip(
                label: LocaleKeys.admin_total_users.tr(),
                value: '${data.stats.total}',
              ),
              _StatChip(
                label: LocaleKeys.admin_active_users.tr(),
                value: '${data.stats.active}',
              ),
              _StatChip(
                label: LocaleKeys.admin_banned_users.tr(),
                value: '${data.stats.banned}',
              ),
              _StatChip(
                label: LocaleKeys.admin_deleted_users.tr(),
                value: '${data.stats.deleted}',
              ),
            ],
          ),
        ),
        // User list
        Expanded(
          child: ListView.separated(
            padding: 16.all,
            itemCount: data.data.length,
            separatorBuilder: (_, _) => const Divider(height: 1),
            itemBuilder: (context, index) {
              final user = data.data[index];
              return _UserListItem(user: user, onRefresh: _loadData);
            },
          ),
        ),
      ],
    );
  }
}

class _StatChip extends StatelessWidget {
  const _StatChip({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Column(
      spacing: 4,
      children: [
        Text(
          value,
          style: context.textTheme.titleLarge?.copyWith(
            fontWeight: FontWeight.bold,
          ),
        ),
        Text(
          label,
          style: context.textTheme.bodySmall,
        ),
      ],
    );
  }
}

class _UserListItem extends WatchingWidget {
  const _UserListItem({required this.user, required this.onRefresh});

  final ResponseUser user;
  final VoidCallback onRefresh;

  @override
  Widget build(BuildContext context) {
    final me = watchValue((ProfileController m) => m.user);
    const permissionsNeeded = {PermissionName.deleteAnotherUser};
    final haveAnyNeededPermission =
        me == null ||
        !me.permissions.containsAnyOf(
          permissionsNeeded,
          by: (item, target) => item.name == target,
        );

    return Card(
      child: ListTile(
        leading: user.avatar != null
            ? CircleAvatar(backgroundImage: NetworkImage(user.avatar!))
            : const CircleAvatar(child: Icon(Icons.person)),
        title: Text(user.username),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          spacing: 4,
          children: [
            Text('ID: ${user.id}'),
            if (user.email != null) Text('Email: ${user.email}'),
            Row(
              spacing: 8,
              children: [
                if (user.isDeleted)
                  Chip(
                    label: Text(LocaleKeys.admin_deleted.tr()),
                    backgroundColor: Colors.orange.withBrightness(-0.8),
                    labelStyle: const TextStyle(color: Colors.orange),
                    visualDensity: VisualDensity.compact,
                  ),
              ],
            ),
          ],
        ),
        trailing: haveAnyNeededPermission
            ? null
            : _MoreUserButton(
                user: user,
                me: me,
                onRefresh: onRefresh,
              ),
      ),
    );
  }
}

class _SystemHealthTab extends WatchingStatefulWidget {
  const _SystemHealthTab();

  @override
  State<_SystemHealthTab> createState() => _SystemHealthTabState();
}

class _SystemHealthTabState extends State<_SystemHealthTab> {
  @override
  void initState() {
    super.initState();
    unawaited(_loadData());
  }

  Future<void> _loadData() async {
    await getIt<AdminController>().loadSystemHealth();
    await getIt<AdminController>().loadPing();
  }

  @override
  Widget build(BuildContext context) {
    final controller = watchIt<AdminController>();
    final healthData = controller.systemHealthData;
    final pingData = controller.pingData;

    if (controller.isLoading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (controller.error != null) {
      return Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            controller.error!,
            style: context.textTheme.bodyLarge,
          ),
          const SizedBox(height: 16),
          ElevatedButton.icon(
            onPressed: _loadData,
            icon: const Icon(Icons.refresh),
            label: Text(LocaleKeys.admin_refresh.tr()),
          ),
        ],
      ).center();
    }

    if (healthData == null) {
      return Center(child: Text(LocaleKeys.admin_loading.tr()));
    }

    return SingleChildScrollView(
      padding: 16.all,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        spacing: 16,
        children: [
          // Ping status
          if (pingData != null)
            Card(
              child: Padding(
                padding: 16.all,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  spacing: 12,
                  children: [
                    Text(
                      LocaleKeys.admin_ping_status.tr(),
                      style: context.textTheme.titleMedium,
                    ),
                    _HealthRow(
                      label: LocaleKeys.admin_event_loop_lag.tr(),
                      value: '${pingData.eventLoopLagMs.toStringAsFixed(2)} ms',
                      isHealthy: pingData.eventLoopLagMs < 100,
                    ),
                    _HealthRow(
                      label: [
                        LocaleKeys.admin_response_time.tr(),
                        LocaleKeys.admin_redis_status.tr(),
                      ].join(' '),
                      value: [
                        pingData.redis.responseMs.toStringAsFixed(2),
                        'ms',
                      ].join(' '),
                      isHealthy: pingData.redis.connected,
                    ),
                  ],
                ),
              ),
            ),

          // Redis status
          Text(
            LocaleKeys.admin_redis_status.tr(),
            style: context.textTheme.titleLarge,
          ),
          Card(
            child: Padding(
              padding: 16.all,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                spacing: 8,
                children: [
                  _HealthRow(
                    label: LocaleKeys.admin_redis_connected.tr(),
                    value: healthData.redis.connected
                        ? LocaleKeys.yes.tr()
                        : LocaleKeys.no.tr(),
                    isHealthy: healthData.redis.connected,
                  ),
                  _HealthRow(
                    label: LocaleKeys.admin_redis_keys.tr(),
                    value: '${healthData.redis.keys}',
                    isHealthy: true,
                  ),
                  _HealthRow(
                    label: LocaleKeys.admin_redis_memory.tr(),
                    value: [
                      healthData.redis.estimatedMemoryMb.toStringAsFixed(2),
                      'MB',
                    ].join(' '),
                    isHealthy: true,
                  ),
                ],
              ),
            ),
          ),

          // Server status
          Text(
            LocaleKeys.admin_server_status.tr(),
            style: context.textTheme.titleLarge,
          ),
          Card(
            child: Padding(
              padding: 16.all,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                spacing: 8,
                children: [
                  _HealthRow(
                    label: LocaleKeys.admin_server_uptime.tr(),
                    value: Duration(
                      seconds: healthData.server.uptime.toInt(),
                    ).f(),
                    isHealthy: true,
                  ),
                  _HealthRow(
                    label: [
                      LocaleKeys.admin_server_memory.tr(),
                      '(${LocaleKeys.admin_memory_used.tr()})',
                    ].join(' '),
                    value: [
                      healthData.server.memory.used.toStringAsFixed(2),
                      'MB',
                    ].join(' '),
                    isHealthy: true,
                  ),
                  _HealthRow(
                    label: [
                      LocaleKeys.admin_server_memory.tr(),
                      '(${LocaleKeys.admin_memory_total.tr()})',
                    ].join(' '),
                    value: [
                      healthData.server.memory.total.toStringAsFixed(2),
                      'MB',
                    ].join(' '),
                    isHealthy: true,
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _MoreUserButton extends StatelessWidget {
  const _MoreUserButton({
    required this.me,
    required this.onRefresh,
    required this.user,
  });
  final ResponseUser user;
  final ResponseUser me;
  final VoidCallback onRefresh;

  @override
  Widget build(BuildContext context) {
    final controller = getIt<AdminController>();
    return PopupMenuButton<AdminActionType>(
      icon: const Icon(Icons.more_vert),
      onSelected: (value) async {
        var success = false;

        switch (value) {
          case AdminActionType.delete:
            final confirmed = await _showConfirmDialog(
              context,
              LocaleKeys.admin_confirm_delete.tr(
                args: [user.username],
              ),
            );
            if (confirmed) {
              success = await controller.deleteUser(user.id);
            }
          case AdminActionType.restore:
            final confirmed = await _showConfirmDialog(
              context,
              LocaleKeys.admin_confirm_restore.tr(
                args: [user.username],
              ),
            );
            if (confirmed) {
              success = await controller.restoreUser(user.id);
            }
        }

        if (success) {
          onRefresh();
        }
      },
      itemBuilder: (context) {
        return [
          if (me.havePermission(PermissionName.deleteAnotherUser)) ...[
            if (!user.isDeleted)
              PopupMenuItem(
                value: AdminActionType.delete,
                child: Row(
                  spacing: 8,
                  children: [
                    const Icon(
                      Icons.delete,
                      size: 20,
                      color: Colors.red,
                    ),
                    Text(
                      LocaleKeys.admin_delete_user.tr(),
                      style: const TextStyle(color: Colors.red),
                    ),
                  ],
                ),
              )
            else
              PopupMenuItem(
                value: AdminActionType.restore,
                child: Row(
                  spacing: 8,
                  children: [
                    const Icon(Icons.restore, size: 20),
                    Text(LocaleKeys.admin_restore_user.tr()),
                  ],
                ),
              ),
          ],
        ];
      },
    );
  }

  Future<bool> _showConfirmDialog(BuildContext context, String message) async {
    final result = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(LocaleKeys.confirm.tr()),
        content: Text(message),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: Text(LocaleKeys.cancel.tr()),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: Text(LocaleKeys.yes.tr()),
          ),
        ],
      ),
    );
    return result ?? false;
  }
}
