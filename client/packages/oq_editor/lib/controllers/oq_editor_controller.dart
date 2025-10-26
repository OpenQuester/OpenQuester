import 'dart:async';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/foundation.dart';
import 'package:openapi/openapi.dart';
import 'package:oq_editor/models/editor_step.dart';
import 'package:oq_editor/models/media_file_reference.dart';
import 'package:oq_editor/models/oq_editor_translations.dart';
import 'package:oq_editor/models/package_upload_state.dart';
import 'package:oq_editor/utils/extensions.dart';
import 'package:oq_editor/utils/media_file_encoder.dart';
import 'package:oq_editor/utils/oq_package_archiver.dart';
import 'package:oq_shared/oq_shared.dart';
import 'package:universal_io/io.dart';

class OqEditorController {
  OqEditorController({
    required this.translations,
    OqPackage? initialPackage,
    this.onSave,
    this.onSaveProgressStream,
    this.logger,
  }) {
    package.value = initialPackage ?? OqPackageX.empty;
  }

  /// Translation provider injected from parent app
  final OqEditorTranslations translations;

  /// Optional logger for debug messages
  final BaseLogger? logger;

  /// Save callback function
  /// Should handle uploading media files and saving the package
  /// Returns the saved package or throws an error
  /// Map key is the hash, value is MediaFileReference
  final Future<OqPackage> Function(
    OqPackage package,
    Map<String, MediaFileReference> mediaFilesByHash,
  )?
  onSave;

  /// Optional stream of upload progress states
  /// If provided, the save dialog will show real-time progress
  final Stream<PackageUploadState>? onSaveProgressStream;

  /// Media file encoder for compressing files before upload/export
  /// Maintains a cache of encoded files to avoid re-encoding
  late final MediaFileEncoder _mediaFileEncoder = MediaFileEncoder(
    logger: logger,
  );

  /// Current package being edited
  final ValueNotifier<OqPackage> package = ValueNotifier<OqPackage>(
    OqPackageX.empty,
  );

  /// Current step in the editor workflow
  final ValueNotifier<EditorStep> currentStep = ValueNotifier<EditorStep>(
    EditorStep.packageInfo,
  );

  /// Key to force refresh of the editor screen
  final ValueNotifier<Key> refreshKey = ValueNotifier<Key>(
    UniqueKey(),
  );

  /// Navigation context tracking which round/theme/question is being edited
  final ValueNotifier<EditorNavigationContext> navigationContext =
      ValueNotifier<EditorNavigationContext>(
        EditorNavigationContext(),
      );

  /// Media file references map by hash
  /// Key: MD5 hash of file, Value: MediaFileReference for upload
  /// This includes both newly added files and imported files from .oq archives
  final Map<String, MediaFileReference> _mediaFilesByHash = {};

  /// Encoding progress stream controllers
  StreamController<double>? _encodingProgressController;

  /// Encoding progress stream for UI dialogs
  Stream<double>? get encodingProgressStream =>
      _encodingProgressController?.stream;

  // Last used settings for question creation
  /// Last used price value (persisted across question creations)
  int lastUsedPrice = 100;

  /// Last used answer delay in milliseconds (persisted
  /// across question creations)
  int lastUsedAnswerDelay = 5000;

  /// Last used display time question for media files in milliseconds
  ///  (persisted across question creations)
  int lastUsedQuestionDisplayTime = 5000;

  /// Last used display time for answer media files in milliseconds
  ///  (persisted across question creations)
  int lastUsedAnswerDisplayTime = 5000;

  /// Get media file reference by hash
  MediaFileReference? getMediaFileByHash(String hash) {
    return _mediaFilesByHash[hash];
  }

  /// Get file bytes by hash (works for both new and imported files)
  Future<Uint8List?> getImportedFileBytes(String hash) async {
    final mediaFile = _mediaFilesByHash[hash];
    if (mediaFile == null) return null;

    // Return bytes from platform file
    if (mediaFile.platformFile.bytes != null) {
      return mediaFile.platformFile.bytes;
    } else if (mediaFile.platformFile.path != null) {
      // Read from path if bytes not available
      final file = File(mediaFile.platformFile.path!);
      return file.readAsBytes();
    }

    return null;
  }

  /// Register a media file reference for upload
  /// Returns the hash for the file
  Future<String> registerMediaFile(MediaFileReference file) async {
    final hash = await file.calculateHash();
    _mediaFilesByHash[hash] = file;
    return hash;
  }

