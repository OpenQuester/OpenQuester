import 'package:crypto/crypto.dart';
import 'package:flutter/foundation.dart';
import 'package:openquester/common_imports.dart';

enum EditorQuestionFilter { all, simple, stake, secret, noRisk, choice, hidden }

enum PackageHealth { good, needsAttention, broken }

class EditorLocation {
  const EditorLocation({this.roundIndex, this.themeIndex, this.questionIndex});

  final int? roundIndex;
  final int? themeIndex;
  final int? questionIndex;

  String get key => '$roundIndex/$themeIndex/$questionIndex';
}

class EditorSearchResult {
  const EditorSearchResult({required this.location, required this.label});

  final EditorLocation location;
  final String label;
}

class EditorValidationIssue {
  const EditorValidationIssue({
    required this.message,
    required this.critical,
    required this.location,
  });

  final String message;
  final bool critical;
  final EditorLocation location;
}

class PackageEditorController extends ChangeNotifier {
  PackageEditorController({required PackageService packageService})
    : _packageService = packageService,
      _io = PackageEditorIo(packageService),
      _package = _emptyPackage();

  final PackageService _packageService;
  final PackageEditorIo _io;

  OqPackage _package;
  OqPackage get package => _package;

  final Map<String, EditorMediaFile> mediaFilesByHash = {};
  final Set<String> selectedQuestions = {};

  EditorLocation location = const EditorLocation();
  EditorQuestionFilter filter = EditorQuestionFilter.all;
  String searchQuery = '';
  bool compact = false;
  bool busy = false;
  bool dirty = false;
  DateTime? lastSavedAt;
  PackageUploadState uploadState = const PackageUploadState.idle();

  static OqPackage _emptyPackage() => OqPackage(
    id: -1,
    title: '',
    createdAt: DateTime.now(),
    author: const ShortUserInfo(id: 0, username: 'local'),
    ageRestriction: AgeRestriction.none,
    rounds: const [],
  );

  int get roundCount => _package.rounds.length;
  int get themeCount => _package.rounds.fold(
    0,
    (total, round) => total + round.themes.length,
  );
  int get questionCount => _package.rounds.fold(
    0,
    (total, round) =>
        total +
        round.themes.fold(
          0,
          (themeTotal, theme) => themeTotal + theme.questions.length,
        ),
  );

  PackageHealth get health {
    final issues = validationIssues;
    if (issues.any((issue) => issue.critical)) return PackageHealth.broken;
    if (issues.isNotEmpty) return PackageHealth.needsAttention;
    return PackageHealth.good;
  }

  List<EditorValidationIssue> get validationIssues {
    final issues = <EditorValidationIssue>[];
    if (_package.title.trim().isEmpty) {
      issues.add(
        const EditorValidationIssue(
          message: LocaleKeys.oq_editor_validation_title_required,
          critical: true,
          location: EditorLocation(),
        ),
      );
    }
    if (_package.rounds.isEmpty) {
      issues.add(
        const EditorValidationIssue(
          message: LocaleKeys.oq_editor_validation_rounds_required,
          critical: true,
          location: EditorLocation(),
        ),
      );
    }
    for (var r = 0; r < _package.rounds.length; r++) {
      final round = _package.rounds[r];
      if (round.themes.isEmpty) {
        issues.add(
          EditorValidationIssue(
            message: LocaleKeys.oq_editor_validation_round_empty.tr(
              args: ['${r + 1}'],
            ),
            critical: true,
            location: EditorLocation(roundIndex: r),
          ),
        );
      }
      for (var t = 0; t < round.themes.length; t++) {
        final theme = round.themes[t];
        if (theme.questions.isEmpty) {
          final themeLabel = theme.name.isEmpty ? '${t + 1}' : theme.name;
          issues.add(
            EditorValidationIssue(
              message: LocaleKeys.oq_editor_validation_theme_empty.tr(
                args: [themeLabel],
              ),
              critical: true,
              location: EditorLocation(roundIndex: r, themeIndex: t),
            ),
          );
        }
        for (var q = 0; q < theme.questions.length; q++) {
          final question = theme.questions[q];
          final hasText = (question.text ?? '').trim().isNotEmpty;
          final hasMedia = question.questionFiles?.isNotEmpty ?? false;
          final hasAnswer =
              (question.answerText ?? '').trim().isNotEmpty ||
              (question.answerFiles?.isNotEmpty ?? false);
          if (!hasText && !hasMedia) {
            issues.add(
              EditorValidationIssue(
                message: LocaleKeys.oq_editor_validation_question_content.tr(
                  args: ['${q + 1}'],
                ),
                critical: true,
                location: EditorLocation(
                  roundIndex: r,
                  themeIndex: t,
                  questionIndex: q,
                ),
              ),
            );
          }
          if (!hasAnswer) {
            issues.add(
              EditorValidationIssue(
                message: LocaleKeys.oq_editor_validation_question_answer.tr(
                  args: ['${q + 1}'],
                ),
                critical: true,
                location: EditorLocation(
                  roundIndex: r,
                  themeIndex: t,
                  questionIndex: q,
                ),
              ),
            );
          }
        }
      }
    }
    if ((_package.language ?? '').isEmpty) {
      issues.add(
        const EditorValidationIssue(
          message: LocaleKeys.oq_editor_validation_language,
          critical: false,
          location: EditorLocation(),
        ),
      );
    }
    return issues;
  }

