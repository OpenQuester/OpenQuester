import { singleton } from "tsyringe";

import { GameService } from "application/services/game/GameService";
import { SocketGameContextService } from "application/services/socket/SocketGameContextService";
import { PhaseTransitionRouter } from "domain/state-machine/PhaseTransitionRouter";
import { TransitionTrigger } from "domain/state-machine/types";
import { GAME_QUESTION_ANSWER_TIME } from "domain/constants/game";
import { Game } from "domain/entities/game/Game";
import { GameStateTimer } from "domain/entities/game/GameStateTimer";
import { Player } from "domain/entities/game/Player";
import { ClientResponse } from "domain/enums/ClientResponse";
import { ClientError } from "domain/errors/ClientError";
import { SecretQuestionTransferLogic } from "domain/logic/special-question/SecretQuestionTransferLogic";
import { GameQuestionMapper } from "domain/mappers/GameQuestionMapper";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { SecretQuestionGameData } from "domain/types/dto/game/state/SecretQuestionGameData";
import { PackageQuestionDTO } from "domain/types/dto/package/PackageQuestionDTO";
import { SecretQuestionTransferInputData } from "domain/types/socket/game/SecretQuestionTransferData";
import { SecretQuestionValidator } from "domain/validators/SecretQuestionValidator";
import { SecretTransferToAnsweringPayload } from "domain/types/socket/transition/special-question";

/**
 * Result from secret question transfer.
 */
export interface SecretQuestionTransferResult {
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
    private readonly phaseTransitionRouter: PhaseTransitionRouter
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

    const questionData = GameQuestionMapper.getQuestionAndTheme(
      game.package,
      game.gameState.currentRound!.id,
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

    game.gameState.questionState = QuestionState.SECRET_TRANSFER;
    game.gameState.secretQuestionData = secretQuestionData;

    return secretQuestionData;
  }

  private _getFallbackTimer(duration: number): GameStateTimer {
    const timer = new GameStateTimer(duration);
    timer.start();
    return timer;
  }
}
