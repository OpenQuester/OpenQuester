import 'package:auto_route/auto_route.dart';
import 'package:flutter/material.dart';
import 'package:openapi/openapi.dart';
import 'package:oq_editor/controllers/oq_editor_controller.dart';
import 'package:oq_editor/router/router.gr.dart';
import 'package:oq_editor/utils/question_templates.dart';
import 'package:oq_editor/view/dialogs/question_editor_dialog.dart';
import 'package:oq_editor/view/widgets/editor_badges.dart';
import 'package:oq_editor/view/widgets/editor_breadcrumb.dart';
import 'package:oq_editor/view/widgets/editor_item_card.dart';
import 'package:oq_editor/view/widgets/package_search_delegate.dart';
import 'package:watch_it/watch_it.dart';

/// Redesigned questions list screen with improved UX
@RoutePage()
class QuestionsListScreenNew extends StatefulWidget {
  const QuestionsListScreenNew({
    @pathParam required this.roundIndex,
    @pathParam required this.themeIndex,
    super.key,
  });

  final int roundIndex;
  final int themeIndex;

  @override
  State<QuestionsListScreenNew> createState() => _QuestionsListScreenNewState();
}

class _QuestionsListScreenNewState extends State<QuestionsListScreenNew>
    with WatchItStatefulWidgetMixin {
  bool _isCompactView = true;

  @override
  Widget build(BuildContext context) {
    final controller = GetIt.I<OqEditorController>();
    final package = watchValue((OqEditorController c) => c.package);
    final translations = controller.translations;

    if (widget.roundIndex >= package.rounds.length) {
      return Scaffold(
        body: Center(
          child: Text(translations.invalidQuestionContext),
        ),
      );
    }

    final round = package.rounds[widget.roundIndex];
    if (widget.themeIndex >= round.themes.length) {
      return Scaffold(
        body: Center(
          child: Text(translations.invalidTheme),
        ),
      );
    }

    final theme = round.themes[widget.themeIndex];
    final questions = theme.questions;

    // Track view mode (compact/detailed) - now using state

    return Scaffold(
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Breadcrumb navigation
          EditorBreadcrumb(
            translations: translations,
            package: package,
            roundIndex: widget.roundIndex,
            themeIndex: widget.themeIndex,
            onNavigateToPackage: () {
              context.router.popUntil(
                (route) => route.settings.name == PackageInfoRoute.name,
              );
            },
            onNavigateToRound: () {
              context.router.popUntil(
                (route) =>
                    route.settings.name == RoundEditorRoute.name ||
                    route.settings.name == ThemesGridRoute.name,
              );
            },
            onNavigateToTheme: () {
              context.router.pop();
            },
          ),

          // Header with actions
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        translations.questions,
                        style: Theme.of(context).textTheme.headlineSmall
                            ?.copyWith(fontWeight: FontWeight.w600),
                      ),
                      const SizedBox(height: 4),
                      CompletionBadge(
                        filled: questions.length,
                        total: questions.length,
                        label: translations.questions,
                      ),
                    ],
                  ),
                ),
                // View mode toggle
                IconButton(
                  icon: Icon(
                    _isCompactView ? Icons.view_list : Icons.view_compact,
                  ),
                  onPressed: () {
                    setState(() {
                      _isCompactView = !_isCompactView;
                    });
                  },
                  tooltip: _isCompactView
                      ? translations.detailedView
                      : translations.compactView,
                ),
                // Search button
                IconButton(
                  icon: const Icon(Icons.search),
                  onPressed: () => _showSearch(context, controller),
                  tooltip: translations.searchPlaceholder,
                ),
                // Add question menu
                PopupMenuButton<VoidCallback>(
                  icon: const Icon(Icons.add),
                  tooltip: translations.addQuestion,
                  onSelected: (callback) => callback(),
                  itemBuilder: (context) => [
                    PopupMenuItem(
                      value: () => _addNewQuestion(
                        context,
                        controller,
                        widget.roundIndex,
                        widget.themeIndex,
                      ),
                      child: ListTile(
                        leading: const Icon(Icons.add),
                        title: Text(translations.addQuestion),
                        contentPadding: EdgeInsets.zero,
                      ),
                    ),
                    PopupMenuItem(
                      value: () => _addQuestionFromTemplate(
                        context,
                        controller,
                        widget.roundIndex,
                        widget.themeIndex,
                        QuestionTemplate.openingQuestion,
                      ),
                      child: ListTile(
                        leading: const Icon(Icons.auto_awesome),
                        title: Text(translations.addFromTemplate),
                        contentPadding: EdgeInsets.zero,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),

          // Questions list or empty state
          Expanded(
            child: questions.isEmpty
                ? _EmptyState(translations: translations)
                : _isCompactView
                    ? _CompactQuestionsList(
                        questions: questions,
                        roundIndex: widget.roundIndex,
                        themeIndex: widget.themeIndex,
                        controller: controller,
                        translations: translations,
                      )
                    : _DetailedQuestionsList(
                        questions: questions,
                        roundIndex: widget.roundIndex,
                        themeIndex: widget.themeIndex,
                        controller: controller,
                        translations: translations,
                      ),
          ),
        ],
      ),
    );
  }

  void _showSearch(BuildContext context, OqEditorController controller) {
    showSearch<PackageSearchResult?>(
      context: context,
      delegate: PackageSearchDelegate(
        package: controller.package.value,
        translations: controller.translations,
        onNavigate: (roundIdx, themeIdx, questionIdx) {
          // Navigate to the selected item
          if (questionIdx != null && themeIdx != null) {
            context.router.push(
              QuestionsListRoute(
                roundIndex: roundIdx,
                themeIndex: themeIdx,
              ),
            );
          } else if (themeIdx != null) {
            context.router.push(
              ThemesGridRoute(roundIndex: roundIdx),
            );
          } else {
            context.router.push(
              RoundEditorRoute(roundIndex: roundIdx),
            );
          }
        },
      ),
    );
  }

  Future<void> _addNewQuestion(
    BuildContext context,
    OqEditorController controller,
    int roundIndex,
    int themeIndex,
  ) async {
    final result = await context
        .pushRoute(
          QuestionEditorRoute(
            roundIndex: roundIndex,
            themeIndex: themeIndex,
            questionIndex: null,
          ),
        )
        .then((value) => value as QuestionEditResult?);

    if (result != null) {
      controller.addQuestion(roundIndex, themeIndex, result.question);
    }
  }

  Future<void> _addQuestionFromTemplate(
    BuildContext context,
    OqEditorController controller,
    int roundIndex,
    int themeIndex,
    QuestionTemplate template,
  ) async {
    PackageQuestionUnion? prefilledQuestion;

    switch (template) {
      case QuestionTemplate.none:
        break;
      case QuestionTemplate.openingQuestion:
        prefilledQuestion = await QuestionTemplates.applyFileImportTemplate(
          context: context,
          controller: controller,
          translations: controller.translations,
        );
    }

    if (prefilledQuestion == null) return;
    if (!context.mounted) return;

    final result = await context
        .pushRoute(
          QuestionEditorRoute(
            roundIndex: roundIndex,
            themeIndex: themeIndex,
            questionIndex: null,
            initialQuestion: prefilledQuestion,
          ),
        )
        .then((value) => value as QuestionEditResult?);

    if (result != null) {
      controller.addQuestion(roundIndex, themeIndex, result.question);
    }
  }
}

