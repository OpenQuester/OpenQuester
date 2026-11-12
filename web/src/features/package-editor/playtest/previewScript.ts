import type { AnsweredPlayer, GameState, Question, StakeQuestionData } from "@/game/protocol";
import type {
  QuestionScriptStep,
  ScriptAnswerFormat,
  ScriptNumberSet,
  QuestionScriptView,
} from "@/game/questionScript";
import { buildContentPlan, textDuration } from "@/game/contentPlan";
import { scriptPointImageOrder } from "@/lib/pointImage";
import { checkPreviewAnswer } from "./checkPreviewAnswer";
import { nextAuctionTurn } from "./previewAuction";
import {
  clampPreviewScore,
  PREVIEW_PLAYERS,
  PREVIEW_QUESTION,
  PREVIEW_SHOWMAN,
} from "./previewModel";
import { previewTimer, type PreviewCommand, type PreviewRuntime } from "./previewRuntime";

/** Executes the normalized SI program used by the server; no first-picture shortcut. */
export class PreviewScript {
  private pc = 0;
  private waiting: "content" | "answerer" | "price" | "answer" | null = null;
  private format: ScriptAnswerFormat = "text";
  private answerers: number[] = [];
  private picker: number = PREVIEW_PLAYERS[0];
  private actor: number | null = null;
  private mode: "button" | "direct" = "button";
  private price: number | null;
  private priceRevealed = false;
  private wrongPricePolicy?: "room" | "none";
  private range: ScriptNumberSet | null = null;
  private announcedRange: ScriptNumberSet | null = null;
  private revealContent = false;
  private awards: { playerId: number; points: number }[] = [];
  private lastCorrectResult?: AnsweredPlayer;
  private active: Question;
  private submissions = new Map<
    number,
    { text: string | null; order?: number; correct: boolean | null }
  >();
  private stakes = new Map<number, number>();
  private finalBids = new Map<number, number>();
  private effects = new Set<string>();
  private options: number[] = [];
  private key: number | null = null;
  private started = false;
  constructor(private readonly game: PreviewRuntime) {
    this.active = {
      ...game.question,
      script: null,
      text: null,
      textItems: [],
      questionFiles: [],
      pointImageOrder: -1,
      answerFiles: [],
      answers: [],
    };
    this.price = game.question.realPrice ?? game.question.price;
  }
  get running() {
    return this.started;
  }
  private revealsPrice(): boolean {
    const question = this.game.question;
    return (
      this.priceRevealed ||
      (this.waiting === "answer" &&
        !question.isHidden &&
        question.type !== "secret" &&
        this.finalBids.size === 0 &&
        this.stakes.size === 0 &&
        this.game.session.state.stakeQuestionData?.highestBid == null)
    );
  }
  viewFor(viewer: number): QuestionScriptView | null | undefined {
    const state = this.game.session.state;
    const view = state.scriptView;
    if (!view) return view;
    const host = viewer === PREVIEW_SHOWMAN;
    if (this.waiting === "price" && (host || viewer === this.actor))
      return { ...view, priceRange: this.range };
    if (this.waiting !== "answer") return view;
    const reveal =
      state.questionState === "reviewing" ||
      (!state.allPlay && [...this.submissions.values()].some((answer) => answer.correct === null));
    const q = this.game.question;
    const baseVisible = host || this.revealsPrice() || (!q.isHidden && q.realPrice == null);
    const estimate = (id?: number) => {
      const { win, lose, source, known } = this.answerPrice(id);
      if (!known || (source === "personal" && id !== viewer && !reveal)) return;
      if (source === "winning" && state.stakeQuestionData?.biddingPhase !== false) return;
      if (source === "base" && !baseVisible) return;
      return { win, lose };
    };
    const target = state.allPlay ? viewer : (state.answeringPlayer ?? viewer);
    const hasPersonal = this.finalBids.size > 0 || this.stakes.size > 0;
    const scoreEstimate =
      !hasPersonal || state.answeringPlayer != null || PREVIEW_PLAYERS.some((id) => id === target)
        ? estimate(target)
        : undefined;
    const reviewScoreEstimates =
      reveal && state.allPlay
        ? Object.fromEntries(
            state.allPlay.entries.flatMap(({ playerId }) => {
              const score = estimate(playerId);
              return score ? [[playerId, score]] : [];
            }),
          )
        : undefined;
    return {
      ...view,
      ...(scoreEstimate ? { scoreEstimate } : {}),
      ...(reviewScoreEstimates ? { reviewScoreEstimates } : {}),
    };
  }
  start(): boolean {
    if (!this.game.question.script) return false;
    const final = this.game.session.state.finalRoundData;
    if (final) {
      this.finalBids = new Map(
        Object.entries(final.bids).map(([id, amount]) => [Number(id), amount]),
      );
      this.answerers = [...final.turnOrder];
    }
    this.started = true;
    this.patch({ finalRoundData: null, questionTransition: null });
    this.run();
    return true;
  }
  private patch(
    patch: Partial<GameState> = {},
    scores: { playerId: number; score: number }[] = [],
  ) {
    const realPrice =
      this.revealsPrice() && (this.priceRevealed || this.game.question.realPrice != null)
        ? this.price
        : undefined;
    const q = { ...this.active, realPrice };
    this.game.dispatch({
      type: "question-script-state",
      payload: {
        gameState: {
          ...this.game.session.state,
          ...patch,
          currentQuestion: q,
          scriptView: {
            questionId: PREVIEW_QUESTION,
            programCounter: this.pc,
            waitingFor: this.waiting,
            actorId: this.actor,
            answererIds: this.answerers,
            answerMode: this.mode,
            ...(this.announcedRange ? { priceRange: this.announcedRange } : {}),
            ...(this.waiting === "answer" ? { canReveal: !!this.currentReveal() } : {}),
            ...(this.awards.length ? { awards: this.awards } : {}),
          },
        },
        scores,
      },
    });
  }
  private run() {
    const program = this.game.question.script!;
    for (let work = 0; work < 128 && !this.waiting && this.pc < program.steps.length; work++) {
      const id = this.pc++;
      const step = program.steps[id]!;
      if (step.op === "setTheme") continue;
      if (step.op === "setAnswerType") {
        this.format = step.answerType;
        this.options = step.optionOrders ?? [];
        this.key = step.correctChoiceOrder ?? null;
      } else if (step.op === "announcePrice") {
        this.announcedRange = this.resolveRange(step.range);
      } else if (step.op === "setPrice") {
        if (step.mode === "withButton" || step.mode === "forAll") {
          this.wrongPricePolicy =
            this.game.session.settings?.wrongAnswerPenalty === "none"
              ? "none"
              : (this.wrongPricePolicy ?? "room");
        } else if (step.mode === "multiply" || step.mode === "noRisk") {
          if (!this.effects.has(`${id}:price`)) this.price = Math.round((this.price ?? 0) * 2);
          this.effects.add(`${id}:price`);
          this.priceRevealed = true;
          if (step.mode === "noRisk") this.wrongPricePolicy = "none";
          else if (this.game.question.type === "noRisk") this.wrongPricePolicy ??= "room";
        } else if (step.mode === "select") {
          this.wrongPricePolicy = undefined;
          this.range = this.resolveRange(step.range);
          if (this.range.min === this.range.max) {
            this.price = this.range.min;
            this.priceRevealed = true;
          } else {
            this.waiting = "price";
            this.actor = this.answerers.length === 1 ? this.answerers[0]! : this.picker;
            this.patch({ questionState: "secret_transfer", timer: previewTimer(30_000) });
          }
        }
      } else if (step.op === "setAnswerer") {
        this.stakes.clear();
        this.patch({ stakeQuestionData: null, allPlay: null });
        if (step.mode === "current") this.answerers = [this.picker];
        else if (step.mode === "all") this.answerers = [...PREVIEW_PLAYERS];
        else if (step.mode === "byCurrent") {
          this.waiting = "answerer";
          this.actor = this.picker;
          this.patch({
            questionState: "secret_transfer",
            secretQuestionData: {
              questionId: PREVIEW_QUESTION,
              pickerPlayerId: this.picker,
              transferType: step.select ?? "exceptCurrent",
              transferDecisionPhase: true,
            },
            timer: previewTimer(30_000),
          });
        } else {
          this.waiting = "answerer";
          this.answerers = [...PREVIEW_PLAYERS];
          if (step.select === "allPossible")
            this.patch({
              questionState: "bidding",
              allPlay: this.everyone("stake"),
              timer: previewTimer(30_000),
            });
          else {
            this.actor = this.picker;
            this.patch({
              questionState: "bidding",
              stakeQuestionData: {
                pickerPlayerId: this.picker,
                questionId: PREVIEW_QUESTION,
                maxPrice: null,
                bids: {},
                passedPlayers: [],
                biddingOrder: [this.picker, ...PREVIEW_PLAYERS.filter((id) => id !== this.picker)],
                currentBidderIndex: 0,
                highestBid: null,
                winnerPlayerId: null,
                biddingPhase: true,
              },
              timer: previewTimer(30_000),
            });
          }
        }
      } else if (step.op === "showContent") this.content(step);
      else if (step.op === "askAnswer") {
        this.waiting = "answer";
        this.mode = step.mode;
        this.submissions.clear();
        this.active = {
          ...this.active,
          answerType: this.format,
          answers: this.game.question.answers?.filter((option) =>
            this.options.includes(option.order),
          ),
          correctChoiceOrder: this.key,
        };
        if (step.mode === "button") this.answerers = [];
        else if (!this.answerers.length) this.answerers = [this.picker];
        this.actor = this.answerers.length === 1 ? this.answerers[0]! : null;
        const timers = this.game.session.settings?.timers;
        const duration =
          this.game.session.state.currentRound?.type === "final"
            ? (timers?.finalAnswerMs ?? 75_000)
            : this.answerers.length > 1
              ? (timers?.allPlayAnswerMs ?? 45_000)
              : this.mode === "button"
                ? (timers?.answerMs ?? 20_500)
                : (timers?.answerSubmitMs ?? 60_000);
        this.patch({
          questionState: this.answerers.length === 1 ? "answering" : "showing",
          answeringPlayer: this.answerers.length === 1 ? this.answerers[0] : null,
          submittedAnswer: null,
          submittedChoiceOrder: null,
          answeredPlayers: null,
          skippedPlayers: null,
          allPlay:
            this.answerers.length > 1
              ? this.everyone(this.stakes.size || this.finalBids.size ? "stake" : "simple")
              : null,
          buzzerOpensAtMs: 0,
          timer: previewTimer(step.durationMs ?? duration),
          answerShowData: null,
        });
      } else if (step.op === "accept") {
        for (const player of this.answerers)
          this.score(player, true, `${id}:accept:${player}`, true);
        this.pc = program.steps.length;
      }
    }
    if (!this.waiting && this.pc >= program.steps.length) {
      this.patch({
        questionState: "showing_answer",
        allPlay: null,
        answeringPlayer: null,
        timer: previewTimer(5000),
        answerShowData: this.game.session.state.answerShowData ?? {
          answerText: null,
          answerFiles: [],
          nextTurnPlayerId: this.picker,
          ...(this.lastCorrectResult ? { answerResult: this.lastCorrectResult } : {}),
        },
      });
      this.started = false;
      return;
    }
    this.patch();
  }
  private content(step: Extract<QuestionScriptStep, { op: "showContent" }>) {
    const source = this.game.question;
    const files = step.phase === "question" ? source.questionFiles : source.answerFiles;
    const texts =
      step.phase === "question"
        ? source.textItems
        : (source.answerTextItems ?? source.script?.answerTextItems);
    const previous = this.active;
    this.active = {
      ...source,
      script: null,
      answerType: this.format,
      text: null,
      textOrder: null,
      textItems: texts?.filter((item) => step.orders.includes(item.order)) ?? [],
      questionFiles: files?.filter((item) => step.orders.includes(item.order)) ?? [],
      answerFiles: [],
      answers: source.answers?.filter((item) => this.options.includes(item.order)) ?? [],
      correctChoiceOrder: this.key,
    };
    if (step.revealRight) {
      if (this.format === "select") {
        const right = this.active.answers?.find((option) => option.order === this.key);
        this.active.text = right?.text ?? null;
        this.active.questionFiles = right?.file
          ? [{ order: 0, file: right.file, displayTime: null }]
          : [];
      } else if (this.format === "point") this.active.questionFiles = previous.questionFiles;
      else this.active.text = source.answerText;
      this.active.pointImageOrder = this.format === "point" ? previous.pointImageOrder : -1;
    } else {
      this.active.pointImageOrder = scriptPointImageOrder(
        this.active.questionFiles,
        this.active.textItems,
        step.orders,
      );
    }
    this.waiting = "content";
    this.revealContent = step.revealRight === true;
    const plan = buildContentPlan({
      text: this.active.text,
      textOrder: this.active.textOrder,
      textItems: this.active.textItems,
      files: this.active.questionFiles,
      playMediaSimultaneously: source.playMediaSimultaneously,
    });
    this.patch({
      questionState: this.active.questionFiles?.length ? "media_downloading" : "showing",
      answeringPlayer: null,
      allPlay: null,
      questionContentPlan: plan,
      answerShowData: null,
      buzzerOpensAtMs: Number.MAX_SAFE_INTEGER,
      timer: previewTimer(
        Math.max(plan?.totalMs ?? 0, this.active.text ? textDuration(this.active.text) : 0, 1),
      ),
    });
    if (!this.active.questionFiles?.length && this.revealContent) this.ready();
  }
  ready(): boolean {
    if (!this.started || this.waiting !== "content") return false;
    this.patch(
      this.revealContent
        ? {
            questionState: "showing_answer",
            answerShowData: {
              answerText: this.active.text ?? null,
              answerFiles: this.active.questionFiles ?? null,
              answerPoint: this.active.answerPoint,
              answerDeviation: this.active.answerDeviation,
              answerContentPlan: this.game.session.state.questionContentPlan,
              nextTurnPlayerId: this.picker,
              ...(this.lastCorrectResult ? { answerResult: this.lastCorrectResult } : {}),
            },
          }
        : { questionState: "showing" },
    );
    return true;
  }
  timeout(): boolean {
    if (!this.started) return false;
    if (this.waiting === "content" && this.game.session.state.questionState === "media_downloading")
      return this.ready();
    if (this.waiting === "answer") {
      if (!this.answerers.length) this.resume();
      else {
        for (const player of this.answerers)
          if (!this.submissions.has(player))
            this.submissions.set(player, { text: null, correct: false });
        this.finishAnswers();
      }
    } else if (this.waiting === "price") {
      this.price = this.range!.min;
      this.priceRevealed = true;
      this.resume();
    } else if (this.waiting === "answerer") {
      const state = this.game.session.state;
      if (state.stakeQuestionData && this.actor != null) {
        const bid = state.stakeQuestionData.highestBid == null ? this.price || 1 : null;
        this.applyBid(state.stakeQuestionData, this.actor, bid);
        return true;
      }
      if (state.allPlay) {
        for (const player of this.answerers) {
          if (!this.stakes.has(player)) this.stakes.set(player, Math.max(1, this.price ?? 1));
        }
      } else if (state.secretQuestionData) {
        const allowPicker = state.secretQuestionData.transferType === "any";
        this.picker = PREVIEW_PLAYERS.find((id) => allowPicker || id !== this.picker)!;
        this.answerers = [this.picker];
        this.patch({ secretQuestionData: null });
      }
      this.resume();
    } else this.resume();
    return true;
  }
  handle(command: PreviewCommand, sender: number): boolean {
    if (!this.started) return false;
    const host = sender === PREVIEW_SHOWMAN;
    if (
      command.type === "question-answer" &&
      this.waiting === "answer" &&
      this.mode === "button" &&
      !this.answerers.length &&
      PREVIEW_PLAYERS.includes(sender as 2 | 3 | 4) &&
      this.canStillBuzz(sender)
    ) {
      this.answerers = [sender];
      this.patch({
        questionState: "answering",
        answeringPlayer: sender,
        timer: previewTimer(60_000),
      });
    } else if (
      ["answer-submitted", "all-play-answer", "final-answer-submit"].includes(command.type)
    ) {
      const input = command.payload as { answerText?: string | null; choiceOrder?: number };
      if (
        this.waiting === "answer" &&
        this.answerers.includes(sender) &&
        !this.submissions.has(sender)
      ) {
        if (
          this.format === "select" &&
          (input.choiceOrder == null || !this.options.includes(input.choiceOrder))
        )
          return true;
        const final = this.game.session.state.currentRound?.type === "final";
        const correct = final
          ? null
          : this.format === "select"
            ? input.choiceOrder === this.key
            : checkPreviewAnswer(
                this.active,
                input.answerText ?? "",
                input.choiceOrder ?? null,
                input.choiceOrder != null,
              );
        this.submit(sender, input.answerText ?? null, input.choiceOrder, correct);
      }
    } else if (
      host &&
      this.waiting === "answer" &&
      ((command.type === "all-play-review" &&
        this.game.session.state.questionState === "reviewing") ||
        (command.type === "answer-result" && this.game.session.state.questionState === "answering"))
    ) {
      const input = command.payload as {
        playerId?: number;
        isCorrect?: boolean;
        answerType?: string;
      };
      const id = input.playerId ?? this.game.session.state.answeringPlayer;
      if (id != null && this.answerers.includes(id)) {
        const submission = this.submissions.get(id);
        if (submission?.correct === null || (!submission && this.format === "text")) {
          this.submissions.set(id, {
            text: submission?.text ?? null,
            order: submission?.order,
            correct: input.isCorrect ?? input.answerType === "correct",
          });
          this.finishAnswers();
        }
      }
    } else if (
      command.type === "secret-question-transfer" &&
      this.waiting === "answerer" &&
      (host || sender === this.actor)
    ) {
      const target = command.payload.targetPlayerId;
      if (
        PREVIEW_PLAYERS.includes(target as 2 | 3 | 4) &&
        (this.game.session.state.secretQuestionData?.transferType !== "exceptCurrent" ||
          target !== this.picker)
      ) {
        this.picker = target;
        this.answerers = [target];
        this.patch({ secretQuestionData: null });
        this.resume();
      }
    } else if (
      command.type === "secret-question-price" &&
      this.waiting === "price" &&
      (host || sender === this.actor)
    ) {
      const amount = command.payload.price;
      if (
        this.range &&
        Number.isInteger(amount) &&
        amount >= this.range.min &&
        amount <= this.range.max &&
        (this.range.step === 0 || (amount - this.range.min) % this.range.step === 0)
      ) {
        this.price = amount;
        this.priceRevealed = true;
        this.resume();
      }
    } else if (
      command.type === "all-play-stake" &&
      this.waiting === "answerer" &&
      this.answerers.includes(sender) &&
      !this.stakes.has(sender)
    ) {
      const amount = command.payload.amount;
      const max = Math.max(
        this.price ?? 1,
        this.game.session.players.find((player) => player.meta.id === sender)?.score ?? 0,
        1,
      );
      if (Number.isInteger(amount) && amount >= 1 && amount <= max) {
        this.stakes.set(sender, amount);
        const all = this.game.session.state.allPlay!;
        this.patch({
          allPlay: {
            ...all,
            entries: all.entries.map((entry) =>
              entry.playerId === sender ? { ...entry, stake: amount } : entry,
            ),
          },
        });
        if (this.answerers.every((id) => this.stakes.has(id))) this.resume();
      }
    } else if (command.type === "stake-bid-submit" && this.waiting === "answerer")
      this.bid(command.payload, sender);
    else if (host && command.type === "skip-show-answer" && this.waiting === "content")
      this.resume();
    else if (host && command.type === "skip-question-force" && this.waiting === "answer") {
      const reveal = this.currentReveal();
      this.pc = this.game.question.script!.steps.length;
      if (reveal) this.content(reveal);
      else this.resume();
    } else if (
      command.type === "question-skip" &&
      this.waiting === "answer" &&
      this.mode === "button" &&
      !this.answerers.length &&
      PREVIEW_PLAYERS.includes(sender as 2 | 3 | 4)
    ) {
      const passed = [...new Set([...(this.game.session.state.skippedPlayers ?? []), sender])];
      this.patch({ skippedPlayers: passed });
      if (!PREVIEW_PLAYERS.some((id) => this.canStillBuzz(id))) this.resume();
    } else if (
      command.type === "question-unskip" &&
      this.waiting === "answer" &&
      this.mode === "button" &&
      !this.answerers.length
    ) {
      this.patch({
        skippedPlayers: (this.game.session.state.skippedPlayers ?? []).filter(
          (id) => id !== sender,
        ),
      });
    } else if (
      command.type === "question-skip" &&
      this.waiting === "answer" &&
      this.answerers.includes(sender) &&
      !this.submissions.has(sender)
    ) {
      this.submit(sender, null, undefined, false);
    }
    return true;
  }
  private submit(
    sender: number,
    text: string | null,
    order: number | undefined,
    correct: boolean | null,
  ) {
    this.submissions.set(sender, { text, order, correct });
    const all = this.game.session.state.allPlay;
    this.patch({
      submittedAnswer: all ? null : text,
      submittedChoiceOrder: all ? null : (order ?? null),
      allPlay: all
        ? {
            ...all,
            entries: all.entries.map((entry) =>
              entry.playerId === sender
                ? { ...entry, answer: text, choiceOrder: order, submitted: true }
                : entry,
            ),
          }
        : null,
    });
    this.finishAnswers();
  }
  private bid(
    input: { bidType: "normal" | "pass" | "all-in"; bidAmount: number | null },
    sender: number,
  ) {
    const stake = this.game.session.state.stakeQuestionData;
    if (!stake || this.actor !== sender) return;
    const score = this.game.session.players.find((player) => player.meta.id === sender)?.score ?? 0;
    const amount =
      input.bidType === "pass" ? null : input.bidType === "all-in" ? score : input.bidAmount;
    if (
      (amount == null && stake.highestBid == null) ||
      (amount != null &&
        (!Number.isInteger(amount) ||
          amount < Math.max(1, this.price ?? 1, (stake.highestBid ?? 0) + 1) ||
          amount > score))
    )
      return;
    this.applyBid(stake, sender, amount);
  }
  private applyBid(stake: StakeQuestionData, sender: number, amount: number | null) {
    const updated = {
      ...stake,
      bids: { ...stake.bids, [sender]: amount },
      passedPlayers: amount == null ? [...stake.passedPlayers, sender] : stake.passedPlayers,
      highestBid: amount ?? stake.highestBid,
    };
    const next = nextAuctionTurn(updated, this.game.session.players);
    this.actor = next.next;
    this.patch({
      stakeQuestionData: {
        ...updated,
        currentBidderIndex:
          next.next == null ? stake.currentBidderIndex : updated.biddingOrder.indexOf(next.next),
        winnerPlayerId: next.winner,
        biddingPhase: !next.complete,
      },
      timer: next.complete
        ? null
        : previewTimer(this.game.session.settings?.timers?.stakeMs ?? 30_000),
    });
    if (next.complete && next.winner != null) {
      this.answerers = [next.winner];

      this.resume();
    }
  }
  private finishAnswers() {
    if (this.answerers.some((id) => !this.submissions.has(id))) return;
    if ([...this.submissions.values()].some((entry) => entry.correct === null)) {
      this.patch({
        questionState: this.answerers.length > 1 ? "reviewing" : "answering",
        timer: null,
      });
      return;
    }
    for (const [id, answer] of this.submissions)
      this.score(id, answer.correct === true, `${this.pc - 1}:answer:${id}`);
    if (
      this.mode === "button" &&
      ![...this.submissions.values()].some((entry) => entry.correct) &&
      PREVIEW_PLAYERS.some((id) => this.canStillBuzz(id))
    ) {
      this.answerers = [];
      this.patch({
        answeringPlayer: null,
        questionState: "showing",
        submittedAnswer: null,
        timer: previewTimer(20_500),
      });
      return;
    }
    this.resume();
  }
  private canStillBuzz(playerId: number) {
    return (
      !this.submissions.has(playerId) && !this.game.session.state.skippedPlayers?.includes(playerId)
    );
  }
  private answerPrice(id?: number) {
    const state = this.game.session.state;
    const personal = id == null ? undefined : (this.finalBids.get(id) ?? this.stakes.get(id));
    const highest = state.stakeQuestionData?.highestBid;
    const stake = personal ?? highest;
    const price = stake ?? this.price;
    const roomPenalty = this.game.session.settings?.wrongAnswerPenalty !== "none";
    const type = this.game.question.type;
    const policy = this.wrongPricePolicy;
    const basePenalty =
      policy === "room"
        ? roomPenalty
        : policy !== "none" && type !== "noRisk" && (type === "secret" || roomPenalty);
    const win = Math.max(-2_000_000, Math.min(2_000_000, price ?? 0));
    return {
      win,
      lose: win !== 0 && (stake != null || basePenalty) ? -win : 0,
      source: personal != null ? "personal" : highest != null ? "winning" : "base",
      known: price != null,
    };
  }
  private score(id: number, correct: boolean, identity: string, award = false) {
    if (this.effects.has(identity)) return;
    const { win, lose } = this.answerPrice(id);
    const previous = this.game.session.players.find((player) => player.meta.id === id)?.score ?? 0;
    const score = clampPreviewScore(previous + (correct ? win : lose));
    if (award) this.awards = [...this.awards, { playerId: id, points: score - previous }];
    else if (correct)
      this.lastCorrectResult = {
        player: id,
        result: score - previous,
        score,
        answerType: "correct",
      };
    this.effects.add(identity);
    this.patch({}, [{ playerId: id, score }]);
  }
  private currentReveal(): Extract<QuestionScriptStep, { op: "showContent" }> | null {
    for (const step of this.game.question.script!.steps.slice(this.pc)) {
      if (step.op === "askAnswer" || step.op === "accept") break;
      if (step.op === "showContent" && step.phase === "answer") return step;
    }
    return this.game.question.answerText ||
      this.key != null ||
      (this.format === "point" && this.game.question.answerPoint)
      ? { op: "showContent", phase: "answer", orders: [], revealRight: true }
      : null;
  }
  private resume() {
    this.waiting = null;
    this.run();
  }
  private everyone(mode: "simple" | "stake") {
    return {
      mode,
      questionId: PREVIEW_QUESTION,
      themeId: 10,
      price: this.price ?? 0,
      maxStake: null,
      priceMultiplier: null,
      entries: this.answerers.map((id) => ({
        playerId: id,
        stake: this.finalBids.get(id) ?? this.stakes.get(id) ?? null,
        answer: null,
        submitted: false,
        isCorrect: null,
        scoreChange: null,
      })),
    };
  }
  private resolveRange(range: ScriptNumberSet): ScriptNumberSet {
    if (range.min || range.max) return range;
    if (this.game.session.state.currentRound?.type === "final") {
      const value = this.game.question.realPrice ?? this.game.question.price ?? 0;
      const price = value > 0 ? value : 1;
      const { min, max } = this.game.finalRoundPrices ?? { min: price, max: price };
      return { min, max, step: max - min };
    }
    const prices =
      this.game.session.state.currentRound?.themes.flatMap((theme) =>
        theme.questions.flatMap((question) =>
          question.price == null || question.price < 0 ? [] : [question.price],
        ),
      ) ?? [];
    const min = Math.min(...prices, this.game.question.price ?? 0);
    const max = Math.max(...prices, this.game.question.price ?? 0);
    return { min, max, step: max - min };
  }
}
