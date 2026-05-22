import { singleton } from "tsyringe";

import { TransitionResourceService } from "application/services/game/TransitionResourceService";
import { GAME_QUESTION_ANSWER_TIME } from "domain/constants/game";
import { Game } from "domain/entities/game/Game";
import { GameStateTimer } from "domain/entities/game/GameStateTimer";
import { Player } from "domain/entities/game/Player";
import { ClientResponse } from "domain/enums/ClientResponse";
import { ClientError } from "domain/errors/ClientError";
import { SecretQuestionTransferLogic } from "domain/logic/special-question/SecretQuestionTransferLogic";
import { PhaseTransitionRouter } from "domain/state-machine/PhaseTransitionRouter";
import { TransitionTrigger } from "domain/state-machine/types";
import { type TimerMutation } from "domain/types/action/ActionExecutionContext";
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

export interface SecretQuestionTransferContextResult extends SecretQuestionTransferResult {
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
   * Handles secret question transfer to another player.
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

    const questionData = await this.packageStore.getQuestionWithTheme(
      game.id,
      secretData!.questionId
    );

    if (!questionData) {
      throw new ClientError(ClientResponse.QUESTION_NOT_FOUND);
    }

    // Transition to ANSWERING phase
    const transitionResult =
      await this.phaseTransitionRouter.tryTransition<SecretTransferToAnsweringPayload>({
        game,
        trigger: TransitionTrigger.USER_ACTION,
        triggeredBy: { playerId: currentPlayer.meta.id, isSystem: false },
        payload: { targetPlayerId: data.targetPlayerId },
        resources: this.transitionResourceService.fromSimpleQuestion(questionData.question)
      });

    if (!transitionResult) {
      throw new ClientError(ClientResponse.INVALID_QUESTION_STATE);
    }

    return {
      ...SecretQuestionTransferLogic.buildResult({
        game,
        fromPlayerId: currentPlayer.meta.id,
        toPlayerId: data.targetPlayerId,
        secretData: secretData!,
        timer:
          transitionResult.timer !== null
            ? GameStateTimer.fromDTO(transitionResult.timer)
            : this._getFallbackTimer(GAME_QUESTION_ANSWER_TIME),
        question: questionData.question
      }),
      timerMutations: transitionResult.timerMutations
    };
  }

  private _getFallbackTimer(duration: number): GameStateTimer {
    const timer = new GameStateTimer(duration);
    timer.start();
    return timer;
  }
}
