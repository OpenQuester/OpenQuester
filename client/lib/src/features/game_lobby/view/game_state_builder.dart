import 'package:flutter/material.dart';
import 'package:openquester/common_imports.dart';

/// Represents the current state of the game
enum GameLobbyState {
  /// Editor mode for showman
  editorMode,

  /// Final round reviewing phase
  reviewingFinalAnswers,

  /// Final round answering phase
  answeringFinal,

  /// Bidding phase for stake questions
  bidding,

  /// Theme picking phase in final round
  pickingTheme,

  /// Picking player for question transfer
  pickingPlayer,

  /// Loading state
  loading,

  /// Game has finished
  finished,

  /// Bidding phase for stake questions (from game state)
  biddingPhaseFromState,

  /// Current question is being displayed
  questionActive,

  /// Default state - showing themes
  showingThemes,
}

/// A widget that determines the current game state and builds UI accordingly
class GameStateBuilder extends WatchingWidget {
  const GameStateBuilder({required this.builder, super.key});

  /// Builder function that receives the current game state
  final Widget Function(GameLobbyState state) builder;

  @override
  Widget build(BuildContext context) {
    final gameData = watchValue((GameLobbyController e) => e.gameData);
    final isPickingPlayer = watchPropertyValue(
      (GameLobbyPlayerPickerController e) => e.isPicking,
    );
    final isBidding = watchPropertyValue(
      (GameLobbyPlayerStakesController e) => e.isBidding,
    );
    final lobbyEditorMode = watchValue(
      (GameLobbyController e) => e.lobbyEditorMode,
    );
    final currentQuestion = watchValue(
      (GameQuestionController e) => e.questionData,
    );
    final isPickingTheme = watchPropertyValue(
      (GameLobbyThemePickerController e) => e.isPicking,
    );
    final gameFinished = watchValue((GameLobbyController e) => e.gameFinished);
    final finalRoundPhase = gameData?.gameState.finalRoundData?.phase;
    final isAnsweringFinal = finalRoundPhase == FinalRoundPhase.answering;
    final isReviewingFinalAnswers =
        finalRoundPhase == FinalRoundPhase.reviewing;

    // Determine current state (order matters!)
    GameLobbyState state;
    if (lobbyEditorMode) {
      state = GameLobbyState.editorMode;
    } else if (isReviewingFinalAnswers) {
      state = GameLobbyState.reviewingFinalAnswers;
    } else if (isAnsweringFinal) {
      state = GameLobbyState.answeringFinal;
    } else if (isBidding) {
      state = GameLobbyState.bidding;
    } else if (isPickingTheme) {
      state = GameLobbyState.pickingTheme;
    } else if (isPickingPlayer) {
      state = GameLobbyState.pickingPlayer;
    } else if (gameData?.gameState.currentRound == null) {
      state = GameLobbyState.loading;
    } else if (gameFinished) {
      state = GameLobbyState.finished;
    } else if (gameData?.gameState.stakeQuestionData?.biddingPhase ?? false) {
      state = GameLobbyState.biddingPhaseFromState;
    } else if (currentQuestion != null) {
      state = GameLobbyState.questionActive;
    } else {
      state = GameLobbyState.showingThemes;
    }

    return builder(state);
  }
}
