import 'package:auto_route/auto_route.dart';
import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';
import 'package:nb_utils/nb_utils.dart';
import 'package:openapi/openapi.dart';
import 'package:oq_editor/controllers/editor_navigation_controller.dart';
import 'package:oq_editor/controllers/oq_editor_controller.dart';
import 'package:oq_editor/models/editor_navigation_state.dart';
import 'package:oq_editor/router/router.gr.dart';
import 'package:oq_editor/view/widgets/editor_filters.dart';
import 'package:oq_editor/view/widgets/editor_item_card.dart';
import 'package:watch_it/watch_it.dart';

/// Grid view of themes within a round
@RoutePage()
class ThemesGridScreen extends WatchingWidget {
  const ThemesGridScreen({@pathParam required this.roundIndex, super.key});
  final int roundIndex;

  @override
  Widget build(BuildContext context) {
    final controller = GetIt.I<OqEditorController>();
    final navController = GetIt.I.isRegistered<EditorNavigationController>()
        ? watchIt<EditorNavigationController>()
        : null;
    final package = watchValue((OqEditorController c) => c.package);

    final translations = controller.translations;

    if (roundIndex >= package.rounds.length) {
      return Scaffold(
        body: Text(translations.invalidRound).center(),
      );
    }

    final round = package.rounds[roundIndex];
    final themes = round.themes;

    final isCompactMode =
        navController?.listViewMode == ListViewMode.compact;
    final selectionMode = navController?.selectionModeActive ?? false;

    // Calculate totals
    final totalQuestions =
        themes.fold<int>(0, (sum, theme) => sum + theme.questions.length);
    final emptyThemes = themes.where((t) => t.questions.isEmpty).length;

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
                        translations.themes,
                        style: Theme.of(context).textTheme.headlineSmall
                            ?.copyWith(
                              fontWeight: FontWeight.w600,
                            ),
                      ),
                      Row(
                        children: [
                          Text(
                            round.name,
                            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                              color: Theme.of(context).colorScheme.onSurfaceVariant,
                            ),
                          ),
                          const SizedBox(width: 8),
                          Text(
                            '• ${themes.length} themes • $totalQuestions questions',
                            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: Theme.of(context).colorScheme.outline,
                            ),
                          ),
                          if (emptyThemes > 0) ...[
                            const SizedBox(width: 8),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 6,
                                vertical: 2,
                              ),
                              decoration: BoxDecoration(
                                color: Colors.orange.withValues(alpha: 0.1),
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(
                                    Icons.warning_amber_outlined,
                                    size: 14,
                                    color: Colors.orange.shade700,
                                  ),
                                  const SizedBox(width: 4),
                                  Text(
                                    '$emptyThemes empty',
                                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                                      color: Colors.orange.shade700,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ],
                      ),
                    ],
                  ),
                ),
                if (navController != null) ...[
                  const ListViewModeToggle(),
                  const SizedBox(width: 8),
                  IconButton(
                    icon: Icon(
                      selectionMode ? Icons.check_box : Icons.check_box_outline_blank,
                    ),
                    tooltip: selectionMode ? 'Exit selection' : 'Select items',
                    onPressed: () => navController.toggleSelectionMode(),
                  ),
                  const SizedBox(width: 8),
                ],
                FilledButton.icon(
                  onPressed: () => _addNewTheme(context, roundIndex),
                  icon: const Icon(Icons.add),
                  label: Text(translations.addTheme),
                ),
              ],
            ),
          ),

          // Themes grid or empty state
          Expanded(
            child: themes.isEmpty
                ? Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          Icons.dashboard_outlined,
                          size: 64,
                          color: Theme.of(context).colorScheme.outline,
                        ),
                        const SizedBox(height: 16),
                        Text(
                          translations.noThemes,
                          style: Theme.of(context).textTheme.titleMedium
                              ?.copyWith(
                                color: Theme.of(
                                  context,
                                ).colorScheme.onSurfaceVariant,
                              ),
                        ),
                        const SizedBox(height: 16),
                        FilledButton.icon(
                          onPressed: () => _addNewTheme(context, roundIndex),
                          icon: const Icon(Icons.add),
                          label: Text(translations.addTheme),
                        ),
                      ],
                    ),
                  )
                : isCompactMode
                    // List view (compact mode)
                    ? ReorderableListView.builder(
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        itemCount: themes.length,
                        onReorder: (oldIndex, newIndex) {
                          controller.reorderThemes(
                            roundIndex,
                            oldIndex,
                            newIndex > oldIndex ? newIndex - 1 : newIndex,
                          );
                        },
                        itemBuilder: (context, index) {
                          final theme = themes[index];
                          return _ThemeListItem(
                            key: ValueKey(theme.id ?? index),
                            theme: theme,
                            roundIndex: roundIndex,
                            themeIndex: index,
                            showCheckbox: selectionMode,
                            isSelected: navController?.selection.selectedThemes
                                    .contains((roundIndex, index)) ??
                                false,
                            onCheckboxChanged: (value) {
                              navController?.toggleThemeSelection(
                                roundIndex,
                                index,
                              );
                            },
                            onTap: () => context.router.push(
                              QuestionsListRoute(
                                roundIndex: roundIndex,
                                themeIndex: index,
                              ),
                            ),
                            onEdit: () => context.router.push(
                              ThemeEditorRoute(
                                roundIndex: roundIndex,
                                themeIndex: index,
                              ),
                            ),
                            onDelete: () =>
                                _confirmDeleteTheme(context, roundIndex, index),
                          );
                        },
                      )
                    // Grid view (detailed mode)
                    : GridView.builder(
                        padding: const EdgeInsets.all(16),
                        gridDelegate:
                            const SliverGridDelegateWithMaxCrossAxisExtent(
                          maxCrossAxisExtent: 400,
                          mainAxisSpacing: 12,
                          crossAxisSpacing: 12,
                          childAspectRatio: 1.4,
                        ),
                        itemCount: themes.length,
                        itemBuilder: (context, index) {
                          final theme = themes[index];
                          return _ThemeCard(
                            key: ValueKey(theme.id ?? index),
                            theme: theme,
                            roundIndex: roundIndex,
                            themeIndex: index,
                            showCheckbox: selectionMode,
                            isSelected: navController?.selection.selectedThemes
                                    .contains((roundIndex, index)) ??
                                false,
                            onCheckboxChanged: (value) {
                              navController?.toggleThemeSelection(
                                roundIndex,
                                index,
                              );
                            },
                            onTap: () => context.router.push(
                              QuestionsListRoute(
                                roundIndex: roundIndex,
                                themeIndex: index,
                              ),
                            ),
                            onDelete: () =>
                                _confirmDeleteTheme(context, roundIndex, index),
                          );
                        },
                      ),
          ),

          // Selection toolbar
          if (navController != null)
            SelectionToolbar(
              onDelete: () => _deleteSelectedThemes(context),
            ),
        ],
      ),
    );
  }

  void _deleteSelectedThemes(BuildContext context) {
    final controller = GetIt.I<OqEditorController>();
    final navController = GetIt.I<EditorNavigationController>();
    final selection = navController.selection;

    // Sort in reverse to avoid index shifting issues
    final themesToDelete = selection.selectedThemes
        .where((t) => t.$1 == roundIndex)
        .toList()
      ..sort((a, b) => b.$2.compareTo(a.$2));

    for (final (_, themeIndex) in themesToDelete) {
      controller.deleteTheme(roundIndex, themeIndex);
    }

    navController.clearSelection();
  }

  void _addNewTheme(BuildContext context, int roundIndex) {
    final controller = GetIt.I<OqEditorController>();
    final newTheme = PackageTheme(
      id: null,
      order: 0,
      name: controller.translations.newTheme,
      description: '',
      questions: [],
    );
    controller.addTheme(roundIndex, newTheme);
  }

  Future<void> _confirmDeleteTheme(
    BuildContext context,
    int roundIndex,
    int themeIndex,
  ) async {
    final controller = GetIt.I<OqEditorController>();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(controller.translations.deleteConfirmTitle),
        content: Text(
          controller.translations.deleteConfirmMessage(
            controller.translations.thisTheme,
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
      controller.deleteTheme(roundIndex, themeIndex);
    }
  }
}

