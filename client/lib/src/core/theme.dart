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
    final colorScheme = theme.colorScheme.copyWith(
      surface: pureDarkColor,
      surfaceContainerLow: pureDarkColor,
      shadow: pureDark ? Colors.white.withValues(alpha: .1) : null,
      surfaceContainer: pureDark
          ? theme.colorScheme.surfaceContainer.withBrightness(-0.1)
          : null,
    );

    return theme.copyWith(
      bottomNavigationBarTheme: theme.bottomNavigationBarTheme.copyWith(
        type: BottomNavigationBarType.shifting,
        landscapeLayout: BottomNavigationBarLandscapeLayout.centered,
        selectedItemColor: colorScheme.onPrimary,
        unselectedItemColor: colorScheme.primary,
        backgroundColor: pureDarkColor,
      ),
      scaffoldBackgroundColor: pureDarkColor,
      appBarTheme: appBarTheme(theme, colorScheme),
      pageTransitionsTheme: pageTransitionsTheme,
      inputDecorationTheme: inputDecorationTheme(colorScheme),
      tooltipTheme: tooltipTheme,
      expansionTileTheme: expansionTileTheme(colorScheme),
      cardColor: pureDarkColor,
      colorScheme: colorScheme,
      extensions: const [
        ExtraColors(
          success: Color(0xFF7CE883),
          warning: Color(0xFFFFE078),
          gold: Color(0xFFFFD700),
          silver: Color(0xFFC0C0C0),
          bronze: Color(0xFFCD7F32),
        ),
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

  static AppBarTheme appBarTheme(ThemeData theme, ColorScheme colorScheme) {
    return AppBarTheme(
      systemOverlayStyle: systemOverlay(theme, colorScheme),
      centerTitle: true,
      actionsPadding: 8.right,
    );
  }

  static TooltipThemeData get tooltipTheme {
    return const TooltipThemeData(waitDuration: Duration(seconds: 1));
  }

  static InputDecorationTheme inputDecorationTheme(ColorScheme colorScheme) {
    return InputDecorationTheme(
      border: OutlineInputBorder(borderRadius: 8.circular),
    );
  }

  static PageTransitionsTheme get pageTransitionsTheme {
    return const PageTransitionsTheme(
      builders: <TargetPlatform, PageTransitionsBuilder>{
        TargetPlatform.android: PredictiveBackPageTransitionsBuilder(),
      },
    );
  }

  static SystemUiOverlayStyle systemOverlay(
    ThemeData theme,
    ColorScheme colorScheme,
  ) {
    return SystemUiOverlayStyle(
      systemNavigationBarColor: colorScheme.surfaceContainer,
      systemNavigationBarDividerColor: colorScheme.surfaceContainer,
      statusBarIconBrightness: theme.brightness.reverse,
      statusBarBrightness: theme.brightness,
    );
  }

  static ExpansionTileThemeData expansionTileTheme(ColorScheme colorScheme) {
    final shape = RoundedRectangleBorder(
      borderRadius: 12.circular,
      side: BorderSide(
        color: colorScheme.outline.withValues(alpha: 0.1),
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
  const ExtraColors({
    required this.success,
    required this.warning,
    required this.gold,
    required this.silver,
    required this.bronze,
  });

  final Color success;
  final Color warning;
  final Color gold;
  final Color silver;
  final Color bronze;

  static ExtraColors of(BuildContext context) =>
      Theme.of(context).extension<ExtraColors>()!;

  @override
  ThemeExtension<ExtraColors> copyWith({
    Color? success,
    Color? warning,
    Color? gold,
    Color? silver,
    Color? bronze,
  }) {
    return ExtraColors(
      success: success ?? this.success,
      warning: warning ?? this.warning,
      gold: gold ?? this.gold,
      silver: silver ?? this.silver,
      bronze: bronze ?? this.bronze,
    );
  }

  @override
  ThemeExtension<ExtraColors> lerp(
    covariant ThemeExtension<ExtraColors> other,
    double t,
  ) {
    if (other is! ExtraColors) {
      return this;
    }
    return ExtraColors(
      success: Color.lerp(success, other.success, t) ?? success,
      warning: Color.lerp(warning, other.warning, t) ?? warning,
      gold: Color.lerp(gold, other.gold, t) ?? gold,
      silver: Color.lerp(silver, other.silver, t) ?? silver,
      bronze: Color.lerp(bronze, other.bronze, t) ?? bronze,
    );
  }
}
