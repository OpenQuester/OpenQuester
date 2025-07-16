import 'dart:ui';
import 'package:flutter/material.dart';

/// Animation types for the switcher
enum AppAnimationType {
  fade,
  fadeBlur,
  scale,
  slide,
  rotation,
}

/// Add fade, blur, scale, slide, or rotation transitions
class AppAnimatedSwitcher extends StatelessWidget {
  const AppAnimatedSwitcher({
    required this.child,
    this.visible,
    this.disableSizeTransition = false,
    this.animationType = AppAnimationType.fadeBlur,
    this.duration,
    super.key,
  });

  final Widget child;
  final bool? visible;
  final bool disableSizeTransition;
  final AppAnimationType animationType;
  final Duration? duration;

  @override
  Widget build(BuildContext context) {
    return AnimatedSwitcher(
      duration: duration ?? Durations.medium1,
      transitionBuilder: (child, animation) {
        Widget transition = _buildTransition(child, animation);

        if (disableSizeTransition) {
          return transition;
        }

        return SizeTransition(
          sizeFactor: animation,
          axis: Axis.horizontal,
          child: transition,
        );
      },
      // if [visible] is null pass changing child only
      child: visible == null
          ? child
          // switch between your real child and an empty placeholder
          : visible!
          ? KeyedSubtree(key: const ValueKey('content'), child: child)
          : const SizedBox.shrink(key: ValueKey('empty')),
    );
  }

  Widget _buildTransition(Widget child, Animation<double> animation) {
    switch (animationType) {
      case AppAnimationType.fade:
        return FadeTransition(opacity: animation, child: child);

      case AppAnimationType.fadeBlur:
        return AnimatedBuilder(
          animation: animation,
          builder: (context, _) {
            final sigma = lerpDouble(2, 0, animation.value)!;
            return ClipRect(
              // ClipRect is required to prevent blur bleeding
              child: BackdropFilter(
                filter: ImageFilter.blur(sigmaX: sigma, sigmaY: sigma),
                child: FadeTransition(opacity: animation, child: child),
              ),
            );
          },
        );

      case AppAnimationType.scale:
        return ScaleTransition(
          scale: Tween<double>(begin: 0.8, end: 1.0).animate(
            CurvedAnimation(parent: animation, curve: Curves.easeOutCubic),
          ),
          child: FadeTransition(opacity: animation, child: child),
        );

      case AppAnimationType.slide:
        return SlideTransition(
          position: Tween<Offset>(
            begin: const Offset(0, 0.1),
            end: Offset.zero,
          ).animate(
            CurvedAnimation(parent: animation, curve: Curves.easeOutCubic),
          ),
          child: FadeTransition(opacity: animation, child: child),
        );

      case AppAnimationType.rotation:
        return RotationTransition(
          turns: Tween<double>(begin: 0.1, end: 0.0).animate(
            CurvedAnimation(parent: animation, curve: Curves.easeOutCubic),
          ),
          child: ScaleTransition(
            scale: Tween<double>(begin: 0.9, end: 1.0).animate(
              CurvedAnimation(parent: animation, curve: Curves.easeOutCubic),
            ),
            child: FadeTransition(opacity: animation, child: child),
          ),
        );
    }
  }
}
