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
      ),
      appBarTheme: appBarTheme(theme),
      pageTransitionsTheme: pageTransitionsTheme,
      inputDecorationTheme: inputDecorationTheme,
      tooltipTheme: tooltipTheme,
      extensions: const [
        ExtraColors(success: Color(0xFF7CE883), warning: Color(0xFFFFE078)),
      ],
    );
  }

  // Backward compatibility default themes (using indigo seed)
  static ThemeData get light => build(Colors.indigo, Brightness.light);
  static ThemeData get dark => build(Colors.indigo, Brightness.dark);

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
