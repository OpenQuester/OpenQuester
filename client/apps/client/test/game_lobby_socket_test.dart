import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:openquester/openquester.dart' hide test;
import 'package:socket_io_client/socket_io_client.dart';

class _Logger extends Mock implements TalkerLogger {}

class _Api extends Mock implements Api {}

class _Rest extends Mock implements RestClient {}

class _Games extends Mock implements GamesClient {}

class _Game extends Mock implements GameListItem {}

class _Sockets extends Mock implements SocketController {}

class _Chat extends Mock implements SocketChatController {}

class _Question extends Mock implements GameQuestionController {
  @override
  final questionData = ValueNotifier<GameQuestionData?>(null);
}

class _Picker extends Mock implements GameLobbyPlayerPickerController {}

class _Themes extends Mock implements GameLobbyThemePickerController {}

class _Stakes extends Mock implements GameLobbyPlayerStakesController {}

class _Review extends Mock implements GameLobbyReviewController {}

class _Final extends Mock implements GameLobbyFinalAnswerController {}

class _Sounds extends Mock implements GameSoundController {}

class _Socket extends Mock implements Socket {
  final handlers = <String, List<dynamic Function(dynamic)>>{};

  @override
  void Function() on(String event, dynamic Function(dynamic) handler) {
    (handlers[event] ??= []).add(handler);
    return () => handlers[event]?.remove(handler);
  }

  Future<void> receive(String event, dynamic data) async {
    for (final handler in handlers[event] ?? <dynamic Function(dynamic)>[]) {
      await handler(data);
    }
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  late GameLobbyController lobby;
  late _Socket socket;
  const snapshot = SocketIoGameJoinEventPayload(
    meta: SocketIoGameJoinMeta(
      title: 'Quiz',
      settings: GameSettings(
        buttonPressMode: ButtonPressMode.firstWins,
        wrongAnswerPenalty: WrongAnswerPenalty.subtract,
        timers: GameTimerSettings(),
      ),
    ),
    players: [],
    gameState: GameState(isPaused: false),
    chatMessages: [],
  );

  setUp(() async {
    await getIt.reset();
    final api = _Api();
    final rest = _Rest();
    final games = _Games();
    final game = _Game();
    final sockets = _Sockets();
    final chat = _Chat();
    final question = _Question();
    socket = _Socket();
    when(() => socket.io).thenReturn(
      io('http://localhost', <String, dynamic>{
        'autoConnect': false,
        'forceNew': true,
      }).io,
    );
    when(() => api.api).thenReturn(rest);
    when(() => rest.games).thenReturn(games);
    when(
      () => games.getV1GamesGameId(gameId: 'quiz'),
    ).thenAnswer((_) async => game);
    when(() => game.isPrivate).thenReturn(false);
    when(
      () => sockets.createConnection(path: '/games'),
    ).thenAnswer((_) async => socket);
    final listening = Completer<void>();
    when(socket.connect).thenAnswer((_) {
      listening.complete();
      return socket;
    });
    when(question.clear).thenAnswer((_) async {});
    when(
      () => chat.init(
        socket: socket,
        messages: any(named: 'messages'),
      ),
    ).thenAnswer((_) async {});
    getIt
      ..registerSingleton<TalkerLogger>(_Logger())
      ..registerSingleton<Api>(api)
      ..registerSingleton<SocketController>(sockets)
      ..registerSingleton<SocketChatController>(chat)
      ..registerSingleton<GameQuestionController>(question)
      ..registerSingleton<GameLobbyPlayerPickerController>(_Picker())
      ..registerSingleton<GameLobbyThemePickerController>(_Themes())
      ..registerSingleton<GameLobbyPlayerStakesController>(_Stakes())
      ..registerSingleton<GameLobbyReviewController>(_Review())
      ..registerSingleton<GameLobbyFinalAnswerController>(_Final())
      ..registerSingleton<GameSoundController>(_Sounds());
    lobby = GameLobbyController();
    final joining = lobby.join(gameId: 'quiz');
    await listening.future;
    expect(socket.handlers, contains('game-data'));
    await socket.receive('game-data', snapshot.toJson());
    expect(await joining, isTrue);
  });

  tearDown(() async {
    await lobby.clear();
    await getIt.reset();
  });

  test('choice delay survives snapshots and new question payloads', () async {
    final choice = <String, dynamic>{
      'type': 'choice',
      'order': 0,
      'price': 100,
      'showAnswerDuration': null,
      'showDelay': 1500,
      'answers': [
        {'order': 0, 'text': 'First'},
        {'order': 1, 'text': 'Second'},
      ],
    };
    final data = snapshot.toJson();
    (data['gameState']! as Map<String, dynamic>)['currentQuestion'] = choice;
    await socket.receive('game-data', data);
    expect(lobby.choiceShowDelayMs.value, 1500);
    expect(lobby.choiceAnswers.value, hasLength(2));
    final timer = GameStateTimer(
      startedAt: DateTime.utc(2100),
      durationMs: 30000,
      elapsedMs: 0,
    ).toJson();
    await socket.receive('question-data', <String, dynamic>{
      'data': {...choice, 'showDelay': 2500},
      'timer': timer,
    });
    expect(lobby.choiceShowDelayMs.value, 2500);
    await socket.receive('question-data', <String, dynamic>{
      'data': {...choice, 'type': 'simple'},
      'timer': timer,
    });
    expect(lobby.choiceShowDelayMs.value, 0);
    expect(lobby.choiceAnswers.value, isNull);
  });

  test(
    'early buzzer-open clears locks and replaces the deadline',
    () async {
      final timer = GameStateTimer(
        startedAt: DateTime.utc(2100),
        durationMs: 30000,
        elapsedMs: 1500,
      );
      lobby.gameData.value = snapshot.copyWith.gameState(
        questionState: GameStateQuestionState.showing,
        currentQuestion: const PackageQuestion(
          type: QuestionType.simple,
          order: 0,
          price: 100,
          showAnswerDuration: null,
        ),
        timer: timer,
        buzzerOpensAtMs: 8000,
        buzzerLocks: {'7': DateTime.utc(2100).millisecondsSinceEpoch},
      );
      lobby.buzzerLockedUntil.value = DateTime.utc(2100);
      expect(lobby.gameData.value!.gameState.buzzerOpensAt(), isNotNull);
      await socket.receive('buzzer-open', <String, dynamic>{
        'buzzerOpensAtMs': 1500,
      });
      final state = lobby.gameData.value!.gameState;
      expect(state.buzzerOpensAtMs, 1500);
      expect(state.buzzerLocks, isNull);
      expect(lobby.buzzerLockedUntil.value, isNull);
      expect(state.buzzerOpensAt(), isNull);
      expect(state.timer, timer);
      expect(state.questionState, GameStateQuestionState.showing);
    },
  );
}
