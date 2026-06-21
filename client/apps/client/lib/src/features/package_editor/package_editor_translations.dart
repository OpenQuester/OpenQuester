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

  @override
  String get errorSaving => LocaleKeys.oq_editor_error_saving.tr();

  @override
  String get errorGeneric => LocaleKeys.oq_editor_error_generic.tr();

  @override
  String get invalidTheme => LocaleKeys.oq_editor_invalid_theme.tr();

  @override
  String get invalidRound => LocaleKeys.oq_editor_invalid_round.tr();

  @override
  String get invalidQuestionContext =>
      LocaleKeys.oq_editor_invalid_question_context.tr();

  @override
  String get enterValidPositiveNumber =>
      LocaleKeys.oq_editor_enter_valid_positive_number.tr();

  @override
  String get enterValidNumber => LocaleKeys.oq_editor_enter_valid_number.tr();

  @override
  String get required => LocaleKeys.oq_editor_required.tr();

  @override
  String get savingPackage => LocaleKeys.oq_editor_saving_package.tr();

  @override
  String get preparingUpload => LocaleKeys.oq_editor_preparing_upload.tr();

  @override
  String get initializing => LocaleKeys.oq_editor_initializing.tr();

  @override
  String get uploading => LocaleKeys.oq_editor_uploading.tr();

  @override
  String uploadingFile(int current, int total) =>
      LocaleKeys.oq_editor_uploading_file.tr(
        args: [current.toString(), total.toString()],
      );

  @override
  String get creatingPackage => LocaleKeys.oq_editor_creating_package.tr();

  @override
  String get uploadComplete => LocaleKeys.oq_editor_upload_complete.tr();

  @override
  String get pleaseWait => LocaleKeys.oq_editor_please_wait.tr();

  @override
  String questionsInTheme(int count) =>
      LocaleKeys.oq_editor_questions_in_theme.tr(args: [count.toString()]);

  @override
  String themesCount(int count) =>
      LocaleKeys.oq_editor_themes_count.tr(args: [count.toString()]);

  @override
  String get questionTypeSimple =>
      LocaleKeys.oq_editor_question_type_simple.tr();

  @override
  String get questionTypeStake => LocaleKeys.oq_editor_question_type_stake.tr();

  @override
  String get questionTypeSecret =>
      LocaleKeys.oq_editor_question_type_secret.tr();

  @override
  String get questionTypeNoRisk =>
      LocaleKeys.oq_editor_question_type_no_risk.tr();

  @override
  String get questionTypeChoice =>
      LocaleKeys.oq_editor_question_type_choice.tr();

  @override
  String get questionTypeHidden =>
      LocaleKeys.oq_editor_question_type_hidden.tr();

  @override
  String get questionTypeUnknown =>
      LocaleKeys.oq_editor_question_type_unknown.tr();

  @override
  String get questionTypeLabel => LocaleKeys.oq_editor_question_type_label.tr();

  @override
  String get questionTypeSimpleDesc =>
      LocaleKeys.oq_editor_question_type_simple_desc.tr();

  @override
  String get questionTypeStakeDesc =>
      LocaleKeys.oq_editor_question_type_stake_desc.tr();

  @override
  String get questionTypeSecretDesc =>
      LocaleKeys.oq_editor_question_type_secret_desc.tr();

  @override
  String get questionTypeNoRiskDesc =>
      LocaleKeys.oq_editor_question_type_no_risk_desc.tr();

  @override
  String get questionTypeChoiceDesc =>
      LocaleKeys.oq_editor_question_type_choice_desc.tr();

  @override
  String get questionTypeHiddenDesc =>
      LocaleKeys.oq_editor_question_type_hidden_desc.tr();

  @override
  String get questionTypeUnknownDesc =>
      LocaleKeys.oq_editor_question_type_unknown_desc.tr();

  @override
  String get questionHint => LocaleKeys.oq_editor_question_hint.tr();

  @override
  String get questionComment => LocaleKeys.oq_editor_question_comment.tr();

  @override
  String get answerDelay => LocaleKeys.oq_editor_answer_delay.tr();

  @override
  String get isHidden => LocaleKeys.oq_editor_is_hidden.tr();

  @override
  String get isHiddenDesc => LocaleKeys.oq_editor_is_hidden_desc.tr();

  @override
  String get pts => LocaleKeys.oq_editor_pts.tr();

  @override
  String get ms => LocaleKeys.oq_editor_ms.tr();

  @override
  String get stakeSubType => LocaleKeys.oq_editor_stake_sub_type.tr();

  @override
  String get stakeMaxPrice => LocaleKeys.oq_editor_stake_max_price.tr();

  @override
  String get stakeMaxPriceHint =>
      LocaleKeys.oq_editor_stake_max_price_hint.tr();

  @override
  String get secretSubType => LocaleKeys.oq_editor_secret_sub_type.tr();

  @override
  String get secretTransferType =>
      LocaleKeys.oq_editor_secret_transfer_type.tr();

  @override
  String get allowedPrices => LocaleKeys.oq_editor_allowed_prices.tr();

  @override
  String get noPricesSetDefaults =>
      LocaleKeys.oq_editor_no_prices_set_defaults.tr();

  @override
  String get noRiskSubType => LocaleKeys.oq_editor_no_risk_sub_type.tr();

  @override
  String get priceMultiplier => LocaleKeys.oq_editor_price_multiplier.tr();

  @override
  String get priceMultiplierHint =>
      LocaleKeys.oq_editor_price_multiplier_hint.tr();

  @override
  String get showDelay => LocaleKeys.oq_editor_show_delay.tr();

  @override
  String get showDelayHint => LocaleKeys.oq_editor_show_delay_hint.tr();

  @override
  String get choiceAnswers => LocaleKeys.oq_editor_choice_answers.tr();

  @override
  String get add2to8Choices => LocaleKeys.oq_editor_add_2_to_8_choices.tr();

  @override
  String get answerDelayHint => LocaleKeys.oq_editor_answer_delay_hint.tr();

  @override
  String get questionHintHelper =>
      LocaleKeys.oq_editor_question_hint_helper.tr();

  @override
  String get questionCommentHelper =>
      LocaleKeys.oq_editor_question_comment_helper.tr();

  @override
  String get questionMediaFiles =>
      LocaleKeys.oq_editor_question_media_files.tr();

  @override
  String get answerMediaFiles => LocaleKeys.oq_editor_answer_media_files.tr();

  @override
  String get addMediaFile => LocaleKeys.oq_editor_add_media_file.tr();

  @override
  String get noMediaFiles => LocaleKeys.oq_editor_no_media_files.tr();

  @override
  String get preview => LocaleKeys.oq_editor_preview.tr();

  @override
  String get removeFile => LocaleKeys.oq_editor_remove_file.tr();

  @override
  String get errorAddingFile => LocaleKeys.oq_editor_error_adding_file.tr();

  @override
  String get failedToLoadImage =>
      LocaleKeys.oq_editor_failed_to_load_image.tr();

  @override
  String get failedToLoadVideo =>
      LocaleKeys.oq_editor_failed_to_load_video.tr();

  @override
  String get failedToLoadAudio =>
      LocaleKeys.oq_editor_failed_to_load_audio.tr();

  @override
  String get addChoiceAnswer => LocaleKeys.oq_editor_add_choice_answer.tr();

  @override
  String get editChoiceAnswer => LocaleKeys.oq_editor_edit_choice_answer.tr();

  @override
  String get answerText => LocaleKeys.oq_editor_answer_text.tr();

  @override
  String get emptyAnswer => LocaleKeys.oq_editor_empty_answer.tr();

  @override
  String get addAllowedPrice => LocaleKeys.oq_editor_add_allowed_price.tr();

  @override
  String get price => LocaleKeys.oq_editor_price.tr();

  @override
  String get optional => LocaleKeys.oq_editor_optional.tr();

  @override
  String get editDisplayTime => LocaleKeys.oq_editor_edit_display_time.tr();

  @override
  String get displayTime => LocaleKeys.oq_editor_display_time.tr();

  @override
  String get mustBePositive => LocaleKeys.oq_editor_must_be_positive.tr();

  @override
  String get invalidNumber => LocaleKeys.oq_editor_invalid_number.tr();

  @override
  String get roundTypeSimple => LocaleKeys.oq_editor_round_type_simple.tr();

  @override
  String get roundTypeFinal => LocaleKeys.oq_editor_round_type_final.tr();

  @override
  String get roundTypeUnknown => LocaleKeys.oq_editor_round_type_unknown.tr();

  @override
  String get ageRestrictionNone =>
      LocaleKeys.oq_editor_age_restriction_none.tr();

  @override
  String get ageRestrictionUnknown =>
      LocaleKeys.oq_editor_age_restriction_unknown.tr();

  @override
  String get newRound => LocaleKeys.oq_editor_new_round.tr();

  @override
  String get newTheme => LocaleKeys.oq_editor_new_theme.tr();

  @override
  String get newQuestion => LocaleKeys.oq_editor_new_question.tr();

  @override
  String get answer => LocaleKeys.oq_editor_answer.tr();

  @override
  String get untitledQuestion => LocaleKeys.oq_editor_untitled_question.tr();

  @override
  String get thisRound => LocaleKeys.oq_editor_this_round.tr();

  @override
  String get thisTheme => LocaleKeys.oq_editor_this_theme.tr();

  @override
  String get thisQuestion => LocaleKeys.oq_editor_this_question.tr();

  @override
  String get useTemplate => LocaleKeys.oq_editor_use_template.tr();

  @override
  String get templateNone => LocaleKeys.oq_editor_template_none.tr();

  @override
  String get templateOpeningQuestion =>
      LocaleKeys.oq_editor_template_opening_question.tr();

  @override
  String get templateOpeningQuestionDesc =>
      LocaleKeys.oq_editor_template_opening_question_desc.tr();

  @override
  String get selectQuestionFile =>
      LocaleKeys.oq_editor_select_question_file.tr();

  @override
  String get selectAnswerFile => LocaleKeys.oq_editor_select_answer_file.tr();

  @override
  String get templateApplied => LocaleKeys.oq_editor_template_applied.tr();

  @override
  String get addFromTemplate => LocaleKeys.oq_editor_add_from_template.tr();

  @override
  String get leaveWarning => LocaleKeys.oq_editor_leave_warning.tr();

  @override
  String get leave => LocaleKeys.oq_editor_leave.tr();

  @override
  String get saveToServer => LocaleKeys.oq_editor_save_to_server.tr();

  @override
  String get saveAsFile => LocaleKeys.oq_editor_save_as_file.tr();

  @override
  String get continueEditing => LocaleKeys.oq_editor_continue_editing.tr();

  @override
  String get importPackage => LocaleKeys.oq_editor_import_package.tr();

  @override
  String get importSiqPackage => LocaleKeys.oq_editor_import_siq_package.tr();

  @override
  String get exportPackage => LocaleKeys.oq_editor_export_package.tr();

  @override
  String get importPackageTooltip =>
      LocaleKeys.oq_editor_import_package_tooltip.tr();

  @override
  String get importSiqTooltip => LocaleKeys.oq_editor_import_siq_tooltip.tr();

  @override
  String get exportPackageTooltip =>
      LocaleKeys.oq_editor_export_package_tooltip.tr();

  @override
  String get errorExporting => LocaleKeys.oq_editor_error_exporting.tr();

  @override
  String get errorImporting => LocaleKeys.oq_editor_error_importing.tr();

  @override
  String get errorImportingSiq => LocaleKeys.oq_editor_error_importing_siq.tr();

  @override
  String get packageImportedSuccessfully =>
      LocaleKeys.oq_editor_package_imported_successfully.tr();

  @override
  String get siqPackageImportedSuccessfully =>
      LocaleKeys.oq_editor_siq_package_imported_successfully.tr();

  @override
  String get packageExportedSuccessfully =>
      LocaleKeys.oq_editor_package_exported_successfully.tr();

  @override
  String get siqEncodingWarningTitle =>
      LocaleKeys.oq_editor_siq_encoding_warning_title.tr();

  @override
  String get siqEncodingWarningMessage =>
      LocaleKeys.oq_editor_siq_encoding_warning_message.tr();

  @override
  String get siqImportContinue => LocaleKeys.oq_editor_siq_import_continue.tr();

  /// Encoding dialog translations
  @override
  String get encodingForUpload => LocaleKeys.oq_editor_encoding_for_upload.tr();

  @override
  String get encodingForExport => LocaleKeys.oq_editor_encoding_for_export.tr();

  @override
  String get preparingFiles => LocaleKeys.oq_editor_preparing_files.tr();

  @override
  String get compressingFiles => LocaleKeys.oq_editor_compressing_files.tr();

  @override
  String get finalizingEncoding =>
      LocaleKeys.oq_editor_finalizing_encoding.tr();

  @override
  String displayTimeValue(int milliseconds) =>
      LocaleKeys.oq_editor_display_time_value.tr(
        args: [milliseconds.toString()],
      );

  /// Package size and encoding warnings
  @override
  String get packageSize => LocaleKeys.oq_editor_package_size.tr();

  @override
  String packageSizeMB(double sizeMB) =>
      LocaleKeys.oq_editor_package_size_mb.tr(
        args: [sizeMB.toStringAsFixed(1)],
      );

  @override
  String get encodingNotSupportedTitle =>
      LocaleKeys.oq_editor_encoding_not_supported_title.tr();

  @override
  String get encodingNotSupportedMessage =>
      LocaleKeys.oq_editor_encoding_not_supported_message.tr();

  @override
  String encodingNotSupportedDetails(double sizeMB) =>
      LocaleKeys.oq_editor_encoding_not_supported_details.tr(
        args: [sizeMB.toStringAsFixed(1)],
      );

  @override
  String get uploadNowButton => LocaleKeys.oq_editor_upload_now_button.tr();

  @override
  String get exportAndUploadButton =>
      LocaleKeys.oq_editor_export_and_upload_button.tr();

  @override
  String get exportRecommended => LocaleKeys.oq_editor_export_recommended.tr();
}
