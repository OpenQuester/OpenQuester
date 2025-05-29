import 'dart:async';
import 'dart:math';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_chat_core/flutter_chat_core.dart'
    show ChatOperation, ChatOperationType, SystemMessage, TextMessage;
import 'package:openquester/openquester.dart';
import 'package:socket_io_client/socket_io_client.dart';

@singleton
class GameLobbyController {
  Socket? socket;
  String? _gameId;

  final gameData = ValueNotifier<SocketIOGameJoinEventPayload?>(null);
  final gameListData = ValueNotifier<GameListItem?>(null);
  final gameFinished = ValueNotifier<bool>(false);

  final showChat = ValueNotifier<bool>(false);
  StreamSubscription<ChatOperation>? _chatMessagesSub;
  double? themeScrollPosition;

  String? get gameId => _gameId;

  Future<void> join({required String gameId}) async {
    // Check if already joined
    if (_gameId == gameId) return;

    clear();

    try {
      _gameId = gameId;

      // Get list game data
      unawaited(
        Api.I.api.games
            .getV1GamesGameId(gameId: gameId)
            .then((value) => gameListData.value = value),
      );

      socket = await getIt<SocketController>().createConnection(path: '/games');
      socket!
        ..onConnect((_) => _onConnect())
        // TODO: Add on disconnect pause state
        ..on(SocketIOEvents.error.json!, onError)
        ..on(SocketIOGameReceiveEvents.gameData.json!, _onGameData)
        ..on(SocketIOGameReceiveEvents.start.json!, _onGameStart)
        ..on(SocketIOGameReceiveEvents.userLeave.json!, _onUserLeave)
        ..on(SocketIOGameReceiveEvents.join.json!, _onUserJoin)
        ..on(SocketIOGameReceiveEvents.questionData.json!, _onQuestionPick)
        ..on(SocketIOGameReceiveEvents.questionAnswer.json!, _onQuestionAnswer)
        ..on(SocketIOGameReceiveEvents.answerResult.json!, _onAnswerResult)
        ..on(SocketIOGameReceiveEvents.questionFinish.json!, _onQuestionFinish)
        ..on(SocketIOGameReceiveEvents.answerSubmitted.json!, _onAnswerResult)
        ..on(SocketIOGameReceiveEvents.nextRound.json!, _onNextRound)
        ..on(SocketIOGameReceiveEvents.gameFinished.json!, _onGameFinish)
        ..on(SocketIOGameReceiveEvents.gamePause.json!, _onGamePause)
        ..on(SocketIOGameReceiveEvents.gameUnpause.json!, _onGameUnPause)
        ..connect();
    } catch (e, s) {
      logger.e(e, stackTrace: s);
      clear();

      rethrow;
    }
  }

  Future<void> _onConnect() async {
    try {
      await getIt<Api>().api.auth.postV1AuthSocket(
        body: InputSocketIOAuth(socketId: socket!.id!),
      );

      final iAmHost =
          gameListData.value!.createdBy.id == ProfileController.getUser()?.id;

      final ioGameJoinInput = SocketIOGameJoinInput(
        gameId: _gameId!,
        role: iAmHost
            ? SocketIOGameJoinInputRole.showman
            : SocketIOGameJoinInputRole.player,
      );

      socket?.emit(SocketIOGameSendEvents.join.json!, ioGameJoinInput.toJson());
    } catch (e, s) {
      logger.e(e, stackTrace: s);
      clear();

      // Show error toast
      await getIt<ToastController>().show(
        e is DioException && e.response?.statusCode == 401
            ? LocaleKeys.user_unauthorized.tr()
            : e,
      );

      // Close game
      await AppRouter.I.replace(const HomeTabsRoute());
    }
  }

  Future<void> _onChatMessage(ChatOperation chatOperation) async {
    // Dont show toast if chat is open
    if (showChat.value) return;

    if (chatOperation.type != ChatOperationType.insert) return;
    final message = chatOperation.message;
    final text = switch (message) {
      TextMessage() => message.text,
      SystemMessage() => message.text,
      _ => null,
    };
    if (text.isEmptyOrNull) return;

    final author = gameData.value?.players.getById(
      int.tryParse(message?.authorId ?? ''),
    );
    await getIt<ToastController>().show(
      text?.trim(),
      title: author?.meta.username,
      type: ToastType.chat,
    );
  }

