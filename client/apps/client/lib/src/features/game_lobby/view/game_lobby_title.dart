import 'package:flutter/material.dart';
import 'package:openquester/common_imports.dart';

class GameLobbyTitle extends WatchingWidget {
  const GameLobbyTitle({super.key});

  @override
  Widget build(BuildContext context) {
    final gameData = watchValue((GameLobbyController e) => e.gameData);
    final imShowman = gameData?.me.isShowman ?? false;

    return GameStateBuilder(
      builder: (state) {
        String title;
        switch (state) {
          case GameLobbyState.editorMode:
            title = '';
          case GameLobbyState.reviewingFinalAnswers:
            title = imShowman
                ? LocaleKeys.game_title_reviewing_answers.tr()
                : LocaleKeys.game_title_waiting_for_review.tr();
          case GameLobbyState.answeringFinal:
            title = imShowman
                ? LocaleKeys.game_title_waiting_for_players.tr()
                : LocaleKeys.game_title_answer_final_question.tr();
          case GameLobbyState.bidding:
          case GameLobbyState.biddingPhaseFromState:
            title = LocaleKeys.game_title_stake_question.tr();
          case GameLobbyState.pickingTheme:
            title = LocaleKeys.game_title_picking_theme.tr();
          case GameLobbyState.pickingPlayer:
            title = '';
          case GameLobbyState.loading:
            title = '';
          case GameLobbyState.finished:
            title = '';
          case GameLobbyState.questionActive:
            final question = gameData?.gameState.currentQuestion;
            if (question?.type == QuestionType.noRisk) {
              title = LocaleKeys.game_title_no_risk_question.tr();
            } else if (question?.type == QuestionType.stake) {
              title = LocaleKeys.game_title_stake_question.tr();
            } else {
              title = LocaleKeys.game_title_waiting_for_answer.tr();
            }
          case GameLobbyState.showingThemes:
            title = LocaleKeys.game_title_select_question.tr();
        }

        if (title.isEmpty) return const SizedBox.shrink();

        return FittedBox(
          fit: BoxFit.scaleDown,
          child: Text(title),
        ).fadeIn();
      },
    );
  }
}