  List<EditorSearchResult> get searchResults {
    final query = searchQuery.trim().toLowerCase();
    if (query.isEmpty) return const [];
    final results = <EditorSearchResult>[];
    for (var r = 0; r < _package.rounds.length; r++) {
      final round = _package.rounds[r];
      if ('${round.name} ${round.description ?? ''}'.toLowerCase().contains(
        query,
      )) {
        results.add(
          EditorSearchResult(
            location: EditorLocation(roundIndex: r),
            label: round.name,
          ),
        );
      }
      for (var t = 0; t < round.themes.length; t++) {
        final theme = round.themes[t];
        if ('${theme.name} ${theme.description ?? ''}'.toLowerCase().contains(
          query,
        )) {
          results.add(
            EditorSearchResult(
              location: EditorLocation(roundIndex: r, themeIndex: t),
              label: '${round.name} → ${theme.name}',
            ),
          );
        }
        for (var q = 0; q < theme.questions.length; q++) {
          final question = theme.questions[q];
          final searchableQuestion = [
            question.text ?? '',
            question.answerText ?? '',
            questionType(question),
          ].join(' ').toLowerCase();
          if (searchableQuestion.contains(query)) {
            final questionLabel =
                question.text ??
                '${LocaleKeys.oq_editor_questions.tr()} ${q + 1}';
            results.add(
              EditorSearchResult(
                location: EditorLocation(
                  roundIndex: r,
                  themeIndex: t,
                  questionIndex: q,
                ),
                label: '${round.name} → ${theme.name} → $questionLabel',
              ),
            );
          }
        }
      }
    }
    return results;
  }

  List<PackageQuestionUnion> questionsFor(int roundIndex, int themeIndex) {
    final questions = _package.rounds[roundIndex].themes[themeIndex].questions;
    if (filter == EditorQuestionFilter.all) return questions;
    return questions
        .where((question) => questionType(question) == filter.name)
        .toList();
  }

  static String questionType(PackageQuestionUnion question) =>
      switch (question) {
        PackageQuestionUnionSimple() => 'simple',
        PackageQuestionUnionStake() => 'stake',
        PackageQuestionUnionSecret() => 'secret',
        PackageQuestionUnionNoRisk() => 'noRisk',
        PackageQuestionUnionChoice() => 'choice',
        PackageQuestionUnionHidden() => 'hidden',
      };

  void select(EditorLocation value) {
    location = value;
    notifyListeners();
  }

  void setSearch(String value) {
    searchQuery = value;
    notifyListeners();
  }

  void setFilter(EditorQuestionFilter value) {
    filter = value;
    notifyListeners();
  }

  void toggleDensity() {
    compact = !compact;
    notifyListeners();
  }

  void updatePackageInfo({
    String? title,
    String? description,
    String? language,
  }) {
    _package = _package.copyWith(
      title: title ?? _package.title,
      description: description ?? _package.description,
      language: language ?? _package.language,
    );
    _changed();
  }

