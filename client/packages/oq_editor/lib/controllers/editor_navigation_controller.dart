import 'package:flutter/material.dart';
import 'package:openapi/openapi.dart';
import 'package:oq_editor/models/editor_navigation_state.dart';

/// Controller for managing editor navigation and state
class EditorNavigationController extends ChangeNotifier {
  EditorNavigationController();

  /// Current navigation location
  EditorNavigationLocation _location = const DashboardLocation();
  EditorNavigationLocation get location => _location;

  /// Navigation history for breadcrumb
  final List<EditorNavigationLocation> _history = [];
  List<EditorNavigationLocation> get history => List.unmodifiable(_history);

  /// Search query
  String _searchQuery = '';
  String get searchQuery => _searchQuery;

  /// Search results
  List<SearchResult> _searchResults = [];
  List<SearchResult> get searchResults => List.unmodifiable(_searchResults);

  /// Current question filter
  QuestionFilter _questionFilter = QuestionFilter.all;
  QuestionFilter get questionFilter => _questionFilter;

  /// List view mode
  ListViewMode _listViewMode = ListViewMode.detailed;
  ListViewMode get listViewMode => _listViewMode;

  /// Selection state for batch operations
  EditorSelection _selection = const EditorSelection();
  EditorSelection get selection => _selection;

  /// Whether selection mode is active
  bool _selectionModeActive = false;
  bool get selectionModeActive => _selectionModeActive;

  /// Whether sidebar is expanded (desktop)
  bool _sidebarExpanded = true;
  bool get sidebarExpanded => _sidebarExpanded;

  /// Currently editing question in side panel (null = panel closed)
  QuestionEditorLocation? _questionEditorPanel;
  QuestionEditorLocation? get questionEditorPanel => _questionEditorPanel;

  /// Navigate to a new location
  void navigateTo(EditorNavigationLocation newLocation) {
    if (_location != newLocation) {
      _history.add(_location);
      _location = newLocation;
      notifyListeners();
    }
  }

  /// Navigate back in history
  bool navigateBack() {
    if (_history.isNotEmpty) {
      _location = _history.removeLast();
      notifyListeners();
      return true;
    }
    return false;
  }

  /// Navigate directly to a location (clears history after that point)
  void navigateToFromBreadcrumb(int historyIndex) {
    if (historyIndex < _history.length) {
      _location = _history[historyIndex];
      _history.removeRange(historyIndex, _history.length);
      notifyListeners();
    }
  }

  /// Set search query and perform search
  void setSearchQuery(String query, OqPackage package) {
    _searchQuery = query;
    if (query.isEmpty) {
      _searchResults = [];
    } else {
      _searchResults = _performSearch(query, package);
    }
    notifyListeners();
  }

  /// Clear search
  void clearSearch() {
    _searchQuery = '';
    _searchResults = [];
    notifyListeners();
  }

  /// Set question filter
  void setQuestionFilter(QuestionFilter filter) {
    _questionFilter = filter;
    notifyListeners();
  }

  /// Toggle list view mode
  void toggleListViewMode() {
    _listViewMode = _listViewMode == ListViewMode.compact
        ? ListViewMode.detailed
        : ListViewMode.compact;
    notifyListeners();
  }

  /// Set list view mode
  void setListViewMode(ListViewMode mode) {
    _listViewMode = mode;
    notifyListeners();
  }

  /// Toggle sidebar
  void toggleSidebar() {
    _sidebarExpanded = !_sidebarExpanded;
    notifyListeners();
  }

  /// Set sidebar expanded state
  void setSidebarExpanded(bool expanded) {
    _sidebarExpanded = expanded;
    notifyListeners();
  }

  /// Toggle selection mode
  void toggleSelectionMode() {
    _selectionModeActive = !_selectionModeActive;
    if (!_selectionModeActive) {
      _selection = const EditorSelection();
    }
    notifyListeners();
  }

  /// Exit selection mode
  void exitSelectionMode() {
    _selectionModeActive = false;
    _selection = const EditorSelection();
    notifyListeners();
  }

  /// Toggle round selection
  void toggleRoundSelection(int roundIndex) {
    final newSet = Set<int>.from(_selection.selectedRounds);
    if (newSet.contains(roundIndex)) {
      newSet.remove(roundIndex);
    } else {
      newSet.add(roundIndex);
    }
    _selection = _selection.copyWith(selectedRounds: newSet);
    notifyListeners();
  }

  /// Toggle theme selection
  void toggleThemeSelection(int roundIndex, int themeIndex) {
    final newSet = Set<(int, int)>.from(_selection.selectedThemes);
    final key = (roundIndex, themeIndex);
    if (newSet.contains(key)) {
      newSet.remove(key);
    } else {
      newSet.add(key);
    }
    _selection = _selection.copyWith(selectedThemes: newSet);
    notifyListeners();
  }

  /// Toggle question selection
  void toggleQuestionSelection(
    int roundIndex,
    int themeIndex,
    int questionIndex,
  ) {
    final newSet = Set<(int, int, int)>.from(_selection.selectedQuestions);
    final key = (roundIndex, themeIndex, questionIndex);
    if (newSet.contains(key)) {
      newSet.remove(key);
    } else {
      newSet.add(key);
    }
    _selection = _selection.copyWith(selectedQuestions: newSet);
    notifyListeners();
  }

  /// Clear selection
  void clearSelection() {
    _selection = const EditorSelection();
    notifyListeners();
  }

  /// Open question editor side panel
  void openQuestionEditor({
    required int roundIndex,
    required int themeIndex,
    int? questionIndex,
    PackageQuestionUnion? initialQuestion,
  }) {
    _questionEditorPanel = QuestionEditorLocation(
      roundIndex: roundIndex,
      themeIndex: themeIndex,
      questionIndex: questionIndex,
      initialQuestion: initialQuestion,
    );
    notifyListeners();
  }

