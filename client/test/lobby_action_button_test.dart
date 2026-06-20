import 'package:flutter_test/flutter_test.dart' as ft;
import 'package:openquester/openquester.dart';

void main() {
  ft.setUp(() async {
    await getIt.reset();
    getIt.registerSingleton(ProfileController()..user.value = _user());
  });

  ft.tearDown(() async {
    await getIt.reset();
  });

  ft.group('startGameButtonLocaleKey', () {
    ft.test(
      'uses start-anyway label when at least one player is not ready',
      () {
        final localeKey = startGameButtonLocaleKey(
          playerCount: 2,
          readyPlayerCount: 1,
        );

        ft.expect(localeKey, LocaleKeys.start_game_anyway);
      },
    );

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

  ft.group('shouldShowLobbyActionButton', () {
    ft.test('shows action for players before game starts', () {
      ft.expect(
        shouldShowLobbyActionButton(_gameData(PlayerRole.player)),
        ft.isTrue,
      );
    });

    ft.test('hides action for spectators', () {
      ft.expect(
        shouldShowLobbyActionButton(_gameData(PlayerRole.spectator)),
        ft.isFalse,
      );
    });

    ft.test('hides action before game data is loaded', () {
      ft.expect(shouldShowLobbyActionButton(null), ft.isFalse);
    });
  });
}

ResponseUser _user() {
  return ResponseUser(
    id: 1,
    username: 'mira',
    createdAt: DateTime(2026),
    updatedAt: DateTime(2026),
    isDeleted: false,
    isBanned: false,
    isGuest: false,
    permissions: const [],
    name: 'Mira',
  );
}

SocketIoGameJoinEventPayload _gameData(PlayerRole currentUserRole) {
  return SocketIoGameJoinEventPayload(
    meta: const SocketIoGameJoinMeta(title: 'Friday Quiz'),
    players: [
      _player(id: 1, name: 'Mira', role: currentUserRole),
      _player(id: 2, name: 'Dana', role: PlayerRole.showman),
      _player(id: 3, name: 'Dan', role: PlayerRole.player, slot: 0),
    ],
    gameState: const GameState(
      isPaused: false,
      readyPlayers: [3],
    ),
    chatMessages: const [],
  );
}

PlayerData _player({
  required int id,
  required String name,
  required PlayerRole role,
  PlayerDataStatus status = PlayerDataStatus.inGame,
  int? slot,
}) {
  return PlayerData(
    meta: PlayerMeta(id: id, username: name),
    role: role,
    restrictionData: const PlayerRestrictions(
      muted: false,
      restricted: false,
      banned: false,
    ),
    score: 0,
    status: status,
    slot: slot,
  );
}
