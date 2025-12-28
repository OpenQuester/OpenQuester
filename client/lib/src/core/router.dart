import 'dart:async';

import 'package:openquester/common_imports.dart';
import 'package:oq_editor/router/router.dart';

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
      AutoRoute(
        page: PackageEditorRoute.page,
        path: '/editor',
        children: OqEditorRouter.editorRoutes(),
      ),
      AutoRoute(page: AdminDashboardRoute.page, path: '/admin'),
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
