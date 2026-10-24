import 'package:flutter_test/flutter_test.dart';
import 'package:openquester/openquester.dart' hide test;

QuestionContentPlanItem _file(int order, int durationMs) =>
    QuestionContentPlanItem(
      kind: QuestionContentPlanItemKind.file,
      order: order,
      placement: ContentPlacement.screen,
      durationMs: durationMs,
    );

void main() {
  // Text for 2 s, then a picture for 5 s, then a video for 20 s
  final plan = QuestionContentPlan(
    steps: [
      const QuestionContentStep(
        startMs: 0,
        durationMs: 2000,
        items: [
          QuestionContentPlanItem(
            kind: QuestionContentPlanItemKind.text,
            order: 0,
            placement: ContentPlacement.screen,
            durationMs: 2000,
          ),
        ],
      ),
      QuestionContentStep(
        startMs: 2000,
        durationMs: 5000,
        items: [_file(1, 5000)],
      ),
      QuestionContentStep(
        startMs: 7000,
        durationMs: 20000,
        items: [_file(2, 20000)],
      ),
    ],
    totalMs: 27000,
  );

  test('walks the steps on the question timer', () {
    final start = ContentPlanPosition.at(plan, 0);
    expect(start.showsText, isTrue);
    expect(start.fileOrder, isNull);

    final picture = ContentPlanPosition.at(plan, 2500);
    expect(picture.index, 1);
    expect(picture.fileOrder, 1);
    expect(picture.showsText, isFalse);

    final end = ContentPlanPosition.at(plan, 30000);
    expect(end.fileOrder, 2);
    expect(end.done, isTrue);
  });

  test('says when the stage changes next', () {
    expect(ContentPlanPosition.nextChangeAt(plan, 0), 2000);
    expect(ContentPlanPosition.nextChangeAt(plan, 2000), 7000);
    expect(ContentPlanPosition.nextChangeAt(plan, 8000), isNull);
  });

  test('schedules a background ending between screen steps', () {
    final backgroundPlan = QuestionContentPlan(
      steps: [
        QuestionContentStep(
          startMs: 0,
          durationMs: 5000,
          items: [
            const QuestionContentPlanItem(
              kind: QuestionContentPlanItemKind.file,
              order: 0,
              placement: ContentPlacement.background,
              durationMs: 3000,
            ),
            _file(1, 5000),
          ],
        ),
        QuestionContentStep(
          startMs: 5000,
          durationMs: 5000,
          items: [_file(2, 5000)],
        ),
      ],
      totalMs: 10000,
    );
    expect(ContentPlanPosition.nextChangeAt(backgroundPlan, 0), 3000);
    expect(ContentPlanPosition.nextChangeAt(backgroundPlan, 3000), 5000);
    expect(ContentPlanPosition.at(backgroundPlan, 3000).fileOrder, 1);
  });

  test('the buzzer opens at its position on the question timer', () {
    final now = DateTime(2026, 1, 1, 12);
    final state = GameState(
      isPaused: false,
      currentQuestion: const PackageQuestion(
        type: QuestionType.simple,
        order: 0,
        price: 100,
        showAnswerDuration: null,
      ),
      timer: GameStateTimer(
        startedAt: now.subtract(const Duration(seconds: 3)),
        durationMs: 30000,
        elapsedMs: 0,
      ),
      buzzerOpensAtMs: 5000,
    );
    expect(state.buzzerOpensAt(now: now), now.add(const Duration(seconds: 2)));

    // Already past it, or someone is answering: nothing to wait for
    expect(
      state.copyWith(buzzerOpensAtMs: 2000).buzzerOpensAt(now: now),
      isNull,
    );
    expect(state.copyWith(answeringPlayer: 7).buzzerOpensAt(now: now), isNull);
  });
}
