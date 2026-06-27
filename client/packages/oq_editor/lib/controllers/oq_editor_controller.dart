import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:openapi/openapi.dart';
import 'package:oq_editor/domain/editor_node_id.dart';
import 'package:oq_editor/domain/package_editor_operation_state.dart';
import 'package:oq_editor/domain/package_editor_validation.dart';
import 'package:oq_editor/models/media_file_reference.dart';
import 'package:oq_editor/models/oq_editor_translations.dart';
import 'package:oq_editor/ports/package_editor_save_adapter.dart';
import 'package:oq_editor/utils/editor_media_utils.dart';
import 'package:oq_editor/utils/extensions.dart';
import 'package:oq_editor/utils/media_file_encoder.dart';
import 'package:oq_editor/utils/oq_package_archiver.dart';
import 'package:oq_editor/utils/siq_import_helper.dart';
import 'package:oq_shared/oq_shared.dart';

class OqEditorController {
  OqEditorController({
    required this.translations,
    OqPackage? initialPackage,
    this.saveAdapter,
    this.logger,
  }) {
    package.value = initialPackage ?? OqPackageX.empty;
    validationIssues.value = validatePackageIssues(package.value);
  }

  final OqEditorTranslations translations;
  final OqPackageSaveAdapter? saveAdapter;
  final BaseLogger? logger;

  late final MediaFileEncoder _mediaFileEncoder = MediaFileEncoder(
    logger: logger,
  );

  final ValueNotifier<OqPackage> package = ValueNotifier<OqPackage>(
    OqPackageX.empty,
  );

  final ValueNotifier<EditorNodeId> selectedNode = ValueNotifier<EditorNodeId>(
    const EditorNodeId.package(),
  );

  final ValueNotifier<PackageEditorOperationState> operationState =
      ValueNotifier<PackageEditorOperationState>(
        const PackageEditorOperationState.idle(),
      );

  final ValueNotifier<bool> hasUnsavedChanges = ValueNotifier<bool>(false);
  final ValueNotifier<String?> lastErrorMessage = ValueNotifier<String?>(null);
  final ValueNotifier<List<String>> operationLogs = ValueNotifier<List<String>>(
    <String>[],
  );
  final ValueNotifier<Map<EditorNodeId, List<String>>> validationIssues =
      ValueNotifier<Map<EditorNodeId, List<String>>>(
        <EditorNodeId, List<String>>{},
      );

  final ValueNotifier<bool> outlinePanelVisible = ValueNotifier<bool>(true);
  final ValueNotifier<bool> previewPanelVisible = ValueNotifier<bool>(true);
  final ValueNotifier<double> outlinePanelWidth = ValueNotifier<double>(320);
  final ValueNotifier<double> previewPanelWidth = ValueNotifier<double>(360);
  final ValueNotifier<double> _totalSizeMB = ValueNotifier<double>(0);

  final Map<String, MediaFileReference> _mediaFilesByHash = {};

  bool _operationRunning = false;

  int lastUsedPrice = 100;
  int lastUsedShowAnswerDuration = 5000;
  int lastUsedQuestionDisplayTime = 5000;
  int lastUsedAnswerDisplayTime = 5000;

  Map<String, MediaFileReference> get pendingMediaFiles {
    return Map.unmodifiable(_mediaFilesByHash);
  }

  int get totalMediaFilesSize {
    return _mediaFilesByHash.values.fold<int>(
      0,
      (total, file) => total + (file.fileSize ?? 0),
    );
  }

  double get totalMediaFilesSizeMB => totalMediaFilesSize / (1024 * 1024);

  ValueNotifier<double> get totalSizeMBNotifier => _totalSizeMB;

  bool get isOperationRunning => operationState.value.isRunning;

  String get operationLogText {
    if (operationLogs.value.isEmpty) return translations.noProcessLogs;
    return operationLogs.value.join('\n');
  }

  void selectNode(EditorNodeId node) {
    selectedNode.value = _coerceNode(node);
  }

  void selectPackage() {
    selectedNode.value = const EditorNodeId.package();
  }

  void selectRound(int roundIndex) {
    selectNode(EditorNodeId.round(roundIndex));
  }

  void selectTheme(int roundIndex, int themeIndex) {
    selectNode(EditorNodeId.theme(roundIndex, themeIndex));
  }

  void selectQuestion(int roundIndex, int themeIndex, int questionIndex) {
    selectNode(EditorNodeId.question(roundIndex, themeIndex, questionIndex));
  }

  MediaFileReference? getMediaFileByHash(String hash) {
    return _mediaFilesByHash[hash];
  }

