import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';
import 'package:oq_editor/controllers/editor_navigation_controller.dart';
import 'package:oq_editor/controllers/oq_editor_controller.dart';
import 'package:oq_editor/models/editor_navigation_state.dart';
import 'package:watch_it/watch_it.dart';

/// Filter chips for filtering questions by type and attributes
class QuestionFilterChips extends WatchingWidget {
  const QuestionFilterChips({super.key});

  @override
  Widget build(BuildContext context) {
    final navController = watchIt<EditorNavigationController>();
    final editorController = GetIt.I<OqEditorController>();
    final translations = editorController.translations;
    final currentFilter = navController.questionFilter;

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Row(
        children: [
          _FilterChip(
            label: 'All',
            isSelected: currentFilter == QuestionFilter.all,
            onSelected: () =>
                navController.setQuestionFilter(QuestionFilter.all),
          ),
          const SizedBox(width: 8),
          _FilterChip(
            label: translations.questionTypeSimple as String,
            icon: Icons.help_outline,
            iconColor: Colors.blue,
            isSelected: currentFilter == QuestionFilter.simple,
            onSelected: () =>
                navController.setQuestionFilter(QuestionFilter.simple),
          ),
          const SizedBox(width: 8),
          _FilterChip(
            label: translations.questionTypeStake as String,
            icon: Icons.monetization_on_outlined,
            iconColor: Colors.amber.shade700,
            isSelected: currentFilter == QuestionFilter.stake,
            onSelected: () =>
                navController.setQuestionFilter(QuestionFilter.stake),
          ),
          const SizedBox(width: 8),
          _FilterChip(
            label: translations.questionTypeSecret as String,
            icon: Icons.visibility_off_outlined,
            iconColor: Colors.purple,
            isSelected: currentFilter == QuestionFilter.secret,
            onSelected: () =>
                navController.setQuestionFilter(QuestionFilter.secret),
          ),
          const SizedBox(width: 8),
          _FilterChip(
            label: translations.questionTypeNoRisk as String,
            icon: Icons.shield_outlined,
            iconColor: Colors.green,
            isSelected: currentFilter == QuestionFilter.noRisk,
            onSelected: () =>
                navController.setQuestionFilter(QuestionFilter.noRisk),
          ),
          const SizedBox(width: 8),
          _FilterChip(
            label: translations.questionTypeChoice as String,
            icon: Icons.list_alt_outlined,
            iconColor: Colors.orange,
            isSelected: currentFilter == QuestionFilter.choice,
            onSelected: () =>
                navController.setQuestionFilter(QuestionFilter.choice),
          ),
          const SizedBox(width: 8),
          _FilterChip(
            label: translations.questionTypeHidden as String,
            icon: Icons.lock_outline,
            iconColor: Colors.grey,
            isSelected: currentFilter == QuestionFilter.hidden,
            onSelected: () =>
                navController.setQuestionFilter(QuestionFilter.hidden),
          ),
          const SizedBox(width: 16),
          const VerticalDivider(width: 1, indent: 8, endIndent: 8),
          const SizedBox(width: 16),
          _FilterChip(
            label: 'Has Media',
            icon: Icons.perm_media_outlined,
            isSelected: currentFilter == QuestionFilter.hasMedia,
            onSelected: () =>
                navController.setQuestionFilter(QuestionFilter.hasMedia),
          ),
          const SizedBox(width: 8),
          _FilterChip(
            label: 'Incomplete',
            icon: Icons.warning_amber_outlined,
            iconColor: Colors.orange,
            isSelected: currentFilter == QuestionFilter.incomplete,
            onSelected: () =>
                navController.setQuestionFilter(QuestionFilter.incomplete),
          ),
        ],
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  const _FilterChip({
    required this.label,
    required this.isSelected,
    required this.onSelected,
    this.icon,
    this.iconColor,
  });

  final String label;
  final IconData? icon;
  final Color? iconColor;
  final bool isSelected;
  final VoidCallback onSelected;

  @override
  Widget build(BuildContext context) {
    return FilterChip(
      label: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(
              icon,
              size: 16,
              color: isSelected
                  ? Theme.of(context).colorScheme.onSecondaryContainer
                  : iconColor,
            ),
            const SizedBox(width: 4),
          ],
          Text(label),
        ],
      ),
      selected: isSelected,
      onSelected: (_) => onSelected(),
      showCheckmark: false,
      visualDensity: VisualDensity.compact,
    );
  }
}

/// List view mode toggle button
class ListViewModeToggle extends WatchingWidget {
  const ListViewModeToggle({super.key});

  @override
  Widget build(BuildContext context) {
    final navController = watchIt<EditorNavigationController>();
    final isCompact = navController.listViewMode == ListViewMode.compact;

    return SegmentedButton<ListViewMode>(
      segments: const [
        ButtonSegment(
          value: ListViewMode.compact,
          icon: Icon(Icons.view_list, size: 18),
          tooltip: 'Compact view',
        ),
        ButtonSegment(
          value: ListViewMode.detailed,
          icon: Icon(Icons.view_agenda, size: 18),
          tooltip: 'Detailed view',
        ),
      ],
      selected: {navController.listViewMode},
      onSelectionChanged: (selected) {
        navController.setListViewMode(selected.first);
      },
      showSelectedIcon: false,
      style: ButtonStyle(
        visualDensity: VisualDensity.compact,
        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
      ),
    );
  }
}

/// Selection mode toolbar for batch operations
class SelectionToolbar extends WatchingWidget {
  const SelectionToolbar({
    required this.onDelete,
    this.onMove,
    this.onDuplicate,
    super.key,
  });

  final VoidCallback onDelete;
  final VoidCallback? onMove;
  final VoidCallback? onDuplicate;

  @override
  Widget build(BuildContext context) {
    final navController = watchIt<EditorNavigationController>();
    final selection = navController.selection;

    if (!navController.selectionModeActive) {
      return const SizedBox.shrink();
    }

    return AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      height: selection.hasSelection ? 56 : 0,
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.secondaryContainer,
        border: Border(
          top: BorderSide(
            color: Theme.of(context).colorScheme.outlineVariant,
          ),
        ),
      ),
      child: selection.hasSelection
          ? Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Row(
                children: [
                  IconButton(
                    icon: const Icon(Icons.close),
                    onPressed: navController.exitSelectionMode,
                    tooltip: 'Exit selection mode',
                  ),
                  const SizedBox(width: 8),
                  Text(
                    '${selection.totalSelected} selected',
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                          fontWeight: FontWeight.w600,
                        ),
                  ),
                  const Spacer(),
                  if (onMove != null)
                    TextButton.icon(
                      icon: const Icon(Icons.drive_file_move_outline),
                      label: const Text('Move'),
                      onPressed: onMove,
                    ),
                  if (onDuplicate != null)
                    TextButton.icon(
                      icon: const Icon(Icons.copy),
                      label: const Text('Duplicate'),
                      onPressed: onDuplicate,
                    ),
                  TextButton.icon(
                    icon: const Icon(Icons.delete_outline),
                    label: const Text('Delete'),
                    style: TextButton.styleFrom(
                      foregroundColor: Theme.of(context).colorScheme.error,
                    ),
                    onPressed: onDelete,
                  ),
                ],
              ),
            )
          : null,
    );
  }
}
