import 'package:flutter/material.dart';
import 'package:openquester/openquester.dart';

@RoutePage()
class ProfileDialog extends WatchingWidget {
  const ProfileDialog({super.key});

  Future<void> showIfUnauthorized(BuildContext context) async {
    final isAuthorized = getIt<AuthController>().authorized;
    if (isAuthorized) return;
    await const ProfileRoute().push<void>(context);
  }

  @override
  Widget build(BuildContext context) {
    return AdaptiveDialog(
      constraints: const BoxConstraints(maxWidth: 400),
      builder: (context) => const ProfileCard(),
    );
  }
}

class ProfileCard extends WatchingWidget {
  const ProfileCard({this.onClose, super.key});

  final VoidCallback? onClose;

  @override
  Widget build(BuildContext context) {
    final user = watchValue((ProfileController m) => m.user);

    return Card(
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
                ? _LoginContent(onClose: onClose)
                : _ProfileContent(user: user, onClose: onClose),
          ),
        ],
      ),
    );
  }
}

class _LoginContent extends WatchingWidget {
  const _LoginContent({required this.onClose});

  final VoidCallback? onClose;

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
        _DiscordLoginBtn(
          onBeforeLogin: () => onClose?.call(),
        ),
        LoadingButtonBuilder(
          onPressed: () {
            onClose?.call();
            return _loginAndGetUsername(context, GuestAuthType());
          },
          onError: handleError,
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
  const _DiscordLoginBtn({this.onBeforeLogin});

  final VoidCallback? onBeforeLogin;

  @override
  Widget build(BuildContext context) {
    return LoadingButtonBuilder(
      onPressed: () {
        onBeforeLogin?.call();
        return _loginAndGetUsername(context, Oauth2AuthType());
      },
      onError: handleError,
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

           final regex = RegExp(r'^(?!.*  )[a-zA-Z0-9\s]*$');
           if (!regex.hasMatch(value)) {
             return LocaleKeys.login_username_validation.tr();
           }

           return null;
         },
       );
}

class _ProfileContent extends WatchingWidget {
  const _ProfileContent({required this.user, required this.onClose});
  final ResponseUser user;
  final VoidCallback? onClose;

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
              Column(
                spacing: 10,
                children: [
                  _ProfileAvatar(user: user).withSize(width: 80, height: 80),
                  FilledButton.tonal(
                    onPressed: () async {
                      onClose?.call();
                      await getIt<ProfileController>().changeAvatar();
                    },
                    child: Text(LocaleKeys.profile_change_avatar.tr()),
                  ),
                ],
              ),
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
            const UpdateBtn(),
            if (user.isGuest)
              _DiscordLoginBtn(
                onBeforeLogin: () => onClose?.call(),
              ),
            FilledButton.tonalIcon(
              onPressed: () async {
                onClose?.call();
                await getIt.get<AuthController>().logOut();
              },
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
    return Container(
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
