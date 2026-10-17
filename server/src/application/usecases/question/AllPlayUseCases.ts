import { TransitionResourceService } from "application/services/game/TransitionResourceService";
import { type Game } from "domain/entities/game/Game";
import { ClientResponse } from "domain/enums/ClientResponse";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { ClientError } from "domain/errors/ClientError";
import { AllPlayLogic } from "domain/logic/question/AllPlayLogic";
import { PhaseTransitionRouter } from "domain/state-machine/PhaseTransitionRouter";
import { TransitionTrigger } from "domain/state-machine/types";
import { type ActionExecutionContext } from "domain/types/action/ActionExecutionContext";
import { type ActionHandlerResult } from "domain/types/action/ActionHandlerResult";
import { type DataMutation, DataMutationConverter } from "domain/types/action/DataMutation";
import { type GameActionHandler } from "domain/types/action/GameActionHandler";
import { PlayerRole } from "domain/types/game/PlayerRole";
import {
  AllPlayAnswerInputData,
  AllPlayReviewEventPayload,
  AllPlayReviewInputData,
  AllPlayStakeInputData,
  AllPlaySubmittedEventPayload
} from "domain/types/socket/events/game/AllPlayEventPayloads";
import { GameStateValidator } from "domain/validators/GameStateValidator";

/**
 * Moves an "everyone answers" question on when its condition is met (every
 * stake / answer / ruling is in). Returns the transition's mutations, or
 * none when the question stays where it is.
 */
async function advanceIfDone(
  router: PhaseTransitionRouter,
  resources: TransitionResourceService,
  game: Game,
  playerId: number
): Promise<DataMutation[]> {
  const allPlay = game.gameState.allPlay;
  if (!allPlay) return [];

  const transition = await router.tryTransition({
    game,
    trigger: TransitionTrigger.CONDITION_MET,
    triggeredBy: { playerId, isSystem: true },
    resources: await resources.getQuestionWithTheme(game, allPlay.questionId)
  });

  if (!transition) return [];

  return [
    ...DataMutationConverter.mutationFromTimerMutations(transition.timerMutations),
    ...DataMutationConverter.mutationFromServiceBroadcasts(transition.broadcasts, game.id)
  ];
}

function requirePlayer(ctx: ActionExecutionContext<unknown>): number {
  GameStateValidator.validateGameInProgress(ctx.game);
  if (ctx.currentPlayer?.role !== PlayerRole.PLAYER) {
    throw new ClientError(ClientResponse.ALL_PLAY_NOT_PARTICIPANT);
  }

  return ctx.currentPlayer.meta.id;
}

/** A player's hidden stake on a stake-for-everyone question */
export class AllPlayStakeUseCase
  implements GameActionHandler<AllPlayStakeInputData, AllPlaySubmittedEventPayload>
{
  constructor(
    private readonly router: PhaseTransitionRouter,
    private readonly resources: TransitionResourceService
  ) {
    //
  }

  public async execute(
    ctx: ActionExecutionContext<AllPlayStakeInputData>
  ): Promise<ActionHandlerResult<AllPlaySubmittedEventPayload>> {
    const playerId = requirePlayer(ctx);
    AllPlayLogic.submitStake(ctx.game, playerId, ctx.action.payload.amount);

    const data: AllPlaySubmittedEventPayload = { playerId };

    return {
      success: true,
      data,
      mutations: [
        DataMutationConverter.gameBroadcastMutation(
          ctx.game.id,
          SocketIOGameEvents.ALL_PLAY_STAKE,
          data
        ),
        ...(await advanceIfDone(this.router, this.resources, ctx.game, playerId)),
        DataMutationConverter.saveGameMutation(ctx.game)
      ],
      broadcastGame: ctx.game
    };
  }
}

/** A player's written answer to an "everyone answers" question */
export class AllPlayAnswerUseCase
  implements GameActionHandler<AllPlayAnswerInputData, AllPlaySubmittedEventPayload>
{
  constructor(
    private readonly router: PhaseTransitionRouter,
    private readonly resources: TransitionResourceService
  ) {
    //
  }

  public async execute(
    ctx: ActionExecutionContext<AllPlayAnswerInputData>
  ): Promise<ActionHandlerResult<AllPlaySubmittedEventPayload>> {
    const playerId = requirePlayer(ctx);
    AllPlayLogic.submitAnswer(ctx.game, playerId, ctx.action.payload.answerText);

    const data: AllPlaySubmittedEventPayload = { playerId };

    return {
      success: true,
      data,
      mutations: [
        DataMutationConverter.gameBroadcastMutation(
          ctx.game.id,
          SocketIOGameEvents.ALL_PLAY_ANSWER,
          data
        ),
        ...(await advanceIfDone(this.router, this.resources, ctx.game, playerId)),
        DataMutationConverter.saveGameMutation(ctx.game)
      ],
      broadcastGame: ctx.game
    };
  }
}

/** The showman's ruling on one written answer */
export class AllPlayReviewUseCase
  implements GameActionHandler<AllPlayReviewInputData, AllPlayReviewEventPayload>
{
  constructor(
    private readonly router: PhaseTransitionRouter,
    private readonly resources: TransitionResourceService
  ) {
    //
  }

  public async execute(
    ctx: ActionExecutionContext<AllPlayReviewInputData>
  ): Promise<ActionHandlerResult<AllPlayReviewEventPayload>> {
    const { game, currentPlayer } = ctx;
    GameStateValidator.validateGameInProgress(game);
    if (currentPlayer?.role !== PlayerRole.SHOWMAN) {
      throw new ClientError(ClientResponse.ONLY_SHOWMAN_SEND_ANSWER_RESULT);
    }

    const { playerId, isCorrect } = ctx.action.payload;
    const entry = AllPlayLogic.review(game, playerId, isCorrect);
    const player = game.getPlayer(playerId, { fetchDisconnected: true });

    const data: AllPlayReviewEventPayload = {
      playerId,
      isCorrect,
      scoreChange: entry.scoreChange ?? 0,
      newScore: player?.score ?? 0
    };

    return {
      success: true,
      data,
      mutations: [
        DataMutationConverter.gameBroadcastMutation(
          game.id,
          SocketIOGameEvents.ALL_PLAY_REVIEW,
          data
        ),
        ...(await advanceIfDone(this.router, this.resources, game, currentPlayer.meta.id)),
        DataMutationConverter.saveGameMutation(game)
      ],
      broadcastGame: game
    };
  }
}