  /// Clear all fields for new game to use
  void clear() {
    try {
      _gameId = null;
      socket?.dispose();
      socket = null;
      gameData.value = null;
      gameListData.value = null;
      _chatMessagesSub?.cancel();
      _chatMessagesSub = null;
      showChat.value = false;
      gameFinished.value = false;
      themeScrollPosition = null;
      getIt<SocketChatController>().clear();
      getIt<GameQuestionController>().clear();
    } catch (_) {}
  }

  Future<void> leave({bool force = false}) async {
    socket?.emit(SocketIOGameSendEvents.userLeave.json!);
    if (force) {
      _leave();
    } else {
      Future<void>.delayed(const Duration(seconds: 1), () {
        if (socket != null) clear();
      });
    }
  }

  void toggleDesktopChat() {
    showChat.value = !showChat.value;
  }

  Future<void> _onGameData(dynamic data) async {
    // Set global game data
    gameData.value = SocketIOGameJoinEventPayload.fromJson(
      data as Map<String, dynamic>,
    );

    await _initChat();

    _showQuestion();
  }

  Future<void> _initChat() async {
    // Get chat messages history
    final messages = gameData.value!.chatMessages
        .map((e) => e.toChatMessage())
        .toList()
        .reversed
        .toList();

    // Init chat controller
    await getIt<SocketChatController>().init(
      socket: socket!,
      messages: messages,
    );

    _updateChatUsers();

    // Listen new messages in chat
    _chatMessagesSub = getIt<SocketChatController>()
        .chatController
        ?.operationsStream
        .listen(_onChatMessage);
  }

  void _updateChatUsers() {
    // Set chat users
    final users = gameData.value!.players.map(UserX.fromPlayerData).toList();
    getIt<SocketChatController>().setUsers(users);
  }

  Future<void> _onGameStart(dynamic data) async {
    final startData = SocketIOGameStartEventPayload.fromJson(
      data as Map<String, dynamic>,
    );
    gameData.value = gameData.value?.copyWith.gameState(
      currentRound: startData.currentRound,
    );
  }

  void startGame() {
    socket?.emit(SocketIOGameSendEvents.start.json!);
  }

  String? onError(dynamic data) {
    String? errorText = data.toString();
    if (data is Map) {
      errorText = data['message']?.toString() ?? errorText;
    }

    getIt<ToastController>().show(errorText);
    return errorText;
  }

  void _onUserLeave(dynamic data) {
    if (data is! Map) return;
    final userId = int.tryParse(data['user']?.toString() ?? '');
    final user = gameData.value?.players.getById(userId);
    if (user == null) return;

    // If i am leaving - close game
    if (user.meta.id == gameData.value?.me.meta.id) {
      _leave();
      return;
    }

    // Update player list
    gameData.value = gameData.value?.changePlayer(
      id: user.meta.id,
      onChange: (value) =>
          value.copyWith(status: PlayerDataStatus.disconnected),
    );

    getIt<ToastController>().show(
      LocaleKeys.user_leave_the_game.tr(args: [user.meta.username]),
      type: ToastType.info,
    );
  }

  void _leave() {
    socket?.dispose();

    // Close only game page
    if (AppRouter.I.current.name == GameLobbyRoute.page.name) {
      AppRouter.I.replace(const HomeTabsRoute());
    }
    clear();
  }

  void _onUserJoin(dynamic data) {
    if (data is! Map) return;

    final user = PlayerData.fromJson(data as Map<String, dynamic>);

    // If player is new - change his status
    if (gameData.value!.players.any((e) => e.meta.id == user.meta.id)) {
      gameData.value = gameData.value?.changePlayer(
        id: user.meta.id,
        onChange: (value) => value.copyWith(status: PlayerDataStatus.inGame),
      );
    } else {
      gameData.value = gameData.value?.copyWith(
        players: [...?gameData.value?.players, user],
      );
    }

    _updateChatUsers();

    getIt<ToastController>().show(
      LocaleKeys.user_joined_the_game.tr(args: [user.meta.username]),
      type: ToastType.info,
    );
  }

