import 'package:flutter_test/flutter_test.dart';
import 'package:openquester/openquester.dart' hide test;

void main() {
  final now = DateTime.utc(2026, 10, 17, 12);
  const question = PackageQuestion(
    type: QuestionType.choice,
    order: 0,
    price: 100,
    showAnswerDuration: null,
    text: 'Pick one',
  );
  const plan = QuestionContentPlan(totalMs: 4000, steps: []);

  GameState state({required int elapsedMs, int? buzzerOpensAtMs}) => GameState(
    isPaused: false,
    currentQuestion: question,
    questionContentPlan: plan,
    buzzerOpensAtMs: buzzerOpensAtMs,
    timer: GameStateTimer(
      startedAt: now,
      durationMs: 30000,
      elapsedMs: elapsedMs,
    ),
  );

  test('options wait for the content and show delay without false starts', () {
    // False starts off: the server sends no buzzer opening point
    expect(
      state(elapsedMs: 1000).choiceOptionsShowAt(showDelayMs: 2000, now: now),
      now.add(const Duration(milliseconds: 5000)),
    );
    expect(
      state(elapsedMs: 6000).choiceOptionsShowAt(showDelayMs: 2000, now: now),
      isNull,
    );
  });

  test('options show when the showman opens the buzzer early', () {
    expect(
      state(
        elapsedMs: 1000,
        buzzerOpensAtMs: 1000,
      ).choiceOptionsShowAt(showDelayMs: 2000, now: now),
      isNull,
    );
  });

  test('options follow the buzzer opening point when it is set', () {
    expect(
      state(
        elapsedMs: 1000,
        buzzerOpensAtMs: 7000,
      ).choiceOptionsShowAt(showDelayMs: 2000, now: now),
      now.add(const Duration(milliseconds: 6000)),
    );
  });
}
