import 'dart:ui';
import 'package:auto_route/auto_route.dart';
import 'package:flutter/material.dart';
import 'package:nb_utils/nb_utils.dart';

class BlurDialogRoute<R> extends CustomRoute<R> {
  BlurDialogRoute({
    required super.page,
    super.path,
    super.children,
    super.allowSnapshotting,
    super.barrierDismissible,
    super.barrierLabel,
    super.duration,
    super.fullMatch,
    super.guards,
    super.initial,
    super.keepHistory,
    super.maintainState,
    super.meta,
    super.restorationId,
    super.reverseDuration,
    super.title,
    super.usesPathAsKey,
  }) : super(
         customRouteBuilder: _blurBuilder,
         enablePredictiveBackGesture: true,
       );

  static Widget blurIn(
    BuildContext context,
    Animation<double> animation,
    Animation<double> secondaryAnimation,
    Widget child,
  ) {
    // Combine both animations for more advanced transitions
    final combinedAnimation = Tween<double>(begin: 0, end: 1).animate(
      CurvedAnimation(
        parent: animation,
        curve: Curves.easeOut,
      ),
    );
    final reverseFade = Tween<double>(begin: 1, end: 0).animate(
      CurvedAnimation(
        parent: secondaryAnimation,
        curve: Curves.easeIn,
      ),
    );
    return AnimatedBuilder(
      animation: Listenable.merge([animation, secondaryAnimation]),
      child: child,
      builder: (context, child) {
        final sigma = animation.value * 2;
        final slideOffset =
            Tween<Offset>(
              begin: const Offset(0, 0.05),
              end: Offset.zero,
            ).animate(
              CurvedAnimation(
                parent: animation,
                curve: Curves.easeOutCubic,
              ),
            );
        // Fade in with animation, fade out with secondaryAnimation
        final fadeValue = combinedAnimation.value * reverseFade.value;
        return BackdropFilter(
          filter: ImageFilter.blur(sigmaX: sigma, sigmaY: sigma),
          child: SlideTransition(
            position: slideOffset,
            child: FadeTransition(
              opacity: AlwaysStoppedAnimation(fadeValue),
              child: child,
            ),
          ),
        );
      },
    );
  }

  static Route<T> _blurBuilder<T>(
    BuildContext context,
    Widget child,
    AutoRoutePage<T> page,
  ) {
    return PageRouteBuilder<T>(
      fullscreenDialog: page.fullscreenDialog,
      opaque: false,
      settings: page,
      pageBuilder: (_, _, _) => child,
      transitionsBuilder: blurIn,
      barrierColor: context.theme.colorScheme.shadow.withValues(alpha: 0.01),
    );
  }
}
