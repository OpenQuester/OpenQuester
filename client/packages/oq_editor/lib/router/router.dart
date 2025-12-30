import 'package:auto_route/auto_route.dart';
import 'package:oq_editor/router/router.gr.dart';
import 'package:oq_shared/ui/blur_dialog_route.dart';

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
        page: RoundsListRouteNew.page,
        path: 'rounds',
      ),
      AutoRoute(
        page: RoundEditorRoute.page,
        path: 'rounds/:roundIndex',
      ),
      AutoRoute(
        page: ThemesGridRouteNew.page,
        path: 'rounds/:roundIndex/themes',
      ),
      AutoRoute(
        page: ThemeEditorRoute.page,
        path: 'rounds/:roundIndex/themes/:themeIndex',
      ),
      AutoRoute(
        page: QuestionsListRouteNew.page,
        path: 'rounds/:roundIndex/themes/:themeIndex/questions',
      ),
      BlurDialogRoute<void>(
        page: QuestionEditorRoute.page,
        path: 'rounds/:roundIndex/themes/:themeIndex/questions/:questionIndex',
      ),
    ];
  }

  @override
  RouteType get defaultRouteType => const RouteType.adaptive();
}
