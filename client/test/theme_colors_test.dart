import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart' as ft;
import 'package:openquester/openquester.dart';

void main() {
  ft.setUpAll(() {
    ft.TestWidgetsFlutterBinding.ensureInitialized();
    SharedPreferences.setMockInitialValues({});

    if (!getIt.isRegistered<SettingsController>()) {
      getIt.registerSingleton(
        SettingsController()..settings = const AppSettings(),
      );
    }
  });

  ft.group('ExtraColors', () {
    ft.test('uses dark custom variants on light themes', () {
      final lightColors = _extraColors(Brightness.light);
      final darkColors = _extraColors(Brightness.dark);

      ft.expect(lightColors.success, lightColors.successDark);
      ft.expect(lightColors.warning, lightColors.warningDark);
      ft.expect(lightColors.gold, lightColors.goldDark);
      ft.expect(lightColors.silver, lightColors.silverDark);
      ft.expect(lightColors.bronze, lightColors.bronzeDark);

      ft.expect(darkColors.success, ft.isNot(darkColors.successDark));
      ft.expect(darkColors.warning, ft.isNot(darkColors.warningDark));
      ft.expect(darkColors.gold, ft.isNot(darkColors.goldDark));
      ft.expect(darkColors.silver, ft.isNot(darkColors.silverDark));
      ft.expect(darkColors.bronze, ft.isNot(darkColors.bronzeDark));
    });

    ft.test('active custom colors have text contrast on theme surfaces', () {
      for (final brightness in Brightness.values) {
        final theme = AppTheme.build(Colors.indigo, brightness);
        final colors = theme.extension<ExtraColors>()!;
        final surfaceColors = [
          theme.colorScheme.surface,
          theme.colorScheme.surfaceContainer,
          theme.colorScheme.surfaceContainerLow,
        ];
        final customColors = {
          'success': colors.success,
          'warning': colors.warning,
          'gold': colors.gold,
          'silver': colors.silver,
          'bronze': colors.bronze,
        };

        for (final surface in surfaceColors) {
          for (final color in customColors.entries) {
            ft.expect(
              _contrastRatio(color.value, surface),
              ft.greaterThanOrEqualTo(4.5),
              reason:
                  '${brightness.name} ${color.key} must be readable on '
                  '#${surface.toARGB32().toRadixString(16)}',
            );
          }
        }
      }
    });

    ft.test(
      'filled custom foreground has contrast on active custom colors',
      () {
        for (final brightness in Brightness.values) {
          final colors = _extraColors(brightness);
          final customColors = {
            'success': colors.success,
            'warning': colors.warning,
            'gold': colors.gold,
            'silver': colors.silver,
            'bronze': colors.bronze,
          };

          for (final color in customColors.entries) {
            ft.expect(
              _contrastRatio(contrastOnColor(color.value), color.value),
              ft.greaterThanOrEqualTo(4.5),
              reason:
                  '${brightness.name} filled ${color.key} must have readable '
                  'foreground',
            );
          }
        }
      },
    );
  });
}

ExtraColors _extraColors(Brightness brightness) {
  return AppTheme.build(
    Colors.indigo,
    brightness,
  ).extension<ExtraColors>()!;
}

double _contrastRatio(Color a, Color b) {
  final aLuminance = a.computeLuminance();
  final bLuminance = b.computeLuminance();
  final lighter = aLuminance > bLuminance ? aLuminance : bLuminance;
  final darker = aLuminance > bLuminance ? bLuminance : aLuminance;

  return (lighter + 0.05) / (darker + 0.05);
}
