import 'dart:async';

import 'package:flutter/material.dart';
import 'package:openquester/common_imports.dart';
import 'package:talker_flutter/talker_flutter.dart' hide TalkerLogger;

class App extends WatchingStatefulWidget {
  const App({super.key});

  @override
  State<App> createState() => _AppState();
}

class _AppState extends State<App> with WidgetsBindingObserver {
  bool loading = true;
  final SettingsController _settingsController = getIt<SettingsController>();
  String? _lastLocaleTag;
  Locale? _lastTargetLocale;

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) =>
      getIt<AppStateController>().appLifecycleState.value = state;

  @override
  void didChangeLocales(List<Locale>? locales) {
    _syncLocaleFromSettings();
  }

  @override
  void initState() {
    super.initState();
    unawaited(AppInit.buildInit().then((_) => setState(() => loading = false)));
    WidgetsBinding.instance.addObserver(this);
    _settingsController.addListener(_syncLocaleFromSettings);
    WidgetsBinding.instance.addPostFrameCallback(
      (_) => _syncLocaleFromSettings(),
    );
  }

  @override
  void dispose() {
    _settingsController.removeListener(_syncLocaleFromSettings);
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  void _syncLocaleFromSettings() {
    if (!mounted) return;
    final targetLocale =
        parseLocaleTag(_settingsController.settings.localeTag) ??
        context.deviceLocale;

    if (_lastLocaleTag == _settingsController.settings.localeTag &&
        _lastTargetLocale == targetLocale) {
      return;
    }

    _lastLocaleTag = _settingsController.settings.localeTag;
    _lastTargetLocale = targetLocale;

    if (context.locale == targetLocale) return;

    WidgetsBinding.instance.addPostFrameCallback((_) async {
      if (!mounted) return;
      if (context.locale == targetLocale) return;
      await context.setLocale(targetLocale);
    });
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
          return AppBuilderWrapper(
            child: child ?? loader,
          );
        },
      ),
    );
  }
}
