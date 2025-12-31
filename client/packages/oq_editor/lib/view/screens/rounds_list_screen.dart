import 'package:auto_route/auto_route.dart';
import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';
import 'package:openapi/openapi.dart';
import 'package:oq_editor/controllers/editor_navigation_controller.dart';
import 'package:oq_editor/controllers/oq_editor_controller.dart';
import 'package:oq_editor/models/editor_navigation_state.dart';
import 'package:oq_editor/router/router.gr.dart';
import 'package:oq_editor/view/widgets/editor_filters.dart';
import 'package:oq_editor/view/widgets/editor_item_card.dart';
import 'package:watch_it/watch_it.dart';

/// Second step: manage rounds in the package
@RoutePage()
class RoundsListScreen extends WatchingWidget {
  const RoundsListScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final controller = GetIt.I<OqEditorController>();
    final navController = GetIt.I.isRegistered<EditorNavigationController>()
        ? watchIt<EditorNavigationController>()
        : null;
    final package = watchValue((OqEditorController c) => c.package);
    final translations = controller.translations;
    final rounds = package.rounds;

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
                        translations.rounds,
                        style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      Text(
                        '${rounds.length} rounds • ${_getTotalThemes(rounds)} themes • ${_getTotalQuestions(rounds)} questions',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: Theme.of(context).colorScheme.onSurfaceVariant,
                        ),
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
                  onPressed: () => _showAddRoundDialog(context),
                  icon: const Icon(Icons.add),
                  label: Text(translations.addRound),
                ),
              ],
            ),
          ),

          // Rounds list or empty state
          Expanded(
            child: rounds.isEmpty
                ? Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          Icons.interests_outlined,
                          size: 64,
                          color: Theme.of(context).colorScheme.outline,
                        ),
                        const SizedBox(height: 16),
                        Text(
                          translations.noRounds,
                          style: Theme.of(context).textTheme.titleMedium
                              ?.copyWith(
                                color: Theme.of(
                                  context,
                                ).colorScheme.onSurfaceVariant,
                              ),
                        ),
                        const SizedBox(height: 16),
                        FilledButton.icon(
                          onPressed: () => _showAddRoundDialog(context),
                          icon: const Icon(Icons.add),
                          label: Text(translations.addRound),
                        ),
                      ],
                    ),
                  )
                : ReorderableListView.builder(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    itemCount: rounds.length,
                    onReorder: controller.reorderRounds,
                    itemBuilder: (context, index) {
                      final round = rounds[index];
                      return _RoundCard(
                        key: ValueKey(round.id ?? index),
                        round: round,
                        roundIndex: index,
                        isCompact: isCompactMode,
                        showCheckbox: selectionMode,
                        isSelected: navController?.selection.selectedRounds
                                .contains(index) ??
                            false,
                        onCheckboxChanged: (value) {
                          navController?.toggleRoundSelection(index);
                        },
                        onTap: () => context.router.push(
                          ThemesGridRoute(roundIndex: index),
                        ),
                        onEdit: () =>
                            _showEditRoundDialog(context, index, round),
                        onDelete: () => _confirmDeleteRound(context, index),
                      );
                    },
                  ),
          ),

          // Selection toolbar
          if (navController != null)
            SelectionToolbar(
              onDelete: () => _deleteSelectedRounds(context),
            ),
        ],
      ),
    );
  }

  int _getTotalThemes(List<PackageRound> rounds) {
    return rounds.fold<int>(0, (sum, round) => sum + round.themes.length);
  }

  int _getTotalQuestions(List<PackageRound> rounds) {
    return rounds.fold<int>(
      0,
      (sum, round) => sum + round.themes.fold<int>(
        0,
        (themeSum, theme) => themeSum + theme.questions.length,
      ),
    );
  }

  void _deleteSelectedRounds(BuildContext context) {
    final controller = GetIt.I<OqEditorController>();
    final navController = GetIt.I<EditorNavigationController>();
    final selection = navController.selection;

    // Sort in reverse to avoid index shifting issues
    final roundsToDelete = selection.selectedRounds.toList()
      ..sort((a, b) => b.compareTo(a));

    for (final roundIndex in roundsToDelete) {
      controller.deleteRound(roundIndex);
    }

    navController.clearSelection();
  }

  Future<void> _showAddRoundDialog(BuildContext context) async {
    final controller = GetIt.I<OqEditorController>();
    final newRound = PackageRound(
      id: null,
      order: 0,
      name: controller.translations.newRound,
      description: '',
      type: PackageRoundType.simple,
      themes: [],
    );

    // Simple add for now - in a real implementation, show a dialog
    controller.addRound(newRound);
  }

  Future<void> _showEditRoundDialog(
    BuildContext context,
    int index,
    PackageRound round,
  ) async {
    // Navigate to round editor
    await context.router.push(
      RoundEditorRoute(roundIndex: index),
    );
  }

  Future<void> _confirmDeleteRound(BuildContext context, int index) async {
    final controller = GetIt.I<OqEditorController>();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(controller.translations.deleteConfirmTitle),
        content: Text(
          controller.translations.deleteConfirmMessage(
            controller.translations.thisRound,
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
      controller.deleteRound(index);
    }
  }
}

