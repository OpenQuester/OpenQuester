import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';
import 'package:oq_editor/controllers/editor_navigation_controller.dart';
import 'package:oq_editor/controllers/oq_editor_controller.dart';
import 'package:oq_editor/models/editor_navigation_state.dart';
import 'package:watch_it/watch_it.dart';

/// Global search widget for the editor
class EditorSearchBar extends WatchingWidget {
  const EditorSearchBar({super.key});

  @override
  Widget build(BuildContext context) {
    final navController = watchIt<EditorNavigationController>();
    final editorController = GetIt.I<OqEditorController>();
    final package = watchValue((OqEditorController c) => c.package);

    return SearchAnchor(
      viewHintText: 'Search questions, themes, rounds...',
      viewLeading: IconButton(
        icon: const Icon(Icons.arrow_back),
        onPressed: () => Navigator.of(context).pop(),
      ),
      builder: (context, controller) {
        return SearchBar(
          controller: controller,
          hintText: 'Search...',
          leading: const Padding(
            padding: EdgeInsets.only(left: 8),
            child: Icon(Icons.search, size: 20),
          ),
          trailing: [
            if (navController.searchQuery.isNotEmpty)
              IconButton(
                icon: const Icon(Icons.clear, size: 20),
                onPressed: () {
                  controller.clear();
                  navController.clearSearch();
                },
              ),
          ],
          onTap: () => controller.openView(),
          onChanged: (value) {
            navController.setSearchQuery(value, package);
          },
          constraints: const BoxConstraints(
            maxWidth: 400,
            minHeight: 40,
            maxHeight: 40,
          ),
        );
      },
      suggestionsBuilder: (context, controller) {
        navController.setSearchQuery(controller.text, package);
        final results = navController.searchResults;

        if (controller.text.isEmpty) {
          return [
            const ListTile(
              leading: Icon(Icons.lightbulb_outline),
              title: Text('Search tips'),
              subtitle: Text(
                'Search for questions, answers, theme names, or round names',
              ),
            ),
          ];
        }

        if (results.isEmpty) {
          return [
            ListTile(
              leading: const Icon(Icons.search_off),
              title: const Text('No results found'),
              subtitle: Text('No matches for "${controller.text}"'),
            ),
          ];
        }

        return results.map((result) {
          return _SearchResultTile(
            result: result,
            onTap: () {
              controller.closeView(result.title);
              _navigateToResult(navController, result);
            },
          );
        }).toList();
      },
    );
  }

  void _navigateToResult(
    EditorNavigationController navController,
    SearchResult result,
  ) {
    switch (result.type) {
      case SearchResultType.round:
        navController.navigateTo(
          ThemesGridLocation(roundIndex: result.roundIndex!),
        );
      case SearchResultType.theme:
        navController.navigateTo(
          QuestionsListLocation(
            roundIndex: result.roundIndex!,
            themeIndex: result.themeIndex!,
          ),
        );
      case SearchResultType.question:
        navController.navigateTo(
          QuestionsListLocation(
            roundIndex: result.roundIndex!,
            themeIndex: result.themeIndex!,
          ),
        );
        // Open the question editor
        navController.openQuestionEditor(
          roundIndex: result.roundIndex!,
          themeIndex: result.themeIndex!,
          questionIndex: result.questionIndex,
        );
    }
  }
}

class _SearchResultTile extends StatelessWidget {
  const _SearchResultTile({
    required this.result,
    required this.onTap,
  });

  final SearchResult result;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final (icon, color) = _getIconAndColor(context);

    return ListTile(
      leading: Container(
        width: 40,
        height: 40,
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Icon(icon, color: color, size: 20),
      ),
      title: Text(
        result.title,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              fontWeight: FontWeight.w500,
            ),
      ),
      subtitle: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (result.subtitle.isNotEmpty)
            Text(
              result.subtitle,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.bodySmall,
            ),
          Text(
            result.path,
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: Theme.of(context).colorScheme.outline,
                ),
          ),
        ],
      ),
      onTap: onTap,
    );
  }

  (IconData, Color) _getIconAndColor(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    switch (result.type) {
      case SearchResultType.round:
        return (Icons.folder_outlined, scheme.primary);
      case SearchResultType.theme:
        return (Icons.category_outlined, scheme.secondary);
      case SearchResultType.question:
        return (Icons.quiz_outlined, scheme.tertiary);
    }
  }
}

/// Compact search button for mobile
class EditorSearchButton extends StatelessWidget {
  const EditorSearchButton({super.key});

  @override
  Widget build(BuildContext context) {
    return IconButton(
      icon: const Icon(Icons.search),
      tooltip: 'Search',
      onPressed: () {
        showSearch(
          context: context,
          delegate: _EditorSearchDelegate(),
        );
      },
    );
  }
}

class _EditorSearchDelegate extends SearchDelegate<SearchResult?> {
  @override
  String get searchFieldLabel => 'Search questions, themes, rounds...';

  @override
  List<Widget> buildActions(BuildContext context) {
    return [
      if (query.isNotEmpty)
        IconButton(
          icon: const Icon(Icons.clear),
          onPressed: () => query = '',
        ),
    ];
  }

  @override
  Widget buildLeading(BuildContext context) {
    return IconButton(
      icon: const Icon(Icons.arrow_back),
      onPressed: () => close(context, null),
    );
  }

  @override
  Widget buildResults(BuildContext context) {
    return _buildSearchResults(context);
  }

  @override
  Widget buildSuggestions(BuildContext context) {
    return _buildSearchResults(context);
  }

  Widget _buildSearchResults(BuildContext context) {
    if (query.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.search,
              size: 64,
              color: Theme.of(context).colorScheme.outline,
            ),
            const SizedBox(height: 16),
            Text(
              'Search for questions, themes, or rounds',
              style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                    color: Theme.of(context).colorScheme.outline,
                  ),
            ),
          ],
        ),
      );
    }

    final navController = GetIt.I<EditorNavigationController>();
    final editorController = GetIt.I<OqEditorController>();
    navController.setSearchQuery(query, editorController.package.value);
    final results = navController.searchResults;

    if (results.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.search_off,
              size: 64,
              color: Theme.of(context).colorScheme.outline,
            ),
            const SizedBox(height: 16),
            Text(
              'No results for "$query"',
              style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                    color: Theme.of(context).colorScheme.outline,
                  ),
            ),
          ],
        ),
      );
    }

    return ListView.builder(
      itemCount: results.length,
      itemBuilder: (context, index) {
        final result = results[index];
        return _SearchResultTile(
          result: result,
          onTap: () {
            close(context, result);
            _navigateToResult(navController, result);
          },
        );
      },
    );
  }

  void _navigateToResult(
    EditorNavigationController navController,
    SearchResult result,
  ) {
    switch (result.type) {
      case SearchResultType.round:
        navController.navigateTo(
          ThemesGridLocation(roundIndex: result.roundIndex!),
        );
      case SearchResultType.theme:
        navController.navigateTo(
          QuestionsListLocation(
            roundIndex: result.roundIndex!,
            themeIndex: result.themeIndex!,
          ),
        );
      case SearchResultType.question:
        navController.navigateTo(
          QuestionsListLocation(
            roundIndex: result.roundIndex!,
            themeIndex: result.themeIndex!,
          ),
        );
        navController.openQuestionEditor(
          roundIndex: result.roundIndex!,
          themeIndex: result.themeIndex!,
          questionIndex: result.questionIndex,
        );
    }
  }
}
