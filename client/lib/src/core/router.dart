import 'dart:async';
import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:openquester/common_imports.dart';

@AutoRouterConfig(
  deferredLoading: true,
  replaceInRouteName: 'Dialog|Page|Screen,Route',
)
@Singleton(order: 0)
class AppRouter extends RootStackRouter {
  @override
  List<AutoRoute> get routes {
    return [
      AutoRoute(page: HomeTabsRoute.page, path: '/', initial: true),
      AutoRoute(page: ProfileRoute.page, path: '/profile'),
      BlurDialogRoute<void>(page: CreateGameRoute.page, path: '/games/create'),
      BlurDialogRoute<void>(
        page: GamePreviewRoute.page,
        path: '/games/:gameId/preview',
      ),
      AutoRoute(page: GameLobbyRoute.page, path: '/games/:gameId'),
      AutoRoute(page: ClickerRoute.page, path: '/clicker'),
      AutoRoute(page: TestScreenRoute.page, path: '/test'),
    ];
  }

  static AppRouter get I => getIt<AppRouter>();

  @override
  RouteType get defaultRouteType =>
      const RouteType.adaptive(enablePredictiveBackGesture: true);

  Future<Uri> deepLinkTransformer(Uri uri) async {
    if (uri.path != '/') {
      // Make home screen behind any page from deep link
      Future.delayed(Duration.zero, () => pushPath(uri.path));
    }
    return Uri(path: '/');
  }
}

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
       );

  static Widget blurIn(
    BuildContext context,
    Animation<double> animation,
    Animation<double> secondaryAnimation,
    Widget child,
  ) {
    return AnimatedBuilder(
      animation: animation,
      child: child,
      builder: (context, child) {
        final sigma = animation.value * 2;
        return BackdropFilter(
          filter: ImageFilter.blur(sigmaX: sigma, sigmaY: sigma),
          child: child,
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
      barrierColor: Colors.black.withValues(alpha: .3),
    );
  }
}
