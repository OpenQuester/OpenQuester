import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';
import 'package:oq_editor/controllers/editor_navigation_controller.dart';
import 'package:oq_editor/controllers/oq_editor_controller.dart';
import 'package:oq_editor/models/editor_navigation_state.dart';
import 'package:watch_it/watch_it.dart';

/// Breadcrumb navigation bar for the editor
class EditorBreadcrumb extends WatchingWidget {
  const EditorBreadcrumb({super.key});

  @override
  Widget build(BuildContext context) {
    final navController = watchIt<EditorNavigationController>();
    final editorController = GetIt.I<OqEditorController>();
    final package = watchValue((OqEditorController c) => c.package);
    final translations = editorController.translations;

    final breadcrumbs = <_BreadcrumbItem>[];

    // Always add Dashboard as first item
    breadcrumbs.add(_BreadcrumbItem(
      label: translations.packageInfo,
      icon: Icons.dashboard_outlined,
      onTap: () => navController.navigateTo(const DashboardLocation()),
      isActive: navController.location is DashboardLocation,
    ));

    // Build breadcrumbs based on current location
    final location = navController.location;

    if (location is RoundsListLocation ||
        location is RoundEditorLocation ||
        location is ThemesGridLocation ||
        location is ThemeEditorLocation ||
        location is QuestionsListLocation ||
        location is QuestionEditorLocation) {
      breadcrumbs.add(_BreadcrumbItem(
        label: translations.rounds,
        icon: Icons.layers_outlined,
        onTap: () => navController.navigateTo(const RoundsListLocation()),
        isActive: location is RoundsListLocation,
      ));
    }

    if (location is RoundEditorLocation) {
      final round = package.rounds.length > location.roundIndex
          ? package.rounds[location.roundIndex]
          : null;
      breadcrumbs.add(_BreadcrumbItem(
        label: round?.name ?? 'Round ${location.roundIndex + 1}',
        icon: Icons.folder_outlined,
        onTap: null,
        isActive: true,
      ));
    }

    if (location is ThemesGridLocation ||
        location is ThemeEditorLocation ||
        location is QuestionsListLocation ||
        location is QuestionEditorLocation) {
      final roundIndex = switch (location) {
        ThemesGridLocation l => l.roundIndex,
        ThemeEditorLocation l => l.roundIndex,
        QuestionsListLocation l => l.roundIndex,
        QuestionEditorLocation l => l.roundIndex,
        _ => 0,
      };

      final round = package.rounds.length > roundIndex
          ? package.rounds[roundIndex]
          : null;

      breadcrumbs.add(_BreadcrumbItem(
        label: round?.name ?? 'Round ${roundIndex + 1}',
        icon: Icons.folder_outlined,
        onTap: () => navController.navigateTo(
          ThemesGridLocation(roundIndex: roundIndex),
        ),
        isActive: location is ThemesGridLocation,
      ));
    }

    if (location is ThemeEditorLocation) {
      final round = package.rounds.length > location.roundIndex
          ? package.rounds[location.roundIndex]
          : null;
      final theme = round != null && round.themes.length > location.themeIndex
          ? round.themes[location.themeIndex]
          : null;

      breadcrumbs.add(_BreadcrumbItem(
        label: theme?.name ?? 'Theme ${location.themeIndex + 1}',
        icon: Icons.category_outlined,
        onTap: null,
        isActive: true,
      ));
    }

    if (location is QuestionsListLocation ||
        location is QuestionEditorLocation) {
      final roundIndex = switch (location) {
        QuestionsListLocation l => l.roundIndex,
        QuestionEditorLocation l => l.roundIndex,
        _ => 0,
      };
      final themeIndex = switch (location) {
        QuestionsListLocation l => l.themeIndex,
        QuestionEditorLocation l => l.themeIndex,
        _ => 0,
      };

      final round = package.rounds.length > roundIndex
          ? package.rounds[roundIndex]
          : null;
      final theme = round != null && round.themes.length > themeIndex
          ? round.themes[themeIndex]
          : null;

      breadcrumbs.add(_BreadcrumbItem(
        label: theme?.name ?? 'Theme ${themeIndex + 1}',
        icon: Icons.category_outlined,
        onTap: () => navController.navigateTo(
          QuestionsListLocation(roundIndex: roundIndex, themeIndex: themeIndex),
        ),
        isActive: location is QuestionsListLocation,
      ));
    }

    if (location is QuestionEditorLocation) {
      breadcrumbs.add(_BreadcrumbItem(
        label: location.questionIndex != null
            ? 'Question ${location.questionIndex! + 1}'
            : translations.addQuestion,
        icon: Icons.quiz_outlined,
        onTap: null,
        isActive: true,
      ));
    }

    if (location is SearchResultsLocation) {
      breadcrumbs.add(_BreadcrumbItem(
        label: 'Search: ${location.query}',
        icon: Icons.search,
        onTap: null,
        isActive: true,
      ));
    }

    return Container(
      height: 48,
      padding: const EdgeInsets.symmetric(horizontal: 16),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surfaceContainerLow,
        border: Border(
          bottom: BorderSide(
            color: Theme.of(context).colorScheme.outlineVariant,
          ),
        ),
      ),
      child: Row(
        children: [
          Expanded(
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  for (var i = 0; i < breadcrumbs.length; i++) ...[
                    if (i > 0) ...[
                      Icon(
                        Icons.chevron_right,
                        size: 20,
                        color: Theme.of(context).colorScheme.outline,
                      ),
                    ],
                    _BreadcrumbButton(item: breadcrumbs[i]),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _BreadcrumbItem {
  const _BreadcrumbItem({
    required this.label,
    required this.icon,
    required this.onTap,
    required this.isActive,
  });

  final String label;
  final IconData icon;
  final VoidCallback? onTap;
  final bool isActive;
}

class _BreadcrumbButton extends StatelessWidget {
  const _BreadcrumbButton({required this.item});

  final _BreadcrumbItem item;

  @override
  Widget build(BuildContext context) {
    final isClickable = item.onTap != null && !item.isActive;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: isClickable ? item.onTap : null,
        borderRadius: BorderRadius.circular(8),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                item.icon,
                size: 16,
                color: item.isActive
                    ? Theme.of(context).colorScheme.primary
                    : isClickable
                        ? Theme.of(context).colorScheme.onSurface
                        : Theme.of(context).colorScheme.outline,
              ),
              const SizedBox(width: 6),
              Text(
                item.label,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      fontWeight:
                          item.isActive ? FontWeight.w600 : FontWeight.normal,
                      color: item.isActive
                          ? Theme.of(context).colorScheme.primary
                          : isClickable
                              ? Theme.of(context).colorScheme.onSurface
                              : Theme.of(context).colorScheme.outline,
                    ),
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
