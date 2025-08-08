import 'package:flutter/material.dart';
import 'package:openquester/openquester.dart';

// Keep for backward compatibility, but primary access is through ProfileDialog
@RoutePage()
class ProfileScreen extends WatchingWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const ProfileDialog();
  }
}

class ProfileDialog extends WatchingWidget {
  const ProfileDialog({super.key});

  Future<void> show(BuildContext context) async {
    return showDialog<void>(
      context: context,
      builder: (context) => this,
    );
  }

  @override
  Widget build(BuildContext context) {
    final user = watchValue((ProfileController m) => m.user);

    return AdaptiveDialog(
      constraints: const BoxConstraints(maxWidth: 400),
      builder: (context) => Card(
        elevation: 0,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Header
            Container(
              padding: 20.all,
              decoration: BoxDecoration(
                color: context.theme.colorScheme.primaryContainer.withValues(
                  alpha: 0.3,
                ),
                borderRadius: const BorderRadius.vertical(
                  top: Radius.circular(12),
                ),
              ),
              child: Row(
                children: [
                  Icon(
                    Icons.account_circle_outlined,
                    color: context.theme.colorScheme.primary,
                  ),
                  Text(
                    LocaleKeys.profile.tr(),
                    style: context.textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
                  ).paddingLeft(8),
                ],
              ),
            ),

            // Content
            Padding(
              padding: 24.all,
              child: user == null
                  ? const _LoginContent()
                  : _ProfileContent(user: user),
            ),
            const _ThemeSettingsSection(),
          ],
        ),
      ),
    );
  }
}

class _LoginContent extends WatchingWidget {
  const _LoginContent();

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      spacing: 20,
      children: [
        Icon(
          Icons.discord,
          size: 48,
          color: context.theme.colorScheme.primary,
        ),
        Column(
          spacing: 8,
          children: [
            Text(
              LocaleKeys.login_with_discord.tr(),
              style: context.textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w600,
              ),
              textAlign: TextAlign.center,
            ),
            Text(
              LocaleKeys.connect_discord.tr(),
              style: context.textTheme.bodySmall?.copyWith(
                color: context.theme.colorScheme.onSurfaceVariant,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
        LoadingButtonBuilder(
          onPressed: getIt.get<AuthController>().loginUser,
          builder: (context, child, onPressed) {
            return FilledButton.icon(
              onPressed: onPressed,
              icon: child,
              label: Text(LocaleKeys.login_with_discord.tr()),
              style: FilledButton.styleFrom(
                minimumSize: const Size.fromHeight(40),
              ),
            );
          },
          child: const Icon(Icons.discord),
        ),
      ],
    );
  }
}

class _ProfileContent extends WatchingWidget {
  const _ProfileContent({required this.user});
  final ResponseUser user;

  @override
  Widget build(BuildContext context) {
    final dateFormat = DateFormat.yMMMd();

    return Column(
      mainAxisSize: MainAxisSize.min,
      spacing: 20,
      children: [
        // Avatar Section
        Column(
          spacing: 12,
          children: [
            Stack(
              clipBehavior: Clip.none,
              children: [
                Container(
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: context.theme.colorScheme.outline.withValues(
                        alpha: 0.2,
                      ),
                      width: 2,
                    ),
                  ),
                  child: ImageWidget(
                    url: user.avatar,
                    avatarRadius: 40,
                  ),
                ),
                Positioned(
                  bottom: -4,
                  right: -4,
                  child: LoadingButtonBuilder(
                    builder: (context, child, onPressed) => Container(
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: context.theme.colorScheme.primaryContainer,
                        border: Border.all(
                          color: context.theme.colorScheme.outline.withValues(
                            alpha: 0.2,
                          ),
                        ),
                      ),
                      child: IconButton(
                        onPressed: onPressed,
                        icon: child,
                        iconSize: 16,
                        style: IconButton.styleFrom(
                          foregroundColor:
                              context.theme.colorScheme.onPrimaryContainer,
                          padding: 6.all,
                        ),
                      ),
                    ),
                    onPressed: getIt<ProfileController>().changeAvatar,
                    child: const Icon(Icons.edit_outlined),
                  ),
                ),
              ],
            ).withSize(width: 80, height: 80),
            Text(
              user.username,
              style: context.textTheme.titleLarge?.copyWith(
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),

        // Basic Info (only safe, user-relevant data)
        Container(
          padding: 16.all,
          decoration: BoxDecoration(
            color: context.theme.colorScheme.surfaceContainerLowest,
            borderRadius: 12.circular,
            border: Border.all(
              color: context.theme.colorScheme.outline.withValues(alpha: 0.1),
            ),
          ),
          child: Column(
            spacing: 8,
            children: [
              if (user.email != null)
                _InfoRow(
                  label: LocaleKeys.email.tr(),
                  value: user.email!,
                  icon: Icons.email_outlined,
                ),
              _InfoRow(
                label: LocaleKeys.member_since.tr(),
                value: dateFormat.format(user.createdAt),
                icon: Icons.calendar_today_outlined,
              ),
            ],
          ),
        ),

        // Actions
        Column(
          spacing: 12,
          children: [
            FilledButton.tonalIcon(
              onPressed: getIt.get<AuthController>().logOut,
              icon: const Icon(Icons.logout_outlined),
              label: Text(LocaleKeys.logout.tr()),
              style: FilledButton.styleFrom(
                minimumSize: const Size.fromHeight(40),
              ),
            ),

            // App info
            Column(
              spacing: 4,
              children: [
                const UpdateBtn(),
                Text(
                  getIt<AutoUpdateController>().getCurrentVersion,
                  style: context.textTheme.bodySmall?.copyWith(
                    color: context.theme.colorScheme.onSurfaceVariant,
                  ),
                ),
              ],
            ),
          ],
        ),
      ],
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({
    required this.label,
    required this.value,
    required this.icon,
  });

  final String label;
  final String value;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(
          icon,
          size: 16,
          color: context.theme.colorScheme.onSurfaceVariant,
        ),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              label,
              style: context.textTheme.bodySmall?.copyWith(
                color: context.theme.colorScheme.onSurfaceVariant,
              ),
            ),
            Text(
              value,
              style: context.textTheme.bodyMedium?.copyWith(
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ).paddingLeft(8).expand(),
      ],
    );
  }
}

