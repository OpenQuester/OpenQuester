import 'package:flutter/foundation.dart';
import 'package:openapi/openapi.dart';
import 'package:oq_editor/models/editor_step.dart';
import 'package:oq_editor/models/oq_editor_translations.dart';
import 'package:oq_editor/utils/extensions.dart';

class OqEditorController {
  OqEditorController({
    required this.translations,
    OqPackage? initialPackage,
  }) {
    package.value = initialPackage ?? OqPackageX.empty;
  }

  /// Translation provider injected from parent app
  final OqEditorTranslations translations;

  /// Current package being edited
  final ValueNotifier<OqPackage> package = ValueNotifier<OqPackage>(
    OqPackageX.empty,
  );

  /// Current step in the editor workflow
  final ValueNotifier<EditorStep> currentStep = ValueNotifier<EditorStep>(
    EditorStep.packageInfo,
  );

  /// Navigation context tracking which round/theme/question is being edited
  final ValueNotifier<EditorNavigationContext> navigationContext =
      ValueNotifier<EditorNavigationContext>(
        EditorNavigationContext(),
      );

  // Navigation methods

  /// Navigate to package info screen
  void navigateToPackageInfo() {
    currentStep.value = EditorStep.packageInfo;
    navigationContext.value = navigationContext.value.toPackageLevel();
  }

  /// Navigate to rounds list screen
  void navigateToRoundsList() {
    currentStep.value = EditorStep.roundsList;
    navigationContext.value = navigationContext.value.toRoundsLevel();
  }

  /// Navigate to round editor for specific round
  void navigateToRoundEditor(int roundIndex) {
    currentStep.value = EditorStep.roundEditor;
    navigationContext.value = navigationContext.value.toRoundLevel(roundIndex);
  }

  /// Navigate to themes grid for specific round
  void navigateToThemesGrid(int roundIndex) {
    currentStep.value = EditorStep.themesGrid;
    navigationContext.value = navigationContext.value.toThemesLevel(roundIndex);
  }

  /// Navigate to theme editor for specific theme
  void navigateToThemeEditor(int roundIndex, int themeIndex) {
    currentStep.value = EditorStep.themeEditor;
    navigationContext.value = navigationContext.value.toThemeLevel(
      roundIndex,
      themeIndex,
    );
  }

  /// Navigate to questions list for specific theme
  void navigateToQuestionsList(int roundIndex, int themeIndex) {
    currentStep.value = EditorStep.questionsList;
    navigationContext.value = navigationContext.value.toThemeLevel(
      roundIndex,
      themeIndex,
    );
  }

  /// Navigate back one step
  void navigateBack() {
    switch (currentStep.value) {
      case EditorStep.packageInfo:
        // Already at root, do nothing or close editor
        break;
      case EditorStep.roundsList:
        navigateToPackageInfo();
      case EditorStep.roundEditor:
        navigateToRoundsList();
      case EditorStep.themesGrid:
        final roundIndex = navigationContext.value.roundIndex;
        if (roundIndex != null) {
          navigateToRoundEditor(roundIndex);
        }
      case EditorStep.themeEditor:
        final roundIndex = navigationContext.value.roundIndex;
        if (roundIndex != null) {
          navigateToThemesGrid(roundIndex);
        }
      case EditorStep.questionsList:
        final roundIndex = navigationContext.value.roundIndex;
        final themeIndex = navigationContext.value.themeIndex;
        if (roundIndex != null && themeIndex != null) {
          navigateToThemeEditor(roundIndex, themeIndex);
        }
    }
  }

  // Package modification methods

  /// Update package basic info
  void updatePackageInfo({
    String? title,
    String? description,
    AgeRestriction? ageRestriction,
    String? language,
    List<PackageTag>? tags,
  }) {
    package.value = package.value.copyWith(
      title: title ?? package.value.title,
      description: description ?? package.value.description,
      ageRestriction: ageRestriction ?? package.value.ageRestriction,
      language: language ?? package.value.language,
      tags: tags ?? package.value.tags,
    );
  }

  // Round CRUD operations

  /// Add a new round
  void addRound(PackageRound round) {
    final updatedRounds = List<PackageRound>.from(package.value.rounds)
      ..add(round);
    package.value = package.value.copyWith(rounds: updatedRounds);
  }

  /// Update an existing round
  void updateRound(int index, PackageRound round) {
    if (index < 0 || index >= package.value.rounds.length) return;
    final updatedRounds = List<PackageRound>.from(package.value.rounds);
    updatedRounds[index] = round;
    package.value = package.value.copyWith(rounds: updatedRounds);
  }

  /// Delete a round
  void deleteRound(int index) {
    if (index < 0 || index >= package.value.rounds.length) return;
    final updatedRounds = List<PackageRound>.from(package.value.rounds)
      ..removeAt(index);
    package.value = package.value.copyWith(rounds: updatedRounds);
  }

  /// Reorder rounds
  void reorderRounds(int oldIndex, int newIndex) {
    if (oldIndex == newIndex) return;
    final updatedRounds = List<PackageRound>.from(package.value.rounds);
    final round = updatedRounds.removeAt(oldIndex);
    updatedRounds.insert(newIndex, round);
    package.value = package.value.copyWith(rounds: updatedRounds);
  }

