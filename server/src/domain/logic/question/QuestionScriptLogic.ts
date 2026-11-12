import {
  MAX_QUESTION_PRICE_UPLOAD,
  MAX_SCORE_DELTA,
  MEDIA_DOWNLOAD_TIMEOUT,
  QUESTION_CONTENT_START_LEAD_MS
} from "domain/constants/game";
import { WrongAnswerPenalty } from "domain/enums/game/GameSettings";
import { PackageQuestionType } from "domain/enums/package/QuestionType";
import { PlayerScoreChangeLogic } from "domain/logic/game/PlayerScoreChangeLogic";
import { ValueUtils } from "domain/utils/ValueUtils";
import { Game } from "domain/entities/game/Game";
import { GameStateTimer } from "domain/entities/game/GameStateTimer";
import { AnswerType } from "domain/enums/package/AnswerType";
import { ClientError } from "domain/errors/ClientError";
import { ClientResponse } from "domain/enums/ClientResponse";
import { AllPlayMode } from "domain/types/dto/game/state/AllPlayDataDTO";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import {
  PackageQuestionDTO,
  PackageQuestionSubType
} from "domain/types/dto/package/PackageQuestionDTO";
import type {
  QuestionScriptProgress,
  QuestionScriptStep,
  QuestionScriptView,
  ScriptNumberSet
} from "domain/types/dto/package/QuestionScriptDTO";
import { PackageQuestionTransferType } from "domain/types/package/PackageQuestionTransferType";
import { PlayerRole } from "domain/types/game/PlayerRole";
import { PackageRoundType } from "domain/types/package/PackageRoundType";
import { GameQuestionMapper } from "domain/mappers/GameQuestionMapper";
import { QuestionContentPlanLogic } from "domain/logic/question/QuestionContentPlanLogic";
import { QuestionTransitionLogic } from "domain/logic/question/QuestionTransitionLogic";
import { QuestionPickLogic } from "domain/logic/question/QuestionPickLogic";
import { AnswerCheckLogic } from "domain/logic/question/AnswerCheckLogic";
import { AnswerResultType } from "domain/types/socket/game/AnswerResultData";
import { getRealPrice } from "domain/logic/question/questionPrices";
import { scriptPointImageOrder } from "domain/logic/question/PointImageLogic";

export interface QuestionScriptScoreEffect {
  playerId: number;
  answerType: AnswerResultType | null;
  change: number;
  score: number;
}

export interface QuestionScriptStartData {
  bids?: Record<number, number>;
  eligibleIds?: number[];
  roundPrices?: { min: number; max: number } | null;
}

/** Bounded, forward-only SI program. All callers run inside GameActionExecutor. */
export class QuestionScriptLogic {
  public static start(
    game: Game,
    question: PackageQuestionDTO,
    themeId: number,
    pickerId: number,
    context: QuestionScriptStartData = {}
  ): QuestionScriptScoreEffect[] {
    const existingFinal = game.gameState.finalRoundData;
    if (context.bids === undefined && existingFinal && Object.keys(existingFinal.bids).length) {
      context = {
        ...context,
        bids: { ...existingFinal.bids },
        eligibleIds: context.eligibleIds ?? existingFinal.turnOrder
      };
    }
    game.captureQuestionEligiblePlayers();
    const picker = QuestionPickLogic.resolvePickerPlayerId(game, pickerId);
    game.gameState.scriptProgress = {
      questionId: question.id!,
      themeId,
      programCounter: 0,
      waitingFor: null,
      activeAnswerFormat: "text",
      appliedEffects: [],
      pickerId: picker,
      answererIds: context.eligibleIds ?? [],
      actorId: null,
      mode: "button",
      optionOrders: null,
      correctChoiceOrder: null,
      content: null,
      priceRange: null,
      announcedRange: null,
      priceRevealed: false,
      roundPrices: context.roundPrices ?? null,
      finalBids: { ...context.bids },
      stakes: {},
      submissions: [],
      final: game.gameState.currentRound?.type === PackageRoundType.FINAL
    };
    if (context.eligibleIds) {
      game.gameState.questionEligiblePlayers = [...context.eligibleIds];
    }
    game.gameState.finalRoundData = null;
    game.gameState.allPlay = null;
    game.gameState.secretQuestionData = null;
    game.gameState.stakeQuestionData = null;
    game.gameState.answerShowData = null;
    game.gameState.currentQuestion = {
      ...GameQuestionMapper.mapToSimpleQuestion(question),
      text: null,
      textItems: [],
      questionFiles: [],
      answers: [],
      realPrice: question.realPrice
    };
    return this.advance(game, question);
  }

