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
}
