/// Represents the current step/screen in the package editor workflow
enum EditorStep {
  /// Main package information (title, description, age
  /// restriction, language, tags)
  packageInfo,

  /// List of rounds in the package
  roundsList,

  /// Editing a specific round
  roundEditor,

  /// Grid view of themes within a round
  themesGrid,

  /// Editing a specific theme
  themeEditor,

  /// List of questions within a theme
  questionsList,
}

/// Navigation context for the editor
/// Tracks which round/theme/question is being edited
class EditorNavigationContext {
  EditorNavigationContext({
    this.roundIndex,
    this.themeIndex,
    this.questionIndex,
  });

  /// Index of the currently selected round (null if none selected)
  final int? roundIndex;

  /// Index of the currently selected theme (null if none selected)
  final int? themeIndex;

  /// Index of the currently selected question (null if none selected)
  final int? questionIndex;

  EditorNavigationContext copyWith({
    int? roundIndex,
    int? themeIndex,
    int? questionIndex,
  }) {
    return EditorNavigationContext(
      roundIndex: roundIndex ?? this.roundIndex,
      themeIndex: themeIndex ?? this.themeIndex,
      questionIndex: questionIndex ?? this.questionIndex,
    );
  }

  /// Reset to package info level
  EditorNavigationContext toPackageLevel() {
    return EditorNavigationContext();
  }

  /// Reset to rounds list level
  EditorNavigationContext toRoundsLevel() {
    return EditorNavigationContext();
  }

  /// Reset to specific round level
  EditorNavigationContext toRoundLevel(int roundIndex) {
    return EditorNavigationContext(roundIndex: roundIndex);
  }

  /// Reset to themes grid level
  EditorNavigationContext toThemesLevel(int roundIndex) {
    return EditorNavigationContext(roundIndex: roundIndex);
  }

  /// Reset to specific theme level
  EditorNavigationContext toThemeLevel(int roundIndex, int themeIndex) {
    return EditorNavigationContext(
      roundIndex: roundIndex,
      themeIndex: themeIndex,
    );
  }
}
