import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:openquester/common_imports.dart';

class AppTheme {
  static ThemeData build(Color seed, Brightness brightness) {
    final base = ThemeData(
      colorScheme: ColorScheme.fromSeed(
        seedColor: seed,
        brightness: brightness,
      ),
      brightness: brightness,
      useMaterial3: true,
    );
    return change(base);
  }

  static ThemeData change(ThemeData theme) {
    return theme.copyWith(
      bottomNavigationBarTheme: theme.bottomNavigationBarTheme.copyWith(
        type: BottomNavigationBarType.shifting,
        landscapeLayout: BottomNavigationBarLandscapeLayout.centered,
        selectedItemColor: theme.colorScheme.onPrimary,
        unselectedItemColor: theme.colorScheme.primary,
        backgroundColor: pureDarkColor,
      ),
      scaffoldBackgroundColor: pureDarkColor,
      appBarTheme: appBarTheme(theme),
      pageTransitionsTheme: pageTransitionsTheme,
      inputDecorationTheme: inputDecorationTheme,
      tooltipTheme: tooltipTheme,
      expansionTileTheme: expansionTileTheme(theme),
      colorScheme: theme.colorScheme.copyWith(
        surface: pureDarkColor,
        surfaceContainer: pureDark
            ? theme.colorScheme.surfaceContainer.withValues(alpha: 0.6)
            : null,
      ),
      extensions: const [
        ExtraColors(success: Color(0xFF7CE883), warning: Color(0xFFFFE078)),
      ],
    );
  }

  // Backward compatibility default themes (using indigo seed)
  static ThemeData get light => build(Colors.indigo, Brightness.light);
  static ThemeData get dark => build(Colors.indigo, Brightness.dark);

  static bool get pureDark =>
      getIt<SettingsController>().settings.themeMode == AppThemeMode.pureDark;
  static Color? get pureDarkColor {
    return pureDark ? Colors.black : null;
  }

  static AppBarTheme appBarTheme(ThemeData theme) {
    return AppBarTheme(
      systemOverlayStyle: systemOverlay(theme),
      centerTitle: true,
      actionsPadding: 8.right,
    );
  }

  static TooltipThemeData get tooltipTheme {
    return const TooltipThemeData(waitDuration: Duration(seconds: 1));
  }

  static InputDecorationTheme get inputDecorationTheme {
    return const InputDecorationTheme(border: OutlineInputBorder());
  }

  static PageTransitionsTheme get pageTransitionsTheme {
    return const PageTransitionsTheme(
      builders: <TargetPlatform, PageTransitionsBuilder>{
        TargetPlatform.android: PredictiveBackPageTransitionsBuilder(),
      },
    );
  }

  static SystemUiOverlayStyle systemOverlay(ThemeData theme) {
    return SystemUiOverlayStyle(
      systemNavigationBarColor: theme.colorScheme.surfaceContainer,
      systemNavigationBarDividerColor: theme.colorScheme.surfaceContainer,
      statusBarIconBrightness: theme.brightness.reverse,
      statusBarBrightness: theme.brightness,
    );
  }

  static ExpansionTileThemeData expansionTileTheme(ThemeData theme) {
    final shape = RoundedRectangleBorder(
      borderRadius: 12.circular,
      side: BorderSide(
        color: theme.colorScheme.outline.withValues(alpha: 0.1),
      ),
    );

    return ExpansionTileThemeData(
      shape: shape,
      collapsedShape: shape,
      childrenPadding: 12.bottom,

      clipBehavior: Clip.antiAlias,
    );
  }
}

class ExtraColors extends ThemeExtension<ExtraColors> {
  const ExtraColors({required this.success, required this.warning});

  final Color? success;
  final Color? warning;

  @override
  ThemeExtension<ExtraColors> copyWith({Color? success, Color? warning}) {
    return ExtraColors(
      success: success ?? this.success,
      warning: warning ?? this.warning,
    );
  }

  @override
  ThemeExtension<ExtraColors> lerp(
    covariant ThemeExtension<ExtraColors>? other,
    double t,
  ) {
    if (other is! ExtraColors) {
      return this;
    }
    return ExtraColors(
      success: Color.lerp(success, other.success, t),
      warning: Color.lerp(warning, other.warning, t),
    );
  }
}