  Future<Uint8List?> getImportedFileBytes(String hash) async {
    final mediaFile = _mediaFilesByHash[hash];
    if (mediaFile == null) return null;

    try {
      return mediaFile.platformFile.readBytes();
    } catch (_) {
      return null;
    }
  }

  Future<String> registerMediaFile(MediaFileReference file) async {
    final hash = await file.calculateHash();
    _mediaFilesByHash[hash] = file;
    _updateTotalSize();
    _markDirty();
    return hash;
  }

  Future<void> unregisterMediaFile(String hash) async {
    final file = _mediaFilesByHash.remove(hash);
    await file?.disposeController();
    _updateTotalSize();
    _markDirty();
  }

  Future<void> clearPendingMediaFiles() async {
    await Future.wait(
      _mediaFilesByHash.values.map((file) => file.disposeController()),
    );
    _mediaFilesByHash.clear();
    _updateTotalSize();
  }

  Future<OqPackage> savePackage() async {
    if (saveAdapter == null) {
      throw UnimplementedError(
        'saveAdapter must be provided to OqEditorController',
      );
    }

    return _runOperation<OqPackage>(() async {
      final normalizedPackage = _normalizePackageOrder(package.value);
      final validation = validatePackage(normalizedPackage);
      if (!validation.isValid) {
        throw StateError(validation.errors.join('\n'));
      }

      final encodingResult = await _encodePackageIfNeeded(
        normalizedPackage,
        message: translations.encodingForUpload,
      );

      OqPackage? savedPackage;
      await for (final event in saveAdapter!(
        PackageEditorSaveRequest(
          package: encodingResult.package,
          mediaFilesByHash: encodingResult.files,
        ),
      )) {
        _setRunning(
          event.phase,
          progress: event.progress,
          message: event.message,
        );

        if (event.savedPackage != null) {
          savedPackage = event.savedPackage;
        }
      }

      final result = savedPackage;
      if (result == null) {
        throw StateError(translations.errorSaving);
      }

      _setPackage(result, dirty: false);
      selectedNode.value = _coerceNode(selectedNode.value);
      operationState.value = PackageEditorOperationState.completed(
        message: translations.uploadComplete,
      );
      return result;
    });
  }

  Future<void> exportPackage() async {
    await _runOperation<void>(() async {
      final normalizedPackage = _normalizePackageOrder(package.value);
      final validation = validatePackage(normalizedPackage);
      if (!validation.isValid) {
        throw StateError(validation.errors.join('\n'));
      }

      final encodingResult = await _encodePackageIfNeeded(
        normalizedPackage,
        message: translations.encodingForExport,
      );

      _setRunning(
        PackageEditorOperationPhase.exporting,
        message: translations.exportPackage,
      );

      final archiveBytes = await OqPackageArchiver.exportPackage(
        encodingResult.package,
        encodingResult.files,
        encodedFileHashes: _mediaFileEncoder.encodedFileHashes,
      );

      await OqPackageArchiver.saveArchiveToFile(
        archiveBytes,
        encodingResult.package.title,
      );

      _markClean();
      operationState.value = PackageEditorOperationState.completed(
        message: translations.packageExportedSuccessfully,
      );
    });
  }

  Future<({Uint8List bytes, String extension})?> pickPackageFile() {
    return SiqImportHelper.pickPackageFile();
  }

  Future<void> importPickedPackage() async {
    await _runOperation<void>(() async {
      _setRunning(
        PackageEditorOperationPhase.importPicking,
        message: translations.importPackage,
      );

      final fileResult = await pickPackageFile();
      if (fileResult == null) {
        operationState.value = const PackageEditorOperationState.idle();
        return;
      }

      if (fileResult.extension == 'oq') {
        await _importOqPackageBytes(fileResult.bytes);
      } else {
        await _importSiqPackageBytes(fileResult.bytes);
      }
    });
  }

  Future<void> importOqPackage(Uint8List oqBytes) async {
    await _runOperation<void>(() => _importOqPackageBytes(oqBytes));
  }

  Future<void> importSiqPackageFromBytes(Uint8List siqBytes) async {
    await _runOperation<void>(() => _importSiqPackageBytes(siqBytes));
  }

  Future<void> importPackage() async {
    await importPickedPackage();
  }

  Future<void> importSiqPackage() async {
    await _runOperation<void>(() async {
      _setRunning(
        PackageEditorOperationPhase.importPicking,
        message: translations.importSiqPackage,
      );

      final fileResult = await pickPackageFile();
      if (fileResult == null) {
        operationState.value = const PackageEditorOperationState.idle();
        return;
      }

      if (fileResult.extension != 'siq') {
        throw StateError(translations.errorImportingSiq);
      }

      await _importSiqPackageBytes(fileResult.bytes);
    });
  }