  void addRound() {
    final rounds = [..._package.rounds];
    rounds.add(
      PackageRound(
        order: rounds.length,
        name: 'Round ${rounds.length + 1}',
        type: PackageRoundType.simple,
        themes: const [],
      ),
    );
    _package = _package.copyWith(rounds: rounds);
    location = EditorLocation(roundIndex: rounds.length - 1);
    _changed();
  }

  void updateRound(
    int roundIndex, {
    required String name,
    String? description,
  }) {
    final rounds = [..._package.rounds];
    rounds[roundIndex] = rounds[roundIndex].copyWith(
      name: name,
      description: description,
    );
    _package = _package.copyWith(rounds: rounds);
    _changed();
  }

  void deleteRound(int roundIndex) {
    final rounds = [..._package.rounds]..removeAt(roundIndex);
    _package = _package.copyWith(rounds: _normalizeRounds(rounds));
    location = const EditorLocation();
    _changed();
  }

  void addTheme(int roundIndex) {
    final round = _package.rounds[roundIndex];
    final themes = [...round.themes];
    themes.add(
      PackageTheme(
        order: themes.length,
        name: 'Theme ${themes.length + 1}',
        questions: const [],
      ),
    );
    _replaceRound(roundIndex, round.copyWith(themes: themes));
    location = EditorLocation(
      roundIndex: roundIndex,
      themeIndex: themes.length - 1,
    );
    _changed();
  }

  void updateTheme(
    int roundIndex,
    int themeIndex, {
    required String name,
    String? description,
  }) {
    final round = _package.rounds[roundIndex];
    final themes = [...round.themes];
    themes[themeIndex] = themes[themeIndex].copyWith(
      name: name,
      description: description,
    );
    _replaceRound(roundIndex, round.copyWith(themes: themes));
    _changed();
  }

  void deleteTheme(int roundIndex, int themeIndex) {
    final round = _package.rounds[roundIndex];
    final themes = [...round.themes]..removeAt(themeIndex);
    _replaceRound(roundIndex, round.copyWith(themes: _normalizeThemes(themes)));
    location = EditorLocation(roundIndex: roundIndex);
    _changed();
  }

  void addQuestion(int roundIndex, int themeIndex) {
    final theme = _package.rounds[roundIndex].themes[themeIndex];
    final questions = [...theme.questions];
    questions.add(
      PackageQuestionUnion.simple(
        order: questions.length,
        price: (questions.length + 1) * 100,
        showAnswerDuration: 5000,
        text: '',
        answerText: '',
      ),
    );
    _replaceTheme(roundIndex, themeIndex, theme.copyWith(questions: questions));
    location = EditorLocation(
      roundIndex: roundIndex,
      themeIndex: themeIndex,
      questionIndex: questions.length - 1,
    );
    _changed();
  }

  void updateQuestion(
    int roundIndex,
    int themeIndex,
    int questionIndex, {
    required String text,
    required String answer,
    required int? price,
  }) {
    final theme = _package.rounds[roundIndex].themes[themeIndex];
    final questions = [...theme.questions];
    questions[questionIndex] = questions[questionIndex].copyWith(
      text: text,
      answerText: answer,
      price: price,
    );
    _replaceTheme(roundIndex, themeIndex, theme.copyWith(questions: questions));
    _changed();
  }

  Future<void> addMedia(
    int roundIndex,
    int themeIndex,
    int questionIndex, {
    required bool answerMedia,
  }) async {
    final result = await FilePicker.pickFiles(
      type: FileType.custom,
      allowedExtensions: const [
        'jpg',
        'jpeg',
        'png',
        'gif',
        'webp',
        'mp3',
        'wav',
        'ogg',
        'mp4',
        'webm',
      ],
      withData: true,
    );
    final platformFile = result?.files.single;
    final bytes = platformFile?.bytes;
    if (platformFile == null || bytes == null) return;

    final hash = md5.convert(bytes).toString();
    final fileType = _mediaType(platformFile.extension);
    mediaFilesByHash[hash] = EditorMediaFile(platformFile: platformFile);

    final theme = _package.rounds[roundIndex].themes[themeIndex];
    final questions = [...theme.questions];
    final question = questions[questionIndex];
    final files = [
      ...?(answerMedia ? question.answerFiles : question.questionFiles),
    ];
    files.add(
      PackageQuestionFile(
        order: files.length,
        file: FileItem(md5: hash, type: fileType),
        displayTime: null,
      ),
    );
    questions[questionIndex] = answerMedia
        ? question.copyWith(answerFiles: files)
        : question.copyWith(questionFiles: files);
    _replaceTheme(
      roundIndex,
      themeIndex,
      theme.copyWith(questions: questions),
    );
    _changed();
  }

