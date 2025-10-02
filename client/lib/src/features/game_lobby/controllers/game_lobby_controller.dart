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
  final lobbyEditorMode = ValueNotifier<bool>(false);
  final showChat = ValueNotifier<bool>(false);

  StreamSubscription<ChatOperation>? _chatMessagesSub;
  double? themeScrollPosition;

  String? get gameId => _gameId;

  int get myId => ProfileController.getUser()!.id;
  bool get gameStarted => gameData.value?.gameState.currentRound != null;

  JoinCompleter _joinCompleter = JoinCompleter();

  Future<bool> join({required String gameId}) async {
    // Check if already joined
    if (_gameId == gameId) return true;

    clear();

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
        ..on(SocketIOGameReceiveEvents.questionSkip.json!, _onQuestionSkip)
        ..on(SocketIOGameReceiveEvents.questionUnskip.json!, _onQuestionUnSkip)
        ..on(SocketIOGameReceiveEvents.scoreChanged.json!, _onScoreChanged)
        ..on(
          SocketIOGameReceiveEvents.playerRestricted.json!,
          _onPlayerRestricted,
        )
        ..on(
          SocketIOGameReceiveEvents.turnPlayerChanged.json!,
          _onPlayerTurnChanged,
        )
        ..on(
          SocketIOGameReceiveEvents.playerRoleChange.json!,
          _onPlayerRoleChange,
        )
        ..on(SocketIOGameReceiveEvents.playerReady.json!, _onPlayerReady)
        ..on(
          SocketIOGameReceiveEvents.secretQuestionPicked.json!,
          _onSecretQuestionPicked,
        )
        ..on(
          SocketIOGameReceiveEvents.secretQuestionTransfer.json!,
          _onSecretQuestionTransfer,
        )
        ..on(
          SocketIOGameReceiveEvents.stakeQuestionPicked.json!,
          _onStakeQuestionPicked,
        )
        ..on(
          SocketIOGameReceiveEvents.stakeBidSubmit.json!,
          _onStakeQuestionSubmitted,
        )
        ..on(
          SocketIOGameReceiveEvents.stakeQuestionWinner.json!,
          _onStakeQuestionWinner,
        )
        ..on(
          SocketIOGameReceiveEvents.mediaDownloadStatus.json!,
          _onMediaDownloadStatus,
        )
        ..connect();

      return await _joinCompleter.future;
    } catch (e, s) {
      logger.e(e, stackTrace: s);
      clear();

      rethrow;
    }
  }

  void _showLoggedInChatEvent(String text) {
    getIt<ToastController>().show(text, type: ToastType.info);
    getIt<SocketChatController>().chatController?.insertMessage(
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
    _setGamePause(isPaused: true);
  }

  Future<void> _onReconnect(dynamic data) async {
    logger.d('GameLobbyController._onReconnect: ${this.gameId}');

    final gameId = this.gameId!;
    clear();
    await join(gameId: gameId);
  }

  Future<void> _onConnect() async {
    try {
      logger.d('GameLobbyController._onConnect: $gameId');

      // Authenticate socket connection
      await Api.I.api.auth.postV1AuthSocket(
        body: InputSocketIOAuth(socketId: socket!.id!),
      );

      // Check for other showman who joined when you wore out
      final otherShowman = gameListData.value?.players.firstWhereOrNull(
        (e) => e.id != myId && e.role == PlayerRole.showman,
      );
      final lastRole = otherShowman != null
          ? null
          : gameListData.value?.players
                .firstWhereOrNull((e) => e.id == myId)
                ?.role;

      final ioGameJoinInput = SocketIOGameJoinInput(
        gameId: _gameId!,
        role: lastRole ?? PlayerRole.spectator,
      );

      socket?.emit(SocketIOGameSendEvents.join.json!, ioGameJoinInput.toJson());
    } catch (e, s) {
      logger.e(e, stackTrace: s);
      clear();

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
      lobbyEditorMode.value = false;
      themeScrollPosition = null;
      getIt<SocketChatController>().clear();
      getIt<GameQuestionController>().clear();
      getIt<GameLobbyPlayerPickerController>().clear();
      _joinCompleter = JoinCompleter();
    } catch (e, s) {
      logger.e(e, stackTrace: s);
    }
  }

  Future<void> leave({bool force = false}) async {
    socket?.emit(SocketIOGameSendEvents.userLeave.json!);
    _leave();
  }

  void toggleDesktopChat() {
    showChat.value = !showChat.value;
  }

  Future<void> _onGameData(dynamic data) async {
    // Set global game data
    gameData.value = SocketIOGameJoinEventPayload.fromJson(
      data as Map<String, dynamic>,
    );

    _joinCompleter.complete(true);

    // Set editor mode after loading game but not starting
    if (!gameStarted) {
      lobbyEditorMode.value = true;
    }

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
    if (gameData.value == null) return;
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
    lobbyEditorMode.value = false;
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

    // Complete the join completer with false if not already completed
    if (!_joinCompleter.isCompleted) {
      _joinCompleter.complete(false);
    }

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

    if (myId != user.meta.id) {
      getIt<ToastController>().show(
        LocaleKeys.user_leave_the_game.tr(args: [user.meta.username]),
        type: ToastType.info,
      );
    }
  }

  void _leave() {
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
      getIt<ToastController>().show(
        LocaleKeys.user_joined_the_game.tr(args: [user.meta.username]),
        type: ToastType.info,
      );
    }
  }

  void onQuestionPick(int questionId) {
    final currentTurnPlayerId = gameData.value?.gameState.currentTurnPlayerId;
    final me = gameData.value?.me;

    if (me?.role == PlayerRole.spectator) return;

    final myTurnToPick = currentTurnPlayerId == me?.meta.id;

    if (!myTurnToPick && me?.role != PlayerRole.showman) {
      getIt<ToastController>().show(
        LocaleKeys.not_your_turn_to_pick.tr(),
        type: ToastType.warning,
      );
      return;
    }

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

    final questionData = QuestionFinishEventPayload.fromJson(
      data as Map<String, dynamic>,
    );

    _updateGameStateFromAnswerResult(
      SocketIOAnswerResultEventPayload(
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

    _showAnswer();
  }

  Future<void> _showAnswer() async {
    final controller = getIt<GameQuestionController>();
    final currentQuestion = gameData.value?.gameState.currentQuestion;

    // Check for empty answer
    if (currentQuestion?.answerFiles?.isEmpty ??
        true && (currentQuestion?.answerText.isEmptyOrNull ?? true)) {
      return;
    }

    // Clear question
    gameData.value = gameData.value?.copyWith.gameState(
      currentQuestion: null,
      timer: null,
    );
    getIt<GameLobbyPlayerPickerController>().stopSelection();

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

  void passQuestion({required bool pass}) {
    final me = gameData.value?.me;
    if (me == null) return;
    if (me.role != PlayerRole.player) return;
    if (gameData.value?.gameState.answeringPlayer != null) return;
    if (gameData.value?.gameState.isPaused ?? true) return;

    socket?.emit(
      pass
          ? SocketIOGameSendEvents.questionSkip.json!
          : SocketIOGameSendEvents.questionUnskip.json!,
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
    gameData.value = gameData.value?.copyWith.gameState(
      isPaused: isPaused,
      timer: null,
    );
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

  void _onQuestionSkip(dynamic data) {
    if (data is! Map) return;

    final skippedPlayer = SocketIOGameSkipEventPayload.fromJson(
      data as Map<String, dynamic>,
    );
    gameData.value = gameData.value?.copyWith.gameState(
      skippedPlayers: {
        ...?gameData.value?.gameState.skippedPlayers,
        skippedPlayer.playerId,
      }.toList(),
    );
  }

  void _onQuestionUnSkip(dynamic data) {
    if (data is! Map) return;

    final unskippedPlayer = SocketIOGameUnskipEventPayload.fromJson(
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

    final restrictedPlayer = SocketIOPlayerRestrictionEventPayload.fromJson(
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

  void _onPlayerRoleChange(dynamic json) {
    if (json is! Map) return;

    final data = SocketIOPlayerRoleChangeEventPayload.fromJson(
      json as Map<String, dynamic>,
    );

    gameData.value = gameData.value?.copyWith(players: data.players);
  }

  void _onPlayerTurnChanged(dynamic json) {
    if (json is! Map) return;

    final data = SocketIOTurnPlayerChangeEventPayload.fromJson(
      json as Map<String, dynamic>,
    );

    gameData.value = gameData.value?.copyWith.gameState(
      currentTurnPlayerId: data.newTurnPlayerId,
    );
  }

  void _onScoreChanged(dynamic json) {
    if (json is! Map) return;

    final data = SocketIOPlayerScoreChangeEventPayload.fromJson(
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

    _showLoggedInChatEvent(
      LocaleKeys.player_edit_showman_changed_score.tr(
        namedArgs: {
          'username': player?.meta.username ?? '',
          'old': formatScore(player?.score),
          'new': formatScore(data.newScore),
        },
      ),
    );
  }

  void _onPlayerReady(dynamic json) {
    if (json is! Map) return;

    final data = SocketIOPlayerReadinessEventPayload.fromJson(
      json as Map<String, dynamic>,
    );

    gameData.value = gameData.value?.copyWith.gameState(
      readyPlayers: data.readyPlayers,
    );
  }

  void playerReady({required bool ready}) {
    socket?.emit(
      ready
          ? SocketIOGameSendEvents.playerReady.json!
          : SocketIOGameSendEvents.playerUnready.json!,
    );
  }

  void _onSecretQuestionPicked(dynamic json) {
    if (json is! Map) return;

    final data = SocketIOSecretQuestionPickedEventPayload.fromJson(
      json as Map<String, dynamic>,
    );

    getIt<GameLobbyPlayerPickerController>().startSelect(
      players: gameData.value?.players ?? [],
      selectingPlayerId: data.pickerPlayerId,
      type: data.transferType,
      onPlayerSelected: (selectedPlayerId) {
        socket?.emit(
          SocketIOGameSendEvents.secretQuestionTransfer.json!,
          SocketIOSecretQuestionTransferInputData(
            targetPlayerId: selectedPlayerId,
          ).toJson(),
        );
      },
    );
  }

  void _onSecretQuestionTransfer(dynamic json) {
    if (json is! Map) return;

    final data = SocketIOSecretQuestionTransferEventPayload.fromJson(
      json as Map<String, dynamic>,
    );

    gameData.value = gameData.value?.copyWith.gameState(
      answeringPlayer: data.toPlayerId,
    );
    getIt<GameLobbyPlayerPickerController>().stopSelection();
  }

  void _onStakeQuestionPicked(dynamic json) {
    if (json is! Map) return;

    final data = SocketIOStakeQuestionPickedEventPayload.fromJson(
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
        currentBidderIndex: data.biddingOrder.first,
        highestBid: null,
        winnerPlayerId: null,
        biddingPhase: true,
      ),
    );
  }

  void _onStakeQuestionSubmitted(dynamic json) {
    if (json is! Map) return;

    final data = SocketIOStakeQuestionSubmittedEventPayload.fromJson(
      json as Map<String, dynamic>,
    );

    final index = gameData.value?.gameState.stakeQuestionData?.biddingOrder
        .indexOf(data.nextBidderId ?? -1);

    gameData.value = gameData.value?.copyWith.gameState(timer: data.timer);
    final stakeData = gameData.value?.gameState.stakeQuestionData;
    gameData.value = gameData.value?.copyWith.gameState.stakeQuestionData!(
      biddingPhase: !data.isPhaseComplete,
      currentBidderIndex: index ?? -1,
      bids: {
        ...?stakeData?.bids,
        data.playerId.toString(): data.bidAmount,
      },
    );
  }

  void _onStakeQuestionWinner(dynamic json) {
    if (json is! Map) return;

    final data = SocketIOStakeQuestionWinnerEventPayload.fromJson(
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

    _showLoggedInChatEvent(
      LocaleKeys.game_stake_question_player_win_the_bid.tr(
        namedArgs: {
          'username': winnerUsername,
          'value': ScoreText.formatScore(data.finalBid).$1,
        },
      ),
    );
  }

  void submitQuestionBid(SocketIOStakeQuestionBidInput input) {
    socket?.emit(
      SocketIOGameSendEvents.stakeBidSubmit.json!,
      input.toJson(),
    );
  }

  void notifyMediaDownloaded() {
    socket?.emit(SocketIOGameSendEvents.mediaDownloaded.json!);
  }

  void _onMediaDownloadStatus(dynamic data) {
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
      getIt<GameQuestionController>().onAllPlayersReady();
    }
  }
}

typedef JoinCompleter = Completer<bool>;