  Future<void> _importOqPackageBytes(Uint8List oqBytes) async {
    _setRunning(
      PackageEditorOperationPhase.importParsing,
      message: translations.importPackage,
    );

    final result = await OqPackageArchiver.importPackage(oqBytes);
    await _replacePackageFromImport(
      package: result.package,
      filesBytesByHash: result.filesBytesByHash,
      encodedFileHashes: result.encodedFileHashes,
    );

    operationState.value = PackageEditorOperationState.completed(
      message: translations.packageImportedSuccessfully,
    );
  }

  Future<void> _importSiqPackageBytes(Uint8List siqBytes) async {
    await clearPendingMediaFiles();

    await for (final progress in SiqImportHelper(
      logger: logger,
    ).convertSiqToOqPackage(siqBytes)) {
      switch (progress) {
        case SiqImportParsingFile(:final progress):
          _setRunning(
            PackageEditorOperationPhase.importParsing,
            progress: progress,
            message: translations.importSiqPackage,
          );
        case SiqImportConvertingMedia(:final current, :final total):
          _setRunning(
            PackageEditorOperationPhase.importParsing,
            progress: total == 0 ? null : current / total,
            message: '${translations.importSiqPackage} $current/$total',
          );
        case SiqImportCompleted(:final result):
          _mediaFilesByHash
            ..clear()
            ..addAll(result.mediaFilesByHash);
          _updateTotalSize();
          package.value = result.package;
          selectPackage();
          operationState.value = PackageEditorOperationState.completed(
            message: translations.siqPackageImportedSuccessfully,
          );
        case SiqImportError(:final error, :final stackTrace):
          Error.throwWithStackTrace(
            error,
            stackTrace ?? StackTrace.current,
          );
        case SiqImportPickingFile():
          break;
      }
    }
  }

  Future<void> _replacePackageFromImport({
    required OqPackage package,
    required Map<String, Uint8List> filesBytesByHash,
    Set<String>? encodedFileHashes,
  }) async {
    await clearPendingMediaFiles();

    if (encodedFileHashes != null) {
      _mediaFileEncoder.populateEncodedFilesCache(encodedFileHashes);
    }

    for (final entry in filesBytesByHash.entries) {
      _mediaFilesByHash[entry.key] = EditorMediaUtils.createMediaFileFromBytes(
        hash: entry.key,
        bytes: entry.value,
      );
    }

    _updateTotalSize();
    _setPackage(package);
    selectPackage();
  }

  PackageEditorValidationResult validatePackage([OqPackage? package]) {
    final targetPackage = package ?? this.package.value;
    final issueMap = validatePackageIssues(targetPackage);
    final errors = issueMap.values.expand((messages) => messages).toList();

    validationIssues.value = issueMap;

    return PackageEditorValidationResult(errors: errors);
  }

  Map<EditorNodeId, List<String>> validatePackageIssues([OqPackage? package]) {
    final targetPackage = package ?? this.package.value;
    final issues = <EditorNodeId, List<String>>{};

    void addIssue(EditorNodeId node, String message) {
      issues.update(
        node,
        (messages) => <String>[...messages, message],
        ifAbsent: () => <String>[message],
      );
    }

    if (targetPackage.title.trim().isEmpty) {
      addIssue(
        const EditorNodeId.package(),
        _requiredIssue(translations.packageTitle),
      );
    } else if (targetPackage.title.trim().length < 3) {
      addIssue(
        const EditorNodeId.package(),
        '${translations.packageTitle}: ${translations.minLengthError(3)}',
      );
    }
    if (targetPackage.language?.trim().isEmpty ?? true) {
      addIssue(
        const EditorNodeId.package(),
        _requiredIssue(translations.packageLanguage),
      );
    }
    if (targetPackage.ageRestriction == AgeRestriction.$unknown) {
      addIssue(
        const EditorNodeId.package(),
        _requiredIssue(translations.packageAgeRestriction),
      );
    }

    for (
      var roundIndex = 0;
      roundIndex < targetPackage.rounds.length;
      roundIndex++
    ) {
      final round = targetPackage.rounds[roundIndex];
      final roundNode = EditorNodeId.round(roundIndex);
      if (round.name.trim().isEmpty) {
        addIssue(roundNode, _requiredIssue(translations.roundName));
      }

      for (var themeIndex = 0; themeIndex < round.themes.length; themeIndex++) {
        final theme = round.themes[themeIndex];
        final themeNode = EditorNodeId.theme(roundIndex, themeIndex);
        if (theme.name.trim().isEmpty) {
          addIssue(themeNode, _requiredIssue(translations.themeName));
        }

        for (
          var questionIndex = 0;
          questionIndex < theme.questions.length;
          questionIndex++
        ) {
          final question = theme.questions[questionIndex];
          final questionNode = EditorNodeId.question(
            roundIndex,
            themeIndex,
            questionIndex,
          );
          final questionIssues = _validateQuestion(question);
          for (final issue in questionIssues) {
            addIssue(questionNode, issue);
          }
        }
      }
    }

    return issues;
  }

