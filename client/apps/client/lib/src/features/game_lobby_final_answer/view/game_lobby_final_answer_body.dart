import 'package:flutter/material.dart';
import 'package:openquester/openquester.dart';

class GameFinalAnswerBody extends WatchingWidget {
  const GameFinalAnswerBody({super.key});

  @override
  Widget build(BuildContext context) {
    final controller = watchIt<GameLobbyFinalAnswerController>();
    final gameData = watchValue((GameLobbyController e) => e.gameData);
    final questionData = gameData?.gameState.finalRoundData?.questionData;

    final questionMediaOnLeft = GameLobbyStyles.questionMediaOnLeft(context);

    final answerInput = Column(
      spacing: 16,
      mainAxisSize: MainAxisSize.min,
      children: [
        TextFormField(
          initialValue: controller.userAnswer,
          decoration: InputDecoration(
            border: const OutlineInputBorder(),
            labelText: LocaleKeys.game_final_round_write_your_answer.tr(),
          ),
          onChanged: controller.onChange,
        ),
        FilledButton(
          onPressed: controller.userAnswer == null ? null : controller.confirm,
          child: Text(LocaleKeys.confirm.tr()),
        ).center(),
      ],
    );

    final layout = GameQuestionLayout(
      text: questionData?.question.text,
      file: questionData?.question.questionFiles?.firstOrNull,
      bottomContent: (gameData?.imShowman ?? false)
          ? null
          : questionMediaOnLeft
          ? answerInput
          : Flexible(child: answerInput.center()),
    );

    return SafeArea(child: layout.paddingAll(16));
  }
}
