import { singleton } from "tsyringe";

import { TransitionResourceService } from "application/services/game/TransitionResourceService";
import { timerKey } from "domain/constants/redisKeys";
import { Game } from "domain/entities/game/Game";
import { GameStateTimer } from "domain/entities/game/GameStateTimer";
import { Player } from "domain/entities/game/Player";
import { ClientResponse } from "domain/enums/ClientResponse";
import { ClientError } from "domain/errors/ClientError";
import { PhaseTransitionRouter } from "domain/state-machine/PhaseTransitionRouter";
import { type TransitionResult, TransitionTrigger } from "domain/state-machine/types";
import { type TimerMutation } from "domain/types/action/ActionExecutionContext";
import { PackageQuestionDTO, PackageQuestionSubType } from "domain/types/dto/package/PackageQuestionDTO";
import {
  SecretQuestionPriceInputData,
  SecretQuestionTransferInputData
} from "domain/types/socket/game/SecretQuestionTransferData";
import { SecretTransferToAnsweringPayload } from "domain/types/socket/transition/special-question";
import { SecretQuestionValidator } from "domain/validators/SecretQuestionValidator";
import { PackageStore } from "infrastructure/database/repositories/PackageStore";

/**
 * Result of a secret question step: either the question goes to its answerer
 * (`question` set), or, for a customPrice question, the receiver must first
 * pick a price (`allowedPrices` set, `question` null).
 */
export interface SecretQuestionTransferContextResult {
  game: Game;
  fromPlayerId: number;
  toPlayerId: number;
  questionId: number;
  timer: GameStateTimer;
  /** Full question data for personalized broadcasts; null while a price is picked */
  question: PackageQuestionDTO | null;
  /** Prices the receiver picks from (customPrice), when waiting for the pick */
  allowedPrices: number[] | null;
  /** The price the receiver picked */
  price: number | null;
  timerMutations: TimerMutation[];
}

/**
 * Service handling secret question type.
 */
@singleton()
export class SecretQuestionService {
  constructor(
    private readonly phaseTransitionRouter: PhaseTransitionRouter,
    private readonly transitionResourceService: TransitionResourceService,
    private readonly packageStore: PackageStore
  ) {
    //
  }

  /**
   * Handles secret question transfer to another player. A customPrice
   * question then waits for the receiver to pick its price.
   */
  public async handleSecretQuestionTransfer(
    game: Game,
    currentPlayer: Player,
    data: SecretQuestionTransferInputData
  ): Promise<SecretQuestionTransferContextResult> {
    const secretData = game.gameState.secretQuestionData;
    SecretQuestionValidator.validateTransfer({
      game,
      currentPlayer,
      secretData: secretData ?? null,
      targetPlayerId: data.targetPlayerId
    });

    const question = await this._loadQuestion(game, secretData!.questionId);
    const allowedPrices = SecretQuestionService.customPrices(question);

    if (allowedPrices) {
      return this._startPriceSelection(game, data.targetPlayerId, question, allowedPrices);
    }

    return this.completeTransfer(game, {
      targetPlayerId: data.targetPlayerId,
      question,
      trigger: TransitionTrigger.USER_ACTION,
      triggeredBy: currentPlayer.meta.id,
      fromPlayerId: currentPlayer.meta.id
    });
  }

  /**
   * The receiver of a customPrice question picks its price; the question is
   * then shown to them at that price.
   */
  public async handlePriceSelection(
    game: Game,
    currentPlayer: Player,
    data: SecretQuestionPriceInputData
  ): Promise<SecretQuestionTransferContextResult> {
    const secretData = game.gameState.secretQuestionData;
    SecretQuestionValidator.validatePriceSelection({
      game,
      currentPlayer,
      secretData: secretData ?? null,
      price: data.price
    });

    const question = await this._loadQuestion(game, secretData!.questionId);

    return this.completeTransfer(game, {
      targetPlayerId: currentPlayer.meta.id,
      question,
      price: data.price,
      trigger: TransitionTrigger.USER_ACTION,
      triggeredBy: currentPlayer.meta.id
    });
  }