/// List item for compact theme view
class _ThemeListItem extends StatelessWidget {
  const _ThemeListItem({
    required this.theme,
    required this.roundIndex,
    required this.themeIndex,
    required this.onTap,
    required this.onEdit,
    required this.onDelete,
    this.showCheckbox = false,
    this.isSelected = false,
    this.onCheckboxChanged,
    super.key,
  });

  final PackageTheme theme;
  final int roundIndex;
  final int themeIndex;
  final VoidCallback onTap;
  final VoidCallback onEdit;
  final VoidCallback onDelete;
  final bool showCheckbox;
  final bool isSelected;
  final ValueChanged<bool?>? onCheckboxChanged;

  @override
  Widget build(BuildContext context) {
    final questionsCount = theme.questions.length;
    final isEmpty = questionsCount == 0;

    return EditorItemCard(
      title: theme.name,
      subtitle: theme.description?.isNotEmpty == true ? theme.description : null,
      onTap: onTap,
      leadingIcon: Icons.category_outlined,
      accentColor: isEmpty ? Colors.orange : null,
      badges: [
        EditorBadge(
          icon: Icons.quiz_outlined,
          label: '$questionsCount',
          tooltip: '$questionsCount questions',
          color: Theme.of(context).colorScheme.primary,
        ),
        if (isEmpty)
          EditorBadge(
            icon: Icons.warning_amber_outlined,
            tooltip: 'No questions',
            color: Colors.orange.shade700,
          ),
      ],
      isCompact: true,
      showCheckbox: showCheckbox,
      isSelected: isSelected,
      onCheckboxChanged: onCheckboxChanged,
      onEdit: onEdit,
      onDelete: onDelete,
      showDragHandle: !showCheckbox,
    );
  }
}

