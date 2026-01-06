import { singleton } from "tsyringe";

import { ActionContext } from "domain/types/action/ActionContext";
import { QuestionActionValidator } from "domain/validators/QuestionActionValidator";
import { QuestionAction } from "domain/types/game/QuestionAction";
import { QuestionPickLogic } from "domain/logic/question/QuestionPickLogic";
import { QuestionPickPayload } from "domain/types/socket/transition/choosing";
import { TransitionTrigger } from "domain/state-machine/types";
import { ClientResponse } from "domain/enums/ClientResponse";
import { ClientError } from "domain/errors/ClientError";
import { GameStateTimer } from "domain/entities/game/GameStateTimer";
import { SocketGameContextService } from "application/services/socket/SocketGameContextService";
import { PhaseTransitionRouter } from "domain/state-machine/PhaseTransitionRouter";
import { GameService } from "application/services/game/GameService";

@singleton()
export class SocketIOQuestionPickService {
  constructor(
    private socketGameContextService: SocketGameContextService,
    private phaseTransitionRouter: PhaseTransitionRouter,
    private gameService: GameService
  ) {
    //
  }

  public async handleQuestionPick(ctx: ActionContext, questionId: number) {
    const { game, currentPlayer } =
      await this.socketGameContextService.loadGameAndPlayer(ctx);

    QuestionActionValidator.validatePickAction({
      game,
      currentPlayer,
      action: QuestionAction.PICK,
    });

    // Validate upfront for fast failure and to reuse full question data later
    const questionData = QuestionPickLogic.validateQuestionPick(
      game,
      questionId
    );

    // Route transition based on question type/state
    const transitionResult =
      await this.phaseTransitionRouter.tryTransition<QuestionPickPayload>({
        game,
        trigger: TransitionTrigger.USER_ACTION,
        triggeredBy: { playerId: currentPlayer!.meta.id, isSystem: false },
        payload: { questionId },
      });

    if (!transitionResult) {
      throw new ClientError(ClientResponse.INVALID_QUESTION_STATE);
    }

    // Save mutated game state
    await this.gameService.updateGame(game);

    const timerDto = transitionResult.timer;
    const timer = timerDto ? GameStateTimer.fromDTO(timerDto) : null;

    return {
      game,
      question: questionData.question,
      timer,
      transitionResult,
    };
  }
}
