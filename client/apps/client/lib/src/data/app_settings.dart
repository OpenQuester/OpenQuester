import 'package:flutter/material.dart';
import 'package:freezed_annotation/freezed_annotation.dart';
import 'package:openquester/common_imports.dart';

part 'app_settings.freezed.dart';
part 'app_settings.g.dart';

@freezed
abstract class AppSettings with _$AppSettings {
  const factory AppSettings({
    @Default(AppThemeSeed.indigo) AppThemeSeed themeSeed,
    @Default(AppThemeMode.system) AppThemeMode themeMode,
    @Default(true) bool limitDesktopWidth,
    String? localeTag,
  }) = _AppSettings;

  factory AppSettings.fromJson(Map<String, dynamic> json) =>
      _$AppSettingsFromJson(json);
}

enum AppThemeSeed {
  indigo,
  deepPurple,
  teal,
  orange,
  pink,
  green,
  blueGrey,
}

enum AppThemeMode {
  system,
  light,
  dark,
  pureDark,
}

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
    AppThemeMode.light => lightTheme,
    AppThemeMode.dark => darkTheme,
    AppThemeMode.pureDark => darkTheme,
    AppThemeMode.system => AppTheme.build(themeSeed.color, Brightness.light),
  };
}

extension AppThemeModeX on AppThemeMode {
  bool get isDark => this == AppThemeMode.dark || this == AppThemeMode.pureDark;

  bool get isLight => this == AppThemeMode.light;

  bool get isSystem => this == AppThemeMode.system;

  ThemeMode get material => switch (this) {
    AppThemeMode.light => ThemeMode.light,
    AppThemeMode.dark => ThemeMode.dark,
    AppThemeMode.pureDark => ThemeMode.dark,
    AppThemeMode.system => ThemeMode.system,
  };
}