  // Theme CRUD operations

  /// Add a new theme to a round
  void addTheme(int roundIndex, PackageTheme theme) {
    if (roundIndex < 0 || roundIndex >= package.value.rounds.length) return;
    final round = package.value.rounds[roundIndex];
    final updatedThemes = List<PackageTheme>.from(round.themes)..add(theme);
    updateRound(roundIndex, round.copyWith(themes: updatedThemes));
  }

  /// Update a theme in a round
  void updateTheme(int roundIndex, int themeIndex, PackageTheme theme) {
    if (roundIndex < 0 || roundIndex >= package.value.rounds.length) return;
    final round = package.value.rounds[roundIndex];
    if (themeIndex < 0 || themeIndex >= round.themes.length) return;
    final updatedThemes = List<PackageTheme>.from(round.themes);
    updatedThemes[themeIndex] = theme;
    updateRound(roundIndex, round.copyWith(themes: updatedThemes));
  }

  /// Delete a theme from a round
  void deleteTheme(int roundIndex, int themeIndex) {
    if (roundIndex < 0 || roundIndex >= package.value.rounds.length) return;
    final round = package.value.rounds[roundIndex];
    if (themeIndex < 0 || themeIndex >= round.themes.length) return;
    final updatedThemes = List<PackageTheme>.from(round.themes)
      ..removeAt(themeIndex);
    updateRound(roundIndex, round.copyWith(themes: updatedThemes));
  }

  /// Reorder themes in a round
  void reorderThemes(int roundIndex, int oldIndex, int newIndex) {
    if (oldIndex == newIndex) return;
    if (roundIndex < 0 || roundIndex >= package.value.rounds.length) return;
    final round = package.value.rounds[roundIndex];
    final updatedThemes = List<PackageTheme>.from(round.themes);
    final theme = updatedThemes.removeAt(oldIndex);
    updatedThemes.insert(newIndex, theme);
    updateRound(roundIndex, round.copyWith(themes: updatedThemes));
  }

  // Question CRUD operations

  /// Add a new question to a theme
  void addQuestion(
    int roundIndex,
    int themeIndex,
    PackageQuestionUnion question,
  ) {
    if (roundIndex < 0 || roundIndex >= package.value.rounds.length) return;
    final round = package.value.rounds[roundIndex];
    if (themeIndex < 0 || themeIndex >= round.themes.length) return;
    final theme = round.themes[themeIndex];
    final updatedQuestions = List<PackageQuestionUnion>.from(theme.questions)
      ..add(question);
    updateTheme(
      roundIndex,
      themeIndex,
      theme.copyWith(questions: updatedQuestions),
    );
  }

  /// Update a question in a theme
  void updateQuestion(
    int roundIndex,
    int themeIndex,
    int questionIndex,
    PackageQuestionUnion question,
  ) {
    if (roundIndex < 0 || roundIndex >= package.value.rounds.length) return;
    final round = package.value.rounds[roundIndex];
    if (themeIndex < 0 || themeIndex >= round.themes.length) return;
    final theme = round.themes[themeIndex];
    if (questionIndex < 0 || questionIndex >= theme.questions.length) return;
    final updatedQuestions = List<PackageQuestionUnion>.from(theme.questions);
    updatedQuestions[questionIndex] = question;
    updateTheme(
      roundIndex,
      themeIndex,
      theme.copyWith(questions: updatedQuestions),
    );
  }

  /// Delete a question from a theme
  void deleteQuestion(int roundIndex, int themeIndex, int questionIndex) {
    if (roundIndex < 0 || roundIndex >= package.value.rounds.length) return;
    final round = package.value.rounds[roundIndex];
    if (themeIndex < 0 || themeIndex >= round.themes.length) return;
    final theme = round.themes[themeIndex];
    if (questionIndex < 0 || questionIndex >= theme.questions.length) return;
    final updatedQuestions = List<PackageQuestionUnion>.from(theme.questions)
      ..removeAt(questionIndex);
    updateTheme(
      roundIndex,
      themeIndex,
      theme.copyWith(questions: updatedQuestions),
    );
  }

  /// Reorder questions in a theme
  void reorderQuestions(
    int roundIndex,
    int themeIndex,
    int oldIndex,
    int newIndex,
  ) {
    if (oldIndex == newIndex) return;
    if (roundIndex < 0 || roundIndex >= package.value.rounds.length) return;
    final round = package.value.rounds[roundIndex];
    if (themeIndex < 0 || themeIndex >= round.themes.length) return;
    final theme = round.themes[themeIndex];
    final updatedQuestions = List<PackageQuestionUnion>.from(theme.questions);
    final question = updatedQuestions.removeAt(oldIndex);
    updatedQuestions.insert(newIndex, question);
    updateTheme(
      roundIndex,
      themeIndex,
      theme.copyWith(questions: updatedQuestions),
    );
  }

  /// Dispose resources
  void dispose() {
    package.dispose();
    currentStep.dispose();
    navigationContext.dispose();
  }
}
