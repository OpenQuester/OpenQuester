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
}