class _RoundCard extends StatelessWidget {
  const _RoundCard({
    required this.round,
    required this.roundIndex,
    required this.onTap,
    required this.onEdit,
    required this.onDelete,
    this.isCompact = false,
    this.showCheckbox = false,
    this.isSelected = false,
    this.onCheckboxChanged,
    super.key,
  });

  final PackageRound round;
  final int roundIndex;
  final VoidCallback onTap;
  final VoidCallback onEdit;
  final VoidCallback onDelete;
  final bool isCompact;
  final bool showCheckbox;
  final bool isSelected;
  final ValueChanged<bool?>? onCheckboxChanged;

  @override
  Widget build(BuildContext context) {
    final themesCount = round.themes.length;
    final questionsCount = round.themes.fold<int>(
      0,
      (sum, theme) => sum + theme.questions.length,
    );
    final emptyThemes =
        round.themes.where((t) => t.questions.isEmpty).length;

    // Build badges
    final badges = <EditorBadge>[
      EditorBadge(
        icon: Icons.category_outlined,
        label: '$themesCount',
        tooltip: '$themesCount themes',
        color: Theme.of(context).colorScheme.secondary,
      ),
      EditorBadge(
        icon: Icons.quiz_outlined,
        label: '$questionsCount',
        tooltip: '$questionsCount questions',
        color: Theme.of(context).colorScheme.tertiary,
      ),
      if (emptyThemes > 0)
        EditorBadge(
          icon: Icons.warning_amber_outlined,
          label: '$emptyThemes empty',
          tooltip: '$emptyThemes empty themes',
          color: Colors.orange.shade700,
        ),
    ];

    // Determine round type color
    final typeColor = round.type == PackageRoundType.valueFinal
        ? Colors.purple
        : Theme.of(context).colorScheme.primary;

    return EditorItemCard(
      title: round.name,
      subtitle: round.description?.isNotEmpty == true ? round.description : null,
      onTap: onTap,
      leadingWidget: Container(
        width: isCompact ? 32 : 48,
        height: isCompact ? 32 : 48,
        decoration: BoxDecoration(
          color: typeColor.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(isCompact ? 8 : 12),
        ),
        alignment: Alignment.center,
        child: Text(
          '${roundIndex + 1}',
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w700,
                color: typeColor,
              ),
        ),
      ),
      accentColor: round.type == PackageRoundType.valueFinal
          ? Colors.purple
          : null,
      typeChip: Chip(
        avatar: Icon(
          round.type == PackageRoundType.valueFinal
              ? Icons.emoji_events_outlined
              : Icons.layers_outlined,
          size: 16,
          color: typeColor,
        ),
        label: Text(
          round.type == PackageRoundType.valueFinal ? 'Final' : 'Regular',
          style: TextStyle(color: typeColor),
        ),
        side: BorderSide(color: typeColor.withValues(alpha: 0.3)),
        backgroundColor: typeColor.withValues(alpha: 0.05),
        visualDensity: VisualDensity.compact,
      ),
      badges: badges,
      isCompact: isCompact,
      showCheckbox: showCheckbox,
      isSelected: isSelected,
      onCheckboxChanged: onCheckboxChanged,
      onEdit: onEdit,
      onDelete: onDelete,
      showDragHandle: !showCheckbox,
    );
  }
}