/// Grid card for detailed theme view
class _ThemeCard extends StatelessWidget {
  const _ThemeCard({
    required this.theme,
    required this.roundIndex,
    required this.themeIndex,
    required this.onTap,
    required this.onDelete,
    this.showCheckbox = false,
    this.isSelected = false,
    this.onCheckboxChanged,
    super.key,
  });

  final PackageTheme theme;
  final int roundIndex;
  final int themeIndex;
  final VoidCallback onTap;
  final VoidCallback onDelete;
  final bool showCheckbox;
  final bool isSelected;
  final ValueChanged<bool?>? onCheckboxChanged;

  @override
  Widget build(BuildContext context) {
    final controller = GetIt.I<OqEditorController>();
    final translations = controller.translations;
    final questionsCount = theme.questions.length;
    final isEmpty = questionsCount == 0;

    // Calculate completion percentage
    final completionPercent = questionsCount > 0
        ? theme.questions.where(_isQuestionComplete).length / questionsCount
        : 0.0;

    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Header with gradient
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: isEmpty
                      ? [
                          Colors.orange.withValues(alpha: 0.2),
                          Colors.orange.withValues(alpha: 0.1),
                        ]
                      : [
                          Theme.of(context).colorScheme.primaryContainer,
                          Theme.of(context).colorScheme.secondaryContainer,
                        ],
                ),
              ),
              child: Row(
                children: [
                  if (showCheckbox)
                    Checkbox(
                      value: isSelected,
                      onChanged: onCheckboxChanged,
                      visualDensity: VisualDensity.compact,
                    ),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          theme.name,
                          style: Theme.of(context).textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.w600,
                            color: Theme.of(context).colorScheme.onPrimaryContainer,
                          ),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 4),
                        Row(
                          children: [
                            Icon(
                              Icons.quiz_outlined,
                              size: 14,
                              color: Theme.of(context).colorScheme.onPrimaryContainer.withValues(alpha: 0.7),
                            ),
                            const SizedBox(width: 4),
                            Text(
                              '$questionsCount ${translations.questions}',
                              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                color: Theme.of(context).colorScheme.onPrimaryContainer.withValues(alpha: 0.7),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.delete_outline, size: 20),
                    onPressed: onDelete,
                    color: Theme.of(context).colorScheme.onPrimaryContainer,
                    tooltip: translations.deleteButton,
                  ),
                ],
              ),
            ),

            // Content
            Expanded(
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (theme.description?.isNotEmpty ?? false)
                      Expanded(
                        child: Text(
                          theme.description!,
                          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: Theme.of(context).colorScheme.onSurfaceVariant,
                          ),
                          maxLines: 3,
                          overflow: TextOverflow.ellipsis,
                        ),
                      )
                    else if (isEmpty)
                      Expanded(
                        child: Center(
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                Icons.add_circle_outline,
                                size: 32,
                                color: Theme.of(context).colorScheme.outline,
                              ),
                              const SizedBox(height: 4),
                              Text(
                                'Add questions',
                                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                  color: Theme.of(context).colorScheme.outline,
                                ),
                              ),
                            ],
                          ),
                        ),
                      )
                    else
                      const Spacer(),

                    // Completion progress
                    if (questionsCount > 0) ...[
                      const SizedBox(height: 8),
                      Row(
                        children: [
                          Expanded(
                            child: ClipRRect(
                              borderRadius: BorderRadius.circular(4),
                              child: LinearProgressIndicator(
                                value: completionPercent,
                                minHeight: 6,
                                backgroundColor: Theme.of(context).colorScheme.outlineVariant,
                                color: completionPercent == 1.0
                                    ? Colors.green
                                    : Theme.of(context).colorScheme.primary,
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Text(
                            '${(completionPercent * 100).toInt()}%',
                            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                              fontWeight: FontWeight.w600,
                              color: completionPercent == 1.0
                                  ? Colors.green
                                  : Theme.of(context).colorScheme.primary,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  bool _isQuestionComplete(PackageQuestionUnion question) {
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
    return (text?.isNotEmpty ?? false) && (answer?.isNotEmpty ?? false);
  }
}