  /// Remove media file reference by hash
  Future<void> unregisterMediaFile(String hash) async {
    final file = _mediaFilesByHash.remove(hash);
    await file?.disposeController();
  }

  /// Get all pending media files for upload
  Map<String, MediaFileReference> get pendingMediaFiles =>
      Map.unmodifiable(_mediaFilesByHash);

  /// Clear all pending media files
  Future<void> clearPendingMediaFiles() async {
    // Dispose all controllers
    await Future.wait(
      _mediaFilesByHash.values.map((e) => e.disposeController()),
    );
    _mediaFilesByHash.clear();
  }

  /// Save the package
  /// Calls the onSave callback with the current package and pending media files
  /// Normalizes order fields for all questions before saving
  /// Encodes media files for compression before upload and updates package
  /// file hashes
  Future<OqPackage> savePackage() async {
    StreamController<double>? progressController;

    try {
      if (onSave == null) {
        throw UnimplementedError(
          'onSave callback must be provided to OqEditorController',
        );
      }

      // Start encoding progress tracking if there are media files
      if (_mediaFilesByHash.isNotEmpty) {
        progressController = StreamController<double>.broadcast();
        _encodingProgressController = progressController;
      }

      // Normalize order fields before saving
      final normalizedPackage = _normalizePackageOrder(package.value);

      // Encode media files for compression and update package with new hashes
      final encodingResult = await _mediaFileEncoder.encodePackage(
        normalizedPackage,
        Map.from(_mediaFilesByHash),
        onProgress: progressController?.add,
      );

      // Close encoding progress stream
      await progressController?.close();
      _encodingProgressController = null;

      final savedPackage = await onSave!(
        encodingResult.package,
        encodingResult.files,
      );

      // Update the package with the saved version
      package.value = savedPackage;

      return savedPackage;
    } catch (e) {
      // Clean up progress stream on error
      await progressController?.close();
      _encodingProgressController = null;

      logger?.e('Error saving package: $e');
      rethrow;
    }
  }

  /// Export package to .oq file
  /// Downloads a zip archive with structure:
  /// /content.json - serialized package
  /// /encoded_files.json - metadata about encoded files
  /// /files/{md5} - media files with hash as filename
  /// Encodes media files for compression before export and updates package
  /// file hashes
  Future<void> exportPackage() async {
    StreamController<double>? progressController;

    try {
      // Start encoding progress tracking if there are media files
      if (_mediaFilesByHash.isNotEmpty) {
        progressController = StreamController<double>.broadcast();
        _encodingProgressController = progressController;
      }

      // Normalize package before export
      final normalizedPackage = _normalizePackageOrder(package.value);

      // Encode media files for compression and update package with new hashes
      final encodingResult = await _mediaFileEncoder.encodePackage(
        normalizedPackage,
        Map.from(_mediaFilesByHash),
        onProgress: progressController?.add,
      );

      // Close encoding progress stream
      await progressController?.close();
      _encodingProgressController = null;

      // Create archive with encoded media files and updated package
      final archiveBytes = await OqPackageArchiver.exportPackage(
        encodingResult.package,
        encodingResult.files,
        encodedFileHashes: _mediaFileEncoder.encodedFileHashes,
      );

      // Save to file
      await OqPackageArchiver.saveArchiveToFile(
        archiveBytes,
        encodingResult.package.title,
      );
    } catch (e) {
      // Clean up progress stream on error
      await progressController?.close();
      _encodingProgressController = null;

      logger?.e('Error exporting package: $e');
      rethrow;
    }
  }

  /// Import package from .oq file
  /// Replaces current package with imported data
  /// Converts imported file bytes to MediaFileReference objects
  /// Restores encoded files cache from archive metadata to avoid re-encoding
  Future<void> importPackage() async {
    try {
      // Pick file
      final archiveBytes = await OqPackageArchiver.pickArchiveFile();
      if (archiveBytes == null) return; // User cancelled

      // Import package
      final result = await OqPackageArchiver.importPackage(archiveBytes);

      // Clear existing media files
      await clearPendingMediaFiles();

      // Populate encoder cache with encoded files from archive metadata
      if (result.encodedFileHashes != null) {
        _mediaFileEncoder.populateEncodedFilesCache(result.encodedFileHashes!);
      }

      // Convert imported file bytes to MediaFileReference objects
      // This allows them to be treated the same as newly added files
      for (final entry in result.filesBytesByHash.entries) {
        final hash = entry.key;
        final bytes = entry.value;

        // Create a PlatformFile from the bytes
        // Use hash as filename since we don't have the original filename
        final platformFile = PlatformFile(
          name: hash,
          size: bytes.length,
          bytes: bytes,
        );

        // Create MediaFileReference and register it
        final mediaFile = MediaFileReference(platformFile: platformFile);
        _mediaFilesByHash[hash] = mediaFile;
      }

      // Update package with imported data
      package.value = result.package;

      // Navigate to package info screen
      navigateToPackageInfo();
      refreshKey.value = UniqueKey();
    } catch (e) {
      logger?.e('Error importing package: $e');
      rethrow;
    }
  }

