import 'package:flutter_test/flutter_test.dart';
import 'package:openapi/openapi.dart';
import 'package:oq_editor/oq_editor.dart';

void main() {
  group('OqEditorController', () {
    test('repairs selected question after deleting its theme', () {
      final controller = OqEditorController(
        translations: _TestTranslations(),
        initialPackage: _packageWithQuestion(),
      );

      final selectedNode =
          (controller
                ..selectQuestion(0, 0, 0)
                ..deleteTheme(0, 0))
              .selectedNode
              .value;

      expect(selectedNode, const EditorNodeId.round(0));
    });

    test('updates package from save adapter completion event', () async {
      final controller = OqEditorController(
        translations: _TestTranslations(),
        initialPackage: _validPackage(),
        saveAdapter: (request) async* {
          yield const PackageEditorOperationEvent.running(
            phase: PackageEditorOperationPhase.creatingPackage,
            progress: 0.2,
            message: 'creating',
          );
          yield PackageEditorOperationEvent.completed(
            package: request.package.copyWith(id: 42),
            message: 'saved',
          );
        },
      );

      final savedPackage = await controller.savePackage();

      expect(savedPackage.id, 42);
      expect(controller.package.value.id, 42);
      expect(
        controller.operationState.value,
        isA<PackageEditorOperationCompleted>(),
      );
    });

    test('creates round theme and question in order', () {
      final controller =
          OqEditorController(
              translations: _TestTranslations(),
              initialPackage: _validPackage(),
            )
            ..createRound()
            ..createTheme(0)
            ..createQuestion(0, 0);

      final round = controller.package.value.rounds.single;
      final theme = round.themes.single;

      expect(round.order, 0);
      expect(round.name, 'translation');
      expect(theme.order, 0);
      expect(theme.name, 'translation');
      expect(theme.questions.single.order, 0);
      expect(
        controller.selectedNode.value,
        const EditorNodeId.question(0, 0, 0),
      );
    });

    test('copies question after source and clears copied id', () {
      final controller = OqEditorController(
        translations: _TestTranslations(),
        initialPackage: _packageWithQuestion(),
      )..copyQuestion(0, 0, 0);

      final questions =
          controller.package.value.rounds.single.themes.single.questions;

      expect(questions, hasLength(2));
      expect(questions[0].id, 1);
      expect(questions[1].id, isNull);
      expect(questions[1].order, 1);
      expect(
        controller.selectedNode.value,
        const EditorNodeId.question(0, 0, 1),
      );
    });
  });
}

OqPackage _validPackage() {
  return OqPackage(
    id: -1,
    title: 'Package',
    description: '',
    createdAt: DateTime(2024),
    author: const ShortUserInfo(id: 1, username: 'author'),
    ageRestriction: AgeRestriction.none,
    language: 'en',
    rounds: [],
    tags: [],
  );
}

OqPackage _packageWithQuestion() {
  return _validPackage().copyWith(
    rounds: [
      const PackageRound(
        order: 0,
        name: 'Round',
        description: '',
        type: PackageRoundType.simple,
        themes: [
          PackageTheme(
            order: 0,
            name: 'Theme',
            description: '',
            questions: [
              PackageQuestionUnion.simple(
                id: 1,
                order: 0,
                price: 100,
                showAnswerDuration: 5000,
                text: 'Question',
                answerText: 'Answer',
                answerDelay: 5000,
              ),
            ],
          ),
        ],
      ),
    ],
  );
}

class _TestTranslations implements OqEditorTranslations {
  @override
  dynamic noSuchMethod(Invocation invocation) {
    final memberName = invocation.memberName.toString();
    if (memberName.contains('uploadingFile')) return 'uploading';
    if (memberName.contains('questionsInTheme')) return 'questions';
    if (memberName.contains('themesCount')) return 'themes';
    if (memberName.contains('minLengthError')) return 'min length';
    if (memberName.contains('maxLengthError')) return 'max length';
    if (memberName.contains('deleteConfirmMessage')) return 'delete';
    if (memberName.contains('displayTimeValue')) return 'display time';
    if (memberName.contains('packageSizeMB')) return 'package size';
    if (memberName.contains('encodingNotSupportedDetails')) {
      return 'encoding';
    }
    return 'translation';
  }
}