  bool refreshValidationIssues() {
    final issues = validatePackageIssues();
    validationIssues.value = issues;
    return issues.isEmpty;
  }

  void updatePackageInfo({
    String? title,
    String? description,
    AgeRestriction? ageRestriction,
    String? language,
    List<PackageTag>? tags,
  }) {
    _setPackage(
      package.value.copyWith(
        title: title ?? package.value.title,
        description: description ?? package.value.description,
        ageRestriction: ageRestriction ?? package.value.ageRestriction,
        language: language ?? package.value.language,
        tags: tags ?? package.value.tags,
      ),
    );
  }

  void addRound(PackageRound round) {
    final newOrder = package.value.rounds.length;
    final updatedRounds = List<PackageRound>.from(package.value.rounds)
      ..add(round.copyWith(order: newOrder));
    _setPackage(package.value.copyWith(rounds: updatedRounds));
    selectRound(updatedRounds.length - 1);
  }

  void createRound() {
    addRound(
      PackageRound(
        order: package.value.rounds.length,
        name: translations.newRound,
        description: '',
        type: PackageRoundType.simple,
        themes: [],
      ),
    );
  }

  void updateRound(int index, PackageRound round) {
    if (index < 0 || index >= package.value.rounds.length) return;
    final updatedRounds = List<PackageRound>.from(package.value.rounds);
    updatedRounds[index] = round;
    _setPackage(package.value.copyWith(rounds: updatedRounds));
    _repairSelection();
  }

  void deleteRound(int index) {
    if (index < 0 || index >= package.value.rounds.length) return;
    final updatedRounds = List<PackageRound>.from(package.value.rounds)
      ..removeAt(index);

    _setPackage(
      package.value.copyWith(
        rounds: updatedRounds
            .asMap()
            .entries
            .map((entry) => entry.value.copyWith(order: entry.key))
            .toList(),
      ),
    );
    _repairSelection(preferredRoundIndex: index);
  }

  void reorderRounds(int oldIndex, int newIndex) {
    if (oldIndex == newIndex) return;
    if (oldIndex < 0 || oldIndex >= package.value.rounds.length) return;
    if (newIndex < 0 || newIndex > package.value.rounds.length) return;

    final updatedRounds = List<PackageRound>.from(package.value.rounds);
    final round = updatedRounds.removeAt(oldIndex);
    final insertIndex = newIndex > oldIndex ? newIndex - 1 : newIndex;
    updatedRounds.insert(insertIndex, round);

    _setPackage(
      package.value.copyWith(
        rounds: updatedRounds
            .asMap()
            .entries
            .map((entry) => entry.value.copyWith(order: entry.key))
            .toList(),
      ),
    );
    _repairSelection(preferredRoundIndex: insertIndex);
  }

  void addTheme(int roundIndex, PackageTheme theme) {
    final round = _roundAt(roundIndex);
    if (round == null) return;

    final updatedThemes = List<PackageTheme>.from(round.themes)
      ..add(theme.copyWith(order: round.themes.length));
    updateRound(roundIndex, round.copyWith(themes: updatedThemes));
    selectTheme(roundIndex, updatedThemes.length - 1);
  }

  void createTheme(int roundIndex) {
    final round = _roundAt(roundIndex);
    if (round == null) return;

    addTheme(
      roundIndex,
      PackageTheme(
        order: round.themes.length,
        name: translations.newTheme,
        description: '',
        questions: [],
      ),
    );
  }

  void updateTheme(int roundIndex, int themeIndex, PackageTheme theme) {
    final round = _roundAt(roundIndex);
    if (round == null || themeIndex < 0 || themeIndex >= round.themes.length) {
      return;
    }

    final updatedThemes = List<PackageTheme>.from(round.themes);
    updatedThemes[themeIndex] = theme;
    updateRound(roundIndex, round.copyWith(themes: updatedThemes));
  }

