import 'package:flutter/material.dart';
import 'package:openquester/common_imports.dart';

class GameQuestion extends WatchingWidget {
  const GameQuestion({required this.question, super.key});
  final SocketIOGameStateQuestionData question;

  @override
  Widget build(BuildContext context) {
    final borderRadius = 12.circular;
    final wideMode = GameLobbyStyles.playersOnLeft(context);

    return FilledButton(
      onPressed: question.isPlayed
          ? null
          : () => getIt<GameLobbyController>().onQuestionPick(question.id),
      style: ButtonStyle(
        shape: WidgetStateProperty.fromMap({
          WidgetState.disabled: RoundedRectangleBorder(
            borderRadius: borderRadius,
            side: BorderSide(
              color: context.theme.colorScheme.onSurfaceVariant,
              width: .15,
            ),
          ),
          WidgetState.any: RoundedRectangleBorder(borderRadius: borderRadius),
        }),
        backgroundColor: WidgetStateProperty.fromMap({
          WidgetState.disabled: Colors.transparent,
          WidgetState.any: context.theme.colorScheme.surfaceContainerHighest,
        }),
        foregroundColor: WidgetStateProperty.fromMap({
          WidgetState.disabled: context.theme.colorScheme.onSurfaceVariant,
          WidgetState.any: context.theme.colorScheme.onSurface,
        }),
        textStyle: WidgetStateProperty.fromMap({
          WidgetState.disabled: context.textTheme.labelLarge,
          WidgetState.any: context.textTheme.titleLarge,
        }),
        minimumSize: WidgetStatePropertyAll(
          GameLobbyStyles.questionSize(context),
        ),
        padding: WidgetStatePropertyAll(8.horizontal),
        backgroundBuilder: (context, states, child) {
          if (child != null && states.contains(WidgetState.disabled)) {
            return DiagonalLineBackground(child: child);
          }
          return child ?? const SizedBox();
        },
      ),
      child: question.price == null
          ? const Text('-')
          : ScoreText(
              score: question.price,
              longLimit: wideMode ? 1_000_000 : 999,
            ),
    );
  }
}
