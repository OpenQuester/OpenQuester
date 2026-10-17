import 'dart:async';
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

    final layout = GameQuestionLayout(
      text: questionText,
      file: file,
      bottomContent: const _QuestionBottom(),
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
              child: layout.paddingAll(16),
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
    final eligible = gameData?.gameState.questionEligiblePlayers;
    final notMyNoRiskQuestion =
        gameData?.gameState.currentQuestion?.type == QuestionType.noRisk &&
        !(eligible?.isEmpty ?? true) &&
        !eligible!.contains(me?.meta.id);
    final choiceShowDelayMs = watchValue(
      (GameLobbyController e) => e.choiceShowDelayMs,
    );
    final choiceAnswers = watchValue(
      (GameLobbyController e) => e.choiceAnswers,
    );

    Widget child = const SizedBox();

    if (showingQuestion) {
      if (!imShowman && answeringPlayer == null && notMyNoRiskQuestion) {
        final picker = gameData?.players.getById(eligible.first);
        child = Text(
          LocaleKeys.question_only_picker_answers.tr(
            args: [picker?.meta.username ?? ''],
          ),
          textAlign: TextAlign.center,
          style: context.textTheme.bodyLarge,
        ).center();
      } else if (!imShowman && answeringPlayer == null && !iAlreadyAnswered) {
        child = const _AnswerButtons();
      } else if (answeringPlayer != null || imShowman) {
        child = const _AnsweringWidget();
      }
    }

    final bottom = ConstrainedBox(
      constraints: const BoxConstraints(minHeight: 150),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [child.flexible()],
      ),
    );
    if (!showingQuestion || (choiceAnswers?.isEmpty ?? true)) return bottom;

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        GameChoiceOptions(
          answers: choiceAnswers!,
          showDelayMs: choiceShowDelayMs,
        ),
        bottom,
      ],
    );
  }
}

/// Answer options of a choice question. The player who pressed the buzzer
/// picks one; the game checks it.
class GameChoiceOptions extends StatefulWidget {
  const GameChoiceOptions({
    required this.answers,
    required this.showDelayMs,
    super.key,
  });

  final List<QuestionChoiceAnswers> answers;
  final int showDelayMs;

  @override
  State<GameChoiceOptions> createState() => _ChoiceOptionsState();
}

class _ChoiceOptionsState extends State<GameChoiceOptions> {
  Timer? _showTimer;
  int? _picked;

  @override
  void dispose() {
    _showTimer?.cancel();
    super.dispose();
  }

  @override
  void didUpdateWidget(covariant GameChoiceOptions oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!identical(oldWidget.answers, widget.answers)) _picked = null;
  }

  @override
  Widget build(BuildContext context) {
    final controller = getIt<GameLobbyController>();
    return ValueListenableBuilder(
      valueListenable: controller.gameData,
      builder: (context, gameData, _) {
        final state = gameData?.gameState;
        final me = gameData?.me;
        // The choice timeline remains active when false starts are off.
        final showAt = state?.choiceOptionsShowAt(
          showDelayMs: widget.showDelayMs,
        );
        _showTimer?.cancel();
        if (showAt != null) {
          if (!(state?.isPaused ?? true)) {
            _showTimer = Timer(
              showAt.difference(DateTime.now()),
              () => mounted ? setState(() {}) : null,
            );
          }
          return Text(
            LocaleKeys.choice_options_soon.tr(),
            style: context.textTheme.bodyLarge,
          ).paddingAll(16);
        }

        final answering =
            state?.answeringPlayer != null &&
            state?.answeringPlayer == me?.meta.id;
        final correct = me.isShowman
            ? state?.currentQuestion?.answerText?.trim().toLowerCase()
            : null;
        final extraColors = ExtraColors.of(context);

        return Semantics(
          label: LocaleKeys.choice_options.tr(),
          child: Wrap(
            spacing: 12,
            runSpacing: 12,
            alignment: WrapAlignment.center,
            children: [
              for (final (index, answer) in widget.answers.indexed)
                ConstrainedBox(
                  constraints: const BoxConstraints(
                    minWidth: 220,
                    maxWidth: 360,
                  ),
                  child: OutlinedButton(
                    onPressed: !answering || _picked != null
                        ? null
                        : () {
                            setState(() => _picked = index);
                            unawaited(
                              controller.answerQuestion(
                                answerText: answer.text ?? '',
                              ),
                            );
                          },
                    style: OutlinedButton.styleFrom(
                      padding: 16.all,
                      alignment: Alignment.centerLeft,
                      side: BorderSide(
                        width: _picked == index ? 2 : 1,
                        color: _picked == index
                            ? context.theme.colorScheme.primary
                            : correct != null &&
                                  answer.text?.trim().toLowerCase() == correct
                            ? extraColors.success
                            : context.theme.colorScheme.outline,
                      ),
                    ),
                    child: Row(
                      spacing: 12,
                      children: [
                        CircleAvatar(
                          radius: 14,
                          child: Text('${index + 1}'),
                        ),
                        Text(
                          answer.text ?? '',
                          style: context.textTheme.titleMedium,
                        ).flexible(),
                      ],
                    ),
                  ),
                ),
            ],
          ),
        ).paddingAll(16);
      },
    );
  }
}

