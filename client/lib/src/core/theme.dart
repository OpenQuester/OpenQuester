import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:openquester/common_imports.dart';

/// Animation configuration constants for consistent timing
class AppAnimations {
  static const Duration fast = Duration(milliseconds: 150);
  static const Duration medium = Duration(milliseconds: 300);
  static const Duration slow = Duration(milliseconds: 500);
  
  // Common curves
  static const Curve easeInOut = Curves.easeInOut;
  static const Curve easeOut = Curves.easeOut;
  static const Curve easeOutCubic = Curves.easeOutCubic;
  static const Curve spring = Curves.elasticOut;
  
  // Modal animation settings
  static const Duration modalEntry = Duration(milliseconds: 300);
  static const Duration modalExit = Duration(milliseconds: 200);
  static const Curve modalCurve = Curves.easeOutCubic;
}

class AppTheme {
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
      inputDecorationTheme: inputDecorationTheme(theme),
      tooltipTheme: tooltipTheme,
      cardTheme: cardTheme(theme),
      elevatedButtonTheme: elevatedButtonTheme(theme),
      filledButtonTheme: filledButtonTheme(theme),
      outlinedButtonTheme: outlinedButtonTheme(theme),
      textButtonTheme: textButtonTheme(theme),
      bottomSheetTheme: bottomSheetTheme(theme),
      dialogTheme: dialogTheme(theme),
      extensions: const [
        ExtraColors(success: Color(0xFF7CE883), warning: Color(0xFFFFE078)),
      ],
    );
  }

  static AppBarTheme appBarTheme(ThemeData theme) {
    return AppBarTheme(
      systemOverlayStyle: systemOverlay(theme),
      centerTitle: true,
      actionsPadding: 8.right,
      elevation: 0,
      scrolledUnderElevation: 0,
    );
  }

  static TooltipThemeData get tooltipTheme {
    return const TooltipThemeData(
      waitDuration: Duration(seconds: 1),
      showDuration: Duration(seconds: 2),
    );
  }

  static InputDecorationTheme inputDecorationTheme(ThemeData theme) {
    return InputDecorationTheme(
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(
          color: theme.colorScheme.outline.withValues(alpha: 0.5),
        ),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(
          color: theme.colorScheme.primary,
          width: 2,
        ),
      ),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
    );
  }

  static CardTheme cardTheme(ThemeData theme) {
    return CardTheme(
      elevation: 2,
      shadowColor: theme.colorScheme.shadow.withValues(alpha: 0.1),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
      ),
    );
  }

  static ElevatedButtonThemeData elevatedButtonTheme(ThemeData theme) {
    return ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
        ),
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
        animationDuration: AppAnimations.fast,
      ),
    );
  }

  static FilledButtonThemeData filledButtonTheme(ThemeData theme) {
    return FilledButtonThemeData(
      style: FilledButton.styleFrom(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
        ),
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
        animationDuration: AppAnimations.fast,
      ),
    );
  }

  static OutlinedButtonThemeData outlinedButtonTheme(ThemeData theme) {
    return OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
        ),
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
        animationDuration: AppAnimations.fast,
      ),
    );
  }

  static TextButtonThemeData textButtonTheme(ThemeData theme) {
    return TextButtonThemeData(
      style: TextButton.styleFrom(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
        ),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        animationDuration: AppAnimations.fast,
      ),
    );
  }

  static BottomSheetThemeData bottomSheetTheme(ThemeData theme) {
    return BottomSheetThemeData(
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(
          top: Radius.circular(16),
        ),
      ),
      elevation: 8,
      modalElevation: 16,
      animationDuration: AppAnimations.medium,
    );
  }

  static DialogTheme dialogTheme(ThemeData theme) {
    return DialogTheme(
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
      ),
      elevation: 24,
      shadowColor: theme.colorScheme.shadow.withValues(alpha: 0.2),
    );
  }

  static PageTransitionsTheme get pageTransitionsTheme {
    return const PageTransitionsTheme(
      builders: <TargetPlatform, PageTransitionsBuilder>{
        // Set the predictive back transitions for Android.
        TargetPlatform.android: PredictiveBackPageTransitionsBuilder(),
        // Enhanced transitions for other platforms
        TargetPlatform.iOS: CupertinoPageTransitionsBuilder(),
        TargetPlatform.macOS: CupertinoPageTransitionsBuilder(),
        TargetPlatform.windows: FadeUpwardsPageTransitionsBuilder(),
        TargetPlatform.linux: FadeUpwardsPageTransitionsBuilder(),
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

  static ThemeData get light => change(ThemeData.light());
  static ThemeData get dark => change(ThemeData.dark());
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
