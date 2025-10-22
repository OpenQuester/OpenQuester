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

  /// Error messages
  String get errorSaving;
  String get errorGeneric;
  String get invalidTheme;
  String get invalidRound;
  String get invalidQuestionContext;
  String get enterValidPositiveNumber;
  String get enterValidNumber;
  String get required;

  /// Saving dialog
  String get savingPackage;
  String get preparingUpload;
  String get initializing;
  String get uploading;
  String uploadingFile(int current, int total);
  String get creatingPackage;
  String get uploadComplete;
  String get pleaseWait;

  /// Progress info
  String questionsInTheme(int count);
  String themesCount(int count);

  /// Question type names
  String get questionTypeSimple;
  String get questionTypeStake;
  String get questionTypeSecret;
  String get questionTypeNoRisk;
  String get questionTypeChoice;
  String get questionTypeHidden;
  String get questionTypeUnknown;
  String get questionTypeLabel;

  /// Question type descriptions
  String get questionTypeSimpleDesc;
  String get questionTypeStakeDesc;
  String get questionTypeSecretDesc;
  String get questionTypeNoRiskDesc;
  String get questionTypeChoiceDesc;
  String get questionTypeHiddenDesc;
  String get questionTypeUnknownDesc;

  /// Question fields
  String get questionHint;
  String get questionComment;
  String get answerDelay;
  String get isHidden;
  String get isHiddenDesc;
  String get pts;
  String get ms;

  /// Question type-specific fields
  String get stakeSubType;
  String get stakeMaxPrice;
  String get stakeMaxPriceHint;
  String get secretSubType;
  String get secretTransferType;
  String get allowedPrices;
  String get noPricesSetDefaults;
  String get noRiskSubType;
  String get priceMultiplier;
  String get priceMultiplierHint;
  String get showDelay;
  String get showDelayHint;
  String get choiceAnswers;
  String get add2to8Choices;
  String get answerDelayHint;
  String get questionHintHelper;
  String get questionCommentHelper;

  /// Media
  String get questionMediaFiles;
  String get answerMediaFiles;
  String get addMediaFile;
  String get noMediaFiles;
  String get preview;
  String get removeFile;
  String get errorAddingFile;
  String get failedToLoadImage;
  String get failedToLoadVideo;
  String get failedToLoadAudio;

  /// Choice answers
  String get addChoiceAnswer;
  String get editChoiceAnswer;
  String get answerText;
  String get emptyAnswer;
  String get addAllowedPrice;
  String get price;
  String get optional;

  /// Display time dialog
  String get editDisplayTime;
  String get displayTime;
  String get mustBePositive;
  String get invalidNumber;

  /// Round types
  String get roundTypeSimple;
  String get roundTypeFinal;
  String get roundTypeUnknown;

  /// Age restrictions
  String get ageRestrictionNone;
  String get ageRestrictionUnknown;

  /// Default values
  String get newRound;
  String get newTheme;
  String get newQuestion;
  String get answer;
  String get untitledQuestion;

  /// Confirm messages
  String get thisRound;
  String get thisTheme;
  String get thisQuestion;

  /// Question templates
  String get useTemplate;
  String get templateNone;
  String get templateOpeningQuestion;
  String get templateOpeningQuestionDesc;
  String get selectQuestionFile;
  String get selectAnswerFile;
  String get templateApplied;
  String get addFromTemplate;

  /// Exit dialog
  String get leaveWarning;
  String get leave;
  String get saveToServer;
  String get saveAsFile;
  String get continueEditing;

  /// Import/Export
  String get importPackage;
  String get exportPackage;
  String get importPackageTooltip;
  String get exportPackageTooltip;
  String get errorExporting;
  String get errorImporting;
  String get packageImportedSuccessfully;
  String get packageExportedSuccessfully;

  /// Media file display
  String displayTimeValue(int milliseconds);
}
