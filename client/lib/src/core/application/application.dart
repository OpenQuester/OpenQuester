import 'dart:async';

import 'package:flutter/material.dart';
import 'package:openquester/common_imports.dart';
import 'package:openquester/src/core/controllers/app_state_controller.dart';
import 'package:talker_flutter/talker_flutter.dart' hide TalkerLogger;

class App extends WatchingStatefulWidget {
  const App({super.key});

  @override
  State<App> createState() => _AppState();
}

class _AppState extends State<App> with WidgetsBindingObserver {
  bool loading = true;

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) =>
      getIt<AppStateController>().appLifecycleState.value = state;

  @override
  void initState() {
    super.initState();
    unawaited(AppInit.buildInit().then((_) => setState(() => loading = false)));
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    const loader = Material();
    final settings = watchPropertyValue<SettingsController, AppSettings>(
      (e) => e.settings,
    );

    return AppWrapper(
      child: MaterialApp.router(
        title: 'OpenQuester',
        restorationScopeId: 'app',
        theme: settings.lightTheme,
        darkTheme: settings.darkTheme,
        themeMode: settings.themeMode.material,
        routerConfig: getIt<AppRouter>().config(
          deepLinkTransformer: getIt<AppRouter>().deepLinkTransformer,
          navigatorObservers: () => [
            TalkerRouteObserver(getIt<TalkerLogger>().talker),
          ],
        ),
        localizationsDelegates: context.localizationDelegates,
        supportedLocales: context.supportedLocales,
        locale: context.locale,
        debugShowCheckedModeBanner: false,
        builder: (context, child) {
          if (loading) return loader;
          return AppBuilderWrapper(child: child ?? loader);
        },
      ),
    );
  }
}
