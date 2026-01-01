import 'package:flutter/material.dart';
import 'package:openquester/common_imports.dart';

class ProfileBtn extends WatchingWidget {
  const ProfileBtn({required this.wideMode, super.key});
  final bool wideMode;

  @override
  Widget build(BuildContext context) {
    final user = watchValue((ProfileController m) => m.user);

    final avatarUrl = (user != null && !user.isGuest) ? user.avatar : null;

    final displayName = (user?.name?.trim().isNotEmpty ?? false)
        ? user!.name!.trim()
        : user?.username;
    final label = user == null
        ? LocaleKeys.login_title.tr()
        : (displayName == null || displayName.isEmpty)
        ? LocaleKeys.profile.tr()
        : displayName;

    // Use responsive breakpoints so the label max width
    // adapts to available screen space
    final textWidth = UiModeUtils.wideModeOn(context, UiModeUtils.large)
        ? 180.0
        : (UiModeUtils.wideModeOn(context) ? 140.0 : 100.0);

    return TextButton(
      onPressed: () => const ProfileRoute().push<void>(context),
      style: ButtonStyle(
        padding: const WidgetStatePropertyAll(
          EdgeInsets.all(12),
        ),
        minimumSize: const WidgetStatePropertyAll(Size.zero),
        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
        shape: const WidgetStatePropertyAll(StadiumBorder()),
        backgroundColor: const WidgetStatePropertyAll(Colors.transparent),
        overlayColor: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.pressed)) {
            return context.theme.colorScheme.onSurface.withValues(
              alpha: 0.12,
            );
          }
          if (states.contains(WidgetState.hovered) ||
              states.contains(WidgetState.focused)) {
            return context.theme.colorScheme.onSurface.withValues(
              alpha: 0.08,
            );
          }
          return null;
        }),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        spacing: 12,
        children: [
          ConstrainedBox(
            constraints: BoxConstraints(maxWidth: textWidth),
            child: Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: context.textTheme.bodyLarge?.copyWith(
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          ImageWidget(
            url: avatarUrl,
            avatarRadius: 24,
          ),
        ],
      ),
    );
  }
}
