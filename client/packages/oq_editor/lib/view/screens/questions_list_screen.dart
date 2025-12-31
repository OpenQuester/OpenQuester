import 'package:auto_route/auto_route.dart';
import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';
import 'package:nb_utils/nb_utils.dart';
import 'package:openapi/openapi.dart';
import 'package:oq_editor/controllers/editor_navigation_controller.dart';
import 'package:oq_editor/controllers/oq_editor_controller.dart';
import 'package:oq_editor/models/editor_navigation_state.dart';
import 'package:oq_editor/router/router.gr.dart';
import 'package:oq_editor/utils/question_templates.dart';
import 'package:oq_editor/view/dialogs/question_editor_dialog.dart';
import 'package:oq_editor/view/widgets/editor_filters.dart';
import 'package:oq_editor/view/widgets/editor_item_card.dart';
import 'package:watch_it/watch_it.dart';

/// List of questions within a theme
@RoutePage()
class QuestionsListScreen extends WatchingWidget {
  const QuestionsListScreen({
    @pathParam required this.roundIndex,
    @pathParam required this.themeIndex,
    super.key,
  });
  final int roundIndex;
  final int themeIndex;

  @override
  Widget build(BuildContext context) {
    final controller = GetIt.I<OqEditorController>();
    final navController = GetIt.I.isRegistered<EditorNavigationController>()
        ? watchIt<EditorNavigationController>()
        : null;
    final package = watchValue((OqEditorController c) => c.package);

    final translations = controller.translations;

    if (roundIndex >= package.rounds.length) {
      return Center(child: Text(translations.invalidQuestionContext));
    }

    final round = package.rounds[roundIndex];
    if (themeIndex >= round.themes.length) {
      return Center(child: Text(translations.invalidTheme));
    }

    final theme = round.themes[themeIndex];
    var questions = theme.questions.toList();

    // Apply filters if nav controller is available
    if (navController != null) {
      questions = navController.filterQuestions(questions);
    }

    final isCompactMode =
        navController?.listViewMode == ListViewMode.compact;
    final selectionMode = navController?.selectionModeActive ?? false;

    return Scaffold(
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Header
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
                      Row(
                        children: [
                          Text(
                            theme.name,
                            style: Theme.of(context).textTheme.bodyMedium
                                ?.copyWith(
                                  color: Theme.of(context)
                                      .colorScheme
                                      .onSurfaceVariant,
                                ),
                          ),
                          const SizedBox(width: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 8,
                              vertical: 2,
                            ),
                            decoration: BoxDecoration(
                              color: Theme.of(context)
                                  .colorScheme
                                  .primaryContainer,
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Text(
                              '${questions.length} / ${theme.questions.length}',
                              style: Theme.of(context).textTheme.labelSmall
                                  ?.copyWith(
                                    color: Theme.of(context)
                                        .colorScheme
                                        .onPrimaryContainer,
                                  ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                // View mode toggle
                if (navController != null) ...[
                  const ListViewModeToggle(),
                  const SizedBox(width: 8),
                ],
                // Selection mode toggle
                if (navController != null)
                  IconButton(
                    icon: Icon(
                      selectionMode ? Icons.check_box : Icons.check_box_outline_blank,
                    ),
                    tooltip: selectionMode ? 'Exit selection' : 'Select items',
                    onPressed: () => navController.toggleSelectionMode(),
                  ),
                const SizedBox(width: 8),
                // Add buttons
                FilledButton.icon(
                  onPressed: () =>
                      _addNewQuestion(context, roundIndex, themeIndex),
                  icon: const Icon(Icons.add),
                  label: Text(translations.addQuestion),
                ),
                const SizedBox(width: 8),
                MenuAnchor(
                  crossAxisUnconstrained: false,
                  builder: (context, menuController, child) {
                    return IconButton.filled(
                      onPressed: () {
                        if (menuController.isOpen) {
                          menuController.close();
                        } else {
                          menuController.open();
                        }
                      },
                      icon: const Icon(Icons.auto_awesome),
                      tooltip: translations.addFromTemplate,
                    );
                  },
                  menuChildren: [
                    MenuItemButton(
                      leadingIcon: const Icon(Icons.file_upload_outlined),
                      onPressed: () => _addQuestionFromTemplate(
                        context,
                        roundIndex,
                        themeIndex,
                        QuestionTemplate.openingQuestion,
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            translations.templateOpeningQuestion,
                            style: Theme.of(context).textTheme.bodyMedium,
                          ),
                          Text(
                            translations.templateOpeningQuestionDesc,
                            style: Theme.of(context).textTheme.bodySmall
                                ?.copyWith(
                                  color: Theme.of(context)
                                      .colorScheme
                                      .onSurfaceVariant,
                                ),
                          ),
                        ],
                      ).paddingAll(16),
                    ),
                  ],
                ),
              ],
            ),
          ),

          // Filter chips
          if (navController != null) ...[
            const SizedBox(height: 48, child: QuestionFilterChips()),
            const SizedBox(height: 8),
          ],

          // Questions list or empty state
          Expanded(
            child: questions.isEmpty
                ? Center(
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
                          navController?.questionFilter != QuestionFilter.all
                              ? 'No matching questions'
                              : translations.noQuestions,
                          style: Theme.of(context).textTheme.titleMedium
                              ?.copyWith(
                                color: Theme.of(context)
                                    .colorScheme
                                    .onSurfaceVariant,
                              ),
                        ),
                        if (navController?.questionFilter != QuestionFilter.all)
                          TextButton(
                            onPressed: () => navController?.setQuestionFilter(
                              QuestionFilter.all,
                            ),
                            child: const Text('Clear filter'),
                          ),
                      ],
                    ),
                  )
                : ReorderableListView.builder(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    itemCount: questions.length,
                    onReorder: (oldIndex, newIndex) {
                      // Find actual indices in original list
                      final actualOld = theme.questions.indexOf(questions[oldIndex]);
                      final actualNew = oldIndex < newIndex
                          ? theme.questions.indexOf(questions[newIndex - 1]) + 1
                          : theme.questions.indexOf(questions[newIndex]);
                      controller.reorderQuestions(
                        roundIndex,
                        themeIndex,
                        actualOld,
                        actualNew > actualOld ? actualNew - 1 : actualNew,
                      );
                    },
                    itemBuilder: (context, index) {
                      final question = questions[index];
                      final actualIndex = theme.questions.indexOf(question);
                      return _QuestionCard(
                        key: ValueKey(question.id ?? actualIndex),
                        question: question,
                        questionIndex: actualIndex,
                        isCompact: isCompactMode,
                        showCheckbox: selectionMode,
                        isSelected: navController?.selection.selectedQuestions
                                .contains((roundIndex, themeIndex, actualIndex)) ??
                            false,
                        onCheckboxChanged: (value) {
                          navController?.toggleQuestionSelection(
                            roundIndex,
                            themeIndex,
                            actualIndex,
                          );
                        },
                        onEdit: () => _showEditQuestionDialog(
                          context,
                          roundIndex,
                          themeIndex,
                          actualIndex,
                          question,
                        ),
                        onDelete: () => _confirmDeleteQuestion(
                          context,
                          roundIndex,
                          themeIndex,
                          actualIndex,
                        ),
                      );
                    },
                  ),
          ),

          // Selection toolbar
          if (navController != null)
            SelectionToolbar(
              onDelete: () => _deleteSelectedQuestions(context),
            ),
        ],
      ),
    );
  }

  void _deleteSelectedQuestions(BuildContext context) {
    final controller = GetIt.I<OqEditorController>();
    final navController = GetIt.I<EditorNavigationController>();
    final selection = navController.selection;

    // Sort in reverse to avoid index shifting issues
    final questionsToDelete = selection.selectedQuestions
        .where((q) => q.$1 == roundIndex && q.$2 == themeIndex)
        .toList()
      ..sort((a, b) => b.$3.compareTo(a.$3));

    for (final (_, _, questionIndex) in questionsToDelete) {
      controller.deleteQuestion(roundIndex, themeIndex, questionIndex);
    }

    navController.clearSelection();
  }

  Future<void> _addNewQuestion(
    BuildContext context,
    int roundIndex,
    int themeIndex,
  ) async {
    final controller = GetIt.I<OqEditorController>();

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
      controller.addQuestion(
        roundIndex,
        themeIndex,
        result.question,
      );
    }
  }

  Future<void> _addQuestionFromTemplate(
    BuildContext context,
    int roundIndex,
    int themeIndex,
    QuestionTemplate template,
  ) async {
    final controller = GetIt.I<OqEditorController>();

    // Apply template to generate pre-filled question
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

    // Show dialog with pre-filled question
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
      controller.addQuestion(
        roundIndex,
        themeIndex,
        result.question,
      );
    }
  }

  Future<void> _showEditQuestionDialog(
    BuildContext context,
    int roundIndex,
    int themeIndex,
    int questionIndex,
    PackageQuestionUnion question,
  ) async {
    final controller = GetIt.I<OqEditorController>();
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

  Future<void> _confirmDeleteQuestion(
    BuildContext context,
    int roundIndex,
    int themeIndex,
    int questionIndex,
  ) async {
    final controller = GetIt.I<OqEditorController>();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(controller.translations.deleteConfirmTitle),
        content: Text(
          controller.translations.deleteConfirmMessage(
            controller.translations.thisQuestion,
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text(controller.translations.cancelButton),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            style: FilledButton.styleFrom(
              backgroundColor: Theme.of(context).colorScheme.error,
            ),
            child: Text(controller.translations.deleteButton),
          ),
        ],
      ),
    );

    if (confirmed ?? false) {
      controller.deleteQuestion(roundIndex, themeIndex, questionIndex);
    }
  }
}

