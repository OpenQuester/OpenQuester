import 'package:openapi/openapi.dart';

/// Represents the current navigation location in the editor
sealed class EditorNavigationLocation {
  const EditorNavigationLocation();
}

/// Dashboard / package overview
class DashboardLocation extends EditorNavigationLocation {
  const DashboardLocation();
}

/// Package info editing
class PackageInfoLocation extends EditorNavigationLocation {
  const PackageInfoLocation();
}

/// Rounds list view
class RoundsListLocation extends EditorNavigationLocation {
  const RoundsListLocation();
}

/// Single round editing
class RoundEditorLocation extends EditorNavigationLocation {
  const RoundEditorLocation({required this.roundIndex});
  final int roundIndex;
}

/// Themes grid for a round
class ThemesGridLocation extends EditorNavigationLocation {
  const ThemesGridLocation({required this.roundIndex});
  final int roundIndex;
}

/// Single theme editing
class ThemeEditorLocation extends EditorNavigationLocation {
  const ThemeEditorLocation({
    required this.roundIndex,
    required this.themeIndex,
  });
  final int roundIndex;
  final int themeIndex;
}

/// Questions list for a theme
class QuestionsListLocation extends EditorNavigationLocation {
  const QuestionsListLocation({
    required this.roundIndex,
    required this.themeIndex,
  });
  final int roundIndex;
  final int themeIndex;
}

/// Question editor (side panel on desktop, full screen on mobile)
class QuestionEditorLocation extends EditorNavigationLocation {
  const QuestionEditorLocation({
    required this.roundIndex,
    required this.themeIndex,
    this.questionIndex,
    this.initialQuestion,
  });
  final int roundIndex;
  final int themeIndex;
  final int? questionIndex;
  final PackageQuestionUnion? initialQuestion;
}

/// Search results view
class SearchResultsLocation extends EditorNavigationLocation {
  const SearchResultsLocation({required this.query});
  final String query;
}

/// Represents a search result item
class SearchResult {
  const SearchResult({
    required this.type,
    required this.title,
    required this.subtitle,
    required this.path,
    this.roundIndex,
    this.themeIndex,
    this.questionIndex,
  });

  final SearchResultType type;
  final String title;
  final String subtitle;
  final String path;
  final int? roundIndex;
  final int? themeIndex;
  final int? questionIndex;
}

enum SearchResultType { round, theme, question }

/// Filter options for questions
enum QuestionFilter {
  all,
  simple,
  stake,
  secret,
  noRisk,
  choice,
  hidden,
  hasMedia,
  incomplete,
}

/// View mode for lists
enum ListViewMode { compact, detailed }

/// Selected items for batch operations
class EditorSelection {
  const EditorSelection({
    this.selectedRounds = const {},
    this.selectedThemes = const {},
    this.selectedQuestions = const {},
  });

  final Set<int> selectedRounds;
  final Set<(int, int)> selectedThemes; // (roundIndex, themeIndex)
  final Set<(int, int, int)> selectedQuestions; // (round, theme, question)

  bool get hasSelection =>
      selectedRounds.isNotEmpty ||
      selectedThemes.isNotEmpty ||
      selectedQuestions.isNotEmpty;

  int get totalSelected =>
      selectedRounds.length +
      selectedThemes.length +
      selectedQuestions.length;

  EditorSelection copyWith({
    Set<int>? selectedRounds,
    Set<(int, int)>? selectedThemes,
    Set<(int, int, int)>? selectedQuestions,
  }) {
    return EditorSelection(
      selectedRounds: selectedRounds ?? this.selectedRounds,
      selectedThemes: selectedThemes ?? this.selectedThemes,
      selectedQuestions: selectedQuestions ?? this.selectedQuestions,
    );
  }

  EditorSelection clear() {
    return const EditorSelection();
  }
}
