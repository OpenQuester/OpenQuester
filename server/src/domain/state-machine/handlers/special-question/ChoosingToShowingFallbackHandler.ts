import { GameService } from "application/services/game/GameService";
import { GAME_QUESTION_ANSWER_TIME } from "domain/constants/game";
import { timerKey } from "domain/constants/redisKeys";
import { GameStateTimer } from "domain/entities/game/GameStateTimer";
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
import { ChoosingToShowingFallbackCtx } from "domain/types/socket/transition/choosing";
import { GameStateValidator } from "domain/validators/GameStateValidator";
import { GameQuestionMapper } from "domain/mappers/GameQuestionMapper";
import { PlayerRole } from "domain/types/game/PlayerRole";

/**
 * Fallback handler when a special question (secret/stake) is picked but
 * no eligible players exist. Skips special flow and shows the question
 * immediately to everyone.
 */
export class ChoosingToShowingFallbackHandler extends BaseTransitionHandler {
  public readonly fromPhase = GamePhase.CHOOSING;
  public readonly toPhase = GamePhase.SHOWING;

  constructor(gameService: GameService) {
    super(gameService);
  }

  public canTransition(ctx: ChoosingToShowingFallbackCtx): boolean {
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

    try {
      const { question } = QuestionPickLogic.validateQuestionPick(
        game,
        payload.questionData
      );

      const isSpecial =
        question.type === PackageQuestionType.SECRET ||
        question.type === PackageQuestionType.STAKE;

      if (!isSpecial) return false;

      // Fallback when fewer than two eligible players remain
      return !TransitionGuards.hasMultipleEligiblePlayers(game);
    } catch {
      return false;
    }
  }

  protected override validate(ctx: ChoosingToShowingFallbackCtx): void {
    GameStateValidator.validateGameInProgress(ctx.game);
  }

  protected async mutate(
    ctx: ChoosingToShowingFallbackCtx
  ): Promise<MutationResult> {
    const { game, payload } = ctx;
    const { question, theme } = QuestionPickLogic.validateQuestionPick(
      game,
      payload!.questionData
    );

    const eligiblePlayers = game
      .getInGamePlayers()
      .filter((player) => player.role === PlayerRole.PLAYER);

    // Default to showing state when no players remain
    let questionState = QuestionState.SHOWING;

    if (eligiblePlayers.length === 1) {
      // Single player: auto-assign answering player and skip transfer flow
      questionState = QuestionState.ANSWERING;
      game.gameState.answeringPlayer = eligiblePlayers[0].meta.id;
    }

    // Clear any stale special-question data and proceed as a normal question
    game.gameState.secretQuestionData = null;
    game.gameState.stakeQuestionData = null;
    game.setQuestionState(questionState);
    game.gameState.currentQuestion =
      GameQuestionMapper.mapToSimpleQuestion(question);

    QuestionPickLogic.markQuestionPlayed(game, question.id!, theme.id!);
    QuestionPickLogic.resetMediaDownloadStatus(game);

    return {
      data: {},
    };
  }

  protected async handleTimer(
    ctx: ChoosingToShowingFallbackCtx,
    _mutationResult: MutationResult
  ): Promise<TimerResult> {
    const { game } = ctx;

    const timer = new GameStateTimer(GAME_QUESTION_ANSWER_TIME);
    game.gameState.timer = timer.start();

    return {
      timer: timer.value() ?? undefined,
      timerMutations: [
        { op: "delete", key: timerKey(game.id) },
        {
          op: "set",
          key: timerKey(game.id),
          value: JSON.stringify(timer.value()!),
          pxTtl: GAME_QUESTION_ANSWER_TIME,
        },
      ],
    };
  }

  protected collectBroadcasts(
    _ctx: ChoosingToShowingFallbackCtx,
    _mutationResult: MutationResult,
    _timerResult: TimerResult
  ): BroadcastEvent[] {
    // Personalized question data emission is handled by the socket handler
    // (similar to normal question flow), so no broadcasts here.
    return [];
  }
}