  /// Close question editor side panel
  void closeQuestionEditor() {
    _questionEditorPanel = null;
    notifyListeners();
  }

  /// Perform search across package
  List<SearchResult> _performSearch(String query, OqPackage package) {
    final results = <SearchResult>[];
    final lowerQuery = query.toLowerCase();

    for (var roundIndex = 0; roundIndex < package.rounds.length; roundIndex++) {
      final round = package.rounds[roundIndex];

      // Search in round name
      if (round.name.toLowerCase().contains(lowerQuery)) {
        results.add(SearchResult(
          type: SearchResultType.round,
          title: round.name,
          subtitle: '${round.themes.length} themes',
          path: 'Round ${roundIndex + 1}',
          roundIndex: roundIndex,
        ));
      }

      for (var themeIndex = 0;
          themeIndex < round.themes.length;
          themeIndex++) {
        final theme = round.themes[themeIndex];

        // Search in theme name
        if (theme.name.toLowerCase().contains(lowerQuery)) {
          results.add(SearchResult(
            type: SearchResultType.theme,
            title: theme.name,
            subtitle: '${theme.questions.length} questions',
            path: 'Round ${roundIndex + 1} → ${theme.name}',
            roundIndex: roundIndex,
            themeIndex: themeIndex,
          ));
        }

        for (var questionIndex = 0;
            questionIndex < theme.questions.length;
            questionIndex++) {
          final question = theme.questions[questionIndex];

          // Get question text and answer
          final questionText = question.map(
            simple: (q) => q.text ?? '',
            stake: (q) => q.text ?? '',
            secret: (q) => q.text ?? '',
            noRisk: (q) => q.text ?? '',
            choice: (q) => q.text ?? '',
            hidden: (q) => q.text ?? '',
          );

          final answerText = question.map(
            simple: (q) => q.answerText ?? '',
            stake: (q) => q.answerText ?? '',
            secret: (q) => q.answerText ?? '',
            noRisk: (q) => q.answerText ?? '',
            choice: (_) => '',
            hidden: (q) => q.answerText ?? '',
          );

          // Search in question text or answer
          if (questionText.toLowerCase().contains(lowerQuery) ||
              answerText.toLowerCase().contains(lowerQuery)) {
            final price = question.map(
              simple: (q) => q.price,
              stake: (q) => q.price,
              secret: (q) => q.price,
              noRisk: (q) => q.price,
              choice: (q) => q.price,
              hidden: (q) => q.price,
            );

            results.add(SearchResult(
              type: SearchResultType.question,
              title: questionText.isEmpty ? 'Question ${questionIndex + 1}' : questionText,
              subtitle: answerText.isEmpty ? '${price ?? 0} pts' : answerText,
              path: 'Round ${roundIndex + 1} → ${theme.name} → Q${questionIndex + 1}',
              roundIndex: roundIndex,
              themeIndex: themeIndex,
              questionIndex: questionIndex,
            ));
          }
        }
      }
    }

    return results;
  }

  /// Filter questions based on current filter
  List<PackageQuestionUnion> filterQuestions(
    List<PackageQuestionUnion> questions,
  ) {
    return questions.where((q) {
      switch (_questionFilter) {
        case QuestionFilter.all:
          return true;
        case QuestionFilter.simple:
          return q is PackageQuestionUnionSimple;
        case QuestionFilter.stake:
          return q is PackageQuestionUnionStake;
        case QuestionFilter.secret:
          return q is PackageQuestionUnionSecret;
        case QuestionFilter.noRisk:
          return q is PackageQuestionUnionNoRisk;
        case QuestionFilter.choice:
          return q is PackageQuestionUnionChoice;
        case QuestionFilter.hidden:
          return q is PackageQuestionUnionHidden;
        case QuestionFilter.hasMedia:
          return _questionHasMedia(q);
        case QuestionFilter.incomplete:
          return _questionIsIncomplete(q);
      }
    }).toList();
  }

  bool _questionHasMedia(PackageQuestionUnion q) {
    final questionFiles = q.map(
      simple: (s) => s.questionFiles,
      stake: (s) => s.questionFiles,
      secret: (s) => s.questionFiles,
      noRisk: (s) => s.questionFiles,
      choice: (s) => s.questionFiles,
      hidden: (s) => s.questionFiles,
    );
    final answerFiles = q.map(
      simple: (s) => s.answerFiles,
      stake: (s) => s.answerFiles,
      secret: (s) => s.answerFiles,
      noRisk: (s) => s.answerFiles,
      choice: (s) => s.answerFiles,
      hidden: (s) => s.answerFiles,
    );
    return (questionFiles?.isNotEmpty ?? false) ||
        (answerFiles?.isNotEmpty ?? false);
  }

  bool _questionIsIncomplete(PackageQuestionUnion q) {
    final text = q.map(
      simple: (s) => s.text,
      stake: (s) => s.text,
      secret: (s) => s.text,
      noRisk: (s) => s.text,
      choice: (s) => s.text,
      hidden: (s) => s.text,
    );
    final answer = q.map(
      simple: (s) => s.answerText,
      stake: (s) => s.answerText,
      secret: (s) => s.answerText,
      noRisk: (s) => s.answerText,
      choice: (_) => 'has_choices', // Choice questions don't have answerText
      hidden: (s) => s.answerText,
    );
    return (text?.isEmpty ?? true) || (answer?.isEmpty ?? true);
  }

  @override
  void dispose() {
    super.dispose();
  }
}
