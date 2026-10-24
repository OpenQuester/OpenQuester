import 'package:openquester/common_imports.dart';

/// Elapsed time on a server timer at [now] (frozen while paused)
int timerElapsedMs(
  GameStateTimer? timer, {
  required bool paused,
  DateTime? now,
}) {
  if (timer == null) return 0;
  final since = timer.resumedAt ?? timer.startedAt;
  final running = paused
      ? 0
      : (now ?? DateTime.now()).difference(since).inMilliseconds;
  return timer.elapsedMs + (running < 0 ? 0 : running);
}

extension GameStateBuzzerX on GameState {
  /// When the buzzer opens on the current question timer, or null when it is
  /// already open (or opens right away). Pressing earlier is a false start.
  DateTime? buzzerOpensAt({DateTime? now}) {
    final opensAtMs = buzzerOpensAtMs;
    if (opensAtMs == null || opensAtMs <= 0 || timer == null) return null;
    if (answeringPlayer != null || currentQuestion == null) return null;
    final elapsed = timerElapsedMs(timer, paused: isPaused, now: now);
    final left = opensAtMs.toInt() - elapsed;
    if (left <= 0) return null;
    return (now ?? DateTime.now()).add(Duration(milliseconds: left));
  }

  /// When the options of a choice question appear on the question timer, or
  /// null when they already show. They follow the question timeline, not
  /// the false-start policy: the content plays, then they wait
  /// [showDelayMs]. A buzzer opening point already includes that wait (or
  /// comes earlier when the showman opens it), so it is used when set.
  DateTime? choiceOptionsShowAt({required int showDelayMs, DateTime? now}) {
    if (answeringPlayer != null || currentQuestion == null || timer == null) {
      return null;
    }
    final opensAtMs = buzzerOpensAtMs?.toInt() ?? 0;
    final showAtMs = opensAtMs > 0
        ? opensAtMs
        : (questionContentPlan?.totalMs ?? 0) + showDelayMs;
    final elapsed = timerElapsedMs(timer, paused: isPaused, now: now);
    final left = showAtMs - elapsed;
    if (left <= 0) return null;
    return (now ?? DateTime.now()).add(Duration(milliseconds: left));
  }
}
