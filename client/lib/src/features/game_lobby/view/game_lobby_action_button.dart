import 'package:flutter/material.dart';
import 'package:openquester/common_imports.dart';

class LobbyActionButton extends WatchingWidget {
  const LobbyActionButton({super.key});

  @override
  Widget build(BuildContext context) {
    final gameData = watchValue((GameLobbyController e) => e.gameData);
    final gameStarted = gameData?.gameStarted ?? false;

    if (gameData == null || gameStarted) return const SizedBox();

    final readyPlayers = gameData.gameState.readyPlayers;
    final imReady = readyPlayers?.contains(gameData.me.meta.id) ?? false;
    final imShowman = gameData.me.role == PlayerRole.showman;
    final imSpectator = gameData.me.role == PlayerRole.spectator;
    final playerIds = gameData.players
        .where((player) => player.role == PlayerRole.player)
        .map((player) => player.meta.id)
        .toList();
    final readyPlayerCount =
        readyPlayers?.where(playerIds.contains).length ?? 0;

    if (imSpectator) return const SizedBox.shrink();

    return Padding(
      padding: 16.all,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          FilledButton.icon(
            onPressed: () {
              final controller = getIt<GameLobbyController>();
              if (imShowman) {
                controller.startGame();
              } else {
                controller.playerReady(ready: !imReady);
              }
            },
            style: const ButtonStyle(
              minimumSize: WidgetStatePropertyAll(Size(240, 54)),
              padding: WidgetStatePropertyAll(
                EdgeInsets.symmetric(horizontal: 24, vertical: 14),
              ),
            ),
            icon: Icon(
              imShowman
                  ? Icons.play_arrow_rounded
                  : imReady
                  ? Icons.remove_circle_outline
                  : Icons.check_circle_outline,
            ),
            label: Text(
              imShowman
                  ? startGameButtonLocaleKey(
                      playerCount: playerIds.length,
                      readyPlayerCount: readyPlayerCount,
                    ).tr()
                  : imReady
                  ? LocaleKeys.game_lobby_editor_not_ready.tr()
                  : LocaleKeys.game_lobby_editor_ready.tr(),
            ),
          ),
        ],
      ),
    );
  }
}

@visibleForTesting
String startGameButtonLocaleKey({
  required int playerCount,
  required int readyPlayerCount,
}) {
  final hasNotReadyPlayers = playerCount > 0 && readyPlayerCount < playerCount;

  return hasNotReadyPlayers
      ? LocaleKeys.start_game_forcefully
      : LocaleKeys.start_game;
}
