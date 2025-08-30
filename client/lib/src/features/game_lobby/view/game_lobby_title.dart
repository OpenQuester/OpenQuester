import 'package:animate_do/animate_do.dart';
import 'package:flutter/material.dart';
import 'package:openquester/common_imports.dart';

class GameLobbyTitle extends WatchingWidget {
  const GameLobbyTitle({super.key});

  @override
  Widget build(BuildContext context) {
    final gameData = watchValue((GameLobbyController e) => e.gameData);
    final fileData = watchValue((GameQuestionController e) => e.questionData);
    final question = gameData?.gameState.currentQuestion;
    final questionPicked = question != null;
    final isPickingPlayer = watchPropertyValue(
      (GameLobbyPlayerPickerController e) => e.isPicking,
    );

    var title = '';

    if (questionPicked) {
      if (question.type == QuestionType.noRisk) {
        title = LocaleKeys.game_title_no_risk_question.tr();
      } else if (question.type == QuestionType.stake) {
        title = LocaleKeys.game_title_stake_question.tr();
      } else {
        title = LocaleKeys.game_title_waiting_for_answer.tr();
      }
    } else if (isPickingPlayer) {
      title = '';
    } else if (fileData == null) {
      title = LocaleKeys.game_title_select_question.tr();
    }

    if (title.isEmpty) return const SizedBox.shrink();

    return FittedBox(
      fit: BoxFit.scaleDown,
      child: Text(title),
    ).fadeIn();
  }
}
