import { GameService } from "application/services/game/GameService";
import { SocketQuestionStateService } from "application/services/socket/SocketQuestionStateService";
import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { QuestionAnswerResultLogic } from "domain/logic/question/QuestionAnswerResultLogic";
import { ShowAnswerLogic } from "domain/logic/question/ShowAnswerLogic";
import { GameQuestionMapper } from "domain/mappers/GameQuestionMapper";
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
import { PackageQuestionDTO } from "domain/types/dto/package/PackageQuestionDTO";
import { BroadcastEvent } from "domain/types/service/ServiceResult";
import { AnswerShowStartEventPayload } from "domain/types/socket/events/game/AnswerShowEventPayload";
import { QuestionFinishWithAnswerEventPayload } from "domain/types/socket/events/game/QuestionFinishEventPayload";
import { AnswerResultType } from "domain/types/socket/game/AnswerResultData";
import { GameStateValidator } from "domain/validators/GameStateValidator";
import {
  AnsweringToShowingAnswerCtx,
  AnsweringToShowingAnswerMutationData,
} from "domain/types/socket/transition/answering";
import { PackageQuestionType } from "domain/enums/package/QuestionType";

/**
 * Handles transition from ANSWERING to SHOWING_ANSWER phase in regular rounds.
 *
 * This transition occurs when:
 * - Player's answer is marked correct by showman
 * - All players are exhausted (everyone answered wrong)
 *
 * Entry points:
 * - Showman marks answer as correct (SocketIOQuestionService.handleAnswerResult)
 * - All players exhausted after wrong answer
 */
export class AnsweringToShowingAnswerHandler extends BaseTransitionHandler {
  public readonly fromPhase = GamePhase.ANSWERING;
  public readonly toPhase = GamePhase.SHOWING_ANSWER;

  constructor(
    gameService: GameService,
    timerService: SocketQuestionStateService
  ) {
    super(gameService, timerService);
  }

  /**
   * Check if this transition should occur.
   *
   * Validates:
   * 1. Current phase must be ANSWERING
   * 2. Game in progress with simple round
   * 3. Answer is CORRECT OR all players will be exhausted after wrong answer
   */
  public canTransition(ctx: AnsweringToShowingAnswerCtx): boolean {
    const { game, trigger, payload } = ctx;

    // 1. Verify we're in the expected phase
    if (getGamePhase(game) !== this.fromPhase) {
      return false;
    }

    // 2. Must be simple round in ANSWERING state
    if (
      !TransitionGuards.canTransitionInRegularRound(
        game,
        QuestionState.ANSWERING
      )
    ) {
      return false;
    }

    // 3. Either CORRECT answer OR all players will be exhausted after this answer
    if (
      trigger === TransitionTrigger.USER_ACTION ||
      trigger === TransitionTrigger.PLAYER_LEFT
    ) {
      const answerType = payload?.answerType;

      // Correct answer always goes to SHOWING_ANSWER
      if (answerType === AnswerResultType.CORRECT) {
        return true;
      }

      // Wrong/Skip answer goes to SHOWING_ANSWER only if all players WILL BE exhausted
      // (including the current answering player who will be added to exhausted list)
      const allExhausted =
        (answerType === AnswerResultType.WRONG ||
          answerType === AnswerResultType.SKIP) &&
        game.willAllPlayersBeExhausted();

      // Stake and secret always go to SHOWING_ANSWER on wrong/skip answers
      const singleAnswererQuestion =
        payload?.questionType === PackageQuestionType.STAKE ||
        payload?.questionType === PackageQuestionType.SECRET ||
        payload?.questionType === PackageQuestionType.NO_RISK;

      if (allExhausted || singleAnswererQuestion) {
        return true;
      }
    }

    // Timer expiration (wrong answer) + all will be exhausted
    if (
      trigger === TransitionTrigger.TIMER_EXPIRED &&
      game.willAllPlayersBeExhausted()
    ) {
      return true;
    }

    return false;
  }

  protected override validate(ctx: AnsweringToShowingAnswerCtx): void {
    GameStateValidator.validateGameInProgress(ctx.game);
  }

