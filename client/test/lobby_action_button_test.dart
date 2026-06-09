import 'package:flutter_test/flutter_test.dart' as ft;
import 'package:openquester/openquester.dart';

void main() {
  ft.group('startGameButtonLocaleKey', () {
    ft.test('uses forceful label when at least one player is not ready', () {
      final localeKey = startGameButtonLocaleKey(
        playerCount: 2,
        readyPlayerCount: 1,
      );

      ft.expect(localeKey, LocaleKeys.start_game_forcefully);
    });

    ft.test('uses normal label when all players are ready', () {
      final localeKey = startGameButtonLocaleKey(
        playerCount: 2,
        readyPlayerCount: 2,
      );

      ft.expect(localeKey, LocaleKeys.start_game);
    });

    ft.test('uses normal label when there are no players', () {
      final localeKey = startGameButtonLocaleKey(
        playerCount: 0,
        readyPlayerCount: 0,
      );

      ft.expect(localeKey, LocaleKeys.start_game);
    });
  });
}
