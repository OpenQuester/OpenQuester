import { ALL_PLAY_BID_TIME } from "domain/constants/game";
import { timerKey } from "domain/constants/redisKeys";
import { GameStateTimer } from "domain/entities/game/GameStateTimer";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { AllPlayLogic } from "domain/logic/question/AllPlayLogic";
import { QuestionPickLogic } from "domain/logic/question/QuestionPickLogic";
import { TransitionGuards } from "domain/state-machine/guards/TransitionGuards";
import { BaseTransitionHandler } from "domain/state-machine/handlers/TransitionHandler";
import {
  GamePhase,
  getGamePhase,
  MutationResult,
  TimerResult,
  TransitionTrigger
} from "domain/state-machine/types";
import { AllPlayMode } from "domain/types/dto/game/state/AllPlayDataDTO";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { BroadcastEvent } from "domain/types/service/ServiceResult";
import { AllPlayStartEventPayload } from "domain/types/socket/events/game/AllPlayEventPayloads";
import { ChoosingToStakeBiddingCtx } from "domain/types/socket/transition/choosing";
import { GameStateValidator } from "domain/validators/GameStateValidator";

/**
 * CHOOSING → ALL_PLAY_BIDDING: a stake-for-everyone question was picked.
 * Every player makes a hidden stake before the question is shown.
 */
export class ChoosingToAllPlayBiddingHandler extends BaseTransitionHandler {
  public readonly fromPhase = GamePhase.CHOOSING;
  public readonly toPhase = GamePhase.ALL_PLAY_BIDDING;

  public canTransition(ctx: ChoosingToStakeBiddingCtx): boolean {
    const { game, trigger, payload } = ctx;

    if (!payload || trigger !== TransitionTrigger.USER_ACTION) return false;
    if (getGamePhase(game) !== this.fromPhase) return false;
    if (!TransitionGuards.canTransitionInRegularRound(game, QuestionState.CHOOSING)) {
      return false;
    }

    try {
      const { question } = QuestionPickLogic.validateQuestionPick(game, payload.questionData);
      return (
        AllPlayLogic.modeOf(question) === AllPlayMode.STAKE &&
        TransitionGuards.hasEligiblePlayers(game)
      );
    } catch {
      return false;
    }
  }

  protected override validate(ctx: ChoosingToStakeBiddingCtx): void {
    GameStateValidator.validateGameInProgress(ctx.game);
  }

  protected async mutate(ctx: ChoosingToStakeBiddingCtx): Promise<MutationResult> {
    const { game, payload } = ctx;
    const { question, theme } = QuestionPickLogic.validateQuestionPick(
      game,
      payload!.questionData
    );

    AllPlayLogic.start(game, question, theme.id!, AllPlayMode.STAKE);
    game.gameState.answerShowData = null;
    game.setQuestionState(QuestionState.BIDDING);
    QuestionPickLogic.markQuestionPlayed(game, question.id!, theme.id!);
    QuestionPickLogic.resetMediaDownloadStatus(game);

    return {};
  }

  protected async handleTimer(ctx: ChoosingToStakeBiddingCtx): Promise<TimerResult> {
    const { game } = ctx;
    const timer = new GameStateTimer(ALL_PLAY_BID_TIME);
    game.gameState.timer = timer.start();

    return {
      timer: timer.value() ?? undefined,
      timerMutations: [
        { op: "delete", key: timerKey(game.id) },
        {
          op: "set",
          key: timerKey(game.id),
          value: JSON.stringify(timer.value()!),
          pxTtl: ALL_PLAY_BID_TIME
        }
      ]
    };
  }

  protected collectBroadcasts(
    ctx: ChoosingToStakeBiddingCtx,
    _mutationResult: MutationResult,
    timerResult: TimerResult
  ): BroadcastEvent[] {
    return [allPlayStartBroadcast(ctx.game, timerResult.timer ?? null)];
  }
}

export function allPlayStartBroadcast(
  game: ChoosingToStakeBiddingCtx["game"],
  timer: AllPlayStartEventPayload["timer"]
): BroadcastEvent<AllPlayStartEventPayload> {
  const data = game.gameState.allPlay!;
  return {
    event: SocketIOGameEvents.ALL_PLAY_START,
    data: {
      mode: data.mode,
      questionId: data.questionId,
      players: data.entries.map((e) => e.playerId),
      price: data.price,
      maxStake: data.maxStake,
      priceMultiplier: data.priceMultiplier,
      timer
    },
    room: game.id
  };
}