  public static advance(game: Game, question: PackageQuestionDTO): QuestionScriptScoreEffect[] {
    const effects: QuestionScriptScoreEffect[] = [];
    const progress = this.require(game);
    const program = question.script;
    if (!program || question.id !== progress.questionId) {
      throw new ClientError(ClientResponse.INVALID_QUESTION_STATE);
    }
    // The validated program has at most 128 instructions and no jumps.
    for (
      let work = 0;
      work < 128 && !progress.waitingFor && progress.programCounter < program.steps.length;
      work++
    ) {
      const identity = progress.programCounter++;
      const instruction = program.steps[identity];
      switch (instruction.op) {
        case "setTheme":
          break;
        case "setAnswerType":
          progress.activeAnswerFormat = instruction.answerType;
          progress.optionOrders = instruction.optionOrders ?? null;
          progress.correctChoiceOrder = instruction.correctChoiceOrder ?? null;
          break;
        case "setAnswerer":
          this.setAnswerer(game, instruction);
          break;
        case "announcePrice":
          progress.announcedRange = this.resolveRange(game, instruction.range);
          break;
        case "setPrice":
          if (instruction.mode === "withButton" || instruction.mode === "forAll") {
            progress.wrongPricePolicy =
              game.settings.wrongAnswerPenalty === WrongAnswerPenalty.NONE
                ? "none"
                : (progress.wrongPricePolicy ?? "room");
          } else if (instruction.mode === "multiply" || instruction.mode === "noRisk") {
            const effect = `${identity}:price`;
            if (!progress.appliedEffects.includes(effect)) {
              game.gameState.currentQuestion!.realPrice = Math.round(
                (getRealPrice(game.gameState.currentQuestion!) ?? 0) * 2
              );
              progress.priceRevealed = true;
              if (instruction.mode === "noRisk") {
                progress.wrongPricePolicy = "none";
              } else if (question.type === PackageQuestionType.NO_RISK) {
                progress.wrongPricePolicy ??= "room";
              }
              progress.appliedEffects.push(effect);
            }
          } else if (instruction.mode === "select") {
            progress.wrongPricePolicy = undefined;
            const range = this.resolveRange(game, instruction.range);
            progress.priceRange = range;
            if (range.min === range.max) {
              game.gameState.currentQuestion!.realPrice = range.min;
              progress.priceRevealed = true;
            } else {
              progress.waitingFor = "price";
              progress.actorId =
                progress.answererIds.length === 1 ? progress.answererIds[0] : progress.pickerId;
              game.setQuestionState(QuestionState.SECRET_TRANSFER);
              this.timer(game, game.settings.timers.secretTransferMs);
            }
          }
          break;
        case "showContent":
          this.beginContent(game, question, instruction);
          break;
        case "askAnswer":
          this.ask(game, question, instruction);
          break;
        case "accept":
          for (const id of progress.answererIds) {
            const award = this.score(game, id, true, `${identity}:accept:${id}`, true);
            if (award) {
              effects.push(award);
            }
          }
          // SI AcceptQuestion completes the authored question after its explicit award.
          progress.programCounter = program.steps.length;
          break;
      }
    }
    if (!progress.waitingFor && progress.programCounter >= program.steps.length) {
      this.complete(
        game,
        effects.filter((effect) => effect.answerType === null)
      );
      return effects;
    }
    game.gameState.scriptView = this.view(game);
    return effects;
  }

