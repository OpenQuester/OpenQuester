import 'package:openquester/openquester.dart';
import 'package:oq_editor/oq_editor.dart';

class AppOqEditorTranslations implements OqEditorTranslations {
  const AppOqEditorTranslations();

  @override
  String get cancelButton => LocaleKeys.cancel.tr();

  @override
  String get closeButton => LocaleKeys.close.tr();

  @override
  String get editorTitle => LocaleKeys.package_editor.tr();

  @override
  String get saveButton => LocaleKeys.save.tr();

  @override
  String get nextButton => LocaleKeys.oq_editor_next.tr();

  @override
  String get backButton => LocaleKeys.oq_editor_back.tr();

  @override
  String get addButton => LocaleKeys.oq_editor_add.tr();

  @override
  String get editButton => LocaleKeys.oq_editor_edit.tr();

  @override
  String get deleteButton => LocaleKeys.oq_editor_delete.tr();

  @override
  String get packageInfo => LocaleKeys.oq_editor_package_info.tr();

  @override
  String get packageTitle => LocaleKeys.oq_editor_package_title.tr();

  @override
  String get packageDescription =>
      LocaleKeys.oq_editor_package_description.tr();

  @override
  String get packageLanguage => LocaleKeys.oq_editor_package_language.tr();

  @override
  String get packageAgeRestriction =>
      LocaleKeys.oq_editor_package_age_restriction.tr();

  @override
  String get packageTags => LocaleKeys.oq_editor_package_tags.tr();

  @override
  String get rounds => LocaleKeys.oq_editor_rounds.tr();

  @override
  String get roundName => LocaleKeys.oq_editor_round_name.tr();

  @override
  String get roundDescription => LocaleKeys.oq_editor_round_description.tr();

  @override
  String get roundType => LocaleKeys.oq_editor_round_type.tr();

  @override
  String get addRound => LocaleKeys.oq_editor_add_round.tr();

  @override
  String get editRound => LocaleKeys.oq_editor_edit_round.tr();

  @override
  String get noRounds => LocaleKeys.oq_editor_no_rounds.tr();

  @override
  String get themes => LocaleKeys.oq_editor_themes.tr();

  @override
  String get themeName => LocaleKeys.oq_editor_theme_name.tr();

  @override
  String get themeDescription => LocaleKeys.oq_editor_theme_description.tr();

  @override
  String get addTheme => LocaleKeys.oq_editor_add_theme.tr();

  @override
  String get editTheme => LocaleKeys.oq_editor_edit_theme.tr();

  @override
  String get noThemes => LocaleKeys.oq_editor_no_themes.tr();

  @override
  String get questions => LocaleKeys.oq_editor_questions.tr();

  @override
  String get questionText => LocaleKeys.oq_editor_question_text.tr();

  @override
  String get questionPrice => LocaleKeys.oq_editor_question_price.tr();

  @override
  String get questionAnswer => LocaleKeys.oq_editor_question_answer.tr();

  @override
  String get addQuestion => LocaleKeys.oq_editor_add_question.tr();

  @override
  String get editQuestion => LocaleKeys.oq_editor_edit_question.tr();

  @override
  String get noQuestions => LocaleKeys.oq_editor_no_questions.tr();

  @override
  String get fieldRequired => LocaleKeys.oq_editor_field_required.tr();

  @override
  String minLengthError(int length) =>
      LocaleKeys.oq_editor_min_length_error.tr(args: [length.toString()]);

  @override
  String maxLengthError(int length) =>
      LocaleKeys.oq_editor_max_length_error.tr(args: [length.toString()]);

  @override
  String get deleteConfirmTitle =>
      LocaleKeys.oq_editor_delete_confirm_title.tr();

  @override
  String deleteConfirmMessage(String itemName) =>
      LocaleKeys.oq_editor_delete_confirm_message.tr(args: [itemName]);
}
