import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:openquester/openquester.dart';

class GameQuestionScreen extends WatchingWidget {
  const GameQuestionScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final fileData = watchValue((GameQuestionController e) => e.questionData);
    final file = fileData?.file;
    final questionText = fileData?.text;
    final questionMediaOnLeft = GameLobbyStyles.questionMediaOnLeft(context);

    final scrollController = createOnce(
      ScrollController.new,
      dispose: (c) => c.dispose(),
    );
    final questionTextWidget = _questionTextAndButtons(
      context: context,
      text: questionText,
      file: file,
      scrollController: scrollController,
    );

    final column = Column(
      spacing: 16,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const GameQuestionTimer(),
        Flex(
          spacing: 16,
          mainAxisAlignment: MainAxisAlignment.center,
          direction: questionMediaOnLeft ? Axis.horizontal : Axis.vertical,
          children: [
            if (!questionMediaOnLeft && questionTextWidget != null)
              questionTextWidget.flexible(flex: file != null ? 0 : 1),
            if (file != null) GameQuestionMediaWidget(file: file).expand(),
            if (questionMediaOnLeft && questionTextWidget != null)
              ConstrainedBox(
                constraints: BoxConstraints(
                  maxWidth: file == null ? double.infinity : 150,
                  maxHeight: file == null ? double.infinity : 300,
                ),
                child: questionTextWidget,
              ).expand(),
            if (questionMediaOnLeft)
              const _QuestionBottom().withWidth(250).flexible(),
          ],
        ).expand(),
        if (!questionMediaOnLeft) const _QuestionBottom(),
      ],
    );

    return SafeArea(
      // Mouse and keyboard shortcuts to press answer
      child: Shortcuts(
        shortcuts: shortcuts(),
        child: Actions(
          actions: actions(),
          child: Focus(
            autofocus: true,
            child: GestureDetector(
              onSecondaryTapDown: (_) =>
                  getIt<GameLobbyController>().onAnswer(),
              supportedDevices: const {PointerDeviceKind.mouse},
              child: column.paddingAll(16),
            ),
          ),
        ),
      ),
    );
  }

  Map<ShortcutActivator, Intent> shortcuts() {
    return {
      LogicalKeySet(LogicalKeyboardKey.space): const AnswerIntent(),
      LogicalKeySet(LogicalKeyboardKey.control): const AnswerIntent(),
    };
  }

  Map<Type, Action<Intent>> actions() {
    return {
      AnswerIntent: CallbackAction(
        onInvoke: (_) => getIt<GameLobbyController>().onAnswer(),
      ),
    };
  }

  Widget? _questionTextAndButtons({
    required BuildContext context,
    required ScrollController scrollController,
    required String? text,
    required PackageQuestionFile? file,
  }) {
    if (text.isEmptyOrNull) return null;

    return ConstrainedBox(
      constraints: const BoxConstraints(minHeight: 50, minWidth: 250),
      child: Scrollbar(
        trackVisibility: true,
        thumbVisibility: true,
        controller: scrollController,
        child: Row(
          children: [
            ListView(
              shrinkWrap: true,
              controller: scrollController,
              children: [
                Text(
                  text ?? '',
                  style: file != null
                      ? context.textTheme.bodyLarge
                      : context.textTheme.headlineLarge,
                  textAlign: TextAlign.center,
                ),
              ],
            ).expand(),
          ],
        ),
      ),
    );
  }
}

class _QuestionBottom extends WatchingWidget {
  const _QuestionBottom();