  public static activeQuestion(game: Game, source: PackageQuestionDTO): PackageQuestionDTO {
    const progress = this.require(game);
    const content = progress.content;
    const orders = new Set(content?.orders ?? []);
    const files = content?.phase === "answer" ? source.answerFiles : source.questionFiles;
    const texts =
      content?.phase === "answer"
        ? (source.answerTextItems ?? source.script?.answerTextItems)
        : source.textItems;
    const current = game.gameState.currentQuestion;
    const result: PackageQuestionDTO = {
      ...source,
      script: null,
      type: source.type,
      answerType: progress.activeAnswerFormat as AnswerType,
      realPrice: current?.realPrice,
      text: null,
      textOrder: null,
      answerText: progress.waitingFor === "answer" ? source.answerText : null,
      answerNumber: progress.activeAnswerFormat === "number" ? source.answerNumber : null,
      answerPoint: progress.activeAnswerFormat === "point" ? source.answerPoint : null,
      rightAnswers: progress.waitingFor === "answer" ? source.rightAnswers : null,
      wrongAnswers: progress.waitingFor === "answer" ? source.wrongAnswers : null,
      textItems: texts?.filter((item) => orders.has(item.order)) ?? [],
      questionFiles:
        files?.filter((item) => orders.has(item.order)).sort((a, b) => a.order - b.order) ?? [],
      answerFiles: [],
      answerTextItems: [],
      answers:
        source.answers?.filter((option) => progress.optionOrders?.includes(option.order)) ?? [],
      correctChoiceOrder: progress.correctChoiceOrder,
      subType: PackageQuestionSubType.SIMPLE,
      priceMultiplier: 1
    };
    result.pointImageOrder = scriptPointImageOrder(result.questionFiles, result.textItems);
    if (content?.revealRight) {
      result.pointImageOrder = -1;
      if (progress.activeAnswerFormat === "select") {
        const right = result.answers?.find(
          (option) => option.order === progress.correctChoiceOrder
        );
        result.text = right?.text ?? null;
        result.questionFiles = right?.file
          ? [{ order: 0, displayTime: null, file: right.file }]
          : [];
      } else if (progress.activeAnswerFormat === "point") {
        // Reveal uses the active presentation that preceded this fallback, not another image occurrence.
        result.questionFiles = current?.questionFiles ?? [];
        result.pointImageOrder = current?.pointImageOrder ?? -1;
      } else {
        result.text = source.answerText ?? null;
      }
    }
    return result;
  }

  public static releaseMedia(
    game: Game,
    question: PackageQuestionDTO
  ): QuestionScriptScoreEffect[] {
    const progress = this.require(game);
    const ask = progress.pendingAsk;
    if (!ask) {
      this.showContent(game, question);
      return [];
    }
    progress.pendingAsk = undefined;
    progress.preparedOptionOrders = this.optionMediaOrders(game.gameState.currentQuestion);
    this.ask(game, question, ask);
    if (!progress.waitingFor) {
      return this.advance(game, question);
    }
    game.gameState.scriptView = this.view(game);
    return [];
  }

  public static showContent(game: Game, question: PackageQuestionDTO): void {
    const opening = !!game.gameState.questionTransition;
    const active = this.activeQuestion(game, question);
    const progress = this.require(game);
    progress.preparedOptionOrders = this.optionMediaOrders(active);
    game.gameState.currentQuestion = {
      ...GameQuestionMapper.mapToSimpleQuestion(active),
      realPrice: active.realPrice
    };
    const plan = QuestionContentPlanLogic.build(
      {
        text: active.text,
        textOrder: active.textOrder,
        textItems: active.textItems,
        files: active.questionFiles,
        playMediaSimultaneously: active.playMediaSimultaneously
      },
      game.gameState.mediaDurations ?? null
    );
    game.gameState.questionContentPlan = plan;
    const ms = plan?.totalMs ?? 0;
    game.gameState.buzzerOpensAtMs = Number.MAX_SAFE_INTEGER;
    game.setQuestionState(QuestionState.SHOWING);
    this.timer(
      game,
      Math.max(ms, active.text ? QuestionContentPlanLogic.textDuration(active.text) : 0, 1),
      opening ? QUESTION_CONTENT_START_LEAD_MS : 0
    );
    if (progress.content?.revealRight) {
      game.setQuestionState(QuestionState.SHOWING_ANSWER);
      game.gameState.answerShowData = {
        answerText: active.text ?? null,
        answerFiles: active.questionFiles ?? null,
        answerContentPlan: plan,
        nextTurnPlayerId: game.gameState.currentTurnPlayerId ?? null,
        answerPoint: active.answerPoint ?? null,
        answerDeviation: active.answerDeviation ?? null,
        ...(progress.lastCorrectResult ? { answerResult: progress.lastCorrectResult } : {})
      };
    }
  }