  void deleteTheme(int roundIndex, int themeIndex) {
    final round = _roundAt(roundIndex);
    if (round == null || themeIndex < 0 || themeIndex >= round.themes.length) {
      return;
    }

    final updatedThemes = List<PackageTheme>.from(round.themes)
      ..removeAt(themeIndex);
    updateRound(
      roundIndex,
      round.copyWith(
        themes: updatedThemes
            .asMap()
            .entries
            .map((entry) => entry.value.copyWith(order: entry.key))
            .toList(),
      ),
    );
    _repairSelection(
      preferredRoundIndex: roundIndex,
      preferredThemeIndex: themeIndex,
    );
  }

  void reorderThemes(int roundIndex, int oldIndex, int newIndex) {
    final round = _roundAt(roundIndex);
    if (round == null || oldIndex == newIndex) return;
    if (oldIndex < 0 || oldIndex >= round.themes.length) return;
    if (newIndex < 0 || newIndex > round.themes.length) return;

    final updatedThemes = List<PackageTheme>.from(round.themes);
    final theme = updatedThemes.removeAt(oldIndex);
    final insertIndex = newIndex > oldIndex ? newIndex - 1 : newIndex;
    updatedThemes.insert(insertIndex, theme);

    updateRound(
      roundIndex,
      round.copyWith(
        themes: updatedThemes
            .asMap()
            .entries
            .map((entry) => entry.value.copyWith(order: entry.key))
            .toList(),
      ),
    );
    _repairSelection(
      preferredRoundIndex: roundIndex,
      preferredThemeIndex: insertIndex,
    );
  }

  void addQuestion(
    int roundIndex,
    int themeIndex,
    PackageQuestionUnion question,
  ) {
    final theme = _themeAt(roundIndex, themeIndex);
    if (theme == null) return;

    final updatedQuestions = List<PackageQuestionUnion>.from(theme.questions)
      ..add(_updateQuestionOrder(question, theme.questions.length));
    updateTheme(
      roundIndex,
      themeIndex,
      theme.copyWith(questions: updatedQuestions),
    );
    selectQuestion(roundIndex, themeIndex, updatedQuestions.length - 1);
  }

  void createQuestion(int roundIndex, int themeIndex) {
    final theme = _themeAt(roundIndex, themeIndex);
    if (theme == null) return;

    addQuestion(
      roundIndex,
      themeIndex,
      PackageQuestionUnion.simple(
        order: theme.questions.length,
        price: lastUsedPrice,
        showAnswerDuration: lastUsedShowAnswerDuration,
        answerDelay: lastUsedQuestionDisplayTime,
        text: translations.newQuestion,
        answerText: '',
      ),
    );
  }

  void copyQuestion(int roundIndex, int themeIndex, int questionIndex) {
    final theme = _themeAt(roundIndex, themeIndex);
    if (theme == null ||
        questionIndex < 0 ||
        questionIndex >= theme.questions.length) {
      return;
    }

    final insertIndex = questionIndex + 1;
    final updatedQuestions = List<PackageQuestionUnion>.from(theme.questions)
      ..insert(
        insertIndex,
        _copyQuestionForInsert(theme.questions[questionIndex], insertIndex),
      );

    updateTheme(
      roundIndex,
      themeIndex,
      theme.copyWith(
        questions: updatedQuestions
            .asMap()
            .entries
            .map((entry) => _updateQuestionOrder(entry.value, entry.key))
            .toList(),
      ),
    );
    selectQuestion(roundIndex, themeIndex, insertIndex);
  }

  void updateQuestion(
    int roundIndex,
    int themeIndex,
    int questionIndex,
    PackageQuestionUnion question,
  ) {
    final theme = _themeAt(roundIndex, themeIndex);
    if (theme == null ||
        questionIndex < 0 ||
        questionIndex >= theme.questions.length) {
      return;
    }

    final updatedQuestions = List<PackageQuestionUnion>.from(theme.questions);
    updatedQuestions[questionIndex] = question;
    updateTheme(
      roundIndex,
      themeIndex,
      theme.copyWith(questions: updatedQuestions),
    );
  }

  void deleteQuestion(int roundIndex, int themeIndex, int questionIndex) {
    final theme = _themeAt(roundIndex, themeIndex);
    if (theme == null ||
        questionIndex < 0 ||
        questionIndex >= theme.questions.length) {
      return;
    }

    final updatedQuestions = List<PackageQuestionUnion>.from(theme.questions)
      ..removeAt(questionIndex);
    updateTheme(
      roundIndex,
      themeIndex,
      theme.copyWith(
        questions: updatedQuestions
            .asMap()
            .entries
            .map((entry) => _updateQuestionOrder(entry.value, entry.key))
            .toList(),
      ),
    );
    _repairSelection(
      preferredRoundIndex: roundIndex,
      preferredThemeIndex: themeIndex,
      preferredQuestionIndex: questionIndex,
    );
  }

