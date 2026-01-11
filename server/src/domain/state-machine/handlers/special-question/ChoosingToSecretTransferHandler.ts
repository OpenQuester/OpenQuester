import { GameService } from "application/services/game/GameService";
import { SocketQuestionStateService } from "application/services/socket/SocketQuestionStateService";
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

  constructor(
    gameService: GameService,
    timerService: SocketQuestionStateService
  ) {
    super(gameService, timerService);
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
        payload.questionId
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
      payload!.questionId
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
    await this.gameService.clearTimer(ctx.game.id);

    const timerEntity = await this.timerService.setupQuestionTimer(
      ctx.game,
      SECRET_QUESTION_TRANSFER_TIME
    );

    return { timer: timerEntity.value() ?? undefined };
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
        },
        room: ctx.game.id,
      },
    ];
  }
}
