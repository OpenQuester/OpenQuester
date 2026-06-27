import 'package:auto_route/auto_route.dart';
import 'package:flutter/material.dart';
import 'package:openapi/openapi.dart';
import 'package:oq_editor/controllers/oq_editor_controller.dart';
import 'package:oq_editor/router/router.gr.dart';
import 'package:oq_editor/view/utils/editor_layout_metrics.dart';
import 'package:oq_shared/ui/max_size_container.dart';
import 'package:watch_it/watch_it.dart';

/// Second step: manage rounds in the package
@RoutePage()
class RoundsListScreen extends WatchingWidget {
  const RoundsListScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final controller = GetIt.I<OqEditorController>();
    final package = watchValue((OqEditorController c) => c.package);
    final translations = controller.translations;
    final rounds = package.rounds;
    callOnce((_) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (context.mounted) controller.selectPackage();
      });
    });

    return Scaffold(
      body: MaxSizeContainer(
        maxWidth: EditorLayoutMetrics.listMaxWidth,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: EditorLayoutMetrics.pagePadding(context),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      translations.rounds,
                      style: Theme.of(context).textTheme.headlineSmall
                          ?.copyWith(
                            fontWeight: FontWeight.w600,
                          ),
                    ),
                  ),
                  FilledButton.icon(
                    onPressed: () => _showAddRoundDialog(context),
                    icon: const Icon(Icons.add),
                    label: Text(translations.addRound),
                  ),
                ],
              ),
            ),

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
                        ],
                      ),
                    )
                  : ReorderableListView.builder(
                      padding: EditorLayoutMetrics.listPadding(context),
                      itemCount: rounds.length,
                      onReorderItem: controller.reorderRounds,
                      itemBuilder: (context, index) {
                        final round = rounds[index];
                        return _RoundCard(
                          key: ValueKey(round.id ?? index),
                          round: round,
                          roundIndex: index,
                          onTap: () => context.router.push(
                            RoundEditorRoute(roundIndex: index),
                          ),
                          onEdit: () =>
                              _showEditRoundDialog(context, index, round),
                          onDelete: () => _confirmDeleteRound(context, index),
                          onViewThemes: () => context.router.push(
                            ThemesGridRoute(roundIndex: index),
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

  Future<void> _showAddRoundDialog(BuildContext context) async {
    final controller = GetIt.I<OqEditorController>()..createRound();
    final roundIndex = controller.selectedNode.value.roundIndex;
    if (roundIndex == null || !context.mounted) return;

    await context.router.push(RoundEditorRoute(roundIndex: roundIndex));
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
    required this.onViewThemes,
    super.key,
  });

  final PackageRound round;
  final int roundIndex;
  final VoidCallback onTap;
  final VoidCallback onEdit;
  final VoidCallback onDelete;
  final VoidCallback onViewThemes;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return Card(
      elevation: 0,
      margin: const EdgeInsets.only(bottom: 12),
      color: colorScheme.surfaceContainerLow,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(8),
        side: BorderSide(color: colorScheme.outlineVariant),
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  // Drag handle
                  Icon(
                    Icons.drag_handle,
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
                  const SizedBox(width: 12),

                  // Round info
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          round.name,
                          style: Theme.of(context).textTheme.titleMedium
                              ?.copyWith(
                                fontWeight: FontWeight.w600,
                              ),
                        ),
                        if (round.description?.isNotEmpty ?? false) ...[
                          const SizedBox(height: 4),
                          Text(
                            round.description!,
                            style: Theme.of(context).textTheme.bodySmall
                                ?.copyWith(
                                  color: Theme.of(
                                    context,
                                  ).colorScheme.onSurfaceVariant,
                                ),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ],
                    ),
                  ),

                  // Actions
                  IconButton(
                    icon: const Icon(Icons.edit_outlined),
                    onPressed: onEdit,
                    tooltip:
                        GetIt.I<OqEditorController>().translations.editButton,
                  ),
                  IconButton(
                    icon: const Icon(Icons.delete_outline),
                    onPressed: onDelete,
                    tooltip:
                        GetIt.I<OqEditorController>().translations.deleteButton,
                  ),
                ],
              ),
              const SizedBox(height: 12),

              // Themes count and view button
              Row(
                children: [
                  Chip(
                    label: Text(
                      GetIt.I<OqEditorController>().translations.themesCount(
                        round.themes.length,
                      ),
                    ),
                    labelStyle: Theme.of(context).textTheme.bodySmall,
                  ),
                  const Spacer(),
                  TextButton.icon(
                    onPressed: onViewThemes,
                    icon: const Icon(Icons.grid_view),
                    label: Text(
                      GetIt.I<OqEditorController>().translations.themes,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