  /** This called only on correct answers, keeps null-check guards just in case */
  protected async mutate(
    ctx: AnsweringToShowingAnswerCtx
  ): Promise<MutationResult> {
    const { game, payload } = ctx;
    const answerType = payload?.answerType ?? AnswerResultType.WRONG;
    const isCorrect = answerType === AnswerResultType.CORRECT;

    // Get score result from payload or default
    // When timer expires with no payload, use negative question price as penalty
    const currentQuestionPrice = game.gameState.currentQuestion?.price ?? 0;
    const scoreResult =
      payload?.scoreResult ?? (isCorrect ? 0 : -currentQuestionPrice);

    const playerAnswerResult = game.handleQuestionAnswer(
      scoreResult,
      answerType,
      QuestionState.SHOWING_ANSWER
    );

    // Get question data for the answer display
    let question: PackageQuestionDTO | null = null;
    const currentQuestion = game.gameState.currentQuestion;

    if (currentQuestion) {
      const questionData = GameQuestionMapper.getQuestionAndTheme(
        game.package,
        game.gameState.currentRound!.id,
        currentQuestion.id!
      );

      if (questionData) {
        question = questionData.question;

        // Mark question as played
        GameQuestionMapper.setQuestionPlayed(
          game,
          question.id!,
          questionData.theme.id!
        );
      }
    }

    // Update turn player for correct answers in all rounds
    if (isCorrect) {
      game.gameState.currentTurnPlayerId = playerAnswerResult.player;
    }

    // Clear current question after processing
    game.gameState.currentQuestion = null;
    game.gameState.stakeQuestionData = null;
    game.gameState.secretQuestionData = null;

    return {
      data: {
        playerAnswerResult,
        question,
        isCorrect,
      } satisfies AnsweringToShowingAnswerMutationData,
    };
  }

  protected async handleTimer(
    ctx: AnsweringToShowingAnswerCtx,
    mutationResult: MutationResult
  ): Promise<TimerResult> {
    const { game } = ctx;
    const mutationData =
      mutationResult.data as AnsweringToShowingAnswerMutationData;
    const question = mutationData.question;

    // Clear the answering timer
    await this.gameService.clearTimer(game.id);

    // Calculate duration based on answer files (media stacking) or fallback default
    const duration = ShowAnswerLogic.calculateShowAnswerDuration(question);

    // Setup show answer timer
    const timerEntity = await this.timerService.setupQuestionTimer(
      game,
      duration
    );

    return {
      timer: timerEntity.value() ?? undefined,
    };
  }

  protected collectBroadcasts(
    ctx: AnsweringToShowingAnswerCtx,
    mutationResult: MutationResult,
    timerResult: TimerResult
  ): BroadcastEvent[] {
    const mutationData =
      mutationResult.data as AnsweringToShowingAnswerMutationData;
    const { game } = ctx;

    const playerAnswerResult = mutationData.playerAnswerResult;
    const question = mutationData.question;

    const broadcasts: BroadcastEvent[] = [];

    // 1. ANSWER_RESULT - score update
    broadcasts.push({
      event: SocketIOGameEvents.ANSWER_RESULT,
      data: QuestionAnswerResultLogic.buildSocketPayload({
        answerResult: playerAnswerResult,
        timer: timerResult.timer ?? null,
      }),
      room: game.id,
    });

    // 2. QUESTION_FINISH - with answer data
    const questionFinishPayload: QuestionFinishWithAnswerEventPayload = {
      answerFiles: question?.answerFiles ?? null,
      answerText: question?.answerText ?? null,
      nextTurnPlayerId: game.gameState.currentTurnPlayerId ?? null,
      answerResult: playerAnswerResult,
    };

    broadcasts.push({
      event: SocketIOGameEvents.QUESTION_FINISH,
      data: questionFinishPayload,
      room: game.id,
    });

    // 3. ANSWER_SHOW_START - signals UI to show answer
    broadcasts.push({
      event: SocketIOGameEvents.ANSWER_SHOW_START,
      data: {} satisfies AnswerShowStartEventPayload,
      room: game.id,
    });

    return broadcasts;
  }
}
