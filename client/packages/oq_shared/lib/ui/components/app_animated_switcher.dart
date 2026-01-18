import 'dart:ui';
import 'package:flutter/material.dart';

/// Add fade and blur or size transition
class AppAnimatedSwitcher extends StatelessWidget {
  const AppAnimatedSwitcher({
    required this.child,
    this.visible,
    this.disableSizeTransition = false,
    this.sizeTransitionAxis = Axis.horizontal,
    this.duration = Durations.medium1,
    super.key,
  });

  final Widget child;
  final bool? visible;
  final bool disableSizeTransition;
  final Axis sizeTransitionAxis;
  final Duration duration;

  @override
  Widget build(BuildContext context) {
    return AnimatedSwitcher(
      duration: duration,
      transitionBuilder: (child, animation) {
        final transition = FadeTransition(opacity: animation, child: child);

        if (disableSizeTransition) {
          return AnimatedBuilder(
            animation: animation,
            builder: (context, _) {
              final sigma = lerpDouble(0, 2, animation.value)!;
              return ClipRect(
                // ClipRect is required to prevent blur bleeding
                child: BackdropFilter(
                  filter: ImageFilter.blur(sigmaX: sigma, sigmaY: sigma),
                  child: transition,
                ),
              );
            },
          );
        }

        return SizeTransition(
          sizeFactor: animation,
          axis: sizeTransitionAxis,
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
}
