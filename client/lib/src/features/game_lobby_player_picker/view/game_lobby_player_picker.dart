import 'package:flutter/material.dart';
import 'package:openquester/common_imports.dart';

class GameLobbyPlayerPicker extends WatchingWidget {
  const GameLobbyPlayerPicker({super.key});

  @override
  Widget build(BuildContext context) {
    final controller = watchIt<GameLobbyPlayerPickerController>();
    final gameData = watchValue((GameLobbyController e) => e.gameData);
    final players =
        gameData?.players.where(
          (e) {
            return e.role == PlayerRole.player &&
                    controller.type == QuestionTransferType.any ||
                e.meta.id != controller.selectingPlayerId;
          },
        ).toList() ??
        [];

    if (controller.selectingPlayerId != ProfileController.getUser()?.id) {
      final selectingPlayer = gameData?.players.getById(
        controller.selectingPlayerId,
      );
      return Column(
        mainAxisSize: MainAxisSize.min,
        spacing: 8,
        children: [
          if (selectingPlayer != null)
            GameLobbyPlayer(
              player: selectingPlayer,
              playerAnswerState: PlayerAnswerState.none,
              answering: false,
              picking: true,
            ),
          Text(LocaleKeys.game_lobby_secret_question_wait_for_player.tr()),
          const CircularProgressIndicator(),
        ],
      ).center();
    }

    return Column(
      spacing: 8,
      children: [
        Text(
          LocaleKeys.game_lobby_secret_question_choose_player.tr(),
          style: context.textTheme.headlineMedium,
        ).paddingBottom(16),
        ListView.builder(
          itemCount: players.length,
          itemBuilder: (context, index) {
            final player = players[index];
            final selected = player.meta.id == controller.selectedPlayerId;
            return InkWell(
              onTap: () => controller.pickPlayer(player.meta.id),
              borderRadius: GameLobbyStyles.playerTileRadius.circular,
              child: GameLobbyPlayer(
                player: player,
                playerAnswerState: selected
                    ? PlayerAnswerState.skip
                    : PlayerAnswerState.none,
                answering: false,
                picking: false,
              ),
            );
          },
        ).expand(),
        FilledButton(
          onPressed: controller.selectedPlayerId == null
              ? null
              : controller.confirmSelection,
          child: Text(LocaleKeys.confirm.tr()),
        ),
      ],
    ).paddingAll(16);
  }
}
