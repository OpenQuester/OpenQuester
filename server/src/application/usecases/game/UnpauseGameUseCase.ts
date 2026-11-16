import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { QuestionTransitionLogic } from "domain/logic/question/QuestionTransitionLogic";
import { SYSTEM_PLAYER_ID } from "domain/constants/game";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { GameService } from "application/services/game/GameService";
import { SocketGameTimerService } from "application/services/socket/SocketGameTimerService";
import { SocketGameValidationService } from "application/services/socket/SocketGameValidationService";
import { type ActionExecutionContext } from "domain/types/action/ActionExecutionContext";
import { type ActionHandlerResult } from "domain/types/action/ActionHandlerResult";
import { DataMutationConverter } from "domain/types/action/DataMutation";
import { type GameActionHandler } from "domain/types/action/GameActionHandler";
import { ShowmanAction } from "domain/types/game/ShowmanAction";
import {
  type EmptyInputData,
  type GameUnpauseBroadcastData
} from "domain/types/socket/events/SocketEventInterfaces";
import { GameStateValidator } from "domain/validators/GameStateValidator";
import { PhaseTransitionRouter } from "domain/state-machine/PhaseTransitionRouter";
import { TransitionTrigger } from "domain/state-machine/types";
import { TransitionGuards } from "domain/state-machine/guards/TransitionGuards";

/**
 * Handles unpausing a game.
 *
 * Validates showman role and game state, loads the saved timer,
 * then builds timer unpause mutations.
 */
export class UnpauseGameUseCase implements GameActionHandler<
  EmptyInputData,
  GameUnpauseBroadcastData
> {
  constructor(
    private readonly socketGameTimerService: SocketGameTimerService,
    private readonly gameService: GameService,
    private readonly socketGameValidationService: SocketGameValidationService,
    private readonly phaseTransitionRouter: PhaseTransitionRouter
  ) {}

  public async execute(
    ctx: ActionExecutionContext<EmptyInputData>
  ): Promise<ActionHandlerResult<GameUnpauseBroadcastData>> {
    await this.socketGameValidationService.validateShowmanOrModerator(ctx, ShowmanAction.UNPAUSE);

    const { game } = ctx;

    GameStateValidator.validateGameNotFinished(game);
    GameStateValidator.validateGameStarted(game);
    if (game.gameState.questionTransition && !game.gameState.isPaused) {
      return { success: true, mutations: [] };
    }

    // Load the saved timer stored under the questionState suffix
    const questionState = game.gameState.questionState;
    const savedTimer = await this.gameService.getTimer(game.id, questionState!);

    const { result, timerMutations } = this.socketGameTimerService.buildUnpauseTimerMutations(
      game,
      savedTimer
    );

    const unpauseData: GameUnpauseBroadcastData = {
      timer: result.data.timer,
      questionTransition: game.gameState.questionTransition ?? null
    };
    const gated = !!game.gameState.questionTransition;
    const regularMedia = TransitionGuards.canTransitionInRegularRound(
      game,
      QuestionState.MEDIA_DOWNLOADING
    );
    const wasReady = game.gameState.questionTransition?.mediaReady;
    const openingMutations = QuestionTransitionLogic.refresh(game);

    // Readiness received while paused can now release MEDIA_DOWNLOADING -> SHOWING
    // after the regular opening barrier, or MEDIA_DOWNLOADING -> FINAL_ANSWERING.
    const transition =
      !game.gameState.scriptProgress && (regularMedia || TransitionGuards.isFinalRoundMediaDownloading(game))
        ? await this.phaseTransitionRouter.tryTransition({
            game,
            trigger: regularMedia ? TransitionTrigger.USER_ACTION : TransitionTrigger.CONDITION_MET,
            triggeredBy: { isSystem: true }
          })
        : null;

    return {
      success: true,
      data: unpauseData,
      mutations: [
        DataMutationConverter.saveGameMutation(game),
        ...DataMutationConverter.mutationFromTimerMutations(
          transition && regularMedia
            ? timerMutations.filter((m) => m.op === "delete")
            : [...timerMutations, ...openingMutations]
        ),
        ...DataMutationConverter.mutationFromSocketBroadcasts(result.broadcasts),
        ...((regularMedia && transition) ||
        (gated && wasReady !== game.gameState.questionTransition?.mediaReady)
          ? [
              DataMutationConverter.gameBroadcastMutation(
                game.id,
                SocketIOGameEvents.MEDIA_DOWNLOAD_STATUS,
                QuestionTransitionLogic.status(game, SYSTEM_PLAYER_ID, transition?.timer ?? null)
              )
            ]
          : []),
        ...DataMutationConverter.mutationFromTimerMutations(transition?.timerMutations),
        ...DataMutationConverter.mutationFromServiceBroadcasts(transition?.broadcasts, game.id)
      ]
    };
  }
}
