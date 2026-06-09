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
    const success = Color(0xFF7CE883);
    const successDark = Color(0xFF0B6B2B);
    const warning = Color(0xFFFFE078);
    const warningDark = Color(0xFF755100);
    const gold = Color(0xFFFFD700);
    const goldDark = Color(0xFF6F5A00);
    const silver = Color(0xFFC0C0C0);
    const silverDark = Color(0xFF5F6670);
    const bronze = Color(0xFFCD7F32);
    const bronzeDark = Color(0xFF7A4A1D);
    final useDarkVariants = theme.brightness == Brightness.light;

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
      extensions: [
        ExtraColors(
          success: useDarkVariants ? successDark : success,
          successDark: successDark,
          warning: useDarkVariants ? warningDark : warning,
          warningDark: warningDark,
          gold: useDarkVariants ? goldDark : gold,
          goldDark: goldDark,
          silver: useDarkVariants ? silverDark : silver,
          silverDark: silverDark,
          bronze: useDarkVariants ? bronzeDark : bronze,
          bronzeDark: bronzeDark,
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

Color contrastOnColor(Color background) {
  return background.computeLuminance() > 0.179 ? Colors.black : Colors.white;
}

class ExtraColors extends ThemeExtension<ExtraColors> {
  const ExtraColors({
    required this.success,
    required this.successDark,
    required this.warning,
    required this.warningDark,
    required this.gold,
    required this.goldDark,
    required this.silver,
    required this.silverDark,
    required this.bronze,
    required this.bronzeDark,
  });

  final Color success;
  final Color successDark;
  final Color warning;
  final Color warningDark;
  final Color gold;
  final Color goldDark;
  final Color silver;
  final Color silverDark;
  final Color bronze;
  final Color bronzeDark;

  static ExtraColors of(BuildContext context) =>
      Theme.of(context).extension<ExtraColors>()!;

  @override
  ThemeExtension<ExtraColors> copyWith({
    Color? success,
    Color? successDark,
    Color? warning,
    Color? warningDark,
    Color? gold,
    Color? goldDark,
    Color? silver,
    Color? silverDark,
    Color? bronze,
    Color? bronzeDark,
  }) {
    return ExtraColors(
      success: success ?? this.success,
      successDark: successDark ?? this.successDark,
      warning: warning ?? this.warning,
      warningDark: warningDark ?? this.warningDark,
      gold: gold ?? this.gold,
      goldDark: goldDark ?? this.goldDark,
      silver: silver ?? this.silver,
      silverDark: silverDark ?? this.silverDark,
      bronze: bronze ?? this.bronze,
      bronzeDark: bronzeDark ?? this.bronzeDark,
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
      successDark: Color.lerp(successDark, other.successDark, t) ?? successDark,
      warning: Color.lerp(warning, other.warning, t) ?? warning,
      warningDark: Color.lerp(warningDark, other.warningDark, t) ?? warningDark,
      gold: Color.lerp(gold, other.gold, t) ?? gold,
      goldDark: Color.lerp(goldDark, other.goldDark, t) ?? goldDark,
      silver: Color.lerp(silver, other.silver, t) ?? silver,
      silverDark: Color.lerp(silverDark, other.silverDark, t) ?? silverDark,
      bronze: Color.lerp(bronze, other.bronze, t) ?? bronze,
      bronzeDark: Color.lerp(bronzeDark, other.bronzeDark, t) ?? bronzeDark,
    );
  }
}
