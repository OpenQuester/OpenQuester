import 'package:auto_route/auto_route.dart';
import 'package:oq_editor/router/router.gr.dart';

@AutoRouterConfig(
  deferredLoading: true,
  replaceInRouteName: 'Dialog|Page|Screen,Route',
)
class OqEditorRouter extends RootStackRouter {
  @override
  List<AutoRoute> get routes => editorRoutes();

  static List<AutoRoute> editorRoutes() {
    return [
      AutoRoute(
        page: PackageInfoRoute.page,
        path: 'info',
        initial: true,
      ),
      AutoRoute(
        page: RoundsListRoute.page,
        path: 'rounds',
      ),
      AutoRoute(
        page: RoundEditorRoute.page,
        path: 'rounds/:roundIndex/edit',
      ),
      AutoRoute(
        page: ThemesGridRoute.page,
        path: 'rounds/:roundIndex/themes',
      ),
      AutoRoute(
        page: ThemeEditorRoute.page,
        path: 'rounds/:roundIndex/themes/:themeIndex/edit',
      ),
      AutoRoute(
        page: QuestionsListRoute.page,
        path: 'rounds/:roundIndex/themes/:themeIndex/questions',
      ),
    ];
  }

  @override
  RouteType get defaultRouteType => const RouteType.adaptive();
}
