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

  // Add more translation keys as needed when implementing features
}
