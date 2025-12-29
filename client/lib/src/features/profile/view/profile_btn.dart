import 'package:flutter/material.dart';
import 'package:openquester/common_imports.dart';

class ProfileBtn extends WatchingStatefulWidget {
  const ProfileBtn({required this.wideMode, super.key});
  final bool wideMode;

  @override
  State<ProfileBtn> createState() => _ProfileBtnState();
}

class _ProfileBtnState extends State<ProfileBtn> {
  final LayerLink _link = LayerLink();
  OverlayEntry? _entry;

  @override
  void dispose() {
    _removeOverlay();
    super.dispose();
  }

  void _toggleOverlay() {
    if (_entry != null) {
      _removeOverlay();
      return;
    }

    final overlay = Overlay.of(context);
    final overlayBox = overlay.context.findRenderObject() as RenderBox;
    final targetBox = context.findRenderObject() as RenderBox;
    final targetTopLeft = targetBox.localToGlobal(
      Offset.zero,
      ancestor: overlayBox,
    );
    final targetBottomY = targetTopLeft.dy + targetBox.size.height;

    _entry = OverlayEntry(
      builder: (context) {
        final isDesktop = widget.wideMode;
        final mq = MediaQuery.of(context);
        final availableHeight = (mq.size.height - targetBottomY - 8).clamp(
          0.0,
          mq.size.height,
        );

        return Stack(
          children: [
            Positioned.fill(
              child: GestureDetector(
                behavior: HitTestBehavior.translucent,
                onTap: _removeOverlay,
              ),
            ),
            if (isDesktop)
              CompositedTransformFollower(
                link: _link,
                targetAnchor: Alignment.bottomRight,
                followerAnchor: Alignment.topRight,
                offset: const Offset(0, 8),
                child: Material(
                  color: Colors.transparent,
                  child: _ProfilePopover(
                    onClose: _removeOverlay,
                    wideMode: true,
                  ),
                ),
              )
            else
              Positioned(
                top: targetBottomY + 8,
                left: 0,
                right: 0,
                child: SafeArea(
                  top: false,
                  child: Center(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      child: Material(
                        color: Colors.transparent,
                        child: _ProfilePopover(
                          onClose: _removeOverlay,
                          wideMode: false,
                          maxHeightOverride: availableHeight,
                        ),
                      ),
                    ),
                  ),
                ),
              ),
          ],
        );
      },
    );

    overlay.insert(_entry!);
  }

  void _removeOverlay() {
    _entry?.remove();
    _entry = null;
  }

  @override
  Widget build(BuildContext context) {
    final user = watchValue((ProfileController m) => m.user);

    final avatarUrl = (user != null && !user.isGuest) ? user.avatar : null;

    final displayName = (user?.name?.trim().isNotEmpty ?? false)
        ? user!.name!.trim()
        : user?.username;
    final label = user == null
        ? 'login_title'.tr()
        : (displayName == null || displayName.isEmpty)
        ? LocaleKeys.profile.tr()
        : displayName;

    final screenWidth = MediaQuery.sizeOf(context).width;
    // Use responsive breakpoints so the label max width adapts to available screen space
    final textWidth = screenWidth >= 1000
        ? 180.0
        : (screenWidth >= 800 ? 140.0 : 100.0);

    return CompositedTransformTarget(
      link: _link,
      child: TextButton(
        onPressed: _toggleOverlay,
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
      ),
    );
  }
}

class _ProfilePopover extends WatchingWidget {
  const _ProfilePopover({
    required this.onClose,
    required this.wideMode,
    this.maxHeightOverride,
  });
  final VoidCallback onClose;
  final bool wideMode;
  final double? maxHeightOverride;

  @override
  Widget build(BuildContext context) {
    final screenSize = MediaQuery.sizeOf(context);

    // Mobile: center and fit within the screen (SafeArea + padding handled above).
    // Desktop: keep anchored to the button and make it slightly smaller.
    final maxHeight =
        (maxHeightOverride ?? (screenSize.height * (wideMode ? 0.85 : 1.0)))
            .clamp(200.0, screenSize.height)
            .toDouble();

    final maxWidth = wideMode
        ? (screenSize.width - 16).clamp(280.0, 480.0).toDouble()
        : (screenSize.width - 32).clamp(280.0, screenSize.width).toDouble();

    return ConstrainedBox(
      constraints: BoxConstraints(
        maxWidth: maxWidth,
        maxHeight: maxHeight,
      ),
      child: SingleChildScrollView(
        child: ProfileCard(onClose: onClose),
      ),
    );
  }
}