  @override
  Widget build(BuildContext context) {
    final gameData = watchValue((GameLobbyController e) => e.gameData);
    final me = gameData?.me;
    final imShowman = me.isShowman;
    final answeringPlayer = gameData?.gameState.answeringPlayer;
    final iAlreadyAnswered =
        gameData?.gameState.answeredPlayers?.any(
          (e) => e.player == me?.meta.id,
        ) ??
        false;
    final showingQuestion = gameData?.gameState.currentQuestion != null;

    Widget child = const SizedBox();

    if (showingQuestion) {
      if (!imShowman && answeringPlayer == null && !iAlreadyAnswered) {
        child = const _AnswerButtons();
      } else if (answeringPlayer != null || imShowman) {
        child = const _AnsweringWidget();
      }
    }

    return ConstrainedBox(
      constraints: const BoxConstraints(minHeight: 150),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [child.flexible()],
      ),
    );
  }
}

class _AnswerButtons extends WatchingWidget {
  const _AnswerButtons();

  @override
  Widget build(BuildContext context) {
    final gameData = watchValue((GameLobbyController e) => e.gameData);
    final myId = gameData?.me.meta.id;
    final playerSkipped =
        gameData?.gameState.skippedPlayers?.contains(myId) ?? false;
    final borderRadius = 8.circular;
    final foregroundColor = context.theme.colorScheme.onSurfaceVariant;

    return InkWell(
      onTap: getIt<GameLobbyController>().onAnswer,
      onLongPress: () =>
          getIt<GameLobbyController>().passQuestion(pass: !playerSkipped),
      borderRadius: borderRadius,
      child: Builder(
        builder: (context) {
          final child = Container(
            decoration: BoxDecoration(
              border: playerSkipped ? null : Border.all(color: foregroundColor),
              borderRadius: borderRadius,
            ),
            padding: 16.all,
            child: Text(
              [
                LocaleKeys.question_press_to_answer.tr(),
                if (playerSkipped)
                  LocaleKeys.question_hold_to_unskip.tr()
                else
                  LocaleKeys.question_hold_to_skip.tr(),
              ].join('\n'),
              textAlign: TextAlign.center,
              style: context.textTheme.bodyLarge?.copyWith(
                color: foregroundColor,
              ),
            ).center(),
          );

          if (playerSkipped) {
            return DottedBorderWidget(
              color: context.theme.colorScheme.outline,
              radius: 8,
              child: child,
            );
          }

          return child;
        },
      ),
    ).paddingAll(24);
  }
}

class _AnsweringWidget extends WatchingWidget {
  const _AnsweringWidget();

  @override
  Widget build(BuildContext context) {
    final gameData = watchValue((GameLobbyController e) => e.gameData);
    final question = gameData?.gameState.currentQuestion;
    final answerText = question?.answerText;
    final answerHint = question?.answerHint;
    final answeringPlayerId = gameData?.gameState.answeringPlayer;
    final answeringPlayer = gameData?.players.getById(answeringPlayerId);
    final answeringPlayerNickname = answeringPlayer?.meta.username;
    final playerAnswering = answeringPlayer != null;
    final answer = [
      if (!answerText.isEmptyOrNull)
        LocaleKeys.question_correct_answer_is.tr(args: [answerText!]),
      if (!answerHint.isEmptyOrNull)
        LocaleKeys.question_hint.tr(args: [answerHint!]),
    ].join('\n');
    final showAnswer = !answer.isEmptyOrNull;

    return Container(
      decoration: BoxDecoration(
        borderRadius: 16.circular,
        color: context.theme.colorScheme.surfaceContainer,
      ),
      padding: 24.all,
      child: OverflowBar(
        spacing: 16,
        overflowSpacing: 16,
        alignment: MainAxisAlignment.center,
        overflowAlignment: OverflowBarAlignment.center,
        children: [
          ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 300),
            child: Column(
              spacing: 16,
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                if (!answeringPlayerNickname.isEmptyOrNull)
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        LocaleKeys.question_user_is_answering.tr(
                          args: [answeringPlayerNickname ?? ''],
                        ),
                        textAlign: TextAlign.center,
                        style: context.textTheme.bodyLarge?.copyWith(
                          fontWeight: showAnswer
                              ? FontWeight.w700
                              : FontWeight.w500,
                        ),
                      ).expand(),
                    ],
                  ),
                if (showAnswer)
                  playerAnswering
                      ? _answerText(context, answer)
                      : HiddenBuilder(
                          builder: ({required context, required hidden}) {
                            return _answerText(
                              context,
                              hidden ? '***' : answer,
                            );
                          },
                        ),
              ],
            ),
          ),
          if (gameData?.me.role == PlayerRole.showman) const _ShowmanControls(),
        ],
      ),
    );
  }

  Text _answerText(BuildContext context, String answer) {
    return Text(
      answer,
      textAlign: TextAlign.center,
      style: context.textTheme.bodySmall?.copyWith(
        color: context.theme.colorScheme.onSurfaceVariant,
      ),
    );
  }
}

