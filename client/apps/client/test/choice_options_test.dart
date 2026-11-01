import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:openquester/openquester.dart' hide test;

void main() {
  late GameLobbyController lobby;
  const options = [
    QuestionChoiceAnswers(order: 0, text: 'First option'),
    QuestionChoiceAnswers(order: 1, text: 'Second option'),
  ];

  setUp(() async {
    await getIt.reset();
    lobby = GameLobbyController();
    final profile = ProfileController()
      ..user.value = ResponseUser(
        id: 7,
        username: 'Player',
        createdAt: DateTime.utc(2026),
        updatedAt: DateTime.utc(2026),
        isDeleted: false,
        isBanned: false,
        isGuest: false,
        permissions: [],
      );
    getIt
      ..registerSingleton<GameLobbyController>(lobby)
      ..registerSingleton<ProfileController>(profile);
    lobby.gameData.value = SocketIoGameJoinEventPayload(
      meta: const SocketIoGameJoinMeta(
        title: 'Quiz',
        settings: GameSettings(
          buttonPressMode: ButtonPressMode.firstWins,
          wrongAnswerPenalty: WrongAnswerPenalty.subtract,
          timers: GameTimerSettings(),
          falseStart: false,
        ),
      ),
      players: const [
        PlayerData(
          meta: PlayerMeta(id: 7, username: 'Player'),
          role: PlayerRole.player,
          restrictionData: PlayerRestrictions(
            muted: false,
            restricted: false,
            banned: false,
          ),
          score: 0,
          status: PlayerDataStatus.inGame,
        ),
      ],
      gameState: GameState(
        isPaused: false,
        questionState: GameStateQuestionState.showing,
        currentQuestion: const PackageQuestion(
          type: QuestionType.choice,
          order: 0,
          price: 100,
          showAnswerDuration: null,
        ),
        timer: GameStateTimer(
          startedAt: DateTime.utc(2100),
          durationMs: 30000,
          elapsedMs: 0,
        ),
        buzzerOpensAtMs: 0,
      ),
      chatMessages: [],
    );
  });
  tearDown(getIt.reset);

  Future<void> show(WidgetTester tester) => tester.pumpWidget(
    MaterialApp(
      theme: ThemeData(
        extensions: const [
          ExtraColors(
            success: Colors.green,
            warning: Colors.orange,
            gold: Colors.yellow,
            silver: Colors.grey,
            bronze: Colors.brown,
          ),
        ],
      ),
      home: const Scaffold(
        body: GameChoiceOptions(answers: options, showDelayMs: 1000),
      ),
    ),
  );

  testWidgets('false starts off still waits for the choice delay', (
    tester,
  ) async {
    await show(tester);
    expect(find.text('First option'), findsNothing);
    lobby.gameData.value = lobby.gameData.value!.copyWith.gameState(
      timer: lobby.gameData.value!.gameState.timer!.copyWith(elapsedMs: 1000),
    );
    await tester.pump();
    expect(find.text('First option'), findsOneWidget);
    expect(find.text('Second option'), findsOneWidget);
    await tester.pumpWidget(const SizedBox());
  });

  testWidgets(
    'paused choice delay does not reveal options as wall time passes',
    (tester) async {
      lobby.gameData.value = lobby.gameData.value!.copyWith.gameState(
        isPaused: true,
      );
      await show(tester);
      await tester.pump(const Duration(seconds: 2));
      expect(find.text('First option'), findsNothing);
      lobby.gameData.value = lobby.gameData.value!.copyWith.gameState(
        isPaused: false,
        timer: lobby.gameData.value!.gameState.timer!.copyWith(elapsedMs: 1000),
      );
      await tester.pump();
      expect(find.text('First option'), findsOneWidget);
      await tester.pumpWidget(const SizedBox());
    },
  );

  testWidgets('server content deadline stays in force with false starts on', (
    tester,
  ) async {
    lobby.gameData.value = lobby.gameData.value!.copyWith.gameState(
      buzzerOpensAtMs: 4000,
      timer: lobby.gameData.value!.gameState.timer!.copyWith(elapsedMs: 1000),
    );
    await show(tester);
    expect(find.text('First option'), findsNothing);
    lobby.gameData.value = lobby.gameData.value!.copyWith.gameState(
      timer: lobby.gameData.value!.gameState.timer!.copyWith(elapsedMs: 4000),
    );
    await tester.pump();
    expect(find.text('First option'), findsOneWidget);
    await tester.pumpWidget(const SizedBox());
  });

  testWidgets('the answer timer never hides options again', (tester) async {
    lobby.gameData.value = lobby.gameData.value!.copyWith.gameState(
      answeringPlayer: 7,
      buzzerOpensAtMs: 4000,
    );
    await show(tester);
    expect(find.text('First option'), findsOneWidget);
    await tester.pumpWidget(const SizedBox());
  });
}
