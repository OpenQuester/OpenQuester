import 'package:flutter_test/flutter_test.dart';
import 'package:openapi/openapi.dart';
import 'package:openquester/src/features/game_lobby/data/join_role_option.dart';

void main() {
  group('resolveJoinRole', () {
    test('uses the requested role when one is selected', () {
      final role = resolveJoinRole(
        game: _game(),
        userId: 7,
        requestedRole: PlayerRole.player,
      );

      expect(role, PlayerRole.player);
    });

    test('defaults the lobby creator to showman when the seat is free', () {
      final role = resolveJoinRole(game: _game(createdById: 7), userId: 7);

      expect(role, PlayerRole.showman);
    });

    test('defaults a new non-creator visitor to spectator', () {
      final role = resolveJoinRole(game: _game(), userId: 7);

      expect(role, PlayerRole.spectator);
    });
  });

  group('buildJoinRoleSwitchOptions', () {
    test('shows only roles the current user can switch into', () {
      final options = buildJoinRoleSwitchOptions(
        currentRole: PlayerRole.spectator,
        showmanTaken: false,
        playerSeatsFull: false,
      );

      expect(options.map((option) => option.role), [
        PlayerRole.showman,
        PlayerRole.player,
      ]);
    });

    test('hides roles that are already occupied or full', () {
      final options = buildJoinRoleSwitchOptions(
        currentRole: PlayerRole.spectator,
        showmanTaken: true,
        playerSeatsFull: true,
      );

      expect(options, isEmpty);
    });
  });
}

GameListItem _game({
  int createdById = 1,
}) {
  return GameListItem(
    id: 'game-id',
    createdBy: ShortUserInfo(id: createdById, username: 'Creator'),
    title: 'Friday quiz',
    createdAt: DateTime(2026),
    ageRestriction: AgeRestriction.none,
    isPrivate: false,
    players: const [],
    maxPlayers: 4,
    package: PackageItem(
      id: 10,
      title: 'General knowledge',
      createdAt: DateTime(2026),
      author: const ShortUserInfo(id: 2, username: 'Author'),
      ageRestriction: AgeRestriction.none,
      roundsCount: 3,
      questionsCount: 45,
      tags: const [],
    ),
  );
}
