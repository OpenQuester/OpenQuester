import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:openquester/openquester.dart' hide test;

void main() {
  late PackageEditorController controller;

  setUp(() {
    controller = PackageEditorController(packageService: PackageService());
  });

  tearDown(() => controller.dispose());

  test('builds a package and reports actionable validation health', () {
    expect(controller.health, PackageHealth.broken);

    controller
      ..updatePackageInfo(title: 'Demo', language: 'en')
      ..addRound()
      ..addTheme(0)
      ..addQuestion(0, 0)
      ..updateQuestion(
        0,
        0,
        0,
        text: 'Capital of France?',
        answer: 'Paris',
        price: 100,
      );

    expect(controller.roundCount, 1);
    expect(controller.themeCount, 1);
    expect(controller.questionCount, 1);
    expect(controller.health, PackageHealth.good);
    expect(controller.dirty, isTrue);
  });

  test('search returns a contextual question path', () {
    controller
      ..addRound()
      ..addTheme(0)
      ..addQuestion(0, 0)
      ..updateQuestion(
        0,
        0,
        0,
        text: 'Where is Mount Fuji?',
        answer: 'Japan',
        price: 200,
      )
      ..setSearch('japan');

    expect(controller.searchResults, hasLength(1));
    expect(controller.searchResults.single.label, contains('Theme 1'));
    expect(controller.searchResults.single.location.questionIndex, 0);
  });

  test('batch duplicate and delete keep question order normalized', () {
    controller
      ..addRound()
      ..addTheme(0)
      ..addQuestion(0, 0)
      ..toggleQuestionSelection(0, 0, 0)
      ..duplicateSelected();

    var questions = controller.package.rounds.single.themes.single.questions;
    expect(questions, hasLength(2));
    expect(questions.map((question) => question.order), [0, 1]);

    controller
      ..toggleQuestionSelection(0, 0, 0)
      ..toggleQuestionSelection(0, 0, 1)
      ..deleteSelected();

    questions = controller.package.rounds.single.themes.single.questions;
    expect(questions, isEmpty);
  });

  test('batch move and reorder preserve all selected questions', () {
    controller
      ..addRound()
      ..addTheme(0)
      ..addTheme(0)
      ..addQuestion(0, 0)
      ..updateQuestion(0, 0, 0, text: 'First', answer: 'A', price: 100)
      ..addQuestion(0, 0)
      ..updateQuestion(0, 0, 1, text: 'Second', answer: 'B', price: 200)
      ..reorderQuestion(0, 0, 0, 1);

    var source = controller.package.rounds.single.themes.first.questions;
    expect(source.first.text, 'Second');
    expect(source.map((question) => question.order), [0, 1]);

    controller
      ..toggleQuestionSelection(0, 0, 0)
      ..toggleQuestionSelection(0, 0, 1)
      ..moveSelected(0, 1);

    source = controller.package.rounds.single.themes.first.questions;
    final target = controller.package.rounds.single.themes.last.questions;
    expect(source, isEmpty);
    expect(target.map((question) => question.text), ['Second', 'First']);
    expect(target.map((question) => question.order), [0, 1]);
  });

  test('changing question type preserves common fields', () {
    controller
      ..addRound()
      ..addTheme(0)
      ..addQuestion(0, 0)
      ..updateQuestionDetails(
        0,
        0,
        0,
        text: 'Question',
        answer: 'Answer',
        price: 300,
        showAnswerDuration: 7000,
        answerDelay: 2500,
        isHidden: false,
        answerHint: 'Hint',
        questionComment: 'Comment',
      )
      ..changeQuestionType(0, 0, 0, EditorQuestionFilter.stake);

    var question =
        controller.package.rounds.single.themes.single.questions.single;
    expect(question, isA<PackageQuestionUnionStake>());
    expect(question.text, 'Question');
    expect(question.answerText, 'Answer');
    expect(question.price, 300);
    expect(question.showAnswerDuration, 7000);
    expect(question.answerDelay, 2500);
    expect(question.answerHint, 'Hint');
    expect(question.questionComment, 'Comment');

    controller.changeQuestionType(0, 0, 0, EditorQuestionFilter.choice);
    question = controller.package.rounds.single.themes.single.questions.single;
    expect(question, isA<PackageQuestionUnionChoice>());
    expect((question as PackageQuestionUnionChoice).answers, hasLength(2));
    expect(question.text, 'Question');
  });

  test(
    'two media files create question and answer text from filenames',
    () async {
      controller
        ..addRound()
        ..addTheme(0);

      final result = await controller.addQuestionFromMediaFiles(0, 0, [
        PlatformFile(
          name: 'Capital_of-France.jpg',
          size: 3,
          bytes: Uint8List.fromList([1, 2, 3]),
        ),
        PlatformFile(
          name: 'Paris.png',
          size: 3,
          bytes: Uint8List.fromList([4, 5, 6]),
        ),
      ]);

      expect(result, MediaPairImportResult.added);
      final question =
          controller.package.rounds.single.themes.single.questions.single;
      expect(question.text, 'Capital of France');
      expect(question.answerText, 'Paris');
      expect(question.questionFiles, hasLength(1));
      expect(question.answerFiles, hasLength(1));
      expect(question.questionFiles!.single.file.type, PackageFileType.image);
      expect(question.answerFiles!.single.file.type, PackageFileType.image);
      expect(controller.mediaFilesByHash, hasLength(2));
      expect(controller.location.questionIndex, 0);

      controller.changeQuestionType(0, 0, 0, EditorQuestionFilter.secret);
      final converted =
          controller.package.rounds.single.themes.single.questions.single;
      expect(converted, isA<PackageQuestionUnionSecret>());
      expect(converted.questionFiles, hasLength(1));
      expect(converted.answerFiles, hasLength(1));
      expect(controller.mediaFilesByHash, hasLength(2));
    },
  );

  test(
    'media-pair automation rejects selections that are not two files',
    () async {
      controller
        ..addRound()
        ..addTheme(0);

      final result = await controller.addQuestionFromMediaFiles(0, 0, [
        PlatformFile(
          name: 'question.jpg',
          size: 1,
          bytes: Uint8List.fromList([1]),
        ),
      ]);

      expect(result, MediaPairImportResult.requiresTwoFiles);
      expect(
        controller.package.rounds.single.themes.single.questions,
        isEmpty,
      );
    },
  );

  test('unreadable media pair does not leave orphaned hashes', () async {
    controller
      ..addRound()
      ..addTheme(0);

    final result = await controller.addQuestionFromMediaFiles(0, 0, [
      PlatformFile(
        name: 'question.jpg',
        size: 1,
        bytes: Uint8List.fromList([1]),
      ),
      PlatformFile(
        name: 'answer.jpg',
        size: 0,
        bytes: Uint8List(0),
      ),
    ]);

    expect(result, MediaPairImportResult.unreadableFile);
    expect(controller.mediaFilesByHash, isEmpty);
    expect(
      controller.package.rounds.single.themes.single.questions,
      isEmpty,
    );
  });
}
