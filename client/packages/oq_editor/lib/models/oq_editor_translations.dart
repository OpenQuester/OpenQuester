/// Abstract interface for translations used by OqEditor.
///
/// Implement this interface in the parent app to provide
/// localized strings from your preferred i18n solution.
abstract class OqEditorTranslations {
  /// Title displayed in the editor app bar
  String get editorTitle;

  /// Label for save button
  String get saveButton;

  /// Label for cancel button
  String get cancelButton;

  /// Label for close button
  String get closeButton;

  /// Label for next button
  String get nextButton;

  /// Label for back button
  String get backButton;

  /// Label for add button
  String get addButton;

  /// Label for edit button
  String get editButton;

  /// Label for delete button
  String get deleteButton;

  /// Package info section
  String get packageInfo;
  String get packageTitle;
  String get packageDescription;
  String get packageLanguage;
  String get packageAgeRestriction;
  String get packageTags;

  /// Rounds section
  String get rounds;
  String get roundName;
  String get roundDescription;
  String get roundType;
  String get addRound;
  String get editRound;
  String get noRounds;

  /// Themes section
  String get themes;
  String get themeName;
  String get themeDescription;
  String get addTheme;
  String get editTheme;
  String get noThemes;

  /// Questions section
  String get questions;
  String get questionText;
  String get questionPrice;
  String get questionAnswer;
  String get addQuestion;
  String get editQuestion;
  String get noQuestions;

  /// Validation messages
  String get fieldRequired;
  String minLengthError(int length);
  String maxLengthError(int length);

  /// Confirm dialogs
  String get deleteConfirmTitle;
  String deleteConfirmMessage(String itemName);
}
