import { GameService } from "application/services/game/GameService";
import { timerKey } from "domain/constants/redisKeys";
import { GameStateTimer } from "domain/entities/game/GameStateTimer";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { PackageQuestionType } from "domain/enums/package/QuestionType";
import { QuestionPickLogic } from "domain/logic/question/QuestionPickLogic";
import { TransitionGuards } from "domain/state-machine/guards/TransitionGuards";
import { BaseTransitionHandler } from "domain/state-machine/handlers/TransitionHandler";
import {
  GamePhase,
  getGamePhase,
  MutationResult,
  TimerResult,
  TransitionTrigger,
} from "domain/state-machine/types";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { BroadcastEvent } from "domain/types/service/ServiceResult";
import {
  ChoosingToSecretTransferCtx,
  ChoosingToSecretTransferMutationData,
} from "domain/types/socket/transition/choosing";
import { GameStateValidator } from "domain/validators/GameStateValidator";
import { SECRET_QUESTION_TRANSFER_TIME } from "domain/constants/game";

/**
 * Handles transition from CHOOSING to SECRET_QUESTION_TRANSFER when a secret
 * question is picked and there are eligible players to transfer to.
 */
export class ChoosingToSecretTransferHandler extends BaseTransitionHandler {
  public readonly fromPhase = GamePhase.CHOOSING;
  public readonly toPhase = GamePhase.SECRET_QUESTION_TRANSFER;

  constructor(gameService: GameService) {
    super(gameService);
  }

  public canTransition(ctx: ChoosingToSecretTransferCtx): boolean {
    const { game, trigger, payload } = ctx;

    if (!payload) return false;
    if (getGamePhase(game) !== this.fromPhase) return false;

    if (
      !TransitionGuards.canTransitionInRegularRound(
        game,
        QuestionState.CHOOSING
      )
    ) {
      return false;
    }

    if (trigger !== TransitionTrigger.USER_ACTION) return false;

    // Validate question existence and type; silence on failure
    try {
      const { question } = QuestionPickLogic.validateQuestionPick(
        game,
        payload.questionData
      );

      if (question.type !== PackageQuestionType.SECRET) return false;

      // Require at least two eligible players to enter transfer phase
      return TransitionGuards.hasMultipleEligiblePlayers(game);
    } catch {
      return false;
    }
  }

  protected override validate(ctx: ChoosingToSecretTransferCtx): void {
    GameStateValidator.validateGameInProgress(ctx.game);
  }

  protected async mutate(
    ctx: ChoosingToSecretTransferCtx
  ): Promise<MutationResult> {
    const { game, payload, triggeredBy } = ctx;
    const pickerPlayerId = triggeredBy.playerId!;

    const { question, theme } = QuestionPickLogic.validateQuestionPick(
      game,
      payload!.questionData
    );

    const secretData = {
      pickerPlayerId,
      transferType: question.transferType!,
      questionId: question.id!,
      transferDecisionPhase: true,
    } satisfies ChoosingToSecretTransferMutationData;

    game.setQuestionState(QuestionState.SECRET_TRANSFER);
    game.gameState.secretQuestionData = secretData;

    // Mark question as played and reset media status for all players
    QuestionPickLogic.markQuestionPlayed(game, question.id!, theme.id!);
    QuestionPickLogic.resetMediaDownloadStatus(game);

    return { data: secretData };
  }

  protected async handleTimer(
    ctx: ChoosingToSecretTransferCtx,
    _mutationResult: MutationResult
  ): Promise<TimerResult> {
    const { game } = ctx;

    const timer = new GameStateTimer(SECRET_QUESTION_TRANSFER_TIME);
    game.gameState.timer = timer.start();

    return {
      timer: timer.value() ?? undefined,
      timerMutations: [
        { op: "delete", key: timerKey(game.id) },
        {
          op: "set",
          key: timerKey(game.id),
          value: JSON.stringify(timer.value()!),
          pxTtl: SECRET_QUESTION_TRANSFER_TIME,
        },
      ],
    };
  }

  protected collectBroadcasts(
    ctx: ChoosingToSecretTransferCtx,
    mutationResult: MutationResult,
    _timerResult: TimerResult
  ): BroadcastEvent[] {
    const data = mutationResult.data as
      | ChoosingToSecretTransferMutationData
      | undefined;

    if (!data) return [];

    return [
      {
        event: SocketIOGameEvents.SECRET_QUESTION_PICKED,
        data: {
          pickerPlayerId: data.pickerPlayerId,
          transferType: data.transferType,
          questionId: data.questionId,
          questionEligiblePlayers: ctx.game.getQuestionEligiblePlayers(),
        },
        room: ctx.game.id,
      },
    ];
  }
}