  void reorderQuestions(
    int roundIndex,
    int themeIndex,
    int oldIndex,
    int newIndex,
  ) {
    final theme = _themeAt(roundIndex, themeIndex);
    if (theme == null || oldIndex == newIndex) return;
    if (oldIndex < 0 || oldIndex >= theme.questions.length) return;
    if (newIndex < 0 || newIndex > theme.questions.length) return;

    final updatedQuestions = List<PackageQuestionUnion>.from(theme.questions);
    final question = updatedQuestions.removeAt(oldIndex);
    final insertIndex = newIndex > oldIndex ? newIndex - 1 : newIndex;
    updatedQuestions.insert(insertIndex, question);

    updateTheme(
      roundIndex,
      themeIndex,
      theme.copyWith(
        questions: updatedQuestions
            .asMap()
            .entries
            .map((entry) => _updateQuestionOrder(entry.value, entry.key))
            .toList(),
      ),
    );
    _repairSelection(
      preferredRoundIndex: roundIndex,
      preferredThemeIndex: themeIndex,
      preferredQuestionIndex: insertIndex,
    );
  }

  PackageQuestionUnion? getQuestionByIndices(
    int roundIndex,
    int themeIndex,
    int? questionIndex,
  ) {
    final theme = _themeAt(roundIndex, themeIndex);
    if (theme == null ||
        questionIndex == null ||
        questionIndex < 0 ||
        questionIndex >= theme.questions.length) {
      return null;
    }
    return theme.questions[questionIndex];
  }

  Future<void> dispose() async {
    await clearPendingMediaFiles();
    await _mediaFileEncoder.dispose();
    package.dispose();
    selectedNode.dispose();
    operationState.dispose();
    hasUnsavedChanges.dispose();
    lastErrorMessage.dispose();
    operationLogs.dispose();
    validationIssues.dispose();
    outlinePanelVisible.dispose();
    previewPanelVisible.dispose();
    outlinePanelWidth.dispose();
    previewPanelWidth.dispose();
    _totalSizeMB.dispose();
  }

  Future<T> _runOperation<T>(Future<T> Function() operation) async {
    if (_operationRunning) {
      throw StateError('Another package editor operation is already running');
    }

    _operationRunning = true;
    lastErrorMessage.value = null;
    _appendOperationLog(translations.initializing);
    try {
      return await operation();
    } catch (error, stackTrace) {
      logger?.e(
        'Package editor operation failed',
        error: error,
        stackTrace: stackTrace,
      );
      final message = userFacingError(error);
      lastErrorMessage.value = message;
      _appendOperationLog('Error: $error');
      _appendOperationLog(stackTrace.toString());
      operationState.value = PackageEditorOperationState.failed(
        error: message,
        stackTrace: stackTrace,
      );
      rethrow;
    } finally {
      _operationRunning = false;
    }
  }

  void _setRunning(
    PackageEditorOperationPhase phase, {
    double? progress,
    String? message,
  }) {
    if (message != null && message.trim().isNotEmpty) {
      _appendOperationLog(message);
    }
    operationState.value = PackageEditorOperationState.running(
      phase: phase,
      progress: progress,
      message: message,
    );
  }

  Future<({OqPackage package, Map<String, MediaFileReference> files})>
  _encodePackageIfNeeded(
    OqPackage package, {
    required String message,
  }) async {
    if (_mediaFilesByHash.isEmpty) {
      return (package: package, files: <String, MediaFileReference>{});
    }

    _setRunning(
      PackageEditorOperationPhase.encoding,
      progress: 0,
      message: message,
    );

    return _mediaFileEncoder.encodePackage(
      package,
      Map.from(_mediaFilesByHash),
      onProgress: (progress) => _setRunning(
        PackageEditorOperationPhase.encoding,
        progress: progress,
        message: message,
      ),
    );
  }

  void _updateTotalSize() {
    _totalSizeMB.value = totalMediaFilesSizeMB;
  }

  void _setPackage(OqPackage value, {bool dirty = true}) {
    package.value = value;
    if (dirty) {
      _markDirty();
    } else {
      _markClean();
    }
    validationIssues.value = validatePackageIssues(value);
  }

  void _markDirty() {
    if (!hasUnsavedChanges.value) {
      hasUnsavedChanges.value = true;
    }
  }