  public static resume(game: Game, question: PackageQuestionDTO): QuestionScriptScoreEffect[] {
    this.require(game).waitingFor = null;
    game.gameState.buzzerWindow = null;
    game.gameState.timer = null;
    return this.advance(game, question);
  }

  public static revealAndStop(
    game: Game,
    question: PackageQuestionDTO
  ): QuestionScriptScoreEffect[] {
    const progress = this.require(game);
    const reveal = this.currentReveal(question, progress);
    progress.programCounter = question.script!.steps.length;
    game.gameState.buzzerWindow = null;
    game.gameState.submittedAnswer = null;
    game.gameState.submittedChoiceOrder = null;
    if (!reveal) {
      return this.resume(game, question);
    }
    this.beginContent(game, question, reveal);
    game.gameState.scriptView = this.view(game);
    return [];
  }

  public static passButton(
    game: Game,
    question: PackageQuestionDTO,
    playerId: number
  ): QuestionScriptScoreEffect[] {
    const progress = this.require(game);
    if (
      progress.waitingFor !== "answer" ||
      progress.mode !== "button" ||
      game.gameState.answeringPlayer != null ||
      !game.isPlayerEligibleToAnswer(playerId)
    ) {
      throw new ClientError(ClientResponse.INVALID_QUESTION_STATE);
    }
    game.addSkippedPlayer(playerId);
    const window = game.gameState.buzzerWindow;
    if (window) {
      window.presses = window.presses.filter((id) => id !== playerId);
    }
    const remaining = game
      .getInGamePlayers()
      .some(
        (player) =>
          game.isPlayerEligibleToAnswer(player.meta.id) &&
          !game.gameState.skippedPlayers?.includes(player.meta.id) &&
          !progress.submissions.some((entry) => entry.playerId === player.meta.id)
      );
    return remaining ? [] : this.resume(game, question);
  }

  public static skipAnswer(
    game: Game,
    source: PackageQuestionDTO,
    playerId: number
  ): QuestionScriptScoreEffect[] {
    const progress = this.require(game);
    if (
      progress.waitingFor !== "answer" ||
      !progress.answererIds.includes(playerId) ||
      progress.submissions.some((entry) => entry.playerId === playerId)
    ) {
      throw new ClientError(ClientResponse.INVALID_QUESTION_STATE);
    }
    progress.submissions.push({
      playerId,
      answerText: null,
      choiceOrder: null,
      correct: false,
      scored: false
    });
    const entry = game.gameState.allPlay?.entries.find((item) => item.playerId === playerId);
    if (entry) {
      entry.submitted = true;
    }
    return this.finishAnswersIfReady(game, source);
  }

  public static submit(
    game: Game,
    source: PackageQuestionDTO,
    playerId: number,
    text: string | null,
    choiceOrder?: number
  ): QuestionScriptScoreEffect[] {
    const progress = this.require(game);
    if (
      progress.waitingFor !== "answer" ||
      !progress.answererIds.includes(playerId) ||
      progress.submissions.some((entry) => entry.playerId === playerId)
    ) {
      throw new ClientError(ClientResponse.INVALID_QUESTION_STATE);
    }
    const active = this.activeQuestion(game, source);
    if (
      progress.activeAnswerFormat === "select" &&
      (!Number.isInteger(choiceOrder) ||
        !active.answers?.some((option) => option.order === choiceOrder))
    ) {
      throw new ClientError(ClientResponse.VALIDATION_ERROR);
    }
    const correct =
      progress.activeAnswerFormat === "select"
        ? choiceOrder === progress.correctChoiceOrder
        : AnswerCheckLogic.check(active, text);
    // Explicit scripts in final retain manual review, including number, point and select.
    progress.submissions.push({
      playerId,
      answerText: text,
      choiceOrder: choiceOrder ?? null,
      correct: progress.final ? null : correct,
      scored: false
    });
    const entry = game.gameState.allPlay?.entries.find((item) => item.playerId === playerId);
    if (entry) {
      entry.answer = text;
      entry.choiceOrder = choiceOrder ?? undefined;
      entry.submitted = true;
    }
    if (!game.gameState.allPlay) {
      game.gameState.submittedAnswer = text;
      game.gameState.submittedChoiceOrder = choiceOrder ?? null;
    }
    return this.finishAnswersIfReady(game, source);
  }

