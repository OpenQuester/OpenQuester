import 'package:flutter_test/flutter_test.dart';
import 'package:openquester/src/features/game_lobby/view/lobby_layout_resolver.dart';

void main() {
  group('LobbyLayoutResolver', () {
    test('uses one main column and overlay chat on compact screens', () {
      final layout = LobbyLayoutResolver.resolve(
        availableWidth: 393,
        chatOpen: true,
      );

      expect(layout.mainColumns, LobbyMainColumns.one);
      expect(layout.chatPresentation, LobbyChatPresentation.overlay);
      expect(layout.actionPlacement, LobbyActionPlacement.bottom);
    });

    test('allows two main columns before persistent chat is available', () {
      final layout = LobbyLayoutResolver.resolve(
        availableWidth: 1024,
        chatOpen: true,
      );

      expect(layout.mainColumns, LobbyMainColumns.two);
      expect(layout.chatPresentation, LobbyChatPresentation.overlay);
      expect(layout.mainContentWidth, greaterThanOrEqualTo(900));
    });

    test('keeps medium chat as overlay instead of shrinking main columns', () {
      final layout = LobbyLayoutResolver.resolve(
        availableWidth: 1280,
        chatOpen: true,
      );

      expect(layout.mainColumns, LobbyMainColumns.two);
      expect(layout.chatPresentation, LobbyChatPresentation.overlay);
      expect(layout.reservedChatWidth, 0);
    });

    test(
      'uses persistent chat only with enough width for valid main lobby',
      () {
        final layout = LobbyLayoutResolver.resolve(
          availableWidth: 1600,
          chatOpen: true,
        );

        expect(layout.mainColumns, LobbyMainColumns.two);
        expect(layout.chatPresentation, LobbyChatPresentation.persistent);
        expect(layout.mainContentWidth, greaterThanOrEqualTo(900));
        expect(layout.reservedChatWidth, greaterThanOrEqualTo(300));
      },
    );

    test(
      'does not reserve chat space when chat is closed on expanded screens',
      () {
        final layout = LobbyLayoutResolver.resolve(
          availableWidth: 1600,
          chatOpen: false,
        );

        expect(layout.mainColumns, LobbyMainColumns.two);
        expect(layout.chatPresentation, LobbyChatPresentation.hidden);
        expect(layout.reservedChatWidth, 0);
        expect(layout.mainContentWidth, greaterThanOrEqualTo(1500));
      },
    );
  });
}