/// Empty state widget
class _EmptyState extends StatelessWidget {
  const _EmptyState({required this.translations});

  final OqEditorTranslations translations;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            Icons.quiz_outlined,
            size: 64,
            color: Theme.of(context).colorScheme.outline,
          ),
          const SizedBox(height: 16),
          Text(
            translations.noQuestions,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
              color: Theme.of(context).colorScheme.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            translations.addFirstQuestion,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: Theme.of(context).colorScheme.onSurfaceVariant,
            ),
          ),
        ],
      ),
    );
  }
}

/// Compact questions list with dense information display
class _CompactQuestionsList extends StatelessWidget {
  const _CompactQuestionsList({
    required this.questions,
    required this.roundIndex,
    required this.themeIndex,
    required this.controller,
    required this.translations,
  });

  final List<PackageQuestionUnion> questions;
  final int roundIndex;
  final int themeIndex;
  final OqEditorController controller;
  final OqEditorTranslations translations;

  @override
  Widget build(BuildContext context) {
    return ReorderableListView.builder(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      itemCount: questions.length,
      onReorder: (oldIndex, newIndex) {
        controller.reorderQuestions(
          roundIndex,
          themeIndex,
          oldIndex,
          newIndex > oldIndex ? newIndex - 1 : newIndex,
        );
      },
      itemBuilder: (context, index) {
        final question = questions[index];
        return _CompactQuestionCard(
          key: ValueKey(question.id ?? index),
          question: question,
          questionIndex: index,
          roundIndex: roundIndex,
          themeIndex: themeIndex,
          controller: controller,
          translations: translations,
        );
      },
    );
  }
}

/// Compact question card with all essential information
class _CompactQuestionCard extends StatelessWidget {
  const _CompactQuestionCard({
    required this.question,
    required this.questionIndex,
    required this.roundIndex,
    required this.themeIndex,
    required this.controller,
    required this.translations,
    super.key,
  });

  final PackageQuestionUnion question;
  final int questionIndex;
  final int roundIndex;
  final int themeIndex;
  final OqEditorController controller;
  final OqEditorTranslations translations;