  public static judge(
    game: Game,
    source: PackageQuestionDTO,
    playerId: number,
    correct: boolean
  ): QuestionScriptScoreEffect[] {
    const entry = this.require(game).submissions.find((item) => item.playerId === playerId);
    if (!entry || entry.correct !== null || entry.scored) {
      throw new ClientError(ClientResponse.INVALID_QUESTION_STATE);
    }
    entry.correct = correct;
    const publicEntry = game.gameState.allPlay?.entries.find((item) => item.playerId === playerId);
    if (publicEntry) {
      publicEntry.isCorrect = correct;
    }
    return this.finishAnswersIfReady(game, source);
  }

  public static finishAnswersIfReady(
    game: Game,
    source: PackageQuestionDTO
  ): QuestionScriptScoreEffect[] {
    const effects: QuestionScriptScoreEffect[] = [];
    const progress = this.require(game);
    if (
      progress.answererIds.some(
        (id) => !progress.submissions.some((entry) => entry.playerId === id)
      )
    ) {
      return effects;
    }
    if (progress.submissions.some((entry) => entry.correct === null)) {
      game.setQuestionState(
        game.gameState.allPlay ? QuestionState.REVIEWING : QuestionState.ANSWERING
      );
      game.gameState.timer = null;
      return effects;
    }
    for (const entry of progress.submissions.filter((item) => !item.scored)) {
      const effect = this.score(
        game,
        entry.playerId,
        entry.correct === true,
        `${progress.programCounter - 1}:answer:${entry.playerId}`
      );
      if (effect) {
        effects.push(effect);
      }
      entry.scored = true;
    }
    if (progress.mode === "button" && !progress.submissions.some((entry) => entry.correct)) {
      const eligible = game
        .getInGamePlayers()
        .filter((player) => game.isPlayerEligibleToAnswer(player.meta.id));
      if (
        eligible.some(
          (player) =>
            !game.gameState.skippedPlayers?.includes(player.meta.id) &&
            !progress.submissions.some((entry) => entry.playerId === player.meta.id)
        )
      ) {
        progress.answererIds = [];
        game.gameState.answeringPlayer = null;
        game.setQuestionState(QuestionState.SHOWING);
        this.timer(game, progress.answerWindowRemainingMs ?? game.settings.timers.answerMs);
        return effects;
      }
    }
    game.gameState.allPlay = null;
    game.gameState.submittedAnswer = null;
    game.gameState.submittedChoiceOrder = null;
    return [...effects, ...this.resume(game, source)];
  }

  /** Source awards change only score. A ruling records an answer verdict for the current ask. */
  public static score(
    game: Game,
    id: number,
    correct: boolean,
    identity: string,
    award = false
  ): QuestionScriptScoreEffect | null {
    const progress = this.require(game);
    if (progress.appliedEffects.includes(identity)) {
      return null;
    }
    const player = game.getPlayer(id, { fetchDisconnected: true });
    if (!player) {
      return null;
    }
    const { win, lose } = this.answerPrice(game, id);
    const delta = correct ? win : lose;
    const oldScore = player.score;
    const score = PlayerScoreChangeLogic.applyScore(game, id, oldScore + delta);
    const answerType = award ? null : correct ? AnswerResultType.CORRECT : AnswerResultType.WRONG;
    if (answerType === AnswerResultType.WRONG) {
      game.gameState.answeredPlayers = [
        ...(game.gameState.answeredPlayers ?? []),
        { player: id, result: delta, score, answerType, appliedChange: score - oldScore }
      ];
    } else if (answerType === AnswerResultType.CORRECT) {
      progress.lastCorrectResult = { player: id, result: score - oldScore, score, answerType };
    }
    if (correct && progress.answererIds.length === 1) {
      game.gameState.currentTurnPlayerId = id;
      progress.pickerId = id;
    }
    progress.appliedEffects.push(identity);
    return { playerId: id, answerType, change: score - oldScore, score };
  }

