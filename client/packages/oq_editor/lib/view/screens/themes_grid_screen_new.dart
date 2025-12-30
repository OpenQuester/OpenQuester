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

/// Redesigned themes grid screen with compact cards
@RoutePage()
class ThemesGridScreenNew extends StatelessWidget with WatchItMixin {
  const ThemesGridScreenNew({
    @pathParam required this.roundIndex,
    super.key,
  });

  final int roundIndex;

  @override
  Widget build(BuildContext context) {
    final controller = GetIt.I<OqEditorController>();
    final package = watchValue((OqEditorController c) => c.package);
    final translations = controller.translations;

    if (roundIndex >= package.rounds.length) {
      return Scaffold(
        body: Center(
          child: Text(translations.invalidRound),
        ),
      );
    }

    final round = package.rounds[roundIndex];
    final themes = round.themes;

    return Scaffold(
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Breadcrumb navigation
          EditorBreadcrumb(
            translations: translations,
            package: package,
            roundIndex: roundIndex,
            onNavigateToPackage: () {
              context.router.popUntil(
                (route) => route.settings.name == PackageInfoRoute.name,
              );
            },
            onNavigateToRound: () {
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
                        translations.themes,
                        style: Theme.of(context).textTheme.headlineSmall
                            ?.copyWith(fontWeight: FontWeight.w600),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        round.name,
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: Theme.of(context).colorScheme.onSurfaceVariant,
                        ),
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
                // Add theme button
                IconButton(
                  icon: const Icon(Icons.add),
                  onPressed: () => _addNewTheme(context, controller, roundIndex),
                  tooltip: translations.addTheme,
                ),
              ],
            ),
          ),

          // Themes list or empty state
          Expanded(
            child: themes.isEmpty
                ? _EmptyState(translations: translations)
                : ListView.builder(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    itemCount: themes.length,
                    itemBuilder: (context, index) {
                      final theme = themes[index];
                      final questionCount = theme.questions.length;
                      final filledQuestions = theme.questions
                          .where((q) {
                            final hasText = q.map(
                              simple: (qq) => qq.text?.isNotEmpty ?? false,
                              stake: (qq) => qq.text?.isNotEmpty ?? false,
                              secret: (qq) => qq.text?.isNotEmpty ?? false,
                              noRisk: (qq) => qq.text?.isNotEmpty ?? false,
                              hidden: (qq) => qq.text?.isNotEmpty ?? false,
                              choice: (qq) => qq.text?.isNotEmpty ?? false,
                            );
                            return hasText;
                          })
                          .length;

                      return EditorItemCard(
                        key: ValueKey(theme.id ?? index),
                        title: theme.name,
                        subtitle: theme.description?.isNotEmpty ?? false
                            ? theme.description
                            : null,
                        depthLevel: 1,
                        trailing: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            CompletionBadge(
                              filled: filledQuestions,
                              total: questionCount,
                              label: translations.questions,
                            ),
                            const SizedBox(width: 8),
                            IconButton(
                              icon: const Icon(Icons.delete_outline, size: 20),
                              onPressed: () =>
                                  _confirmDeleteTheme(context, controller, roundIndex, index),
                              tooltip: translations.deleteButton,
                              padding: EdgeInsets.zero,
                              constraints: const BoxConstraints(),
                            ),
                          ],
                        ),
                        onTap: () => context.router.push(
                          QuestionsListRoute(
                            roundIndex: roundIndex,
                            themeIndex: index,
                          ),
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
                                    ThemeEditorRoute(
                                      roundIndex: roundIndex,
                                      themeIndex: index,
                                    ),
                                  ),
                                  icon: const Icon(Icons.edit_outlined, size: 16),
                                  label: Text(translations.editTheme),
                                  style: TextButton.styleFrom(
                                    alignment: Alignment.centerLeft,
                                  ),
                                ),
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: TextButton.icon(
                                  onPressed: () => context.router.push(
                                    QuestionsListRoute(
                                      roundIndex: roundIndex,
                                      themeIndex: index,
                                    ),
                                  ),
                                  icon: const Icon(Icons.quiz_outlined, size: 16),
                                  label: Text(translations.questions),
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
          }
        },
      ),
    );
  }

  void _addNewTheme(
    BuildContext context,
    OqEditorController controller,
    int roundIndex,
  ) {
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
    OqEditorController controller,
    int roundIndex,
    int themeIndex,
  ) async {
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
            Icons.dashboard_outlined,
            size: 64,
            color: Theme.of(context).colorScheme.outline,
          ),
          const SizedBox(height: 16),
          Text(
            translations.noThemes,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
              color: Theme.of(context).colorScheme.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            translations.addFirstTheme,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: Theme.of(context).colorScheme.onSurfaceVariant,
            ),
          ),
        ],
      ),
    );
  }
}
