import 'package:flutter/material.dart';
import 'package:openquester/common_imports.dart';

class LobbyActionButton extends WatchingWidget {
  const LobbyActionButton({super.key});

  @override
  Widget build(BuildContext context) {
    final gameData = watchValue((GameLobbyController e) => e.gameData);
    final gameStarted = gameData?.gameStarted ?? false;

    if (gameStarted) return const SizedBox();

    final playerCount = gameData?.players
        .where((p) => p.role == PlayerRole.player)
        .length;
    final readyPlayers = gameData?.gameState.readyPlayers;
    final imReady = readyPlayers?.contains(gameData?.me.meta.id) ?? false;
    final imShowman = gameData?.me.role == PlayerRole.showman;
    final imSpectator = gameData?.me.role == PlayerRole.spectator;

    return Column(
      mainAxisSize: MainAxisSize.min,
      spacing: 8,
      children: [
        if (!imShowman)
          Text(
            LocaleKeys.game_lobby_hint.tr(),
            style: context.textTheme.bodyMedium,
          ),
        if (!imSpectator)
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              FilledButton.tonal(
                onPressed: () {
                  final controller = getIt<GameLobbyController>();
                  if (imShowman) {
                    controller.startGame();
                  } else {
                    controller.playerReady(ready: !imReady);
                  }
                },
                child: Text(
                  imShowman
                      ? [
                          LocaleKeys.start_game.tr(),
                          ' ',
                          '(',
                          LocaleKeys.game_lobby_editor_ready.tr(),
                          ' ',
                          ':',
                          ' ${readyPlayers?.length ?? 0}/$playerCount',
                          ')',
                        ].join()
                      : imReady
                      ? LocaleKeys.game_lobby_editor_not_ready.tr()
                      : LocaleKeys.game_lobby_editor_ready.tr(),
                ),
              ),
            ],
          ).paddingAll(16),
      ],
    );
  }
}