  /** Amounts before the player's total-score clamp, shared by ruling and display. */
  public static answerPrice(game: Game, id?: number) {
    const progress = this.require(game);
    const current = game.gameState.currentQuestion!;
    const personal = id === undefined ? undefined : (progress.finalBids[id] ?? progress.stakes[id]);
    const highest = game.gameState.stakeQuestionData?.highestBid;
    const stake = personal ?? highest;
    const price = stake ?? getRealPrice(current);
    const roomPenalty = game.settings.wrongAnswerPenalty !== WrongAnswerPenalty.NONE;
    const policy = progress.wrongPricePolicy;
    const basePenalty =
      policy === "room"
        ? roomPenalty
        : policy !== "none" &&
          current.type !== PackageQuestionType.NO_RISK &&
          (current.type === PackageQuestionType.SECRET || roomPenalty);
    const win = ValueUtils.clampAbs(price ?? 0, MAX_SCORE_DELTA);
    return {
      win,
      lose: win !== 0 && (stake != null || basePenalty) ? -win : 0,
      source: personal != null ? "personal" : highest != null ? "winning" : "base",
      known: price != null
    };
  }

  public static view(game: Game): QuestionScriptView | null {
    const progress = game.gameState.scriptProgress;
    return progress
      ? {
          questionId: progress.questionId,
          programCounter: progress.programCounter,
          waitingFor: progress.waitingFor,
          actorId: progress.actorId,
          answererIds: progress.answererIds,
          answerMode: progress.mode,
          ...(progress.waitingFor === "answer" ? { canReveal: progress.canReveal } : {}),
          ...(progress.announcedRange ? { priceRange: progress.announcedRange } : {})
        }
      : null;
  }

  public static finalRoundPrices(questions: Pick<PackageQuestionDTO, "price" | "realPrice">[]) {
    const prices = questions
      .map(getRealPrice)
      .filter(
        (price): price is number =>
          price != null &&
          Number.isSafeInteger(price) &&
          price > 0 &&
          price <= MAX_QUESTION_PRICE_UPLOAD
      );
    return prices.length
      ? { min: Math.min(...prices), max: Math.max(...prices) }
      : { min: 1, max: 1 };
  }

  public static resolveRange(game: Game, range: ScriptNumberSet): ScriptNumberSet {
    if (range.min !== 0 || range.max !== 0) {
      return range;
    }
    const snapshot = this.require(game).roundPrices;
    if (!snapshot) {
      throw new ClientError(ClientResponse.INVALID_SECRET_QUESTION_PRICE);
    }
    return { ...snapshot, step: snapshot.max - snapshot.min };
  }

  public static allowedPrice(range: ScriptNumberSet, price: number): boolean {
    return (
      Number.isSafeInteger(price) &&
      price >= range.min &&
      price <= range.max &&
      (range.step === 0 || (price - range.min) % range.step === 0)
    );
  }

  public static timer(game: Game, ms: number, delayMs = 0): void {
    game.gameState.timer = new GameStateTimer(ms).start(delayMs);
  }

  public static require(game: Game): QuestionScriptProgress {
    const progress = game.gameState.scriptProgress;
    if (!progress) {
      throw new ClientError(ClientResponse.INVALID_QUESTION_STATE);
    }
    return progress;
  }

