import 'package:auto_route/auto_route.dart';
import 'package:flutter/material.dart';
import 'package:openapi/openapi.dart';
import 'package:oq_editor/controllers/oq_editor_controller.dart';
import 'package:oq_editor/models/oq_editor_translations.dart';
import 'package:oq_editor/router/router.gr.dart';
import 'package:oq_editor/utils/question_templates.dart';
import 'package:oq_editor/view/screens/question_editor_screen.dart';
import 'package:oq_editor/view/utils/editor_layout_metrics.dart';
import 'package:oq_shared/ui/max_size_container.dart';
import 'package:watch_it/watch_it.dart';

enum _QuestionCardAction { edit, duplicate, delete }

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
    final package = watchValue((OqEditorController c) => c.package);

    final translations = controller.translations;
    callOnce((_) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (context.mounted) controller.selectTheme(roundIndex, themeIndex);
      });
    });

    if (roundIndex >= package.rounds.length) {
      return Center(child: Text(translations.invalidQuestionContext));
    }

    final round = package.rounds[roundIndex];
    if (themeIndex >= round.themes.length) {
      return Center(child: Text(translations.invalidTheme));
    }

    final theme = round.themes[themeIndex];
    final questions = theme.questions;

    return Scaffold(
      body: MaxSizeContainer(
        maxWidth: EditorLayoutMetrics.listMaxWidth,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: EditorLayoutMetrics.pagePadding(context),
              child: _QuestionsHeader(
                title: translations.questions,
                subtitle: theme.name,
                onAddQuestion: () =>
                    _addNewQuestion(context, roundIndex, themeIndex),
                onAddTemplate: () => _addQuestionFromTemplate(
                  context,
                  roundIndex,
                  themeIndex,
                  QuestionTemplate.openingQuestion,
                ),
              ),
            ),

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
                      padding: EditorLayoutMetrics.listPadding(context),
                      itemCount: questions.length,
                      onReorderItem: (oldIndex, newIndex) {
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
                          onEdit: () => _showEditQuestionPage(
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
                          onDuplicate: () => _duplicateQuestion(
                            roundIndex,
                            themeIndex,
                            index,
                          ),
                        );
                      },
                    ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _addNewQuestion(
    BuildContext context,
    int roundIndex,
    int themeIndex,
  ) async {
    final controller = GetIt.I<OqEditorController>();

    final result = await context
        .pushRoute(
          AddQuestionRoute(
            roundIndex: roundIndex,
            themeIndex: themeIndex,
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

    final result = await context
        .pushRoute(
          AddQuestionRoute(
            roundIndex: roundIndex,
            themeIndex: themeIndex,
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

  Future<void> _showEditQuestionPage(
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

  void _duplicateQuestion(
    int roundIndex,
    int themeIndex,
    int questionIndex,
  ) {
    GetIt.I<OqEditorController>().copyQuestion(
      roundIndex,
      themeIndex,
      questionIndex,
    );
  }
}

class _QuestionsHeader extends StatelessWidget {
  const _QuestionsHeader({
    required this.title,
    required this.subtitle,
    required this.onAddQuestion,
    required this.onAddTemplate,
  });

  final String title;
  final String subtitle;
  final VoidCallback onAddQuestion;
  final VoidCallback onAddTemplate;

  @override
  Widget build(BuildContext context) {
    final translations = GetIt.I<OqEditorController>().translations;
    final titleBlock = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: Theme.of(
            context,
          ).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w600),
        ),
        Text(
          subtitle,
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
            color: Theme.of(context).colorScheme.onSurfaceVariant,
          ),
        ),
      ],
    );
    final actions = OverflowBar(
      overflowAlignment: OverflowBarAlignment.end,
      spacing: 8,
      overflowSpacing: 8,
      children: [
        FilledButton.icon(
          onPressed: onAddQuestion,
          icon: const Icon(Icons.add),
          label: Text(translations.addQuestion),
        ),
        MenuAnchor(
          crossAxisUnconstrained: false,
          builder: (context, controller, child) {
            return FilledButton.tonalIcon(
              onPressed: () {
                if (controller.isOpen) {
                  controller.close();
                } else {
                  controller.open();
                }
              },
              icon: const Icon(Icons.auto_awesome),
              label: Text(translations.addFromTemplate),
            );
          },
          menuChildren: [
            MenuItemButton(
              leadingIcon: const Icon(Icons.file_upload_outlined),
              onPressed: onAddTemplate,
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 12),
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
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: Theme.of(context).colorScheme.onSurfaceVariant,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ],
    );

    return LayoutBuilder(
      builder: (context, constraints) {
        if (constraints.maxWidth < 640) {
          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              titleBlock,
              const SizedBox(height: 12),
              actions,
            ],
          );
        }

        return Row(
          children: [
            Expanded(child: titleBlock),
            Flexible(child: actions),
          ],
        );
      },
    );
  }
}

class _QuestionCard extends StatelessWidget {
  const _QuestionCard({
    required this.question,
    required this.questionIndex,
    required this.onEdit,
    required this.onDelete,
    required this.onDuplicate,
    super.key,
  });

  final PackageQuestionUnion question;
  final int questionIndex;
  final VoidCallback onEdit;
  final VoidCallback onDelete;
  final VoidCallback onDuplicate;

  @override
  Widget build(BuildContext context) {
    final controller = GetIt.I<OqEditorController>();
    final translations = controller.translations;
    final colorScheme = Theme.of(context).colorScheme;
    final isCompact =
        MediaQuery.sizeOf(context).width <
        EditorLayoutMetrics.compactBreakpoint;

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

    final questionType = question.map(
      simple: (_) => translations.questionTypeSimple,
      stake: (_) => translations.questionTypeStake,
      secret: (_) => translations.questionTypeSecret,
      noRisk: (_) => translations.questionTypeNoRisk,
      hidden: (_) => translations.questionTypeHidden,
      choice: (_) => translations.questionTypeChoice,
    );

    return Card(
      elevation: 0,
      margin: const EdgeInsets.only(bottom: 12),
      color: colorScheme.surfaceContainerLow,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(8),
        side: BorderSide(color: colorScheme.outlineVariant),
      ),
      clipBehavior: Clip.antiAlias,
      child: ListTile(
        contentPadding: const EdgeInsets.fromLTRB(16, 8, 8, 8),
        leading: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
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
        subtitle: Wrap(
          spacing: 8,
          runSpacing: 4,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            Chip(
              label: Text(questionType),
              labelStyle: Theme.of(context).textTheme.bodySmall,
              padding: EdgeInsets.zero,
            ),
            if (questionPrice != null)
              Text(
                '$questionPrice ${translations.pts}',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: Theme.of(context).colorScheme.primary,
                  fontWeight: FontWeight.w600,
                ),
              ),
          ],
        ),
        trailing: isCompact ? _compactMenu(translations) : _inlineActions(),
      ),
    );
  }

  Widget _compactMenu(OqEditorTranslations translations) {
    return PopupMenuButton<_QuestionCardAction>(
      onSelected: _handleAction,
      itemBuilder: (context) => [
        PopupMenuItem(
          value: _QuestionCardAction.edit,
          child: _ToolbarMenuItem(
            icon: Icons.edit_outlined,
            label: translations.editButton,
          ),
        ),
        PopupMenuItem(
          value: _QuestionCardAction.duplicate,
          child: _ToolbarMenuItem(
            icon: Icons.copy_all_outlined,
            label: translations.duplicateQuestion,
          ),
        ),
        PopupMenuItem(
          value: _QuestionCardAction.delete,
          child: _ToolbarMenuItem(
            icon: Icons.delete_outline,
            label: translations.deleteButton,
          ),
        ),
      ],
    );
  }

  Widget _inlineActions() {
    final translations = GetIt.I<OqEditorController>().translations;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        IconButton(
          icon: const Icon(Icons.edit_outlined),
          onPressed: onEdit,
          tooltip: translations.editButton,
        ),
        IconButton(
          icon: const Icon(Icons.copy_all_outlined),
          onPressed: onDuplicate,
          tooltip: translations.duplicateQuestion,
        ),
        IconButton(
          icon: const Icon(Icons.delete_outline),
          onPressed: onDelete,
          tooltip: translations.deleteButton,
        ),
      ],
    );
  }

  void _handleAction(_QuestionCardAction action) {
    switch (action) {
      case _QuestionCardAction.edit:
        onEdit();
      case _QuestionCardAction.duplicate:
        onDuplicate();
      case _QuestionCardAction.delete:
        onDelete();
    }
  }
}

class _ToolbarMenuItem extends StatelessWidget {
  const _ToolbarMenuItem({
    required this.icon,
    required this.label,
  });

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 20),
        const SizedBox(width: 12),
        Flexible(
          child: Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ],
    );
  }
}
