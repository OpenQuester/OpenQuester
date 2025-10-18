import 'package:flutter/material.dart';
import 'package:openapi/openapi.dart';
import 'package:oq_editor/controllers/oq_editor_controller.dart';
import 'package:oq_editor/view/dialogs/question_editor_dialog.dart';
import 'package:watch_it/watch_it.dart';

/// List of questions within a theme
class QuestionsListScreen extends WatchingWidget {
  const QuestionsListScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final controller = GetIt.I<OqEditorController>();
    final package = watchValue((OqEditorController c) => c.package);
    final navContext = watchValue(
      (OqEditorController c) => c.navigationContext,
    );
    final translations = controller.translations;

    final roundIndex = navContext.roundIndex;
    final themeIndex = navContext.themeIndex;

    if (roundIndex == null ||
        themeIndex == null ||
        roundIndex >= package.rounds.length) {
      return const Center(child: Text('Invalid question context'));
    }

    final round = package.rounds[roundIndex];
    if (themeIndex >= round.themes.length) {
      return const Center(child: Text('Invalid theme'));
    }

    final theme = round.themes[themeIndex];
    final questions = theme.questions;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Header
        Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              IconButton(
                icon: const Icon(Icons.arrow_back),
                onPressed: controller.navigateBack,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      translations.questions,
                      style: Theme.of(context).textTheme.headlineSmall
                          ?.copyWith(
                            fontWeight: FontWeight.w600,
                          ),
                    ),
                    Text(
                      theme.name,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: Theme.of(context).colorScheme.onSurfaceVariant,
                      ),
                    ),
                  ],
                ),
              ),
              FilledButton.icon(
                onPressed: () =>
                    _addNewQuestion(context, roundIndex, themeIndex),
                icon: const Icon(Icons.add),
                label: Text(translations.addQuestion),
              ),
            ],
          ),
        ),

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
                        translations.noQuestions,
                        style: Theme.of(context).textTheme.titleMedium
                            ?.copyWith(
                              color: Theme.of(
                                context,
                              ).colorScheme.onSurfaceVariant,
                            ),
                      ),
                    ],
                  ),
                )
              : ReorderableListView.builder(
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
                    return _QuestionCard(
                      key: ValueKey(question.id ?? index),
                      question: question,
                      questionIndex: index,
                      onEdit: () => _showEditQuestionDialog(
                        context,
                        roundIndex,
                        themeIndex,
                        index,
                        question,
                      ),
                      onDelete: () => _confirmDeleteQuestion(
                        context,
                        roundIndex,
                        themeIndex,
                        index,
                      ),
                    );
                  },
                ),
        ),
      ],
    );
  }

  Future<void> _addNewQuestion(
    BuildContext context,
    int roundIndex,
    int themeIndex,
  ) async {
    final controller = GetIt.I<OqEditorController>();

    final result = await QuestionEditorDialog.show(
      context: context,
      translations: controller.translations,
      roundIndex: roundIndex,
      themeIndex: themeIndex,
    );

    if (result != null) {
      controller.addQuestion(roundIndex, themeIndex, result.question);

      // Media files are stored during editing but not uploaded yet
      // Upload happens when the full package is saved/published
      // Files stored as references (file paths), not bytes (memory efficient)
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

    final result = await QuestionEditorDialog.show(
      context: context,
      translations: controller.translations,
      roundIndex: roundIndex,
      themeIndex: themeIndex,
      question: question,
      questionIndex: questionIndex,
    );

    if (result != null) {
      controller.updateQuestion(
        roundIndex,
        themeIndex,
        questionIndex,
        result.question,
      );

      // Media files are stored during editing but not uploaded yet
      // Upload happens when the full package is saved/published
      // Files stored as references (file paths), not bytes (memory efficient)
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
          controller.translations.deleteConfirmMessage('this question'),
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
    super.key,
  });

  final PackageQuestionUnion question;
  final int questionIndex;
  final VoidCallback onEdit;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    final questionText = question.map(
      simple: (q) => q.text ?? 'Untitled Question',
      stake: (q) => q.text ?? 'Untitled Question',
      secret: (q) => q.text ?? 'Untitled Question',
      noRisk: (q) => q.text ?? 'Untitled Question',
      hidden: (q) => q.text ?? 'Untitled Question',
      choice: (q) => q.text ?? 'Untitled Question',
    );

    final questionPrice = question.map(
      simple: (q) => q.price,
      stake: (q) => q.price,
      secret: (q) => q.price,
      noRisk: (q) => q.price,
      hidden: (q) => q.price,
      choice: (q) => q.price,
    );

    final questionType = question.map(
      simple: (_) => 'Simple',
      stake: (_) => 'Stake',
      secret: (_) => 'Secret',
      noRisk: (_) => 'No Risk',
      hidden: (_) => 'Hidden',
      choice: (_) => 'Choice',
    );

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: ListTile(
        leading: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.drag_handle,
              color: Theme.of(context).colorScheme.onSurfaceVariant,
            ),
            const SizedBox(width: 8),
            CircleAvatar(
              backgroundColor: Theme.of(context).colorScheme.primaryContainer,
              child: Text(
                '${questionIndex + 1}',
                style: TextStyle(
                  color: Theme.of(context).colorScheme.onPrimaryContainer,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ],
        ),
        title: Text(
          questionText,
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
        ),
        subtitle: Row(
          children: [
            Chip(
              label: Text(questionType),
              labelStyle: Theme.of(context).textTheme.bodySmall,
              padding: EdgeInsets.zero,
            ),
            const SizedBox(width: 8),
            if (questionPrice != null)
              Text(
                '$questionPrice pts',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: Theme.of(context).colorScheme.primary,
                  fontWeight: FontWeight.w600,
                ),
              ),
          ],
        ),
        trailing: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            IconButton(
              icon: const Icon(Icons.edit_outlined),
              onPressed: onEdit,
              tooltip: GetIt.I<OqEditorController>().translations.editButton,
            ),
            IconButton(
              icon: const Icon(Icons.delete_outline),
              onPressed: onDelete,
              tooltip: GetIt.I<OqEditorController>().translations.deleteButton,
            ),
          ],
        ),
      ),
    );
  }
}