  PackageFileType _mediaType(String? extension) {
    return switch (extension?.toLowerCase()) {
      'mp3' || 'wav' || 'ogg' => PackageFileType.audio,
      'mp4' || 'webm' => PackageFileType.video,
      _ => PackageFileType.image,
    };
  }

  void deleteQuestion(int roundIndex, int themeIndex, int questionIndex) {
    final theme = _package.rounds[roundIndex].themes[themeIndex];
    final questions = [...theme.questions]..removeAt(questionIndex);
    _replaceTheme(
      roundIndex,
      themeIndex,
      theme.copyWith(questions: _normalizeQuestions(questions)),
    );
    location = EditorLocation(roundIndex: roundIndex, themeIndex: themeIndex);
    _changed();
  }

  void toggleQuestionSelection(
    int roundIndex,
    int themeIndex,
    int questionIndex,
  ) {
    final key = EditorLocation(
      roundIndex: roundIndex,
      themeIndex: themeIndex,
      questionIndex: questionIndex,
    ).key;
    if (!selectedQuestions.add(key)) selectedQuestions.remove(key);
    notifyListeners();
  }

  void deleteSelected() {
    final locations =
        selectedQuestions
            .map(_parseLocation)
            .where((item) => item.questionIndex != null)
            .toList()
          ..sort((a, b) {
            final round = b.roundIndex!.compareTo(a.roundIndex!);
            if (round != 0) return round;
            final theme = b.themeIndex!.compareTo(a.themeIndex!);
            if (theme != 0) return theme;
            return b.questionIndex!.compareTo(a.questionIndex!);
          });
    for (final item in locations) {
      deleteQuestion(item.roundIndex!, item.themeIndex!, item.questionIndex!);
    }
    selectedQuestions.clear();
    notifyListeners();
  }

  void duplicateSelected() {
    final grouped = <String, List<int>>{};
    for (final key in selectedQuestions) {
      final item = _parseLocation(key);
      grouped
          .putIfAbsent('${item.roundIndex}/${item.themeIndex}', () => [])
          .add(item.questionIndex!);
    }
    for (final entry in grouped.entries) {
      final parts = entry.key.split('/').map(int.parse).toList();
      final r = parts[0];
      final t = parts[1];
      final theme = _package.rounds[r].themes[t];
      final questions = [...theme.questions];
      for (final index in entry.value..sort()) {
        questions.add(theme.questions[index].copyWith(order: questions.length));
      }
      _replaceTheme(r, t, theme.copyWith(questions: questions));
    }
    selectedQuestions.clear();
    _changed();
  }

  void moveSelected(int targetRoundIndex, int targetThemeIndex) {
    final locations = selectedQuestions.map(_parseLocation).toList()
      ..sort((a, b) {
        final round = a.roundIndex!.compareTo(b.roundIndex!);
        if (round != 0) return round;
        final theme = a.themeIndex!.compareTo(b.themeIndex!);
        if (theme != 0) return theme;
        return a.questionIndex!.compareTo(b.questionIndex!);
      });
    final moving = [
      for (final item in locations)
        _package
            .rounds[item.roundIndex!]
            .themes[item.themeIndex!]
            .questions[item.questionIndex!],
    ];
    final descending = [...locations]
      ..sort((a, b) {
        final round = b.roundIndex!.compareTo(a.roundIndex!);
        if (round != 0) return round;
        final theme = b.themeIndex!.compareTo(a.themeIndex!);
        if (theme != 0) return theme;
        return b.questionIndex!.compareTo(a.questionIndex!);
      });
    for (final item in descending) {
      final theme = _package.rounds[item.roundIndex!].themes[item.themeIndex!];
      final questions = [...theme.questions]..removeAt(item.questionIndex!);
      _replaceTheme(
        item.roundIndex!,
        item.themeIndex!,
        theme.copyWith(questions: _normalizeQuestions(questions)),
      );
    }
    final target = _package.rounds[targetRoundIndex].themes[targetThemeIndex];
    final targetQuestions = [...target.questions];
    for (final question in moving) {
      targetQuestions.add(question.copyWith(order: targetQuestions.length));
    }
    _replaceTheme(
      targetRoundIndex,
      targetThemeIndex,
      target.copyWith(questions: targetQuestions),
    );
    selectedQuestions.clear();
    location = EditorLocation(
      roundIndex: targetRoundIndex,
      themeIndex: targetThemeIndex,
    );
    _changed();
  }

