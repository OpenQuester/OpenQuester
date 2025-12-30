import 'package:flutter/material.dart';
import 'package:openapi/openapi.dart';
import 'package:oq_editor/models/oq_editor_translations.dart';

/// Search result item with context path
class PackageSearchResult {
  PackageSearchResult({
    required this.type,
    required this.text,
    required this.roundIndex,
    required this.roundName,
    this.themeIndex,
    this.themeName,
    this.questionIndex,
    this.matchedAnswer,
  });

  final SearchResultType type;
  final String text;
  final int roundIndex;
  final String roundName;
  final int? themeIndex;
  final String? themeName;
  final int? questionIndex;
  final String? matchedAnswer;
}

enum SearchResultType {
  round,
  theme,
  question,
}

/// Search delegate for package content
class PackageSearchDelegate extends SearchDelegate<PackageSearchResult?> {
  PackageSearchDelegate({
    required this.package,
    required this.translations,
    required this.onNavigate,
  });

  final OqPackage package;
  final OqEditorTranslations translations;
  final void Function(int roundIndex, int? themeIndex, int? questionIndex)
      onNavigate;

  @override
  String get searchFieldLabel => translations.searchPlaceholder;

  @override
  List<Widget> buildActions(BuildContext context) {
    return [
      if (query.isNotEmpty)
        IconButton(
          icon: const Icon(Icons.clear),
          onPressed: () {
            query = '';
            showSuggestions(context);
          },
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
    final results = _searchPackage(query);

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
              'Nothing found',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
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
          query: query,
          translations: translations,
          onTap: () {
            close(context, result);
            onNavigate(
              result.roundIndex,
              result.themeIndex,
              result.questionIndex,
            );
          },
        );
      },
    );
  }

  @override
  Widget buildSuggestions(BuildContext context) {
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
              translations.searchPlaceholder,
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
            ),
          ],
        ),
      );
    }

    return buildResults(context);
  }

  List<PackageSearchResult> _searchPackage(String searchQuery) {
    if (searchQuery.isEmpty) return [];

    final results = <PackageSearchResult>[];
    final lowerQuery = searchQuery.toLowerCase();

    for (var roundIndex = 0;
        roundIndex < package.rounds.length;
        roundIndex++) {
      final round = package.rounds[roundIndex];

      // Search in round name
      if (round.name.toLowerCase().contains(lowerQuery)) {
        results.add(
          PackageSearchResult(
            type: SearchResultType.round,
            text: round.name,
            roundIndex: roundIndex,
            roundName: round.name,
          ),
        );
      }

      for (var themeIndex = 0;
          themeIndex < round.themes.length;
          themeIndex++) {
        final theme = round.themes[themeIndex];

        // Search in theme name
        if (theme.name.toLowerCase().contains(lowerQuery)) {
          results.add(
            PackageSearchResult(
              type: SearchResultType.theme,
              text: theme.name,
              roundIndex: roundIndex,
              roundName: round.name,
              themeIndex: themeIndex,
              themeName: theme.name,
            ),
          );
        }

        for (var questionIndex = 0;
            questionIndex < theme.questions.length;
            questionIndex++) {
          final question = theme.questions[questionIndex];

          // Search in question text
          final questionText = question.map(
            simple: (q) => q.text ?? '',
            stake: (q) => q.text ?? '',
            secret: (q) => q.text ?? '',
            noRisk: (q) => q.text ?? '',
            hidden: (q) => q.text ?? '',
            choice: (q) => q.text ?? '',
          );

          // Search in answer text
          final answerText = question.map(
            simple: (q) => q.answer?.answer ?? '',
            stake: (q) => q.answer?.answer ?? '',
            secret: (q) => q.answer?.answer ?? '',
            noRisk: (q) => q.answer?.answer ?? '',
            hidden: (q) => q.answer?.answer ?? '',
            choice: (q) => q.answer?.answer ?? '',
          );

          final questionMatches =
              questionText.toLowerCase().contains(lowerQuery);
          final answerMatches = answerText.toLowerCase().contains(lowerQuery);

          if (questionMatches || answerMatches) {
            results.add(
              PackageSearchResult(
                type: SearchResultType.question,
                text: questionText,
                roundIndex: roundIndex,
                roundName: round.name,
                themeIndex: themeIndex,
                themeName: theme.name,
                questionIndex: questionIndex,
                matchedAnswer: answerMatches ? answerText : null,
              ),
            );
          }
        }
      }
    }

    return results;
  }
}

class _SearchResultTile extends StatelessWidget {
  const _SearchResultTile({
    required this.result,
    required this.query,
    required this.translations,
    required this.onTap,
  });

  final PackageSearchResult result;
  final String query;
  final OqEditorTranslations translations;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    IconData icon;
    String title;
    String subtitle;

    switch (result.type) {
      case SearchResultType.round:
        icon = Icons.interests_outlined;
        title = result.text;
        subtitle = translations.rounds;
      case SearchResultType.theme:
        icon = Icons.dashboard_outlined;
        title = result.text;
        subtitle = '${translations.inRound(result.roundName)}';
      case SearchResultType.question:
        icon = Icons.quiz_outlined;
        title = result.text;
        subtitle =
            '${result.roundName} › ${result.themeName ?? ''}'
            '${result.matchedAnswer != null ? ' • ${translations.answer}: ${result.matchedAnswer}' : ''}';
    }

    return ListTile(
      leading: Icon(icon),
      title: Text(
        title,
        maxLines: 2,
        overflow: TextOverflow.ellipsis,
      ),
      subtitle: Text(
        subtitle,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: Theme.of(context).textTheme.bodySmall?.copyWith(
          color: Theme.of(context).colorScheme.onSurfaceVariant,
        ),
      ),
      onTap: onTap,
    );
  }
}