class _ShowmanControls extends WatchingWidget {
  const _ShowmanControls();

  @override
  Widget build(BuildContext context) {
    final gameData = watchValue((GameLobbyController e) => e.gameData);
    final playerAnswering = gameData?.gameState.answeringPlayer != null;

    final extraColors = ExtraColors.of(context);

    ButtonStyle buttonStyle({required bool correctAnswer}) {
      final background = correctAnswer
          ? extraColors.success
          : context.theme.colorScheme.error;
      return ButtonStyle(
        backgroundColor: WidgetStatePropertyAll(background),
        foregroundColor: WidgetStatePropertyAll(
          Colors.black.withBrightness(-.4),
        ),
      );
    }

    List<Widget> multiplierBtns({required bool playerAnswerIsRight}) {
      return [0.5, 2.0].map((e) {
        return FilledButton(
          onPressed: () => getIt<GameLobbyController>().answerResult(
            playerAnswerIsRight: playerAnswerIsRight,
            multiplier: e,
          ),
          style: buttonStyle(correctAnswer: playerAnswerIsRight),
          child: Text('${e >= 1 ? e.toInt() : e}X'),
        );
      }).toList();
    }

    Widget buttons({required bool playerAnswerIsRight}) {
      return Wrap(
        spacing: 8,
        runSpacing: 8,
        children: [
          FilledButton.icon(
            onPressed: () => getIt<GameLobbyController>().answerResult(
              playerAnswerIsRight: playerAnswerIsRight,
            ),
            style: buttonStyle(correctAnswer: playerAnswerIsRight),
            icon: Icon(playerAnswerIsRight ? Icons.check : Icons.close),
            label: Text(
              playerAnswerIsRight
                  ? LocaleKeys.question_answer_is_correct.tr()
                  : LocaleKeys.question_answer_is_wrong.tr(),
            ),
          ),
          ...multiplierBtns(playerAnswerIsRight: playerAnswerIsRight),
        ],
      );
    }

    Widget zeroSkipButton() {
      return FilledButton.tonal(
        onPressed: () => getIt<GameLobbyController>().answerResult(
          playerAnswerIsRight: true,
          multiplier: 0,
        ),
        child: const Text('0X'),
      );
    }

    return OverflowBar(
      overflowAlignment: OverflowBarAlignment.center,
      alignment: MainAxisAlignment.center,
      spacing: 8,
      overflowSpacing: 8,
      children: [
        if (playerAnswering) ...[
          Column(
            spacing: 16,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              buttons(playerAnswerIsRight: true),
              buttons(playerAnswerIsRight: false),
            ],
          ),
          zeroSkipButton(),
        ] else
          const _SkipQuestionBtn(),
      ],
    );
  }
}

class AnswerIntent extends Intent {
  const AnswerIntent();
}

class _SkipQuestionBtn extends StatelessWidget {
  const _SkipQuestionBtn();

  @override
  Widget build(BuildContext context) {
    return FilledButton.tonal(
      onPressed: getIt<GameLobbyController>().skipQuestion,
      child: Text(LocaleKeys.skip_question.tr()),
    );
  }
}