  void onQuestionPick(int questionId) {
    socket?.emit(
      SocketIOGameSendEvents.questionPick.json!,
      SocketIOQuestionPickEventInput(questionId: questionId).toJson(),
    );
  }

  void _onQuestionPick(dynamic data) {
    if (data is! Map) return;

    final questionData = SocketIOQuestionDataEventPayload.fromJson(
      data as Map<String, dynamic>,
    );

    gameData.value = gameData.value?.copyWith.gameState(
      timer: questionData.timer,
      currentQuestion: questionData.data,
      answeredPlayers: null,
      answeringPlayer: null,
    );

    gameData.value = gameData.value!.copyWith.gameState(
      currentRound: gameData.value!.gameState.currentRound?.changeQuestion(
        id: questionData.data.id,
        onChange: (question) => question.copyWith(isPlayed: true),
      ),
    );

    // Pass the question to controller to show the question
    _showQuestion();
  }

  void _showQuestion() {
    final question = gameData.value?.gameState.currentQuestion;
    if (question == null) return;

    getIt<GameQuestionController>().questionData.value = GameQuestionData(
      file: question.questionFiles?.firstOrNull,
      text: question.text,
    );
  }

  void _onQuestionAnswer(dynamic data) {
    if (data is! Map) return;

    final questionData = SocketIOQuestionAnswerEventPayload.fromJson(
      data as Map<String, dynamic>,
    );

    gameData.value = gameData.value?.copyWith.gameState(
      answeringPlayer: questionData.userId,
      timer: questionData.timer,
    );

    // Pause media during question answer
    _pauseMediaPlay();
  }

  void _onAnswerResult(dynamic data) {
    if (data is! Map) return;

    final questionData = SocketIOAnswerResultEventPayload.fromJson(
      data as Map<String, dynamic>,
    );

    _updateGameStateFromAnswerResult(questionData);

    // Question answered, hide question screen and show answer
    final result = questionData.answerResult?.result;
    if (result != null) {
      if (result > 0) {
        _showAnswer();
      } else {
        _resumeMediaPlay();
      }
    }
  }

  void _updateGameStateFromAnswerResult(
    SocketIOAnswerResultEventPayload questionData,
  ) {
    gameData.value = gameData.value?.copyWith
        .gameState(
          answeringPlayer: null,
          answeredPlayers: [
            ...?gameData.value?.gameState.answeredPlayers,
            if (questionData.answerResult != null) questionData.answerResult!,
          ],
          timer: questionData.timer,
        )
        .changePlayer(
          id: questionData.answerResult?.player,
          onChange: (value) =>
              value.copyWith(score: questionData.answerResult!.score),
        );
  }

  void _pauseMediaPlay() {
    getIt<GameQuestionController>().mediaController.value?.pause();
  }

  /// Resume media after wrong answer
  void _resumeMediaPlay() {
    final questionController = getIt<GameQuestionController>();
    final controller = questionController.mediaController.value;
    if (controller == null) return;

    final question = questionController.questionData.value;
    if (question == null) return;

    final displayTime = Duration(milliseconds: question.file?.displayTime ?? 0);

    // Add 200ms offset
    final currentPlayPosition =
        controller.value.position - const Duration(milliseconds: 500);

    if (currentPlayPosition >= displayTime) return;

    controller.play();
  }

  void _onQuestionFinish(dynamic data) {
    if (data is! Map) return;

    final questionData = SocketIOAnswerResultEventPayload.fromJson(
      data as Map<String, dynamic>,
    );

    _updateGameStateFromAnswerResult(questionData);

    gameData.value = gameData.value?.copyWith.gameState(
      currentQuestion: gameData.value?.gameState.currentQuestion?.copyWith(
        answerFiles: questionData.answerFiles,
        answerText: questionData.answerText,
      ),
    );

    _showAnswer();
  }

