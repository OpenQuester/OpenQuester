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
            return e.isPlayer &&
                (controller.type == QuestionTransferType.any ||
                    e.meta.id != controller.selectingPlayerId);
          },
        ).toList() ??
        [];

    final playerBoxConstraints = BoxConstraints.expand(
      width: 350,
      height: GameLobbyStyles.players.height,
    );
    final playerTextStyle = GameLobbyStyles.playerTextStyleDesktop(context);

    if (controller.selectingPlayerId != ProfileController.getUser()?.id &&
        gameData?.me.role != PlayerRole.showman) {
      final selectingPlayer = gameData?.players.getById(
        controller.selectingPlayerId,
      );
      return Column(
        mainAxisSize: MainAxisSize.min,
        spacing: 24,
        children: [
          if (selectingPlayer != null)
            GameLobbyPlayer(
              player: selectingPlayer,
              settings: const PlayerTileSettings.empty(),
              constraints: playerBoxConstraints,
              playerTextStyle: playerTextStyle,
            ),
          Text(
            LocaleKeys.game_secret_question_wait_for_player_to_select_next.tr(),
            textAlign: TextAlign.center,
            style: context.textTheme.headlineSmall,
          ),
          //TODO: Add animation for waiting icon
          const Icon(
            Icons.more_horiz,
            size: 42,
          ),
        ],
      ).paddingAll(16).center();
    }

    return Column(
      spacing: 8,
      children: [
        Text(
          [
            LocaleKeys.game_secret_question_choose_player.tr(),
            ':',
          ].join(),
          style: context.textTheme.headlineSmall,
          textAlign: TextAlign.center,
        ).paddingBottom(16),
        ListView.separated(
          itemCount: players.length,
          separatorBuilder: (_, _) => 8.height,
          itemBuilder: (context, index) {
            final player = players[index];
            final selected = player.meta.id == controller.selectedPlayerId;

            return InkWell(
              onTap: () => controller.pickPlayer(player.meta.id),
              borderRadius: GameLobbyStyles.playerTileRadius.circular,
              child: GameLobbyPlayer(
                player: player,
                constraints: playerBoxConstraints,
                settings: PlayerTileSettings.empty(
                  playerAnswerState: selected
                      ? PlayerAnswerState.correct
                      : PlayerAnswerState.none,
                ),
              ),
            ).center();
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
