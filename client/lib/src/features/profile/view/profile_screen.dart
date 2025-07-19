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
      builder: (context) => Container(
        constraints: const BoxConstraints(maxWidth: 400),
        child: Card(
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
            ],
          ),
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
              'Connect your Discord account to get started',
              style: context.textTheme.bodySmall?.copyWith(
                color: context.theme.colorScheme.onSurfaceVariant,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
        LoadingButtonBuilder(
          onPressed: () async {
            try {
              await getIt.get<AuthController>().loginUser();
            } catch (e) {
              await getIt<ToastController>().show(e.toString());
            }
          },
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
                          width: 1,
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
                  label: 'Email',
                  value: user.email!,
                  icon: Icons.email_outlined,
                ),
              _InfoRow(
                label: 'Member Since',
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
        Expanded(
          child: Column(
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
          ),
        ).paddingLeft(8),
      ],
    );
  }
}
