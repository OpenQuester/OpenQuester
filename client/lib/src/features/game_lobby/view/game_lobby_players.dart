import 'package:flutter/material.dart';
import 'package:openquester/openquester.dart';

class GameLobbyPlayers extends WatchingWidget {
  const GameLobbyPlayers({required this.axis, super.key});
  final Axis axis;

  @override
  Widget build(BuildContext context) {
    final gameData = watchValue((GameLobbyController e) => e.gameData);
    final gameState = gameData?.gameState;
    final answeredPlayers = gameState?.answeredPlayers;
    final answeringPlayer = gameState?.answeringPlayer;
    final skippedPlayers = gameState?.skippedPlayers;
    final currentTurnPlayerId = gameState?.currentTurnPlayerId;
    const roleToShow = {PlayerRole.player, PlayerRole.showman};
    const inGame = PlayerDataStatus.inGame;
    final players =
        gameData?.players
            .where(
              (p) {
                final itsMe = p.meta.id == getIt<GameLobbyController>().myId;
                return roleToShow.contains(p.role) &&
                    (p.status == inGame || itsMe);
              },
            )
            .sorted((a, b) => a.role == PlayerRole.showman ? 0 : 1)
            .toList() ??
        [];

    return ListView.separated(
      itemCount: players.length,
      scrollDirection: axis,
      padding: axis == Axis.horizontal ? 16.horizontal : null,
      separatorBuilder: (context, index) => const SizedBox.square(dimension: 8),
      itemBuilder: (context, index) {
        final player = players[index];
        final answeredPlayer = answeredPlayers?.firstWhereOrNull(
          (e) => e.player == player.meta.id,
        );

        final result = answeredPlayer?.result;
        final passQuestion = skippedPlayers?.contains(player.meta.id) ?? false;
        final showUserAnsweredCorrect = _getPlayerAnswerState(
          result,
          passQuestion,
        );

        return GameLobbyPlayer(
          player: player,
          answering: answeringPlayer == player.meta.id,
          picking: currentTurnPlayerId == player.meta.id,
          playerAnswerState: showUserAnsweredCorrect,
        );
      },
    );
  }

  PlayerAnswerState _getPlayerAnswerState(int? result, bool passQuestion) {
    if (passQuestion) return PlayerAnswerState.skip;
    if (result == null) return PlayerAnswerState.none;
    if (result > 0) return PlayerAnswerState.correct;
    if (result == 0) return PlayerAnswerState.skip;
    return PlayerAnswerState.wrong;
  }
}