class _AnswerButtons extends WatchingStatefulWidget {
  const _AnswerButtons();

  @override
  State<_AnswerButtons> createState() => _AnswerButtonsState();
}

class _AnswerButtonsState extends State<_AnswerButtons> {
  Timer? _tick;
  bool _wasClosed = false;

  @override
  void dispose() {
    _tick?.cancel();
    super.dispose();
  }

  /// Rebuilds when the buzzer opens or a false-start lock ends
  void _rebuildAt(DateTime? at) {
    _tick?.cancel();
    if (at == null) return;
    final wait = at.difference(DateTime.now());
    _tick = Timer(
      wait.isNegative ? Duration.zero : wait + const Duration(milliseconds: 20),
      () => mounted ? setState(() {}) : null,
    );
  }

  @override
  Widget build(BuildContext context) {
    final gameData = watchValue((GameLobbyController e) => e.gameData);
    final lockedUntil = watchValue(
      (GameLobbyController e) => e.buzzerLockedUntil,
    );
    final myId = gameData?.me.meta.id;
    final playerSkipped =
        gameData?.gameState.skippedPlayers?.contains(myId) ?? false;
    final borderRadius = 8.circular;
    final foregroundColor = context.theme.colorScheme.onSurfaceVariant;

    final now = DateTime.now();
    final opensAt = gameData?.gameState.buzzerOpensAt(now: now);
    final locked = lockedUntil != null && lockedUntil.isAfter(now);
    // While locked, count the seconds down
    _rebuildAt(
      locked ? [lockedUntil, now.add(const Duration(seconds: 1))].min : opensAt,
    );

    // The button just opened: everyone hears it
    if (opensAt != null) {
      _wasClosed = true;
    } else if (_wasClosed) {
      _wasClosed = false;
      getIt<GameSoundController>().play(GameSound.open);
    }

    final lines = [
      if (locked)
        LocaleKeys.buzzer_locked.tr(
          args: [
            (lockedUntil.difference(now).inMilliseconds / 1000)
                .ceil()
                .toString(),
          ],
        )
      else if (opensAt != null) ...[
        LocaleKeys.buzzer_wait.tr(),
        LocaleKeys.buzzer_early_hint.tr(),
      ] else
        LocaleKeys.question_press_to_answer.tr(),
      if (playerSkipped)
        LocaleKeys.question_hold_to_unskip.tr()
      else
        LocaleKeys.question_hold_to_skip.tr(),
    ];
    final open = opensAt == null && !locked;

    return InkWell(
      onTap: locked ? null : getIt<GameLobbyController>().onAnswer,
      onLongPress: () =>
          getIt<GameLobbyController>().passQuestion(pass: !playerSkipped),
      borderRadius: borderRadius,
      child: Builder(
        builder: (context) {
          final child = Container(
            decoration: BoxDecoration(
              border: playerSkipped
                  ? null
                  : Border.all(
                      color: open
                          ? foregroundColor
                          : foregroundColor.withValues(alpha: 0.4),
                    ),
              borderRadius: borderRadius,
            ),
            padding: 16.all,
            child: Text(
              lines.join('\n'),
              textAlign: TextAlign.center,
              style: context.textTheme.bodyLarge?.copyWith(
                color: open
                    ? foregroundColor
                    : foregroundColor.withValues(alpha: 0.6),
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
          if (answeringPlayerId != null &&
              answeringPlayerId == gameData?.me.meta.id &&
              _giveUpQuestionTypes.contains(question?.type))
            const _GiveUpButton(),
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
        foregroundColor: WidgetStatePropertyAll(contrastOnColor(background)),
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

/// Question types answered by one player, who may give up instead
const Set<QuestionType> _giveUpQuestionTypes = {
  QuestionType.noRisk,
  QuestionType.secret,
  QuestionType.stake,
};

class _GiveUpButton extends StatelessWidget {
  const _GiveUpButton();

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      spacing: 4,
      children: [
        OutlinedButton(
          onPressed: getIt<GameLobbyController>().giveUp,
          child: Text(LocaleKeys.question_give_up.tr()),
        ),
        Text(
          LocaleKeys.question_give_up_hint.tr(),
          style: context.textTheme.bodySmall,
          textAlign: TextAlign.center,
        ),
      ],
    );
  }
}