  Future<void> _showAnswer() async {
    final controller = getIt<GameQuestionController>();
    final currentQuestion = gameData.value?.gameState.currentQuestion;

    // Clear question
    gameData.value = gameData.value?.copyWith.gameState(
      currentQuestion: null,
      timer: null,
    );

    try {
      var mediaPlaytimeMs = 0;
      if (currentQuestion != null) {
        final file = currentQuestion.answerFiles?.firstOrNull;
        controller.questionData.value = GameQuestionData(
          file: file,
          text: currentQuestion.answerText,
        );

        // Wait for user to see answer
        final mediaValue = controller.mediaController.value?.value;
        if (mediaValue != null && file != null) {
          final playtimeLeft = mediaValue.duration - mediaValue.position;
          mediaPlaytimeMs = playtimeLeft.inMilliseconds;
        }
      }

      // Wait to show answer
      await Future<void>.delayed(
        Duration(milliseconds: max(5000, mediaPlaytimeMs + 2000)),
      );
    } catch (e) {
      onError(e);
    }

    // Hide question screen
    await controller.clear();
  }

  Future<void> answerQuestion({String? answerText}) async {
    await socket?.emitWithAckAsync(
      SocketIOGameSendEvents.answerSubmitted.json!,
      SocketIOAnswerSubmittedEventData(answerText: answerText ?? '').toJson(),
    );
  }

  void onAnswer() {
    final me = gameData.value?.me;
    if (me == null) return;
    if (me.role != PlayerRole.player) return;
    if (gameData.value?.gameState.answeringPlayer != null) return;
    if (gameData.value?.gameState.isPaused ?? true) return;

    socket?.emit(SocketIOGameSendEvents.questionAnswer.json!);
  }

  Future<void> answerResult({
    required bool playerAnswerIsRight,
    double? multiplier,
  }) async {
    final question = gameData.value?.gameState.currentQuestion;
    if (question == null) return;
    final score = ((question.price ?? 0) * (multiplier ?? 1)).toInt();

    await socket?.emitWithAckAsync(
      SocketIOGameSendEvents.answerResult.json!,
      SocketIOAnswerResultInput(
        scoreResult: playerAnswerIsRight ? score : -score,
        answerType: multiplier == 0
            ? SocketIOGameAnswerType.skip
            : playerAnswerIsRight
            ? SocketIOGameAnswerType.correct
            : SocketIOGameAnswerType.wrong,
      ).toJson(),
    );
  }

  void _onNextRound(dynamic data) {
    if (data is! Map) return;

    final nextRoundData = SocketIONextRoundEventPayload.fromJson(
      data as Map<String, dynamic>,
    );

    gameData.value = gameData.value?.copyWith(
      gameState: nextRoundData.gameState,
    );

    _resetScrollPosition();
  }

  void _resetScrollPosition() => themeScrollPosition = null;

  void _onGameFinish(dynamic data) {
    gameFinished.value = true;
  }

  void skipRound() {
    final me = gameData.value?.me;
    if (me == null) return;
    if (me.role != PlayerRole.showman) return;
    socket?.emit(SocketIOGameSendEvents.nextRound.json!);
  }

  void _onGamePause(dynamic data) => _setGamePause(isPaused: true);

  void _onGameUnPause(dynamic data) {
    _setGamePause(isPaused: false);

    // Update timer after pause
    if (data is! Map) return;
    final unpauseData = SocketIOGameUnpauseEventPayload.fromJson(
      data as Map<String, dynamic>,
    );
    gameData.value = gameData.value?.copyWith.gameState(
      timer: unpauseData.timer,
    );
  }

  void _setGamePause({required bool isPaused}) {
    gameData.value = gameData.value?.copyWith.gameState(isPaused: isPaused);
    if (isPaused) {
      _pauseMediaPlay();
    } else {
      _resumeMediaPlay();
    }
  }

  void setPause({required bool pauseState}) {
    socket?.emit(
      pauseState
          ? SocketIOGameSendEvents.gamePause.json!
          : SocketIOGameSendEvents.gameUnpause.json!,
    );
  }

  void skipQuestion() {
    socket?.emit(SocketIOGameSendEvents.skipQuestionForce.json!);
  }
}
