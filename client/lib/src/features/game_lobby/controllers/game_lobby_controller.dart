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

  final gameData = ValueNotifier<SocketIoGameJoinEventPayload?>(null);
  final gameListData = ValueNotifier<GameListItem?>(null);
  final gameFinished = ValueNotifier<bool>(false);
  final lobbyEditorMode = ValueNotifier<bool>(false);
  final showChat = ValueNotifier<bool>(false);

  StreamSubscription<ChatOperation>? _chatMessagesSub;
  double? themeScrollPosition;

  String? get gameId => _gameId;

  int get myId => ProfileController.getUser()!.id;
  bool get gameStarted => gameData.value?.gameStarted ?? false;

  JoinCompleter _joinCompleter = JoinCompleter();

  Future<bool> join({required String gameId}) async {
    // Check if already joined
    if (_gameId == gameId) return true;

    await clear();

    try {
      _gameId = gameId;

      // Get list game data
      gameListData.value = await Api.I.api.games.getV1GamesGameId(
        gameId: gameId,
      );

      socket = await getIt<SocketController>().createConnection(path: '/games');
      socket!
        ..onConnect((_) => _onConnect())
        ..onReconnect(_onReconnect)
        ..onReconnectFailed(_onDisconnect)
        ..onDisconnect(_onDisconnect)
        ..on(SocketIoEvents.error.json!, onError)
        ..on(SocketIoGameReceiveEvents.gameData.json!, _onGameData)
        ..on(SocketIoGameReceiveEvents.start.json!, _onGameStart)
        ..on(SocketIoGameReceiveEvents.userLeave.json!, _onUserLeave)
        ..on(SocketIoGameReceiveEvents.join.json!, _onUserJoin)
        ..on(SocketIoGameReceiveEvents.questionData.json!, _onQuestionPick)
        ..on(SocketIoGameReceiveEvents.questionAnswer.json!, _onQuestionAnswer)
        ..on(SocketIoGameReceiveEvents.answerResult.json!, _onAnswerResult)
        ..on(SocketIoGameReceiveEvents.questionFinish.json!, _onQuestionFinish)
        ..on(SocketIoGameReceiveEvents.answerSubmitted.json!, _onAnswerResult)
        ..on(SocketIoGameReceiveEvents.nextRound.json!, _onNextRound)
        ..on(SocketIoGameReceiveEvents.gameFinished.json!, _onGameFinish)
        ..on(SocketIoGameReceiveEvents.gamePause.json!, _onGamePause)
        ..on(SocketIoGameReceiveEvents.gameUnpause.json!, _onGameUnPause)
        ..on(SocketIoGameReceiveEvents.questionSkip.json!, _onQuestionSkip)
        ..on(SocketIoGameReceiveEvents.questionUnskip.json!, _onQuestionUnSkip)
        ..on(SocketIoGameReceiveEvents.scoreChanged.json!, _onScoreChanged)
        ..on(
          SocketIoGameReceiveEvents.playerRestricted.json!,
          _onPlayerRestricted,
        )
        ..on(
          SocketIoGameReceiveEvents.playerKicked.json!,
          _onPlayerKicked,
        )
        ..on(
          SocketIoGameReceiveEvents.turnPlayerChanged.json!,
          _onPlayerTurnChanged,
        )
        ..on(
          SocketIoGameReceiveEvents.playerRoleChange.json!,
          _onPlayerRoleChange,
        )
        ..on(SocketIoGameReceiveEvents.playerReady.json!, _onPlayerReady)
        ..on(
          SocketIoGameReceiveEvents.secretQuestionPicked.json!,
          _onSecretQuestionPicked,
        )
        ..on(
          SocketIoGameReceiveEvents.secretQuestionTransfer.json!,
          _onSecretQuestionTransfer,
        )
        ..on(
          SocketIoGameReceiveEvents.stakeQuestionPicked.json!,
          _onStakeQuestionPicked,
        )
        ..on(
          SocketIoGameReceiveEvents.stakeBidSubmit.json!,
          _onStakeQuestionSubmitted,
        )
        ..on(
          SocketIoGameReceiveEvents.stakeQuestionWinner.json!,
          _onStakeQuestionWinner,
        )
        ..on(
          SocketIoGameReceiveEvents.mediaDownloadStatus.json!,
          _onMediaDownloadStatus,
        )
        ..on(
          SocketIoGameReceiveEvents.themeEliminate.json!,
          _onThemeEliminate,
        )
        ..on(
          SocketIoGameReceiveEvents.finalPhaseComplete.json!,
          _onFinalPhaseComplete,
        )
        ..on(
          SocketIoGameReceiveEvents.finalBidSubmit.json!,
          _onFinalBidSubmit,
        )
        ..on(
          SocketIoGameReceiveEvents.finalQuestionData.json!,
          _onFinalQuestionData,
        )
        ..on(
          SocketIoGameReceiveEvents.finalAnswerSubmit.json!,
          _onFinalAnswerSubmit,
        )
        ..on(
          SocketIoGameReceiveEvents.finalAnswerReview.json!,
          _onFinalAnswerReview,
        )
        ..connect();

      return await _joinCompleter.future;
    } catch (e, s) {
      logger.e(e, stackTrace: s);
      await clear();

      rethrow;
    }
  }

  Future<void> _showLoggedInChatEvent(String text) async {
    await getIt<SocketChatController>().chatController?.insertMessage(
      TextMessage(
        id: UniqueKey().toString(),
        authorId: SocketChatController.systemMessageId,
        text: text,
        createdAt: DateTime.now(),
      ),
    );
  }

  Future<void> _onDisconnect(dynamic data) async {
    logger.d('GameLobbyController._onDisconnect: $gameId');

    gameData.value = gameData.value?.changePlayer(
      id: myId,
      onChange: (value) =>
          value.copyWith(status: PlayerDataStatus.disconnected),
    );
    await _setGamePause(isPaused: true);
  }

  Future<void> _onReconnect(dynamic data) async {
    logger.d('GameLobbyController._onReconnect: ${this.gameId}');

    final gameId = this.gameId!;
    await clear();
    await join(gameId: gameId);
  }

  Future<void> _onConnect() async {
    try {
      logger.d('GameLobbyController._onConnect: $gameId');

      // Authenticate socket connection
      await Api.I.api.auth.postV1AuthSocket(
        body: InputSocketIoAuth(socketId: socket!.id!),
      );

      final ioGameJoinInput = SocketIoGameJoinInput(
        gameId: _gameId!,
        role: _getJoinRole(),
      );

      socket?.emit(SocketIoGameSendEvents.join.json!, ioGameJoinInput.toJson());
    } catch (e, s) {
      logger.e(e, stackTrace: s);
      await clear();

      // Show error toast
      await getIt<ToastController>().show(
        e is DioException && e.response?.statusCode == 401
            ? LocaleKeys.login_user_unauthorized.tr()
            : e,
      );

      // Close game
      await AppRouter.I.replace(const HomeTabsRoute());
    }
  }

  PlayerRole _getJoinRole() {
    var lastRole = gameListData.value?.players
        .firstWhereOrNull((e) => e.id == myId)
        ?.role;

    // Check for other showman who joined when you wore out
    if (lastRole == PlayerRole.showman) {
      final otherShowman = gameListData.value?.players.firstWhereOrNull(
        (e) => e.id != myId && e.role == PlayerRole.showman,
      );
      if (otherShowman != null) {
        lastRole = null;
        unawaited(
          getIt<ToastController>().show(
            LocaleKeys.multiple_showman_warning.tr(),
            type: ToastType.warning,
          ),
        );
      }
    }
    return lastRole ?? PlayerRole.spectator;
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
    if ((text?.trim()).isEmptyOrNull) return;

    final author = gameData.value?.players.getById(
      int.tryParse(message?.authorId ?? ''),
    );
    final isSystemMessage =
        message?.authorId == SocketChatController.systemMessageId;

    await getIt<ToastController>().show(
      text?.trim(),
      title: author?.meta.username,
      type: isSystemMessage ? ToastType.info : ToastType.chat,
    );
  }

  /// Clear all fields for new game to use
  Future<void> clear() async {
    try {
      _gameId = null;
      socket?.dispose();
      socket = null;
      gameData.value = null;
      gameListData.value = null;
      await _chatMessagesSub?.cancel();
      _chatMessagesSub = null;
      showChat.value = false;
      gameFinished.value = false;
      lobbyEditorMode.value = false;
      themeScrollPosition = null;
      getIt<SocketChatController>().clear();
      await getIt<GameQuestionController>().clear();
      getIt<GameLobbyPlayerPickerController>().clear();
      getIt<GameLobbyThemePickerController>().clear();
      getIt<GameLobbyPlayerStakesController>().clear();
      getIt<GameLobbyReviewController>().clear();
      getIt<GameLobbyFinalAnswerController>().clear();
      _joinCompleter = JoinCompleter();
    } catch (e, s) {
      logger.e(e, stackTrace: s);
    }
  }

  Future<void> leave({bool force = false}) async {
    socket?.emit(SocketIoGameSendEvents.userLeave.json!);
    _leave();
  }

  void toggleDesktopChat() => showChat.value = !showChat.value;

  Future<void> _onGameData(dynamic data) async {
    try {
      // Set global game data
      gameData.value = SocketIoGameJoinEventPayload.fromJson(
        data as Map<String, dynamic>,
      );

      _joinCompleter.complete(true);

      // Set editor mode after loading game but not starting
      if (!gameStarted) {
        lobbyEditorMode.value = true;
      }

      await _initChat();

      _showQuestion();
      _showFinalRound();
      _showStakeQuestion();
    } catch (e) {
      onError(e);
    }
  }

  void _onNextRound(dynamic data) {
    if (data is! Map) return;

    final nextRoundData = SocketIoNextRoundEventPayload.fromJson(
      data as Map<String, dynamic>,
    );

    gameData.value = gameData.value?.copyWith(
      gameState: nextRoundData.gameState,
    );

    _resetScrollPosition();
    _showQuestion();
    _showFinalRound();
  }

  void _resetScrollPosition() => themeScrollPosition = null;

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
    if (gameData.value == null) return;
    // Set chat users
    final users = gameData.value!.players
        .map(ChatUserX.fromPlayerData)
        .toList();
    getIt<SocketChatController>().setUsers(users);
  }

  Future<void> _onGameStart(dynamic data) async {
    final startData = SocketIoGameStartEventPayload.fromJson(
      data as Map<String, dynamic>,
    );
    gameData.value = gameData.value?.copyWith.gameState(
      currentRound: startData.currentRound,
    );
    lobbyEditorMode.value = false;
  }

  void startGame() {
    socket?.emit(SocketIoGameSendEvents.start.json!);
  }

  String? onError(dynamic data) {
    String? errorText = data.toString();
    if (data is Map) {
      errorText = data['message']?.toString() ?? errorText;
    }

    unawaited(getIt<ToastController>().show(errorText));

    // Complete the join completer with false if not already completed
    if (!_joinCompleter.isCompleted) {
      _joinCompleter.complete(false);
    }

    return errorText;
  }

  void _onUserLeave(dynamic data) {
    if (data is! Map) return;

    final leaveData = SocketIoGameLeaveEventPayload.fromJson(
      data as Map<String, dynamic>,
    );
    final user = gameData.value?.players.getById(leaveData.user);
    if (user == null) return;

    // If i am leaving - close game
    if (user.meta.id == myId) {
      _leave();
      return;
    }

    // Update player list
    gameData.value = gameData.value?.changePlayer(
      id: user.meta.id,
      onChange: (value) =>
          value.copyWith(status: PlayerDataStatus.disconnected),
    );

    if (myId != user.meta.id) {
      unawaited(
        getIt<ToastController>().show(
          LocaleKeys.user_leave_the_game.tr(args: [user.meta.username]),
          type: ToastType.info,
        ),
      );
    }
  }

  void _leave() {
    // Close only game page
    if (AppRouter.I.current.name == GameLobbyRoute.page.name) {
      unawaited(AppRouter.I.replace(const HomeTabsRoute()));
    }
    unawaited(clear());
  }

  void _onUserJoin(dynamic data) {
    if (data is! Map) return;

    final user = PlayerData.fromJson(data as Map<String, dynamic>);

    // If player is new - change his status
    if (gameData.value?.players.any((e) => e.meta.id == user.meta.id) ??
        false) {
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

    if (myId != user.meta.id) {
      unawaited(
        getIt<ToastController>().show(
          LocaleKeys.user_joined_the_game.tr(args: [user.meta.username]),
          type: ToastType.info,
        ),
      );
    }
  }

  void onQuestionPick(int questionId) {
    final currentTurnPlayerId = gameData.value?.gameState.currentTurnPlayerId;
    final me = gameData.value?.me;

    if (me.isSpectator) return;

    final myTurnToPick = currentTurnPlayerId == me?.meta.id;

    if (!myTurnToPick && me?.role != PlayerRole.showman) {
      unawaited(
        getIt<ToastController>().show(
          LocaleKeys.not_your_turn_to_pick.tr(),
          type: ToastType.warning,
        ),
      );
      return;
    }

    socket?.emit(
      SocketIoGameSendEvents.questionPick.json!,
      SocketIoQuestionPickEventInput(questionId: questionId).toJson(),
    );
  }

  void _onQuestionPick(dynamic data) {
    if (data is! Map) return;

    final questionData = SocketIoQuestionDataEventPayload.fromJson(
      data as Map<String, dynamic>,
    );

    // Reset media download status for all players
    final playersWithResetStatus =
        gameData.value?.players.map((player) {
          return player.copyWith(mediaDownloaded: false);
        }).toList() ??
        [];

    gameData.value = gameData.value
        ?.copyWith(players: playersWithResetStatus)
        .copyWith
        .gameState(
          timer: questionData.timer,
          currentQuestion: questionData.data,
          answeredPlayers: null,
          // Dont clear answeringPlayer for stake question
          answeringPlayer: questionData.data.type == QuestionType.stake
              ? gameData.value?.gameState.answeringPlayer
              : null,
        );

    gameData.value = gameData.value!.copyWith.gameState(
      currentRound: gameData.value!.gameState.currentRound?.changeQuestion(
        id: questionData.data.id,
        onChange: (question) => question.copyWith(isPlayed: true),
      ),
    );

    getIt<GameLobbyPlayerPickerController>().stopSelection();
    getIt<GameLobbyPlayerStakesController>().stopSelection();

    // Pass the question to controller to show the question
    _showQuestion();
  }

  void _showQuestion({bool dontWaitForPlayers = false}) {
    final question = gameData.value?.gameState.currentQuestion;
    if (question == null) return;

    final controller = getIt<GameQuestionController>();
    if (dontWaitForPlayers) {
      controller.ignoreWaitingForPlayers = true;
    }
    controller.questionData.value = GameQuestionData(
      file: question.questionFiles?.firstOrNull,
      text: question.text,
    );
  }

  Future<void> _onQuestionAnswer(dynamic data) async {
    if (data is! Map) return;

    final questionData = SocketIoQuestionAnswerEventPayload.fromJson(
      data as Map<String, dynamic>,
    );

    gameData.value = gameData.value?.copyWith.gameState(
      answeringPlayer: questionData.userId,
      timer: questionData.timer,
    );

    // Pause media during question answer
    await _pauseMediaPlay();
  }

  Future<void> _onAnswerResult(dynamic data) async {
    if (data is! Map) return;

    final questionData = SocketIoAnswerResultEventPayload.fromJson(
      data as Map<String, dynamic>,
    );

    _updateGameStateFromAnswerResult(questionData);

    // Question answered, hide question screen and show answer
    final result = questionData.answerResult?.result;
    if (result != null) {
      if (result > 0) {
        await _showAnswer();
      } else {
        await _resumeMediaPlay();
      }
    }
  }

  void _updateGameStateFromAnswerResult(
    SocketIoAnswerResultEventPayload questionData,
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

  Future<void> _pauseMediaPlay() async {
    await getIt<GameQuestionController>().mediaController.value?.pause();
  }

  /// Resume media after wrong answer
  Future<void> _resumeMediaPlay() async {
    final questionController = getIt<GameQuestionController>();
    final controller = questionController.mediaController.value;
    if (controller == null) return;

    questionController.ignoreWaitingForPlayers = false;
    final question = questionController.questionData.value;
    if (question == null) return;

    final displayTime = Duration(milliseconds: question.file?.displayTime ?? 0);

    // Add 200ms offset
    final currentPlayPosition =
        controller.value.position - const Duration(milliseconds: 500);

    if (currentPlayPosition >= displayTime) return;

    await controller.play();
  }

  Future<void> _onQuestionFinish(dynamic data) async {
    if (data is! Map) return;

    final questionData = SocketIoQuestionFinishEventPayload.fromJson(
      data as Map<String, dynamic>,
    );

    _updateGameStateFromAnswerResult(
      SocketIoAnswerResultEventPayload(
        answerFiles: questionData.answerFiles,
        answerText: questionData.answerText,
      ),
    );

    gameData.value = gameData.value?.copyWith.gameState(
      currentQuestion: gameData.value?.gameState.currentQuestion?.copyWith(
        answerFiles: questionData.answerFiles,
        answerText: questionData.answerText,
      ),
      currentTurnPlayerId: questionData.nextTurnPlayerId,
      skippedPlayers: null,
    );

    await _showAnswer();
  }

  Future<void> _showAnswer() async {
    final controller = getIt<GameQuestionController>();
    final currentQuestion = gameData.value?.gameState.currentQuestion;

    // Check for empty answer
    if ((currentQuestion?.answerFiles?.isEmpty ?? true) &&
        (currentQuestion?.answerText.isEmptyOrNull ?? true)) {
      return;
    }

    // Clear question
    gameData.value = gameData.value?.copyWith.gameState(
      currentQuestion: null,
      timer: null,
    );

    // Clear selection controllers
    getIt<GameLobbyPlayerPickerController>().clear();
    getIt<GameLobbyPlayerStakesController>().clear();

    try {
      int? mediaPlaytimeMs;
      int? showMediaForMs;
      if (currentQuestion != null) {
        final file = currentQuestion.answerFiles?.firstOrNull;

        controller.ignoreWaitingForPlayers = true;
        controller.questionData.value = GameQuestionData(
          // Clear display time to avoid auto pause
          file: file?.copyWith(displayTime: null),
          text: currentQuestion.answerText,
        );

        // Wait for user to see answer
        final mediaValue = controller.mediaController.value?.value;

        showMediaForMs = file?.displayTime;
        if (mediaValue != null && file != null) {
          final playtimeLeft = mediaValue.duration - mediaValue.position;
          mediaPlaytimeMs = playtimeLeft.inMilliseconds;

          // Wait for media to play
          final timeout = Timer(const Duration(seconds: 5), () {});
          while (controller.mediaController.value?.value.isPlaying != true &&
              timeout.isActive) {
            await Future<void>.delayed(const Duration(milliseconds: 100));
          }
        }
      }

      const defaultAnswerDurationMs = 5000;
      var answerShowingDurationMs = max(
        // Cap duration to minimum of default duration
        defaultAnswerDurationMs,

        // Use media playtime or question defined time
        showMediaForMs != null && mediaPlaytimeMs != null
            ? min(showMediaForMs, mediaPlaytimeMs)
            : showMediaForMs ?? mediaPlaytimeMs ?? defaultAnswerDurationMs,
      );
      // Cap maximum duration to 30 seconds
      if (answerShowingDurationMs > 30000) answerShowingDurationMs = 30000;

      gameData.value = gameData.value?.copyWith.gameState(
        timer: GameStateTimer(
          startedAt: DateTime.now(),
          durationMs: answerShowingDurationMs,
          elapsedMs: 0,
        ),
      );
      logger.d(
        'Waiting for $answerShowingDurationMs ms to hide answer '
        'mediaPlaytimeMs: $mediaPlaytimeMs, showMediaForMs: $showMediaForMs',
      );
      await Future<void>.delayed(
        Duration(milliseconds: answerShowingDurationMs),
      );
    } catch (e) {
      onError(e);
    }

    // Hide question screen
    await controller.clear();
  }

  Future<void> answerQuestion({String? answerText}) async {
    await socket?.emitWithAckAsync(
      SocketIoGameSendEvents.answerSubmitted.json!,
      SocketIoAnswerSubmittedInput(answerText: answerText ?? '').toJson(),
    );
  }

  void onAnswer() {
    final me = gameData.value?.me;
    if (me == null) return;
    if (me.role != PlayerRole.player) return;
    if (gameData.value?.gameState.answeringPlayer != null) return;
    if (gameData.value?.gameState.isPaused ?? true) return;

    socket?.emit(SocketIoGameSendEvents.questionAnswer.json!);
  }

  void passQuestion({required bool pass}) {
    final me = gameData.value?.me;
    if (me == null) return;
    if (me.role != PlayerRole.player) return;
    if (gameData.value?.gameState.answeringPlayer != null) return;
    if (gameData.value?.gameState.isPaused ?? true) return;

    socket?.emit(
      pass
          ? SocketIoGameSendEvents.questionSkip.json!
          : SocketIoGameSendEvents.questionUnskip.json!,
    );
  }

  Future<void> answerResult({
    required bool playerAnswerIsRight,
    double? multiplier,
  }) async {
    final question = gameData.value?.gameState.currentQuestion;
    if (question == null) return;
    final score = ((question.price ?? 0) * (multiplier ?? 1)).toInt();

    await socket?.emitWithAckAsync(
      SocketIoGameSendEvents.answerResult.json!,
      SocketIoAnswerResultInput(
        scoreResult: playerAnswerIsRight ? score : -score,
        answerType: multiplier == 0
            ? SocketIoGameAnswerType.skip
            : playerAnswerIsRight
            ? SocketIoGameAnswerType.correct
            : SocketIoGameAnswerType.wrong,
      ).toJson(),
    );
  }

  void _onGameFinish(dynamic data) {
    gameFinished.value = true;
  }

  void skipRound() {
    final me = gameData.value?.me;
    if (me == null) return;
    if (me.role != PlayerRole.showman) return;
    socket?.emit(SocketIoGameSendEvents.nextRound.json!);
  }

  void _onGamePause(dynamic data) => _setGamePause(isPaused: true);

  void _onGameUnPause(dynamic data) {
    unawaited(_setGamePause(isPaused: false));

    // Update timer after pause
    if (data is! Map) return;
    final unpauseData = SocketIoGameUnpauseEventPayload.fromJson(
      data as Map<String, dynamic>,
    );
    gameData.value = gameData.value?.copyWith.gameState(
      timer: unpauseData.timer,
    );
  }

  Future<void> _setGamePause({required bool isPaused}) async {
    gameData.value = gameData.value?.copyWith.gameState(
      isPaused: isPaused,
      timer: null,
    );
    if (isPaused) {
      await _pauseMediaPlay();
    } else {
      await _resumeMediaPlay();
    }
  }

  void setPause({required bool pauseState}) {
    socket?.emit(
      pauseState
          ? SocketIoGameSendEvents.gamePause.json!
          : SocketIoGameSendEvents.gameUnpause.json!,
    );
  }

  void skipQuestion() {
    socket?.emit(SocketIoGameSendEvents.skipQuestionForce.json!);
  }

  Future<void> _onQuestionSkip(dynamic data) async {
    if (data is! Map) return;

    final skippedPlayer = SocketIoGameSkipEventPayload.fromJson(
      data as Map<String, dynamic>,
    );
    gameData.value = gameData.value?.copyWith.gameState(
      skippedPlayers: {
        ...?gameData.value?.gameState.skippedPlayers,
        skippedPlayer.playerId,
      }.toList(),
    );

    await _resumeMediaPlay();
  }

  void _onQuestionUnSkip(dynamic data) {
    if (data is! Map) return;

    final unskippedPlayer = SocketIoGameUnskipEventPayload.fromJson(
      data as Map<String, dynamic>,
    );
    gameData.value = gameData.value?.copyWith.gameState(
      skippedPlayers: gameData.value?.gameState.skippedPlayers
          ?.whereNot(
            (e) => e == unskippedPlayer.playerId,
          )
          .toList(),
    );
  }

  void _onPlayerRestricted(dynamic data) {
    if (data is! Map) return;

    final restrictedPlayer = SocketIoPlayerRestrictionEventPayload.fromJson(
      data as Map<String, dynamic>,
    );
    gameData.value = gameData.value?.changePlayer(
      id: restrictedPlayer.playerId,
      onChange: (player) => player.copyWith(
        restrictionData: RestrictionsEventData(
          banned: restrictedPlayer.banned,
          muted: restrictedPlayer.muted,
          restricted: restrictedPlayer.restricted,
        ),
      ),
    );
  }

  void _onPlayerKicked(dynamic data) {
    if (data is! Map) return;

    final kickedPlayer = SocketIoPlayerKickEventPayload.fromJson(
      data as Map<String, dynamic>,
    );
    final playerId = kickedPlayer.playerId;

    gameData.value = gameData.value?.changePlayer(
      id: playerId,
      onChange: (_) => null,
    );
  }

  void _onPlayerRoleChange(dynamic json) {
    if (json is! Map) return;

    final data = SocketIoPlayerRoleChangeEventPayload.fromJson(
      json as Map<String, dynamic>,
    );

    gameData.value = gameData.value?.copyWith(players: data.players);
  }

  void _onPlayerTurnChanged(dynamic json) {
    if (json is! Map) return;

    final data = SocketIoTurnPlayerChangeEventPayload.fromJson(
      json as Map<String, dynamic>,
    );

    gameData.value = gameData.value?.copyWith.gameState(
      currentTurnPlayerId: data.newTurnPlayerId,
    );

    _syncCurrentUserFromTurn();
  }

  void _onScoreChanged(dynamic json) {
    if (json is! Map) return;

    final data = SocketIoPlayerScoreChangeEventPayload.fromJson(
      json as Map<String, dynamic>,
    );

    final player = gameData.value?.players.getById(data.playerId);

    gameData.value = gameData.value?.changePlayer(
      id: data.playerId,
      onChange: (player) => player.copyWith(
        score: data.newScore,
      ),
    );

    if (player?.score == data.newScore) return;

    String formatScore(int? score) {
      final (formattedScore, compactFormat) = ScoreText.formatScore(score);
      return formattedScore;
    }

    unawaited(
      _showLoggedInChatEvent(
        LocaleKeys.player_edit_showman_changed_score.tr(
          namedArgs: {
            'username': player?.meta.username ?? '',
            'old': formatScore(player?.score),
            'new': formatScore(data.newScore),
          },
        ),
      ),
    );
  }

  void _onPlayerReady(dynamic json) {
    if (json is! Map) return;

    final data = SocketIoPlayerReadinessEventPayload.fromJson(
      json as Map<String, dynamic>,
    );

    gameData.value = gameData.value?.copyWith.gameState(
      readyPlayers: data.readyPlayers,
    );
  }

  void playerReady({required bool ready}) {
    socket?.emit(
      ready
          ? SocketIoGameSendEvents.playerReady.json!
          : SocketIoGameSendEvents.playerUnready.json!,
    );
  }

  void _onSecretQuestionPicked(dynamic json) {
    if (json is! Map) return;

    final data = SocketIoSecretQuestionPickedEventPayload.fromJson(
      json as Map<String, dynamic>,
    );

    getIt<GameLobbyPlayerPickerController>().startSelect(
      selectingPlayerId: data.pickerPlayerId,
      type: data.transferType,
      onPlayerSelected: (selectedPlayerId) {
        socket?.emit(
          SocketIoGameSendEvents.secretQuestionTransfer.json!,
          SocketIoSecretQuestionTransferInputData(
            targetPlayerId: selectedPlayerId,
          ).toJson(),
        );
      },
    );
  }

  void _onSecretQuestionTransfer(dynamic json) {
    if (json is! Map) return;

    final data = SocketIoSecretQuestionTransferEventPayload.fromJson(
      json as Map<String, dynamic>,
    );

    gameData.value = gameData.value?.copyWith.gameState(
      answeringPlayer: data.toPlayerId,
    );
    getIt<GameLobbyPlayerPickerController>().stopSelection();
  }

  void _onStakeQuestionPicked(dynamic json) {
    if (json is! Map) return;

    final data = SocketIoStakeQuestionPickedEventPayload.fromJson(
      json as Map<String, dynamic>,
    );

    gameData.value = gameData.value?.copyWith.gameState(
      timer: data.timer,
      questionState: GameStateQuestionState.bidding,
      stakeQuestionData: StakeQuestionGameData(
        pickerPlayerId: data.pickerPlayerId,
        questionId: data.questionId,
        maxPrice: data.maxPrice,
        bids: {},
        passedPlayers: [],
        biddingOrder: data.biddingOrder,
        currentBidderIndex: 0,
        highestBid: null,
        winnerPlayerId: null,
        biddingPhase: true,
      ),
    );

    _showStakeQuestion();
  }

  void _showStakeQuestion() {
    final stakeData = gameData.value?.gameState.stakeQuestionData;
    if (stakeData == null) return;
    if (stakeData.winnerPlayerId != null) return;

    final bidderIndex = stakeData.currentBidderIndex;
    final bidderId =
        gameData.value?.gameState.currentTurnPlayerId ??
        stakeData.biddingOrder.tryByIndex(bidderIndex) ??
        -1;

    getIt<GameLobbyPlayerStakesController>().startBidding(
      allPlayersBid: false,
      bidderId: bidderId,
      bids: stakeData.bids.map((key, value) => MapEntry(int.parse(key), value)),
      onPlayerBid: (bid) => socket?.emit(
        SocketIoGameSendEvents.stakeBidSubmit.json!,
        bid.toJson(),
      ),
    );
  }

  void _syncCurrentUserFromTurn() {
    final currentTurnPlayerId = gameData.value?.gameState.currentTurnPlayerId;
    if (currentTurnPlayerId == null) return;
    getIt<GameLobbyPlayerStakesController>().changeBidder(currentTurnPlayerId);
  }

  void _onStakeQuestionSubmitted(dynamic json) {
    if (json is! Map) return;

    final data = SocketIoStakeQuestionSubmittedEventPayload.fromJson(
      json as Map<String, dynamic>,
    );

    final index = gameData.value?.gameState.stakeQuestionData?.biddingOrder
        .indexOf(data.nextBidderId ?? -1);

    gameData.value = gameData.value?.copyWith.gameState(timer: data.timer);
    final stakeData = gameData.value?.gameState.stakeQuestionData;
    final bids = {
      ...?stakeData?.bids,
      data.playerId.toString(): data.bidAmount,
    };
    gameData.value = gameData.value?.copyWith.gameState.stakeQuestionData!(
      biddingPhase: !data.isPhaseComplete,
      currentBidderIndex: index ?? -1,
      bids: bids,
    );

    if (data.nextBidderId != null) {
      getIt<GameLobbyPlayerStakesController>().changeBidder(data.nextBidderId!);
    }

    getIt<GameLobbyPlayerStakesController>().changeBids(
      bids.map(
        (key, value) => MapEntry(int.parse(key), value),
      ),
    );
  }

  void _onStakeQuestionWinner(dynamic json) {
    if (json is! Map) return;

    final data = SocketIoStakeQuestionWinnerEventPayload.fromJson(
      json as Map<String, dynamic>,
    );

    gameData.value = gameData.value?.copyWith.gameState(
      timer: null,
      answeringPlayer: data.winnerPlayerId,
    );
    gameData.value = gameData.value?.copyWith.gameState.stakeQuestionData?.call(
      winnerPlayerId: data.winnerPlayerId,
      highestBid: data.finalBid,
    );

    final winnerUsername =
        gameData.value?.players.getById(data.winnerPlayerId)?.meta.username ??
        '';

    unawaited(
      _showLoggedInChatEvent(
        LocaleKeys.game_stake_question_player_win_the_bid.tr(
          namedArgs: {
            'username': winnerUsername,
            'value': ScoreText.formatScore(data.finalBid).$1,
          },
        ),
      ),
    );
  }

  void submitQuestionBid(SocketIoStakeQuestionBidInput input) {
    socket?.emit(
      SocketIoGameSendEvents.stakeBidSubmit.json!,
      input.toJson(),
    );
  }

  void _onThemeEliminate(dynamic json) {
    if (json is! Map) return;

    final data = SocketIoThemeEliminatePayload.fromJson(
      json as Map<String, dynamic>,
    );

    gameData.value = gameData.value?.copyWith.gameState.finalRoundData?.call(
      eliminatedThemes: {
        ...?gameData.value?.gameState.finalRoundData?.eliminatedThemes,
        data.themeId,
      }.toList(),
    );
    gameData.value = gameData.value?.copyWith.gameState(
      currentTurnPlayerId: data.nextPlayerId,
    );
  }

  void _showFinalRound() {
    final finalRoundData = gameData.value?.gameState.finalRoundData;
    if (finalRoundData == null) return;

    switch (finalRoundData.phase) {
      case FinalRoundPhase.themeElimination:
        getIt<GameLobbyThemePickerController>().startSelect(
          onSelected: (themeId) => socket?.emit(
            SocketIoGameSendEvents.themeEliminate.json!,
            SocketIoThemeEliminateInput(themeId: themeId).toJson(),
          ),
        );

      case FinalRoundPhase.bidding:
        getIt<GameLobbyPlayerStakesController>().startBidding(
          allPlayersBid: true,
          bidderId: finalRoundData.turnOrder.first,
          bids: finalRoundData.bids.map(
            (key, value) => MapEntry(int.parse(key), value),
          ),
          onPlayerBid: (bid) => socket?.emit(
            SocketIoGameSendEvents.finalBidSubmit.json!,
            SocketIoFinalBidSubmitInput(bid: bid.bidAmount ?? 0).toJson(),
          ),
        );

      case FinalRoundPhase.answering:
        getIt<GameLobbyPlayerStakesController>().clear();
        getIt<GameLobbyThemePickerController>().clear();
        getIt<GameLobbyReviewController>().clear();

        // Show question
        _showQuestion();

        // Start answer controller for players
        final me = gameData.value?.me;
        final existingAnswer = finalRoundData.answers
            .where((a) => a.playerId == me?.meta.id)
            .firstOrNull
            ?.answer;

        getIt<GameLobbyFinalAnswerController>().startSelect(
          initialAnswer: existingAnswer,
          onSelected: (answer) {
            socket?.emit(
              SocketIoGameSendEvents.finalAnswerSubmit.json!,
              SocketIoFinalAnswerSubmitInput(answerText: answer).toJson(),
            );
          },
        );

      case FinalRoundPhase.reviewing:
        getIt<GameLobbyPlayerStakesController>().clear();
        getIt<GameLobbyThemePickerController>().clear();
        getIt<GameLobbyReviewController>().startReview(
          answers: finalRoundData.answers,
          bids: finalRoundData.bids.map(
            (key, value) => MapEntry(int.parse(key), value),
          ),
          onReview: (answerId, isCorrect) {
            socket?.emit(
              SocketIoGameSendEvents.finalAnswerReview.json!,
              SocketIoFinalAnswerReviewInput(
                answerId: answerId,
                isCorrect: isCorrect,
              ).toJson(),
            );
          },
        );

      default:
        break;
    }
  }

  void _onFinalPhaseComplete(dynamic json) {
    if (json is! Map) return;

    final data = SocketIoFinalPhaseCompletePayload.fromJson(
      json as Map<String, dynamic>,
    );
    if (gameData.value?.copyWith.gameState.finalRoundData == null) return;
    gameData.value = gameData.value!.copyWith.gameState.finalRoundData!(
      phase: data.nextPhase,
    );
    gameData.value = gameData.value?.copyWith.gameState(timer: data.timer);

    _showFinalRound();
  }

  void _onFinalBidSubmit(dynamic json) {
    if (json is! Map) return;
    final data = SocketIoFinalBidSubmitPayload.fromJson(
      json as Map<String, dynamic>,
    );
    final finalRoundData = gameData.value?.gameState.finalRoundData;
    if (finalRoundData == null) return;
    final bids = {
      ...finalRoundData.bids,
      data.playerId.toString(): data.bidAmount,
    };
    gameData.value = gameData.value!.copyWith.gameState.finalRoundData!(
      bids: bids,
    );
    getIt<GameLobbyPlayerStakesController>().changeBids(
      bids.map(
        (key, value) => MapEntry(int.parse(key), value),
      ),
    );
  }

  void _onFinalQuestionData(dynamic json) {
    if (json is! Map) return;

    final data = SocketIoFinalQuestionEventDataPayload.fromJson(
      json as Map<String, dynamic>,
    );

    gameData.value = gameData.value?.copyWith.gameState.finalRoundData!(
      questionData: data.questionData,
    );

    _showQuestion();
  }

  void _onFinalAnswerSubmit(dynamic json) {
    if (json is! Map) return;

    final data = SocketIoFinalAnswerSubmitPayload.fromJson(
      json as Map<String, dynamic>,
    );

    // If this is my answer, stop the controller
    final myId = gameData.value?.me.meta.id;
    if (data.playerId == myId) {
      getIt<GameLobbyFinalAnswerController>().stop();
    }
  }

  void _onFinalAnswerReview(dynamic json) {
    if (json is! Map) return;

    final data = SocketIoFinalAnswerReviewPayload.fromJson(
      json as Map<String, dynamic>,
    );

    final finalRoundData = gameData.value?.gameState.finalRoundData;
    if (finalRoundData == null) return;

    // Update the answer in the answers list
    final updatedAnswers = finalRoundData.answers.map((answer) {
      if (answer.id == data.answerId) {
        return answer.copyWith(
          isCorrect: data.isCorrect,
          reviewedAt: DateTime.now(),
        );
      }
      return answer;
    }).toList();

    gameData.value = gameData.value!.copyWith.gameState.finalRoundData!(
      answers: updatedAnswers,
    );

    // Update player score
    gameData.value = gameData.value?.changePlayer(
      id: data.playerId,
      onChange: (player) => player.copyWith(
        score: player.score + data.scoreChange,
      ),
    );

    // Clear currentReviewingAnswerId
    getIt<GameLobbyReviewController>().updateReviewingAnswerId(null);
  }

  void notifyMediaDownloaded() =>
      socket?.emit(SocketIoGameSendEvents.mediaDownloaded.json!);

  Future<void> _onMediaDownloadStatus(dynamic data) async {
    if (data is! Map) return;

    final statusData = MediaDownloadStatusEventPayload.fromJson(
      data as Map<String, dynamic>,
    );

    // Update the player's media download status in game data
    gameData.value = gameData.value?.changePlayer(
      id: statusData.playerId,
      onChange: (player) =>
          player.copyWith(mediaDownloaded: statusData.mediaDownloaded),
    );

    // If all players are ready, update timer and notify the question controller
    // to start playback
    if (statusData.allPlayersReady) {
      // Update the timer if provided
      if (statusData.timer != null) {
        gameData.value = gameData.value?.copyWith.gameState(
          timer: statusData.timer,
        );
      }
      await getIt<GameQuestionController>().onAllPlayersReady();
    }
  }
}

typedef JoinCompleter = Completer<bool>;