  /**
   * Hands the question to its answerer and starts answering (SECRET_TRANSFER
   * → ANSWERING). Used for a plain transfer, a picked price, and timeouts.
   */
  public async completeTransfer(
    game: Game,
    input: {
      targetPlayerId: number;
      question: PackageQuestionDTO;
      price?: number;
      trigger: TransitionTrigger;
      triggeredBy?: number;
      /** Who handed the question over; defaults to its picker */
      fromPlayerId?: number;
    }
  ): Promise<SecretQuestionTransferContextResult & { transition: TransitionResult }> {
    const secretData = game.gameState.secretQuestionData!;
    const { targetPlayerId, question, price, trigger, triggeredBy } = input;

    const transitionResult =
      await this.phaseTransitionRouter.tryTransition<SecretTransferToAnsweringPayload>({
        game,
        trigger,
        triggeredBy:
          triggeredBy !== undefined
            ? { playerId: triggeredBy, isSystem: false }
            : { isSystem: true },
        payload: price !== undefined ? { targetPlayerId, price } : { targetPlayerId },
        resources: this.transitionResourceService.fromSimpleQuestion(question)
      });

    if (!transitionResult) {
      throw new ClientError(ClientResponse.INVALID_QUESTION_STATE);
    }

    return {
      game,
      fromPlayerId: input.fromPlayerId ?? secretData.pickerPlayerId,
      toPlayerId: targetPlayerId,
      questionId: secretData.questionId,
      timer:
        transitionResult.timer !== null
          ? GameStateTimer.fromDTO(transitionResult.timer)
          : this._startedTimer(game.settings.timers.answerMs),
      question: price !== undefined ? { ...question, price } : question,
      allowedPrices: null,
      price: price ?? null,
      timerMutations: transitionResult.timerMutations,
      transition: transitionResult
    };
  }

  /** Allowed prices when the question lets its receiver pick one */
  public static customPrices(question: PackageQuestionDTO): number[] | null {
    if (question.subType !== PackageQuestionSubType.CUSTOM_PRICE) {
      return null;
    }
    const prices = [...new Set(question.allowedPrices ?? [])].sort((a, b) => a - b);
    return prices.length > 0 ? prices : null;
  }

  private _startPriceSelection(
    game: Game,
    targetPlayerId: number,
    question: PackageQuestionDTO,
    allowedPrices: number[]
  ): SecretQuestionTransferContextResult {
    const secretData = game.gameState.secretQuestionData!;
    secretData.transferDecisionPhase = false;
    secretData.priceSelection = { playerId: targetPlayerId, allowedPrices };

    const timer = this._startedTimer(game.settings.timers.secretTransferMs);
    game.gameState.timer = timer.value();

    return {
      game,
      fromPlayerId: secretData.pickerPlayerId,
      toPlayerId: targetPlayerId,
      questionId: secretData.questionId,
      timer,
      question: null,
      allowedPrices,
      price: null,
      timerMutations: [
        { op: "delete", key: timerKey(game.id) },
        {
          op: "set",
          key: timerKey(game.id),
          value: JSON.stringify(timer.value()),
          pxTtl: game.settings.timers.secretTransferMs
        }
      ]
    };
  }

  private async _loadQuestion(game: Game, questionId: number): Promise<PackageQuestionDTO> {
    const questionData = await this.packageStore.getQuestionWithTheme(game.id, questionId);

    if (!questionData) {
      throw new ClientError(ClientResponse.QUESTION_NOT_FOUND);
    }

    return questionData.question;
  }

  private _startedTimer(duration: number): GameStateTimer {
    const timer = new GameStateTimer(duration);
    timer.start();
    return timer;
  }
}
