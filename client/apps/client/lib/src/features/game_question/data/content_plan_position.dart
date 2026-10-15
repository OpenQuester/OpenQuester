import 'package:openquester/common_imports.dart';

/// Where the question's content timeline is at a moment, mirroring the
/// server's QuestionContentPlanLogic and the web client's contentPlan.ts.
class ContentPlanPosition {
  const ContentPlanPosition({
    required this.index,
    required this.screen,
    required this.screenStartMs,
    required this.done,
  });

  factory ContentPlanPosition.at(QuestionContentPlan plan, int elapsedMs) {
    final steps = plan.steps;
    var index = 0;
    for (var i = 0; i < steps.length; i++) {
      if (steps[i].startMs <= elapsedMs) index = i;
    }
    var screen = <QuestionContentPlanItem>[];
    var screenStartMs = 0;
    for (var i = index; i >= 0 && steps.isNotEmpty; i--) {
      final items = steps[i].items
          .where((item) => item.placement == ContentPlacement.screen)
          .toList();
      if (items.isNotEmpty) {
        screen = items;
        screenStartMs = steps[i].startMs;
        break;
      }
    }
    return ContentPlanPosition(
      index: index,
      screen: screen,
      screenStartMs: screenStartMs,
      done: elapsedMs >= plan.totalMs,
    );
  }

  /// Index of the current step
  final int index;

  /// Items on the stage: the current step's screen items, or the last step
  /// that had some
  final List<QuestionContentPlanItem> screen;

  /// Start of the step the screen items belong to
  final int screenStartMs;

  /// The whole timeline has played
  final bool done;

  /// When the stage next changes after [elapsedMs], or null when it doesn't
  static int? nextChangeAt(QuestionContentPlan plan, int elapsedMs) {
    int? next;
    for (final step in plan.steps) {
      if (step.startMs > elapsedMs && (next == null || step.startMs < next)) {
        next = step.startMs;
      }
    }
    return next;
  }

  /// The file shown on screen at this position, if any
  int? get fileOrder => screen
      .firstWhereOrNull((item) => item.kind == QuestionContentPlanItemKind.file)
      ?.order;

  /// Whether the question text has its own step that is on screen now
  bool get showsText =>
      screen.any((item) => item.kind == QuestionContentPlanItemKind.text);
}
