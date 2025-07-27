import 'package:flutter/material.dart';
import 'package:openquester/openquester.dart';

class GameQuestionTimer extends WatchingWidget {
  const GameQuestionTimer({super.key});

  @override
  Widget build(BuildContext context) {
    final gameData = watchValue((GameLobbyController e) => e.gameData);
    final timer = gameData?.gameState.timer;

    if (timer == null) return const SizedBox.shrink();

    final timeLeft = Duration(milliseconds: timer.durationMs - timer.elapsedMs);
    final beginPoint = (1 / (timer.durationMs / timer.elapsedMs)).clamp(0, 1);

    return ConstrainedBox(
      key: ValueKey(timer),
      constraints: const BoxConstraints(
        maxWidth: GameLobbyStyles.maxTimerWidth,
      ),
      child: TweenAnimationBuilder(
        tween: Tween(begin: beginPoint, end: 1),
        duration: timeLeft,
        builder: (BuildContext context, num value, Widget? child) {
          return LinearProgressIndicator(
            value: value.toDouble(),
            borderRadius: 16.circular,
            minHeight: 4,
          );
        },
      ),
    ).paddingBottom(14).paddingSymmetric(horizontal: 16);
  }
}