  void _markClean() {
    hasUnsavedChanges.value = false;
  }

  void _appendOperationLog(String entry) {
    final text = entry.trim();
    if (text.isEmpty) return;
    operationLogs.value = <String>[
      ...operationLogs.value,
      '[${DateTime.now().toIso8601String()}] $text',
    ];
  }

  void clearOperationLogs() {
    operationLogs.value = <String>[];
  }

  String userFacingError(Object error) {
    final raw = error.toString().trim();
    final candidates = <String?>[
      _extractJsonError(raw),
      _extractLooseErrorField(raw),
      _stripExceptionPrefixes(raw),
    ].whereType<String>().map((value) => value.trim()).toList();

    for (final candidate in candidates) {
      if (_isUsefulUserMessage(candidate)) {
        return candidate;
      }
    }

    return translations.somethingWentWrong;
  }

  String? _extractJsonError(String raw) {
    final start = raw.indexOf('{');
    final end = raw.lastIndexOf('}');
    if (start == -1 || end <= start) return null;

    final jsonText = raw.substring(start, end + 1);
    try {
      final decoded = jsonDecode(jsonText);
      if (decoded is Map<String, dynamic>) {
        final value = decoded['error'] ?? decoded['message'];
        if (value is String) return value;
      }
    } catch (_) {
      return null;
    }
    return null;
  }

  String? _extractLooseErrorField(String raw) {
    final quotedMatch = RegExp(
      r'''["'](?:error|message)["']\s*:\s*["']([^"']+)["']''',
      caseSensitive: false,
    ).firstMatch(raw);
    if (quotedMatch != null) return quotedMatch.group(1);

    final looseMatch = RegExp(
      r'''(?:error|message)\s*:\s*([^,}\n]+)''',
      caseSensitive: false,
    ).firstMatch(raw);
    return looseMatch?.group(1);
  }

  String _stripExceptionPrefixes(String raw) {
    return raw
        .replaceFirst(RegExp(r'^Exception:\s*'), '')
        .replaceFirst(RegExp(r'^Bad state:\s*'), '')
        .replaceFirst(RegExp(r'^FormatException:\s*'), '')
        .trim();
  }

  bool _isUsefulUserMessage(String message) {
    if (message.isEmpty) return false;
    if (message.contains('{') || message.contains('}')) return false;
    if (message.contains('DioException')) return false;
    if (message.contains('StackTrace')) return false;
    return true;
  }

  List<String> _validateQuestion(PackageQuestionUnion question) {
    final issues = <String>[];
    final text = question.map(
      simple: (question) => question.text,
      stake: (question) => question.text,
      secret: (question) => question.text,
      noRisk: (question) => question.text,
      choice: (question) => question.text,
      hidden: (question) => question.text,
    );
    if (text == null || text.trim().isEmpty) {
      issues.add(_requiredIssue(translations.questionText));
    }

    question.map(
      simple: (question) {
        if (question.answerText?.trim().isEmpty ?? true) {
          issues.add(_requiredIssue(translations.questionAnswer));
        }
      },
      stake: (question) {
        if (question.answerText?.trim().isEmpty ?? true) {
          issues.add(_requiredIssue(translations.questionAnswer));
        }
      },
      secret: (question) {
        if (question.answerText?.trim().isEmpty ?? true) {
          issues.add(_requiredIssue(translations.questionAnswer));
        }
      },
      noRisk: (question) {
        if (question.answerText?.trim().isEmpty ?? true) {
          issues.add(_requiredIssue(translations.questionAnswer));
        }
      },
      choice: (question) {
        final answers = question.answers;
        if (answers.length < 2 || answers.length > 8) {
          issues.add(translations.add2to8Choices);
        }
        if (answers.any((answer) => answer.text?.trim().isEmpty ?? true)) {
          issues.add(_requiredIssue(translations.answerText));
        }
      },
      hidden: (_) {},
    );

    return issues;
  }

  String _requiredIssue(String fieldName) {
    return '$fieldName: ${translations.fieldRequired}';
  }

  PackageRound? _roundAt(int roundIndex) {
    if (roundIndex < 0 || roundIndex >= package.value.rounds.length) {
      return null;
    }
    return package.value.rounds[roundIndex];
  }

  PackageTheme? _themeAt(int roundIndex, int themeIndex) {
    final round = _roundAt(roundIndex);
    if (round == null || themeIndex < 0 || themeIndex >= round.themes.length) {
      return null;
    }
    return round.themes[themeIndex];
  }

