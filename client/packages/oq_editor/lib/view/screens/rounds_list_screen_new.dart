import 'package:auto_route/auto_route.dart';
import 'package:flutter/material.dart';
import 'package:openapi/openapi.dart';
import 'package:oq_editor/controllers/oq_editor_controller.dart';
import 'package:oq_editor/router/router.gr.dart';
import 'package:oq_editor/view/widgets/editor_badges.dart';
import 'package:oq_editor/view/widgets/editor_breadcrumb.dart';
import 'package:oq_editor/view/widgets/editor_item_card.dart';
import 'package:oq_editor/view/widgets/package_search_delegate.dart';
import 'package:watch_it/watch_it.dart';

/// Redesigned rounds list screen with compact layout
@RoutePage()
class RoundsListScreenNew extends StatelessWidget with WatchItMixin {
  const RoundsListScreenNew({super.key});

  @override
  Widget build(BuildContext context) {
    final controller = GetIt.I<OqEditorController>();
    final package = watchValue((OqEditorController c) => c.package);
    final translations = controller.translations;
    final rounds = package.rounds;

    return Scaffold(
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Breadcrumb navigation
          EditorBreadcrumb(
            translations: translations,
            package: package,
            onNavigateToPackage: () {
              context.router.popUntil(
                (route) => route.settings.name == PackageInfoRoute.name,
              );
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
                        translations.rounds,
                        style: Theme.of(context).textTheme.headlineSmall
                            ?.copyWith(fontWeight: FontWeight.w600),
                      ),
                      const SizedBox(height: 4),
                      CompletionBadge(
                        filled: rounds.length,
                        total: rounds.length,
                        label: translations.rounds,
                      ),
                    ],
                  ),
                ),
                // Search button
                IconButton(
                  icon: const Icon(Icons.search),
                  onPressed: () => _showSearch(context, controller),
                  tooltip: translations.searchPlaceholder,
                ),
                // Add round button
                IconButton(
                  icon: const Icon(Icons.add),
                  onPressed: () => _showAddRoundDialog(context, controller),
                  tooltip: translations.addRound,
                ),
              ],
            ),
          ),

          // Rounds list or empty state
          Expanded(
            child: rounds.isEmpty
                ? _EmptyState(translations: translations)
                : ReorderableListView.builder(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    itemCount: rounds.length,
                    onReorder: controller.reorderRounds,
                    itemBuilder: (context, index) {
                      final round = rounds[index];
                      final themeCount = round.themes.length;
                      final questionCount = round.themes.fold<int>(
                        0,
                        (sum, theme) => sum + theme.questions.length,
                      );

                      return EditorItemCard(
                        key: ValueKey(round.id ?? index),
                        title: round.name,
                        subtitle: round.description?.isNotEmpty ?? false
                            ? round.description
                            : null,
                        depthLevel: 0,
                        leading: const Icon(
                          Icons.drag_handle,
                          color: Colors.grey,
                        ),
                        trailing: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            CompletionBadge(
                              filled: themeCount,
                              total: themeCount,
                              label: translations.themes,
                            ),
                            const SizedBox(width: 4),
                            CompletionBadge(
                              filled: questionCount,
                              total: questionCount,
                              label: translations.questions,
                            ),
                            const SizedBox(width: 8),
                            IconButton(
                              icon: const Icon(Icons.delete_outline, size: 20),
                              onPressed: () =>
                                  _confirmDeleteRound(context, controller, index),
                              tooltip: translations.deleteButton,
                              padding: EdgeInsets.zero,
                              constraints: const BoxConstraints(),
                            ),
                          ],
                        ),
                        onTap: () => context.router.push(
                          ThemesGridRoute(roundIndex: index),
                        ),
                        footer: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 8,
                          ),
                          child: Row(
                            children: [
                              Expanded(
                                child: TextButton.icon(
                                  onPressed: () => context.router.push(
                                    RoundEditorRoute(roundIndex: index),
                                  ),
                                  icon: const Icon(Icons.edit_outlined, size: 16),
                                  label: Text(translations.editRound),
                                  style: TextButton.styleFrom(
                                    alignment: Alignment.centerLeft,
                                  ),
                                ),
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: TextButton.icon(
                                  onPressed: () => context.router.push(
                                    ThemesGridRoute(roundIndex: index),
                                  ),
                                  icon: const Icon(Icons.grid_view, size: 16),
                                  label: Text(translations.themes),
                                  style: TextButton.styleFrom(
                                    alignment: Alignment.centerLeft,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      );
                    },
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

  Future<void> _showAddRoundDialog(
    BuildContext context,
    OqEditorController controller,
  ) async {
    final newRound = PackageRound(
      id: null,
      order: 0,
      name: controller.translations.newRound,
      description: '',
      type: PackageRoundType.simple,
      themes: [],
    );

    controller.addRound(newRound);
  }

  Future<void> _confirmDeleteRound(
    BuildContext context,
    OqEditorController controller,
    int index,
  ) async {
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
            Icons.interests_outlined,
            size: 64,
            color: Theme.of(context).colorScheme.outline,
          ),
          const SizedBox(height: 16),
          Text(
            translations.noRounds,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
              color: Theme.of(context).colorScheme.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            translations.addFirstRound,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: Theme.of(context).colorScheme.onSurfaceVariant,
            ),
          ),
        ],
      ),
    );
  }
}
