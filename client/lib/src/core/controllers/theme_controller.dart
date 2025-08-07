import 'package:flutter/material.dart';
import 'package:openquester/common_imports.dart';

/// Persistent theme controller allowing user to select ThemeMode & seed color.
class ThemeController {
  static const String _kThemeMode = 'ui.theme.mode';
  static const String _kThemeSeed = 'ui.theme.seed';

  final ValueNotifier<ThemeMode> themeMode = ValueNotifier(ThemeMode.system);
  final ValueNotifier<AppThemeSeed> seed = ValueNotifier<AppThemeSeed>(
    AppThemeSeed.indigo,
  );

  Future<void> init() async {
    final storage = getIt<Storage>();
    final modeRaw = await storage.get(_kThemeMode) as String?;
    final seedRaw = await storage.get(_kThemeSeed) as String?;

    if (modeRaw != null) {
      themeMode.value =
          ThemeMode.values.firstWhereOrNull((e) => e.name == modeRaw) ??
          ThemeMode.system;
    }
    if (seedRaw != null) {
      seed.value =
          AppThemeSeed.values.firstWhereOrNull((e) => e.name == seedRaw) ??
          AppThemeSeed.indigo;
    }
  }

  Future<void> setThemeMode(ThemeMode value) async {
    if (value == themeMode.value) return;
    themeMode.value = value;
    await _persist();
  }

  Future<void> setSeed(AppThemeSeed value) async {
    if (value == seed.value) return;
    seed.value = value;
    await _persist();
  }

  Future<void> _persist() async {
    final storage = getIt<Storage>();
    await storage.put(_kThemeMode, themeMode.value.name);
    await storage.put(_kThemeSeed, seed.value.name);
  }

  ThemeData get lightTheme =>
      AppTheme.build(seed.value.color, Brightness.light);
  ThemeData get darkTheme => AppTheme.build(seed.value.color, Brightness.dark);
}

/// Predefined Material Design 3-like seed palettes.
enum AppThemeSeed { indigo, deepPurple, teal, orange, pink, green, blueGrey }

extension AppThemeSeedX on AppThemeSeed {
  String get label => switch (this) {
    AppThemeSeed.indigo => 'Indigo',
    AppThemeSeed.deepPurple => 'Deep Purple',
    AppThemeSeed.teal => 'Teal',
    AppThemeSeed.orange => 'Orange',
    AppThemeSeed.pink => 'Pink',
    AppThemeSeed.green => 'Green',
    AppThemeSeed.blueGrey => 'Blue Grey',
  };

  Color get color => switch (this) {
    AppThemeSeed.indigo => Colors.indigo,
    AppThemeSeed.deepPurple => Colors.deepPurple,
    AppThemeSeed.teal => Colors.teal,
    AppThemeSeed.orange => Colors.deepOrange,
    AppThemeSeed.pink => Colors.pink,
    AppThemeSeed.green => Colors.green,
    AppThemeSeed.blueGrey => Colors.blueGrey,
  };
}
