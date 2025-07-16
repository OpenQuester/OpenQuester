import 'package:flutter/material.dart';
import 'package:openquester/openquester.dart';

/// Custom page route with enhanced animations
class SmoothPageRoute<T> extends PageRouteBuilder<T> {
  SmoothPageRoute({
    required this.child,
    this.transitionType = PageTransitionType.slideFromRight,
    this.duration = const Duration(milliseconds: 300),
    super.settings,
  }) : super(
          pageBuilder: (context, animation, _) => child,
          transitionDuration: duration,
          reverseTransitionDuration: Duration(milliseconds: (duration.inMilliseconds * 0.7).round()),
          transitionsBuilder: (context, animation, secondaryAnimation, child) {
            return _buildTransition(
              context,
              animation,
              secondaryAnimation,
              child,
              transitionType,
            );
          },
        );

  final Widget child;
  final PageTransitionType transitionType;
  final Duration duration;

  static Widget _buildTransition(
    BuildContext context,
    Animation<double> animation,
    Animation<double> secondaryAnimation,
    Widget child,
    PageTransitionType type,
  ) {
    switch (type) {
      case PageTransitionType.fade:
        return FadeTransition(
          opacity: animation,
          child: child,
        );

      case PageTransitionType.slideFromRight:
        return SlideTransition(
          position: Tween<Offset>(
            begin: const Offset(1.0, 0.0),
            end: Offset.zero,
          ).animate(CurvedAnimation(
            parent: animation,
            curve: Curves.easeOutCubic,
          )),
          child: child,
        );

      case PageTransitionType.slideFromLeft:
        return SlideTransition(
          position: Tween<Offset>(
            begin: const Offset(-1.0, 0.0),
            end: Offset.zero,
          ).animate(CurvedAnimation(
            parent: animation,
            curve: Curves.easeOutCubic,
          )),
          child: child,
        );

      case PageTransitionType.slideFromBottom:
        return SlideTransition(
          position: Tween<Offset>(
            begin: const Offset(0.0, 1.0),
            end: Offset.zero,
          ).animate(CurvedAnimation(
            parent: animation,
            curve: Curves.easeOutCubic,
          )),
          child: child,
        );

      case PageTransitionType.slideFromTop:
        return SlideTransition(
          position: Tween<Offset>(
            begin: const Offset(0.0, -1.0),
            end: Offset.zero,
          ).animate(CurvedAnimation(
            parent: animation,
            curve: Curves.easeOutCubic,
          )),
          child: child,
        );

      case PageTransitionType.scale:
        return ScaleTransition(
          scale: Tween<double>(
            begin: 0.8,
            end: 1.0,
          ).animate(CurvedAnimation(
            parent: animation,
            curve: Curves.easeOutCubic,
          )),
          child: FadeTransition(
            opacity: animation,
            child: child,
          ),
        );

      case PageTransitionType.rotation:
        return RotationTransition(
          turns: Tween<double>(
            begin: 0.1,
            end: 0.0,
          ).animate(CurvedAnimation(
            parent: animation,
            curve: Curves.easeOutCubic,
          )),
          child: FadeTransition(
            opacity: animation,
            child: child,
          ),
        );

      case PageTransitionType.slideScale:
        return SlideTransition(
          position: Tween<Offset>(
            begin: const Offset(1.0, 0.0),
            end: Offset.zero,
          ).animate(CurvedAnimation(
            parent: animation,
            curve: Curves.easeOutCubic,
          )),
          child: ScaleTransition(
            scale: Tween<double>(
              begin: 0.8,
              end: 1.0,
            ).animate(CurvedAnimation(
              parent: animation,
              curve: Curves.easeOutCubic,
            )),
            child: child,
          ),
        );
    }
  }
}

/// Available page transition types
enum PageTransitionType {
  fade,
  slideFromRight,
  slideFromLeft,
  slideFromBottom,
  slideFromTop,
  scale,
  rotation,
  slideScale,
}

/// Utility methods for smooth navigation
extension SmoothNavigation on NavigatorState {
  Future<T?> pushSmooth<T extends Object?>(
    Widget page, {
    PageTransitionType transitionType = PageTransitionType.slideFromRight,
    Duration duration = const Duration(milliseconds: 300),
  }) {
    return push<T>(
      SmoothPageRoute<T>(
        child: page,
        transitionType: transitionType,
        duration: duration,
      ),
    );
  }

  Future<T?> pushReplacementSmooth<T extends Object?, TO extends Object?>(
    Widget page, {
    PageTransitionType transitionType = PageTransitionType.slideFromRight,
    Duration duration = const Duration(milliseconds: 300),
    TO? result,
  }) {
    return pushReplacement<T, TO>(
      SmoothPageRoute<T>(
        child: page,
        transitionType: transitionType,
        duration: duration,
      ),
      result: result,
    );
  }
}