  @override
  Widget build(BuildContext context) {
    final questionText = question.map(
      simple: (q) => q.text ?? translations.untitledQuestion,
      stake: (q) => q.text ?? translations.untitledQuestion,
      secret: (q) => q.text ?? translations.untitledQuestion,
      noRisk: (q) => q.text ?? translations.untitledQuestion,
      hidden: (q) => q.text ?? translations.untitledQuestion,
      choice: (q) => q.text ?? translations.untitledQuestion,
    );

    final answerText = question.map(
      simple: (q) => q.answer?.answer ?? '',
      stake: (q) => q.answer?.answer ?? '',
      secret: (q) => q.answer?.answer ?? '',
      noRisk: (q) => q.answer?.answer ?? '',
      hidden: (q) => q.answer?.answer ?? '',
      choice: (q) => q.answer?.answer ?? '',
    );

    final questionPrice = question.map(
      simple: (q) => q.price,
      stake: (q) => q.price,
      secret: (q) => q.price,
      noRisk: (q) => q.price,
      hidden: (q) => q.price,
      choice: (q) => q.price,
    );

    // Check for media files
    final hasQuestionMedia = question.map(
      simple: (q) => (q.questionMedia?.isNotEmpty ?? false),
      stake: (q) => (q.questionMedia?.isNotEmpty ?? false),
      secret: (q) => (q.questionMedia?.isNotEmpty ?? false),
      noRisk: (q) => (q.questionMedia?.isNotEmpty ?? false),
      hidden: (q) => (q.questionMedia?.isNotEmpty ?? false),
      choice: (q) => (q.questionMedia?.isNotEmpty ?? false),
    );

    final hasAnswerMedia = question.map(
      simple: (q) => (q.answerMedia?.isNotEmpty ?? false),
      stake: (q) => (q.answerMedia?.isNotEmpty ?? false),
      secret: (q) => (q.answerMedia?.isNotEmpty ?? false),
      noRisk: (q) => (q.answerMedia?.isNotEmpty ?? false),
      hidden: (q) => (q.answerMedia?.isNotEmpty ?? false),
      choice: (q) => (q.answerMedia?.isNotEmpty ?? false),
    );

    final hasMedia = hasQuestionMedia || hasAnswerMedia;

    return EditorItemCard(
      index: questionIndex,
      title: questionText,
      subtitle: answerText.isNotEmpty
          ? '${translations.answer}: ${answerText.length > 50 ? '${answerText.substring(0, 50)}...' : answerText}'
          : null,
      depthLevel: 2,
      trailing: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Media indicator
          if (hasMedia)
            const Padding(
              padding: EdgeInsets.only(right: 4),
              child: MediaIndicatorBadge(
                hasImage: true,
                hasVideo: false,
                hasAudio: false,
                compact: true,
              ),
            ),
          // Question type badge
          QuestionTypeBadge(
            question: question,
            translations: translations,
            compact: true,
          ),
          const SizedBox(width: 4),
          // Price badge
          if (questionPrice != null) PriceBadge(price: questionPrice),
          const SizedBox(width: 8),
          // Actions
          IconButton(
            icon: const Icon(Icons.edit_outlined, size: 20),
            onPressed: () => _showEditQuestionDialog(context),
            tooltip: translations.editButton,
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(),
          ),
          const SizedBox(width: 4),
          IconButton(
            icon: const Icon(Icons.delete_outline, size: 20),
            onPressed: () => _confirmDeleteQuestion(context),
            tooltip: translations.deleteButton,
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(),
          ),
        ],
      ),
    );
  }

  Future<void> _showEditQuestionDialog(BuildContext context) async {
    final result = await context
        .pushRoute(
          QuestionEditorRoute(
            roundIndex: roundIndex,
            themeIndex: themeIndex,
            questionIndex: questionIndex,
            initialQuestion: question,
          ),
        )
        .then((value) => value as QuestionEditResult?);

    if (result != null) {
      controller.updateQuestion(
        roundIndex,
        themeIndex,
        questionIndex,
        result.question,
      );
    }
  }

  Future<void> _confirmDeleteQuestion(BuildContext context) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(translations.deleteConfirmTitle),
        content: Text(
          translations.deleteConfirmMessage(translations.thisQuestion),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text(translations.cancelButton),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            style: FilledButton.styleFrom(
              backgroundColor: Theme.of(context).colorScheme.error,
            ),
            child: Text(translations.deleteButton),
          ),
        ],
      ),
    );

    if (confirmed ?? false) {
      controller.deleteQuestion(roundIndex, themeIndex, questionIndex);
    }
  }
}

/// Detailed questions list with expanded information
class _DetailedQuestionsList extends StatelessWidget {
  const _DetailedQuestionsList({
    required this.questions,
    required this.roundIndex,
    required this.themeIndex,
    required this.controller,
    required this.translations,
  });

  final List<PackageQuestionUnion> questions;
  final int roundIndex;
  final int themeIndex;
  final OqEditorController controller;
  final OqEditorTranslations translations;

  @override
  Widget build(BuildContext context) {
    return ReorderableListView.builder(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      itemCount: questions.length,
      onReorder: (oldIndex, newIndex) {
        controller.reorderQuestions(
          roundIndex,
          themeIndex,
          oldIndex,
          newIndex > oldIndex ? newIndex - 1 : newIndex,
        );
      },
      itemBuilder: (context, index) {
        final question = questions[index];
        return _CompactQuestionCard(
          key: ValueKey(question.id ?? index),
          question: question,
          questionIndex: index,
          roundIndex: roundIndex,
          themeIndex: themeIndex,
          controller: controller,
          translations: translations,
        );
      },
    );
  }
}