class _ThemeSettingsSection extends StatelessWidget {
  const _ThemeSettingsSection();

  @override
  Widget build(BuildContext context) {
    return ExpansionTile(
      title: Text(LocaleKeys.theme_appearance.tr()),
      leading: const Icon(Icons.palette_outlined),
      childrenPadding: 16.horizontal + 12.bottom,
      children: [
        const _ThemeModeSelector(),
        12.height,
        const _SeedSelector(),
      ],
    );
  }
}

class _ThemeModeSelector extends WatchingWidget {
  const _ThemeModeSelector();

  @override
  Widget build(BuildContext context) {
    const modes = ThemeMode.values;
    final controller = watchIt<SettingsController>();

    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: modes.map((m) {
        final selected = m == controller.settings.themeMode;
        return ChoiceChip(
          label: Text(_label(m)),
          selected: selected,
          onSelected: (_) => controller.updateSettings(
            controller.settings.copyWith(
              themeMode: m,
            ),
          ),
        );
      }).toList(),
    );
  }

  String _label(ThemeMode mode) => switch (mode) {
    ThemeMode.system => LocaleKeys.theme_system.tr(),
    ThemeMode.light => LocaleKeys.theme_light.tr(),
    ThemeMode.dark => LocaleKeys.theme_dark.tr(),
  };
}

class _SeedSelector extends WatchingWidget {
  const _SeedSelector();

  @override
  Widget build(BuildContext context) {
    final controller = watchIt<SettingsController>();
    return Wrap(
      spacing: 10,
      runSpacing: 10,
      children: AppThemeSeed.values.map((AppThemeSeed s) {
        final selected = s == controller.settings.themeSeed;
        final color = s.color;
        return InkWell(
          onTap: () => controller.updateSettings(
            controller.settings.copyWith(
              themeSeed: s,
            ),
          ),
          borderRadius: 12.circular,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            padding: const EdgeInsets.symmetric(
              horizontal: 10,
              vertical: 8,
            ),
            decoration: BoxDecoration(
              borderRadius: 12.circular,
              color: color.withValues(alpha: .12),
              border: Border.all(
                color: selected ? color : color.withValues(alpha: .4),
                width: selected ? 2 : 1,
              ),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              spacing: 6,
              children: [
                CircleAvatar(radius: 6, backgroundColor: color),
                Text(
                  switch (s) {
                    AppThemeSeed.indigo =>
                      LocaleKeys.theme_color_seeds_indigo.tr(),
                    AppThemeSeed.deepPurple =>
                      LocaleKeys.theme_color_seeds_deep_purple.tr(),
                    AppThemeSeed.teal => LocaleKeys.theme_color_seeds_teal.tr(),
                    AppThemeSeed.orange =>
                      LocaleKeys.theme_color_seeds_orange.tr(),
                    AppThemeSeed.pink => LocaleKeys.theme_color_seeds_pink.tr(),
                    AppThemeSeed.green =>
                      LocaleKeys.theme_color_seeds_green.tr(),
                    AppThemeSeed.blueGrey =>
                      LocaleKeys.theme_color_seeds_blue_grey.tr(),
                  },
                ),
                if (selected) Icon(Icons.check, size: 14, color: color),
              ],
            ),
          ),
        );
      }).toList(),
    );
  }
}