  private static ask(
    game: Game,
    source: PackageQuestionDTO,
    instruction: Extract<QuestionScriptStep, { op: "askAnswer" }>
  ): void {
    const progress = this.require(game);
    const active = this.activeQuestion(game, source);
    const needsMedia = this.optionMediaOrders(active).some(
      (order) => !progress.preparedOptionOrders?.includes(order)
    );
    const opensFromBoard =
      game.gameState.questionState === QuestionState.CHOOSING && !progress.final;
    game.gameState.currentQuestion = {
      ...GameQuestionMapper.mapToSimpleQuestion(active),
      realPrice: active.realPrice
    };
    if (needsMedia) {
      progress.pendingAsk = instruction;
      progress.waitingFor = "content";
      game.gameState.answeringPlayer = null;
      game.gameState.allPlay = null;
      game.gameState.answerShowData = null;
      this.prepareMedia(game, opensFromBoard);
      return;
    }
    progress.waitingFor = "answer";
    progress.canReveal = !!this.currentReveal(source, progress);
    progress.mode = instruction.mode;
    progress.submissions = [];
    progress.actorId = null;
    game.gameState.answeredPlayers = null;
    game.gameState.skippedPlayers = null;
    game.gameState.answerShowData = null;
    game.gameState.buzzerOpensAtMs = 0;
    if (instruction.mode === "button") {
      progress.answererIds = [];
      game.gameState.answeringPlayer = null;
      game.setQuestionState(QuestionState.SHOWING);
    } else {
      const eligible = game
        .getInGamePlayers()
        .filter((player) => game.isPlayerEligibleToAnswer(player.meta.id));
      progress.answererIds = progress.answererIds.filter((id) =>
        eligible.some((player) => player.meta.id === id)
      );
      if (!progress.answererIds.length) {
        const picker = eligible.find((player) => player.meta.id === progress.pickerId);
        if (!picker) {
          progress.waitingFor = null;
          return;
        }
        progress.answererIds = [picker.meta.id];
      }
      progress.actorId = progress.answererIds.length === 1 ? progress.answererIds[0] : null;
      game.gameState.answeringPlayer = progress.actorId;
      game.setQuestionState(
        progress.answererIds.length === 1 ? QuestionState.ANSWERING : QuestionState.SHOWING
      );
      if (progress.answererIds.length > 1) {
        game.gameState.allPlay = {
          mode:
            Object.keys(progress.stakes).length || Object.keys(progress.finalBids).length
              ? AllPlayMode.STAKE
              : AllPlayMode.SIMPLE,
          questionId: progress.questionId,
          themeId: progress.themeId,
          price: getRealPrice(game.gameState.currentQuestion!) ?? 0,
          maxStake: null,
          priceMultiplier: null,
          entries: progress.answererIds.map((id) => ({
            playerId: id,
            stake: progress.finalBids[id] ?? progress.stakes[id] ?? null,
            answer: null,
            submitted: false,
            isCorrect: null,
            scoreChange: null
          }))
        };
      }
    }
    this.timer(
      game,
      instruction.durationMs ??
        (progress.final
          ? game.settings.timers.finalAnswerMs
          : progress.answererIds.length > 1
            ? game.settings.timers.allPlayAnswerMs
            : instruction.mode === "button"
              ? game.settings.timers.answerMs
              : game.settings.timers.answerSubmitMs)
    );
  }

  private static currentReveal(
    question: PackageQuestionDTO,
    progress: QuestionScriptProgress
  ): Extract<QuestionScriptStep, { op: "showContent" }> | null {
    for (const step of question.script!.steps.slice(progress.programCounter)) {
      if (step.op === "askAnswer" || step.op === "accept") {
        break;
      }
      if (step.op === "showContent" && step.phase === "answer") {
        return step;
      }
    }
    return question.answerText ||
      progress.correctChoiceOrder != null ||
      (progress.activeAnswerFormat === "point" && question.answerPoint)
      ? { op: "showContent", phase: "answer", orders: [], revealRight: true }
      : null;
  }

  private static beginContent(
    game: Game,
    question: PackageQuestionDTO,
    instruction: Extract<QuestionScriptStep, { op: "showContent" }>
  ): void {
    const progress = this.require(game);
    const opensFromBoard =
      !progress.content &&
      !progress.final &&
      game.gameState.questionState === QuestionState.CHOOSING;
    progress.content = instruction;
    progress.waitingFor = "content";
    const active = this.activeQuestion(game, question);
    game.gameState.currentQuestion = {
      ...GameQuestionMapper.mapToSimpleQuestion(active),
      realPrice: active.realPrice
    };
    game.gameState.allPlay = null;
    game.gameState.answeringPlayer = null;
    game.gameState.answerShowData = null;
    if (opensFromBoard || QuestionTransitionLogic.hasMedia(game)) {
      this.prepareMedia(game, opensFromBoard);
    } else {
      this.showContent(game, question);
    }
  }

  private static prepareMedia(game: Game, opensFromBoard: boolean): void {
    QuestionPickLogic.resetMediaDownloadStatus(game);
    game.setQuestionState(QuestionState.MEDIA_DOWNLOADING);
    if (opensFromBoard) {
      QuestionTransitionLogic.start(game);
    }
    if (QuestionTransitionLogic.hasMedia(game)) {
      this.timer(game, MEDIA_DOWNLOAD_TIMEOUT);
    } else {
      game.gameState.timer = null;
    }
  }

