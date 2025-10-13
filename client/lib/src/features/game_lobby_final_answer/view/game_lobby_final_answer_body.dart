import 'package:flutter/material.dart';
import 'package:openquester/openquester.dart';

class GameFinalAnswerBody extends WatchingWidget {
  const GameFinalAnswerBody({super.key});

  @override
  Widget build(BuildContext context) {
    final controller = watchIt<GameLobbyFinalAnswerController>();

    final body = Column(
      spacing: 16,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const GameQuestionTimer(),
        TextFormField(
          initialValue: controller.userAnswer,
          minLines: 4,
          maxLines: 6,
          decoration: InputDecoration(
            border: const OutlineInputBorder(),
            labelText: LocaleKeys.game_final_round_write_your_answer.tr(),
          ),
          onChanged: controller.onChange,
        ).center().expand(),
        FilledButton(
          onPressed: controller.userAnswer == null ? null : controller.confirm,
          child: Text(LocaleKeys.confirm.tr()),
        ).center(),
      ],
    );

    return SafeArea(child: body.paddingAll(16));
  }
}