  /// Normalize order fields for rounds, themes, and questions in the package
  /// Ensures all entities are sorted by order and have sequential
  /// order values (0, 1, 2, ...)
  OqPackage _normalizePackageOrder(OqPackage pkg) {
    // Sort rounds by current order field
    final sortedRounds = List<PackageRound>.from(pkg.rounds)
      ..sort((a, b) => a.order.compareTo(b.order));

    // Reassign order values to rounds sequentially
    final normalizedRounds = sortedRounds.asMap().entries.map((roundEntry) {
      final round = roundEntry.value;
      final roundOrder = roundEntry.key;

      // Sort themes by current order field
      final sortedThemes = List<PackageTheme>.from(round.themes)
        ..sort((a, b) => a.order.compareTo(b.order));

      // Reassign order values to themes sequentially
      final normalizedThemes = sortedThemes.asMap().entries.map((themeEntry) {
        final theme = themeEntry.value;
        final themeOrder = themeEntry.key;

        // Sort questions by current order field
        final sortedQuestions = List<PackageQuestionUnion>.from(theme.questions)
          ..sort((a, b) => a.order.compareTo(b.order));

        // Reassign order values to questions sequentially
        final reorderedQuestions = sortedQuestions
            .asMap()
            .entries
            .map((entry) => _updateQuestionOrder(entry.value, entry.key))
            .toList();

        return theme.copyWith(
          order: themeOrder,
          questions: reorderedQuestions,
        );
      }).toList();

      return round.copyWith(
        order: roundOrder,
        themes: normalizedThemes,
      );
    }).toList();

    return pkg.copyWith(rounds: normalizedRounds);
  }

