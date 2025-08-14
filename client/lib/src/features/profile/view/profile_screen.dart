import 'package:flutter/material.dart';
import 'package:openquester/openquester.dart';
import 'package:openquester/src/core/ui/components/one_field_dialog.dart';

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

  Future<void> showIfUnauthorized(BuildContext context) async {
    final isAuthorized = getIt<AuthController>().authorized;
    if (isAuthorized) return;
    await show(context);
  }

  @override
  Widget build(BuildContext context) {
    final user = watchValue((ProfileController m) => m.user);

    return AdaptiveDialog(
      constraints: const BoxConstraints(maxWidth: 400),
      builder: (context) => Card(
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
            const Column(
              spacing: 12,
              children: [
                _ThemeSettingsSection(),
                _GameSettingsSection(),
                _AppInfo(),
              ],
            ).paddingSymmetric(horizontal: 12).paddingBottom(12),
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
        Text(
          LocaleKeys.login_login_description.tr(),
          textAlign: TextAlign.center,
          style: context.textTheme.bodyLarge,
        ),
        Text(
          LocaleKeys.login_login_description_guest.tr(),
          textAlign: TextAlign.center,
          style: context.textTheme.bodySmall?.copyWith(
            color: context.theme.colorScheme.onSurfaceVariant,
          ),
        ),
        const _DiscordLoginBtn(),
        LoadingButtonBuilder(
          onPressed: () => _loginAndGetUsername(context, GuestAuthType()),
          builder: (context, child, onPressed) {
            return FilledButton.tonalIcon(
              onPressed: onPressed,
              icon: child,
              label: Text(LocaleKeys.login_as_guest.tr()),
              style: FilledButton.styleFrom(
                minimumSize: const Size.fromHeight(40),
              ),
            );
          },
          child: const Icon(Icons.account_circle_outlined),
        ),
      ],
    );
  }
}

class _DiscordLoginBtn extends StatelessWidget {
  const _DiscordLoginBtn();

  @override
  Widget build(BuildContext context) {
    return LoadingButtonBuilder(
      onPressed: () => _loginAndGetUsername(context, Oauth2AuthType()),
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
    );
  }
}

Future<void> _loginAndGetUsername(
  BuildContext context,
  AuthType auth,
) async {
  final controller = getIt.get<AuthController>();

  String? username;
  if (auth is GuestAuthType) {
    if (!context.mounted) return;
    username = await _UsernameDialog(
      initText: getIt<AuthController>().lastUsername,
    ).show(context);
    if (username == null) return;
  }

  await controller.loginUser(
    auth: auth,
    username: username,
  );
}

class _UsernameDialog extends OneFieldDialog {
  _UsernameDialog({
    required super.initText,
  }) : super(
         title: LocaleKeys.username.tr(),
         subtitle: LocaleKeys.login_set_your_username.tr(),
         hintText: 'Chill Dude',
         maxLength: 50,
         validator: (value) {
           if (value == null || value.trim().isEmpty) {
             return LocaleKeys.field_required.tr();
           }

           final regex = RegExp(r'^[a-zA-Z0-9\s]*$');
           if (!regex.hasMatch(value)) {
             return LocaleKeys.login_username_validation.tr();
           }

           return null;
         },
       );
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
            if (!user.isGuest)
              _ProfileAvatar(user: user).withSize(width: 80, height: 80),
            Column(
              children: [
                Text(
                  user.name ?? user.username,
                  style: context.textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
                ),
                if (!user.name.isEmptyOrNull && user.name != user.username)
                  Text(
                    user.username,
                    style: context.textTheme.bodyMedium?.copyWith(
                      color: context.theme.colorScheme.onSurfaceVariant,
                    ),
                  ),
              ],
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
            if (user.isGuest) const _DiscordLoginBtn(),
            FilledButton.tonalIcon(
              onPressed: getIt.get<AuthController>().logOut,
              icon: const Icon(Icons.logout_outlined),
              label: Text(LocaleKeys.login_logout.tr()),
              style: FilledButton.styleFrom(
                minimumSize: const Size.fromHeight(40),
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _ProfileAvatar extends StatelessWidget {
  const _ProfileAvatar({required this.user});
  final ResponseUser user;

  @override
  Widget build(BuildContext context) {
    return Stack(
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
                  foregroundColor: context.theme.colorScheme.onPrimaryContainer,
                  padding: 6.all,
                ),
              ),
            ),
            onPressed: getIt<ProfileController>().changeAvatar,
            child: const Icon(Icons.edit_outlined),
          ),
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
      expandedCrossAxisAlignment: CrossAxisAlignment.start,
      childrenPadding: 12.horizontal,
      children: const [
        _ThemeModeSelector(),
        Divider(),
        _SeedSelector(),
      ],
    );
  }
}

class _GameSettingsSection extends WatchingWidget {
  const _GameSettingsSection();

  @override
  Widget build(BuildContext context) {
    final controller = getIt<SettingsController>();

    return ExpansionTile(
      title: Text(LocaleKeys.game_settings.tr()),
      leading: const Icon(Icons.settings_outlined),
      expandedCrossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _BoolSetting(
          title: LocaleKeys.settings_limit_desktop_width.tr(),
          state: watchPropertyValue(
            (SettingsController m) => m.settings.limitDesktopWidth,
          ),
          onChanged: (value) => controller.updateSettings(
            controller.settings.copyWith(
              limitDesktopWidth: value,
            ),
          ),
        ),
      ],
    );
  }
}

class _BoolSetting extends StatelessWidget {
  const _BoolSetting({
    required this.title,
    required this.state,
    required this.onChanged,
  });
  final String title;
  final bool state;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      title: Text(title),
      trailing: Switch(
        value: state,
        onChanged: onChanged,
      ),
    );
  }
}

class _ThemeModeSelector extends WatchingWidget {
  const _ThemeModeSelector();

  @override
  Widget build(BuildContext context) {
    final controller = watchIt<SettingsController>();

    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: AppThemeMode.values.map((m) {
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

  String _label(AppThemeMode mode) => switch (mode) {
    AppThemeMode.system => LocaleKeys.theme_system.tr(),
    AppThemeMode.light => LocaleKeys.theme_light.tr(),
    AppThemeMode.dark => LocaleKeys.theme_dark.tr(),
    AppThemeMode.pureDark => LocaleKeys.theme_pure_dark.tr(),
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
              ),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              spacing: 6,
              children: [
                CircleAvatar(radius: 6, backgroundColor: color),
                Text(s.label),
                Visibility(
                  visible: selected,
                  child: Icon(Icons.check, size: 14, color: color),
                ),
              ],
            ),
          ),
        );
      }).toList(),
    );
  }
}

class _AppInfo extends StatelessWidget {
  const _AppInfo();

  @override
  Widget build(BuildContext context) {
    return // App info
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
    );
  }
}
