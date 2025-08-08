import 'package:flutter/material.dart';
import 'package:openquester/common_imports.dart';
import 'package:toastification/toastification.dart';

class App extends WatchingStatefulWidget {
  const App({super.key});

  @override
  State<App> createState() => _AppState();
}

class _AppState extends State<App> {
  bool loading = true;

  @override
  void initState() {
    super.initState();
    AppInit.buildInit().then((_) => setState(() => loading = false));
  }

  @override
  Widget build(BuildContext context) {
    const loader = Material();
    final settings = watchPropertyValue<SettingsController, AppSettings>(
      (e) => e.settings,
    );

    return ToastificationWrapper(
      config: getIt<ToastController>().config,
      child: MaterialApp.router(
        title: 'OpenQuester',
        restorationScopeId: 'app',
        theme: settings.lightTheme,
        darkTheme: settings.darkTheme,
        themeMode: settings.themeMode.material,
        routerConfig: getIt<AppRouter>().config(
          deepLinkTransformer: getIt<AppRouter>().deepLinkTransformer,
        ),
        localizationsDelegates: context.localizationDelegates,
        supportedLocales: context.supportedLocales,
        locale: context.locale,
        debugShowCheckedModeBanner: false,
        builder: (context, child) {
          if (loading) return loader;
          return child ?? loader;
        },
      ),
    );
  }
}