  /// Update the order field of a question based on its type
  PackageQuestionUnion _updateQuestionOrder(
    PackageQuestionUnion question,
    int newOrder,
  ) {
    return question.map(
      simple: (q) => q.copyWith(order: newOrder),
      stake: (q) => q.copyWith(order: newOrder),
      secret: (q) => q.copyWith(order: newOrder),
      noRisk: (q) => q.copyWith(order: newOrder),
      choice: (q) => q.copyWith(order: newOrder),
      hidden: (q) => q.copyWith(order: newOrder),
    );
  }

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
  /// Automatically assigns order based on current position in the list
  void addRound(PackageRound round) {
    // Assign order based on current round count
    final newOrder = package.value.rounds.length;
    final roundWithOrder = round.copyWith(order: newOrder);

    final updatedRounds = List<PackageRound>.from(package.value.rounds)
      ..add(roundWithOrder);
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
  /// Renormalizes order fields for remaining rounds
  void deleteRound(int index) {
    if (index < 0 || index >= package.value.rounds.length) return;
    final updatedRounds = List<PackageRound>.from(package.value.rounds)
      ..removeAt(index);

    // Renormalize order values after deletion
    final reorderedRounds = updatedRounds
        .asMap()
        .entries
        .map((entry) => entry.value.copyWith(order: entry.key))
        .toList();

    package.value = package.value.copyWith(rounds: reorderedRounds);
  }

  /// Reorder rounds
  /// Updates order fields to reflect new positions
  void reorderRounds(int oldIndex, int newIndex) {
    if (oldIndex == newIndex) return;
    final updatedRounds = List<PackageRound>.from(package.value.rounds);
    final round = updatedRounds.removeAt(oldIndex);
    updatedRounds.insert(newIndex, round);

    // Reassign order values to match new positions
    final reorderedRounds = updatedRounds
        .asMap()
        .entries
        .map((entry) => entry.value.copyWith(order: entry.key))
        .toList();

    package.value = package.value.copyWith(rounds: reorderedRounds);
  }

  // Theme CRUD operations

  /// Add a new theme to a round
  /// Automatically assigns order based on current position in the list
  void addTheme(int roundIndex, PackageTheme theme) {
    if (roundIndex < 0 || roundIndex >= package.value.rounds.length) return;
    final round = package.value.rounds[roundIndex];

    // Assign order based on current theme count
    final newOrder = round.themes.length;
    final themeWithOrder = theme.copyWith(order: newOrder);

    final updatedThemes = List<PackageTheme>.from(round.themes)
      ..add(themeWithOrder);
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
  /// Renormalizes order fields for remaining themes
  void deleteTheme(int roundIndex, int themeIndex) {
    if (roundIndex < 0 || roundIndex >= package.value.rounds.length) return;
    final round = package.value.rounds[roundIndex];
    if (themeIndex < 0 || themeIndex >= round.themes.length) return;

    final updatedThemes = List<PackageTheme>.from(round.themes)
      ..removeAt(themeIndex);

    // Renormalize order values after deletion
    final reorderedThemes = updatedThemes
        .asMap()
        .entries
        .map((entry) => entry.value.copyWith(order: entry.key))
        .toList();

    updateRound(roundIndex, round.copyWith(themes: reorderedThemes));
  }

  /// Reorder themes in a round
  /// Updates order fields to reflect new positions
  void reorderThemes(int roundIndex, int oldIndex, int newIndex) {
    if (oldIndex == newIndex) return;
    if (roundIndex < 0 || roundIndex >= package.value.rounds.length) return;
    final round = package.value.rounds[roundIndex];
    final updatedThemes = List<PackageTheme>.from(round.themes);
    final theme = updatedThemes.removeAt(oldIndex);
    updatedThemes.insert(newIndex, theme);

    // Reassign order values to match new positions
    final reorderedThemes = updatedThemes
        .asMap()
        .entries
        .map((entry) => entry.value.copyWith(order: entry.key))
        .toList();

    updateRound(roundIndex, round.copyWith(themes: reorderedThemes));
  }

  // Question CRUD operations

  /// Add a new question to a theme
  /// Automatically assigns order based on current position in the list
  void addQuestion(
    int roundIndex,
    int themeIndex,
    PackageQuestionUnion question,
  ) {
    if (roundIndex < 0 || roundIndex >= package.value.rounds.length) return;
    final round = package.value.rounds[roundIndex];
    if (themeIndex < 0 || themeIndex >= round.themes.length) return;
    final theme = round.themes[themeIndex];

    // Assign order based on current question count
    final newOrder = theme.questions.length;
    final questionWithOrder = _updateQuestionOrder(question, newOrder);

    final updatedQuestions = List<PackageQuestionUnion>.from(theme.questions)
      ..add(questionWithOrder);
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
  /// Renormalizes order fields for remaining questions
  void deleteQuestion(int roundIndex, int themeIndex, int questionIndex) {
    if (roundIndex < 0 || roundIndex >= package.value.rounds.length) return;
    final round = package.value.rounds[roundIndex];
    if (themeIndex < 0 || themeIndex >= round.themes.length) return;
    final theme = round.themes[themeIndex];
    if (questionIndex < 0 || questionIndex >= theme.questions.length) return;

    final updatedQuestions = List<PackageQuestionUnion>.from(theme.questions)
      ..removeAt(questionIndex);

    // Renormalize order values after deletion
    final reorderedQuestions = updatedQuestions
        .asMap()
        .entries
        .map((entry) => _updateQuestionOrder(entry.value, entry.key))
        .toList();

    updateTheme(
      roundIndex,
      themeIndex,
      theme.copyWith(questions: reorderedQuestions),
    );
  }

  /// Reorder questions in a theme
  /// Updates order fields to reflect new positions
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

    // Reassign order values to match new positions
    final reorderedQuestions = updatedQuestions
        .asMap()
        .entries
        .map((entry) => _updateQuestionOrder(entry.value, entry.key))
        .toList();

    updateTheme(
      roundIndex,
      themeIndex,
      theme.copyWith(questions: reorderedQuestions),
    );
  }

  /// Dispose resources
  Future<void> dispose() async {
    await clearPendingMediaFiles();
    await _mediaFileEncoder.dispose();
    await _encodingProgressController?.close();
    package.dispose();
    currentStep.dispose();
    navigationContext.dispose();
  }
}