  void reorderQuestion(
    int roundIndex,
    int themeIndex,
    int oldIndex,
    int targetIndex,
  ) {
    final theme = _package.rounds[roundIndex].themes[themeIndex];
    final questions = [...theme.questions];
    final question = questions.removeAt(oldIndex);
    questions.insert(targetIndex, question);
    _replaceTheme(
      roundIndex,
      themeIndex,
      theme.copyWith(questions: _normalizeQuestions(questions)),
    );
    _changed();
  }

  Future<void> importPackage() async {
    await _runBusy(() async {
      final result = await _io.importPackage();
      if (result == null) return;
      _package = result.package;
      mediaFilesByHash
        ..clear()
        ..addEntries(
          result.filesBytesByHash.entries.map(
            (entry) => MapEntry(
              entry.key,
              EditorMediaFile.fromBytes(entry.key, entry.value),
            ),
          ),
        );
      location = const EditorLocation();
      dirty = true;
    });
  }

  Future<void> exportPackage() async {
    await _runBusy(() => _io.exportPackage(_package, mediaFilesByHash));
    lastSavedAt = DateTime.now();
    dirty = false;
    notifyListeners();
  }

  Future<int> saveToServer() async {
    int? packageId;
    await _runBusy(() async {
      await for (final state in _packageService.uploadPackage(
        packageInput: _packageService.convertOqPackageToInput(_package),
        mediaFilesByHash: mediaFilesByHash,
      )) {
        uploadState = state;
        if (state.phase == PackageUploadPhase.completed) {
          packageId = state.packageId;
        }
        if (state.phase == PackageUploadPhase.error) {
          throw Exception(state.error.toString());
        }
        notifyListeners();
      }
    });
    if (packageId == null) throw StateError('Package upload did not complete');
    _package = _package.copyWith(id: packageId!);
    lastSavedAt = DateTime.now();
    dirty = false;
    notifyListeners();
    return packageId!;
  }

  Future<void> _runBusy(Future<void> Function() action) async {
    busy = true;
    notifyListeners();
    try {
      await action();
    } finally {
      busy = false;
      notifyListeners();
    }
  }

  void _replaceRound(int index, PackageRound round) {
    final rounds = [..._package.rounds];
    rounds[index] = round;
    _package = _package.copyWith(rounds: rounds);
  }

  void _replaceTheme(int roundIndex, int themeIndex, PackageTheme theme) {
    final round = _package.rounds[roundIndex];
    final themes = [...round.themes];
    themes[themeIndex] = theme;
    _replaceRound(roundIndex, round.copyWith(themes: themes));
  }

  List<PackageRound> _normalizeRounds(List<PackageRound> rounds) => [
    for (var i = 0; i < rounds.length; i++) rounds[i].copyWith(order: i),
  ];

  List<PackageTheme> _normalizeThemes(List<PackageTheme> themes) => [
    for (var i = 0; i < themes.length; i++) themes[i].copyWith(order: i),
  ];

  List<PackageQuestionUnion> _normalizeQuestions(
    List<PackageQuestionUnion> questions,
  ) => [
    for (var i = 0; i < questions.length; i++) questions[i].copyWith(order: i),
  ];

  EditorLocation _parseLocation(String value) {
    final parts = value.split('/');
    int? parse(String part) => part == 'null' ? null : int.parse(part);
    return EditorLocation(
      roundIndex: parse(parts[0]),
      themeIndex: parse(parts[1]),
      questionIndex: parse(parts[2]),
    );
  }

  void _changed() {
    dirty = true;
    notifyListeners();
  }
}
