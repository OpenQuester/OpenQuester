import 'package:openquester/common_imports.dart';

class JoinRoleOption {
  const JoinRoleOption({
    required this.role,
  });

  final PlayerRole role;
}

List<JoinRoleOption> buildJoinRoleSwitchOptions({
  required PlayerRole currentRole,
  required bool showmanTaken,
  required bool playerSeatsFull,
}) {
  final canSwitchToShowman = currentRole != PlayerRole.showman && !showmanTaken;
  final canSwitchToPlayer =
      currentRole != PlayerRole.player && !playerSeatsFull;
  final canSwitchToSpectator = currentRole != PlayerRole.spectator;

  return [
    if (canSwitchToShowman) const JoinRoleOption(role: PlayerRole.showman),
    if (canSwitchToPlayer) const JoinRoleOption(role: PlayerRole.player),
    if (canSwitchToSpectator) const JoinRoleOption(role: PlayerRole.spectator),
  ];
}

PlayerRole resolveJoinRole({
  required GameListItem? game,
  required int userId,
  PlayerRole? requestedRole,
}) {
  if (requestedRole != null) return requestedRole;

  final existingRole = game?.players
      .firstWhereOrNull((player) => player.id == userId)
      ?.role;

  if (existingRole == PlayerRole.showman && _hasOtherShowman(game, userId)) {
    return PlayerRole.spectator;
  }

  if (existingRole != null) return existingRole;

  final creatorCanBeShowman =
      game?.createdBy.id == userId && !_hasOtherShowman(game, userId);

  if (creatorCanBeShowman) return PlayerRole.showman;

  return PlayerRole.spectator;
}

bool _hasOtherShowman(GameListItem? game, int userId) {
  return game?.players.any(
        (player) {
          final belongsToAnotherUser = player.id != userId;
          final isShowman = player.role == PlayerRole.showman;

          return belongsToAnotherUser && isShowman;
        },
      ) ??
      false;
}