  void _repairSelection({
    int? preferredRoundIndex,
    int? preferredThemeIndex,
    int? preferredQuestionIndex,
  }) {
    selectedNode.value = _coerceNode(
      selectedNode.value,
      preferredRoundIndex: preferredRoundIndex,
      preferredThemeIndex: preferredThemeIndex,
      preferredQuestionIndex: preferredQuestionIndex,
    );
  }

  EditorNodeId _coerceNode(
    EditorNodeId node, {
    int? preferredRoundIndex,
    int? preferredThemeIndex,
    int? preferredQuestionIndex,
  }) {
    final rounds = package.value.rounds;

    switch (node.kind) {
      case EditorNodeKind.package:
        return const EditorNodeId.package();
      case EditorNodeKind.round:
        if (rounds.isEmpty) return const EditorNodeId.package();
        return EditorNodeId.round(
          _clampIndex(
            preferredRoundIndex ?? node.roundIndex ?? 0,
            rounds.length,
          ),
        );
      case EditorNodeKind.theme:
        if (rounds.isEmpty) return const EditorNodeId.package();
        final roundIndex = _clampIndex(
          preferredRoundIndex ?? node.roundIndex ?? 0,
          rounds.length,
        );
        final themes = rounds[roundIndex].themes;
        if (themes.isEmpty) return EditorNodeId.round(roundIndex);
        return EditorNodeId.theme(
          roundIndex,
          _clampIndex(
            preferredThemeIndex ?? node.themeIndex ?? 0,
            themes.length,
          ),
        );
      case EditorNodeKind.question:
        if (rounds.isEmpty) return const EditorNodeId.package();
        final roundIndex = _clampIndex(
          preferredRoundIndex ?? node.roundIndex ?? 0,
          rounds.length,
        );
        final themes = rounds[roundIndex].themes;
        if (themes.isEmpty) return EditorNodeId.round(roundIndex);
        final themeIndex = _clampIndex(
          preferredThemeIndex ?? node.themeIndex ?? 0,
          themes.length,
        );
        final questions = themes[themeIndex].questions;
        if (questions.isEmpty) {
          return EditorNodeId.theme(roundIndex, themeIndex);
        }
        return EditorNodeId.question(
          roundIndex,
          themeIndex,
          _clampIndex(
            preferredQuestionIndex ?? node.questionIndex ?? 0,
            questions.length,
          ),
        );
    }
  }

  int _clampIndex(int index, int length) {
    if (index < 0) return 0;
    if (index >= length) return length - 1;
    return index;
  }

  OqPackage _normalizePackageOrder(OqPackage package) {
    final sortedRounds = List<PackageRound>.from(package.rounds)
      ..sort((a, b) => a.order.compareTo(b.order));

    final normalizedRounds = sortedRounds.asMap().entries.map((roundEntry) {
      final sortedThemes = List<PackageTheme>.from(roundEntry.value.themes)
        ..sort((a, b) => a.order.compareTo(b.order));

      final normalizedThemes = sortedThemes.asMap().entries.map((themeEntry) {
        final sortedQuestions = List<PackageQuestionUnion>.from(
          themeEntry.value.questions,
        )..sort((a, b) => a.order.compareTo(b.order));

        return themeEntry.value.copyWith(
          order: themeEntry.key,
          questions: sortedQuestions
              .asMap()
              .entries
              .map((entry) => _updateQuestionOrder(entry.value, entry.key))
              .toList(),
        );
      }).toList();

      return roundEntry.value.copyWith(
        order: roundEntry.key,
        themes: normalizedThemes,
      );
    }).toList();

    return package.copyWith(rounds: normalizedRounds);
  }

  PackageQuestionUnion _updateQuestionOrder(
    PackageQuestionUnion question,
    int newOrder,
  ) {
    return question.map(
      simple: (question) => question.copyWith(order: newOrder),
      stake: (question) => question.copyWith(order: newOrder),
      secret: (question) => question.copyWith(order: newOrder),
      noRisk: (question) => question.copyWith(order: newOrder),
      choice: (question) => question.copyWith(order: newOrder),
      hidden: (question) => question.copyWith(order: newOrder),
    );
  }

  PackageQuestionUnion _copyQuestionForInsert(
    PackageQuestionUnion question,
    int order,
  ) {
    return question.map(
      simple: (question) => question.copyWith(id: null, order: order),
      stake: (question) => question.copyWith(id: null, order: order),
      secret: (question) => question.copyWith(id: null, order: order),
      noRisk: (question) => question.copyWith(id: null, order: order),
      choice: (question) => question.copyWith(id: null, order: order),
      hidden: (question) => question.copyWith(id: null, order: order),
    );
  }
}
