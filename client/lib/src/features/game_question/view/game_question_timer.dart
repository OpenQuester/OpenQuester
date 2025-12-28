import 'package:flutter/material.dart';
import 'package:openquester/openquester.dart';

class GameQuestionTimer extends WatchingWidget {
  const GameQuestionTimer({super.key});

  @override
  Widget build(BuildContext context) {
    final gameData = watchValue((GameLobbyController e) => e.gameData);
    final timer = gameData?.gameState.timer;

    if (timer == null) return const SizedBox.shrink();

    final diff = DateTime.now().difference(timer.startedAt);
    final elapsedMs = timer.elapsedMs + diff.inMilliseconds;
    final timeLeft = Duration(milliseconds: timer.durationMs - elapsedMs);
    final beginPoint = (1 / (timer.durationMs / elapsedMs)).clamp(0, 1);

    return ConstrainedBox(
      key: ValueKey(timer),
      constraints: const BoxConstraints(
        maxWidth: GameLobbyStyles.maxTimerWidth,
      ),
      child: TweenAnimationBuilder(
        tween: Tween(begin: beginPoint, end: 1),
        duration: timeLeft,
        builder: (BuildContext context, num value, Widget? child) {
          final secondsRemaining = Duration(
            seconds: (timer.durationMs * (1 - value) / 1000).ceil(),
          );
          return Row(
            spacing: 16,
            children: [
              Expanded(
                child: LinearProgressIndicator(
                  value: value.toDouble(),
                  borderRadius: 16.circular,
                  minHeight: 4,
                ),
              ),
              Text(
                secondsRemaining.f(withSeconds: true),
                style: context.textTheme.labelLarge,
              ),
            ],
          );
        },
      ),
    ).paddingBottom(14).paddingSymmetric(horizontal: 16);
  }
}