class _QuestionCard extends StatelessWidget {
  const _QuestionCard({
    required this.question,
    required this.questionIndex,
    required this.onEdit,
    required this.onDelete,
    this.isCompact = false,
    this.showCheckbox = false,
    this.isSelected = false,
    this.onCheckboxChanged,
    super.key,
  });

  final PackageQuestionUnion question;
  final int questionIndex;
  final VoidCallback onEdit;
  final VoidCallback onDelete;
  final bool isCompact;
  final bool showCheckbox;
  final bool isSelected;
  final ValueChanged<bool?>? onCheckboxChanged;

  @override
  Widget build(BuildContext context) {
    final controller = GetIt.I<OqEditorController>();
    final translations = controller.translations;

    final questionText = question.map(
      simple: (q) => q.text ?? translations.untitledQuestion,
      stake: (q) => q.text ?? translations.untitledQuestion,
      secret: (q) => q.text ?? translations.untitledQuestion,
      noRisk: (q) => q.text ?? translations.untitledQuestion,
      hidden: (q) => q.text ?? translations.untitledQuestion,
      choice: (q) => q.text ?? translations.untitledQuestion,
    );

    final questionPrice = question.map(
      simple: (q) => q.price,
      stake: (q) => q.price,
      secret: (q) => q.price,
      noRisk: (q) => q.price,
      hidden: (q) => q.price,
      choice: (q) => q.price,
    );

    final answerText = question.map(
      simple: (q) => q.answerText,
      stake: (q) => q.answerText,
      secret: (q) => q.answerText,
      noRisk: (q) => q.answerText,
      hidden: (q) => q.answerText,
      choice: (_) => null,
    );

    final questionType = getQuestionType(question);
    final questionTypeName = question.map(
      simple: (_) => translations.questionTypeSimple,
      stake: (_) => translations.questionTypeStake,
      secret: (_) => translations.questionTypeSecret,
      noRisk: (_) => translations.questionTypeNoRisk,
      hidden: (_) => translations.questionTypeHidden,
      choice: (_) => translations.questionTypeChoice,
    );

    // Check for media files
    final hasMedia = _hasMedia();
    final isIncomplete = _isIncomplete();

    // Build badges
    final badges = <EditorBadge>[
      if (hasMedia)
        const EditorBadge(
          icon: Icons.perm_media_outlined,
          tooltip: 'Has media',
          color: Colors.blue,
        ),
      if (isIncomplete)
        EditorBadge(
          icon: Icons.warning_amber_outlined,
          tooltip: 'Incomplete',
          color: Colors.orange.shade700,
        ),
    ];

    return EditorItemCard(
      title: questionText,
      subtitle: isCompact
          ? '${questionPrice ?? 0} pts'
          : answerText?.isNotEmpty == true
              ? 'Answer: ${answerText!.substring(0, answerText.length > 50 ? 50 : answerText.length)}${answerText.length > 50 ? '...' : ''}'
              : null,
      onTap: onEdit,
      leadingWidget: Container(
        width: isCompact ? 28 : 40,
        height: isCompact ? 28 : 40,
        decoration: BoxDecoration(
          color: getQuestionTypeColor(questionType).withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(isCompact ? 6 : 8),
          border: Border.all(
            color: getQuestionTypeColor(questionType).withValues(alpha: 0.3),
          ),
        ),
        alignment: Alignment.center,
        child: Text(
          '${questionIndex + 1}',
          style: Theme.of(context).textTheme.labelMedium?.copyWith(
                fontWeight: FontWeight.w700,
                color: getQuestionTypeColor(questionType),
              ),
        ),
      ),
      typeChip: QuestionTypeChip(
        type: questionType,
        label: questionTypeName,
        isCompact: isCompact,
      ),
      accentColor: getQuestionTypeColor(questionType),
      badges: badges,
      isCompact: isCompact,
      showCheckbox: showCheckbox,
      isSelected: isSelected,
      onCheckboxChanged: onCheckboxChanged,
      onEdit: onEdit,
      onDelete: onDelete,
      showDragHandle: !showCheckbox,
      trailingWidget: !isCompact
          ? Text(
              '${questionPrice ?? 0} pts',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                    color: Theme.of(context).colorScheme.primary,
                  ),
            )
          : null,
    );
  }

  bool _hasMedia() {
    final questionFiles = question.map(
      simple: (s) => s.questionFiles,
      stake: (s) => s.questionFiles,
      secret: (s) => s.questionFiles,
      noRisk: (s) => s.questionFiles,
      choice: (s) => s.questionFiles,
      hidden: (s) => s.questionFiles,
    );
    final answerFiles = question.map(
      simple: (s) => s.answerFiles,
      stake: (s) => s.answerFiles,
      secret: (s) => s.answerFiles,
      noRisk: (s) => s.answerFiles,
      choice: (s) => s.answerFiles,
      hidden: (s) => s.answerFiles,
    );
    return (questionFiles?.isNotEmpty ?? false) ||
        (answerFiles?.isNotEmpty ?? false);
  }

  bool _isIncomplete() {
    final text = question.map(
      simple: (s) => s.text,
      stake: (s) => s.text,
      secret: (s) => s.text,
      noRisk: (s) => s.text,
      choice: (s) => s.text,
      hidden: (s) => s.text,
    );
    final answer = question.map(
      simple: (s) => s.answerText,
      stake: (s) => s.answerText,
      secret: (s) => s.answerText,
      noRisk: (s) => s.answerText,
      choice: (_) => 'has_choices',
      hidden: (s) => s.answerText,
    );
    return (text?.isEmpty ?? true) || (answer?.isEmpty ?? true);
  }
}
}
