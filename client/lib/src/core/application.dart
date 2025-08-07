import 'package:flutter/material.dart';
import 'package:openquester/common_imports.dart';
import 'package:toastification/toastification.dart';

import 'controllers/theme_controller.dart';

class App extends StatefulWidget {
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
    final themeController = getIt<ThemeController>();

    return ToastificationWrapper(
      config: getIt<ToastController>().config,
      child: ValueListenableBuilder(
        valueListenable: themeController.themeMode,
        builder: (context, ThemeMode mode, _) {
          return ValueListenableBuilder(
            valueListenable: themeController.seed,
            builder: (context, _, __) {
              return MaterialApp.router(
                title: 'OpenQuester',
                restorationScopeId: 'app',
                theme: themeController.lightTheme,
                darkTheme: themeController.darkTheme,
                themeMode: mode,
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
              );
            },
          );
        },
      ),
    );
  }
}