  private static optionMediaOrders(question: PackageQuestionDTO | null): number[] {
    return question?.answerType === AnswerType.SELECT
      ? (question.answers ?? []).flatMap((option) => (option.file ? [option.order] : []))
      : [];
  }

  private static setAnswerer(
    game: Game,
    step: Extract<QuestionScriptStep, { op: "setAnswerer" }>
  ): void {
    const progress = this.require(game);
    const eligible = game
      .getInGamePlayers()
      .filter(
        (player) =>
          player.role === PlayerRole.PLAYER && game.isPlayerEligibleToAnswer(player.meta.id)
      )
      .map((player) => player.meta.id);
    game.gameState.stakeQuestionData = null;
    game.gameState.allPlay = null;
    progress.stakes = {};
    if (step.mode === "current") {
      progress.answererIds = eligible.includes(progress.pickerId) ? [progress.pickerId] : [];
    } else if (step.mode === "all") {
      progress.answererIds = eligible;
    } else if (step.mode === "byCurrent") {
      progress.answererIds = [];
      const targets = eligible.filter((id) => step.select === "any" || id !== progress.pickerId);
      if (targets.length <= 1) {
        progress.answererIds = targets;
        if (targets[0] != null) {
          progress.pickerId = targets[0];
        }
        return;
      }
      progress.actorId = progress.pickerId;
      progress.waitingFor = "answerer";
      game.gameState.secretQuestionData = {
        pickerPlayerId: progress.pickerId,
        questionId: progress.questionId,
        transferType:
          step.select === "any"
            ? PackageQuestionTransferType.ANY
            : PackageQuestionTransferType.EXCEPT_CURRENT,
        transferDecisionPhase: true
      };
      game.setQuestionState(QuestionState.SECRET_TRANSFER);
      this.timer(game, game.settings.timers.secretTransferMs);
    } else {
      progress.answererIds = eligible;
      if (!eligible.length) {
        return;
      }
      progress.waitingFor = "answerer";
      if (step.select === "highest") {
        const order = [progress.pickerId, ...eligible.filter((id) => id !== progress.pickerId)];
        game.gameState.stakeQuestionData = {
          pickerPlayerId: progress.pickerId,
          questionId: progress.questionId,
          maxPrice: null,
          bids: {},
          passedPlayers: [],
          biddingOrder: order,
          currentBidderIndex: 0,
          highestBid: null,
          winnerPlayerId: null,
          biddingPhase: true
        };
        progress.actorId = order[0] ?? null;
      } else {
        game.gameState.allPlay = {
          mode: AllPlayMode.STAKE,
          questionId: progress.questionId,
          themeId: progress.themeId,
          price: getRealPrice(game.gameState.currentQuestion!) ?? 0,
          maxStake: null,
          priceMultiplier: null,
          entries: eligible.map((id) => ({
            playerId: id,
            stake: null,
            answer: null,
            submitted: false,
            isCorrect: null,
            scoreChange: null
          }))
        };
      }
      game.setQuestionState(QuestionState.BIDDING);
      this.timer(game, game.settings.timers.stakeMs);
    }
  }

  private static complete(game: Game, awards: QuestionScriptScoreEffect[]): void {
    const progress = this.require(game);
    GameQuestionMapper.setQuestionPlayed(game, progress.questionId, progress.themeId);
    game.gameState.answeringPlayer = null;
    game.gameState.allPlay = null;
    game.gameState.secretQuestionData = null;
    game.gameState.stakeQuestionData = null;
    game.gameState.questionContentPlan = null;
    game.gameState.scriptView = {
      ...this.view(game)!,
      actorId: null,
      answererIds: [],
      ...(awards.length
        ? { awards: awards.map((award) => ({ playerId: award.playerId, points: award.change })) }
        : {})
    };
    game.gameState.scriptProgress = null;
    game.gameState.answerShowData ??= {
      answerText: null,
      answerFiles: null,
      nextTurnPlayerId: game.gameState.currentTurnPlayerId ?? null,
      ...(progress.lastCorrectResult ? { answerResult: progress.lastCorrectResult } : {})
    };
    game.setQuestionState(QuestionState.SHOWING_ANSWER);
    this.timer(game, awards.length ? 5000 : 1);
  }
}
