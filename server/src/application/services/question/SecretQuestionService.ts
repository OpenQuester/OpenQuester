import { singleton } from "tsyringe";

import { GameService } from "application/services/game/GameService";
import { SocketGameContextService } from "application/services/socket/SocketGameContextService";
import { GAME_QUESTION_ANSWER_TIME } from "domain/constants/game";
import { Game } from "domain/entities/game/Game";
import { GameStateTimer } from "domain/entities/game/GameStateTimer";
import { Player } from "domain/entities/game/Player";
import { ClientResponse } from "domain/enums/ClientResponse";
import { ClientError } from "domain/errors/ClientError";
import { SecretQuestionTransferLogic } from "domain/logic/special-question/SecretQuestionTransferLogic";
import { PhaseTransitionRouter } from "domain/state-machine/PhaseTransitionRouter";
import { TransitionTrigger } from "domain/state-machine/types";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { SecretQuestionGameData } from "domain/types/dto/game/state/SecretQuestionGameData";
import { PackageQuestionDTO } from "domain/types/dto/package/PackageQuestionDTO";
import { SecretQuestionTransferInputData } from "domain/types/socket/game/SecretQuestionTransferData";
import { SecretTransferToAnsweringPayload } from "domain/types/socket/transition/special-question";
import { SecretQuestionValidator } from "domain/validators/SecretQuestionValidator";
import { PackageStore } from "infrastructure/database/repositories/PackageStore";

/**
 * Result from secret question transfer.
 */
interface SecretQuestionTransferResult {
  game: Game;
  fromPlayerId: number;
  toPlayerId: number;
  questionId: number;
  timer: GameStateTimer;
  /** Full question data for personalized broadcasts */
  question: PackageQuestionDTO;
}

/**
 * Service handling secret question type.
 */
@singleton()
export class SecretQuestionService {
  constructor(
    private readonly gameService: GameService,
    private readonly socketGameContextService: SocketGameContextService,
    private readonly phaseTransitionRouter: PhaseTransitionRouter,
    private readonly packageStore: PackageStore
  ) {
    //
  }

  /**
   * Handles secret question transfer to another player.
   */
  public async handleSecretQuestionTransfer(
    socketId: string,
    data: SecretQuestionTransferInputData
  ): Promise<SecretQuestionTransferResult> {
    // Context & Validation
    const context = await this.socketGameContextService.fetchGameContext(
      socketId
    );
    const game = context.game;
    const currentPlayer = context.currentPlayer;

    const secretData = game.gameState.secretQuestionData;
    SecretQuestionValidator.validateTransfer({
      game,
      currentPlayer,
      secretData: secretData ?? null,
      targetPlayerId: data.targetPlayerId,
    });

    // Transition to ANSWERING phase
    const transitionResult =
      await this.phaseTransitionRouter.tryTransition<SecretTransferToAnsweringPayload>(
        {
          game,
          trigger: TransitionTrigger.USER_ACTION,
          triggeredBy: { playerId: currentPlayer!.meta.id, isSystem: false },
          payload: { targetPlayerId: data.targetPlayerId },
        }
      );

    if (!transitionResult) {
      throw new ClientError(ClientResponse.INVALID_QUESTION_STATE);
    }

    const questionData = await this.packageStore.getQuestionWithTheme(
      game.id,
      secretData!.questionId
    );

    if (!questionData) {
      throw new ClientError(ClientResponse.QUESTION_NOT_FOUND);
    }

    await this.gameService.updateGame(game);

    return SecretQuestionTransferLogic.buildResult({
      game,
      fromPlayerId: currentPlayer!.meta.id,
      toPlayerId: data.targetPlayerId,
      secretData: secretData!,
      timer:
        transitionResult.timer !== null
          ? GameStateTimer.fromDTO(transitionResult.timer)
          : this._getFallbackTimer(GAME_QUESTION_ANSWER_TIME),
      question: questionData.question,
    });
  }

  /**
   * Sets up secret question data and game state.
   * Returns null if no active players exist.
   */
  public setupSecretQuestion(
    game: Game,
    question: PackageQuestionDTO,
    currentPlayer: Player
  ): SecretQuestionGameData | null {
    const activeInGamePlayers = game.getInGamePlayers();
    if (activeInGamePlayers.length === 0) {
      return null;
    }

    const secretQuestionData: SecretQuestionGameData = {
      pickerPlayerId: currentPlayer.meta.id,
      transferType: question.transferType!,
      questionId: question.id!,
      transferDecisionPhase: true,
    };

    game.setQuestionState(QuestionState.SECRET_TRANSFER);
    game.gameState.secretQuestionData = secretQuestionData;

    return secretQuestionData;
  }

  private _getFallbackTimer(duration: number): GameStateTimer {
    const timer = new GameStateTimer(duration);
    timer.start();
    return timer;
  }
}
