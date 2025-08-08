import 'package:flutter/material.dart';
import 'package:freezed_annotation/freezed_annotation.dart';
import 'package:openquester/common_imports.dart';

part 'app_settings.freezed.dart';
part 'app_settings.g.dart';

@freezed
abstract class AppSettings with _$AppSettings {
  const factory AppSettings({
    required AppThemeSeed themeSeed,
    required ThemeMode themeMode,
  }) = _AppSettings;

  factory AppSettings.fromJson(Map<String, dynamic> json) =>
      _$AppSettingsFromJson(json);
}

enum AppThemeSeed { indigo, deepPurple, teal, orange, pink, green, blueGrey }

extension AppThemeSeedX on AppThemeSeed {
  String get label => switch (this) {
    AppThemeSeed.indigo => LocaleKeys.theme_color_seeds_indigo.tr(),
    AppThemeSeed.deepPurple => LocaleKeys.theme_color_seeds_deep_purple.tr(),
    AppThemeSeed.teal => LocaleKeys.theme_color_seeds_teal.tr(),
    AppThemeSeed.orange => LocaleKeys.theme_color_seeds_orange.tr(),
    AppThemeSeed.pink => LocaleKeys.theme_color_seeds_pink.tr(),
    AppThemeSeed.green => LocaleKeys.theme_color_seeds_green.tr(),
    AppThemeSeed.blueGrey => LocaleKeys.theme_color_seeds_blue_grey.tr(),
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

extension AppSettingsX on AppSettings {
  ThemeData get lightTheme => AppTheme.build(themeSeed.color, Brightness.light);
  ThemeData get darkTheme => AppTheme.build(themeSeed.color, Brightness.dark);
  ThemeData get themeData => switch (themeMode) {
    ThemeMode.light => lightTheme,
    ThemeMode.dark => darkTheme,
    ThemeMode.system => AppTheme.build(themeSeed.color, Brightness.light),
  };
}
