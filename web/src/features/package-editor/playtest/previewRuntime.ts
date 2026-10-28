import type { GameCommands } from "@/features/game/GameContext";
import { buildContentPlan, nextChangeAt, textDuration, timerElapsed } from "@/game/contentPlan";
import type { ClientEventName, ClientEvents, Question, ServerEvent, Timer } from "@/game/protocol";
import { reduce, type GameSession } from "@/game/reducer";
import { canBuzz, phaseOf, questionValue, wrongCostsPoints } from "@/game/selectors";
import { createGameStore } from "@/game/store";
import { serverNow } from "@/lib/clock";
import { checkPreviewAnswer } from "./checkPreviewAnswer";
import { optionAnswer } from "@/features/game/play/question/optionAnswer";
import {
  clampPreviewScore,
  PREVIEW_PLAYERS,
  PREVIEW_QUESTION,
  PREVIEW_SHOWMAN,
  publicQuestion,
} from "./previewModel";
import { handleSpecial, startSpecial, timeoutSpecial } from "./previewSpecial";
import { handleFinal, timeoutFinal } from "./previewFinal";

export type PreviewCommand = {
  [K in ClientEventName]: { type: K; payload: ClientEvents[K] };
}[ClientEventName];
export const previewTimer = (durationMs: number, elapsedMs = 0): Timer => ({
  startedAt: new Date(serverNow()).toISOString(),
  durationMs,
  elapsedMs,
  resumedAt: null,
});

/** One private local game; views receive a role-filtered projection in a separate store. */
export class PreviewRuntime {
  readonly store = createGameStore();
  readonly commands: GameCommands;
  private state: GameSession;
  private readonly picker: number | null;
  private disposed = false;
  private showingTimer: Timer | null = null;
  private revealTimer: Timer | null = null;
  private perspective: number = PREVIEW_PLAYERS[0];
  readonly answers = new Map<number, string>();
  readonly stakes = new Map<number, number>();
  constructor(
    initial: GameSession,
    readonly question: Question,
    private readonly credits: { authors: string[]; sources: string[] } = {
      authors: [],
      sources: [],
    },
  ) {
    this.state = initial;
    this.picker = initial.state.currentTurnPlayerId ?? null;
    this.commands = {
      connected: true,
      emit: <K extends ClientEventName>(
        name: K,
        ...args: ClientEvents[K] extends undefined ? [] : [ClientEvents[K]]
      ) => {
        this.command({ type: name, payload: args[0] } as PreviewCommand);
      },
    };
    this.store.setState({ gameId: initial.gameId, connection: "connected" });
    this.publish();
  }
  get session(): GameSession {
    return this.state;
  }
  activate() {
    this.disposed = false;
  }
  dispose() {
    this.disposed = true;
  }
  get activeTimer(): Timer | null {
    if (this.state.finished) return null;
    return phaseOf(this.state) === "reveal" ? this.revealTimer : this.state.state.timer;
  }
  setPerspective(id: number) {
    if (this.disposed) return;
    this.perspective = id;
    this.publish();
  }
  dispatch(event: ServerEvent) {
    if (this.disposed) return;
    this.state = reduce(this.state, event);
    this.publish();
  }
  private publish() {
    const s = this.state;
    const isHost = this.perspective === PREVIEW_SHOWMAN;
    const q = s.state.currentQuestion;
    const final = s.state.finalRoundData;
    const all = s.state.allPlay;
    const visibleFinal = final && {
      ...final,
      questionData: final.questionData
        ? {
            ...final.questionData,
            question: isHost
              ? final.questionData.question
              : publicQuestion(final.questionData.question),
          }
        : final.questionData,
      bids:
        final.phase === "reviewing"
          ? final.bids
          : Object.fromEntries(
              Object.entries(final.bids).map(([id, amount]) => [
                id,
                Number(id) === this.perspective ? amount : 0,
              ]),
            ),
      answers: final.phase === "reviewing" ? final.answers : [],
    };
    const visibleAll =
      all &&
      (s.state.questionState === "reviewing" || s.state.questionState === "showing_answer"
        ? all
        : {
            ...all,
            entries: all.entries.map((entry) => ({
              ...entry,
              stake: entry.stake == null ? null : 0,
              answer: entry.answer == null ? null : "",
            })),
          });
    this.store.setState({
      session: {
        ...s,
        submittedAnswer:
          isHost || s.state.answeringPlayer === this.perspective ? s.submittedAnswer : null,
        state: {
          ...s.state,
          currentQuestion: q && !isHost ? publicQuestion(q) : q,
          submittedAnswer:
            isHost || s.state.answeringPlayer === this.perspective ? s.state.submittedAnswer : null,
          finalRoundData: visibleFinal,
          allPlay: visibleAll,
        },
      },
    });
  }
  command(command: PreviewCommand, sender = this.perspective) {
    if (this.disposed) return;
    if (this.state.state.isPaused && command.type !== "game-unpause") return;
    if (command.type === "game-pause" || command.type === "game-unpause") {
      this.pause(command.type === "game-pause");
      return;
    }
    if (handleFinal(this, command, sender) || handleSpecial(this, command, sender)) return;
    switch (command.type) {
      case "question-pick":
        if (
          phaseOf(this.state) === "choosing" &&
          command.payload.questionId === PREVIEW_QUESTION &&
          (sender === PREVIEW_SHOWMAN || sender === this.state.state.currentTurnPlayerId)
        )
          this.pick();
        break;
      case "question-answer":
        this.buzz(sender);
        break;
      case "answer-submitted":
        if (this.state.state.answeringPlayer === sender)
          this.submit(command.payload.answerText ?? "", command.payload.choiceOrder);
        break;
      case "answer-result":
        if (sender === PREVIEW_SHOWMAN)
          this.judge(command.payload.answerType, command.payload.scoreResult);
        break;
      case "question-skip":
        if (
          phaseOf(this.state) === "answering" &&
          this.state.state.answeringPlayer === sender &&
          ["secret", "stake", "noRisk"].includes(this.question.type)
        )
          this.judge("wrong");
        else if (phaseOf(this.state) === "showing" && canBuzz(this.state, sender).ok) {
          this.dispatch({ type: "question-skip", payload: { playerId: sender } });
          if (this.allExhausted()) this.finish();
        }
        break;
      case "question-unskip":
        if (phaseOf(this.state) === "showing" && this.state.state.skippedPlayers?.includes(sender))
          this.dispatch({ type: "question-unskip", payload: { playerId: sender } });
        break;
      case "skip-question-force":
        if (sender === PREVIEW_SHOWMAN && phaseOf(this.state) === "showing") this.finish();
        break;
      case "skip-show-answer":
        if (sender === PREVIEW_SHOWMAN && phaseOf(this.state) === "reveal") this.endRound();
        break;
      case "buzzer-open":
        if (sender === PREVIEW_SHOWMAN && phaseOf(this.state) === "showing")
          this.dispatch({ type: "buzzer-open", payload: { buzzerOpensAtMs: 0 } });
        break;
    }
  }
  pick() {
    const target = this.state.state.currentRound?.themes
      .flatMap((theme) => theme.questions)
      .find((q) => q.id === PREVIEW_QUESTION);
    if (!target || target.isPlayed) return;
    if (startSpecial(this)) return;
    this.showQuestion();
  }
  showQuestion() {
    const { duration, opensAt } = this.questionTiming();
    const direct =
      this.state.state.stakeQuestionData?.winnerPlayerId != null ||
      (this.state.state.secretQuestionData != null && this.state.state.answeringPlayer != null);
    this.dispatch({
      type: "question-data",
      payload: {
        data: this.question,
        timer: previewTimer(direct ? duration : 30_000),
        buzzerOpensAtMs: opensAt,
        questionEligiblePlayers:
          this.question.type === "noRisk" && this.question.subType !== "forEveryone"
            ? [PREVIEW_PLAYERS[0]]
            : null,
      },
    });
  }
  ready() {
    const plan = buildContentPlan({
      text: this.question.text,
      textOrder: this.question.textOrder,
      files: this.question.questionFiles,
    });
    const { duration, opensAt } = this.questionTiming();
    this.dispatch({
      type: "media-download-status",
      payload: {
        playerId: PREVIEW_PLAYERS[0],
        mediaDownloaded: true,
        allPlayersReady: true,
        timer: previewTimer(duration),
        contentPlan: plan,
        buzzerOpensAtMs: opensAt,
      },
    });
  }
  private questionTiming() {
    const q = this.question;
    const plan = buildContentPlan({ text: q.text, textOrder: q.textOrder, files: q.questionFiles });
    const content = plan?.totalMs ?? 0;
    const caption = q.text?.trim() && q.textOrder == null ? textDuration(q.text.trim()) : 0;
    const opensAt = this.state.settings?.falseStart
      ? Math.max(content, caption) + (q.type === "choice" ? Math.max(0, q.showDelay ?? 0) : 0)
      : 0;
    const answerMs = this.state.state.allPlay ? 45_000 : 20_500;
    return { opensAt, duration: Math.max(content, opensAt) + answerMs };
  }
  buzz(id: number) {
    if (this.disposed) return;
    if (!canBuzz(this.state, id).ok) return;
    if ((this.state.state.buzzerOpensAtMs ?? 0) > timerElapsed(this.state.state.timer, false)) {
      this.dispatch({ type: "buzzer-false-start", payload: { playerId: id, lockMs: 3000 } });
      return;
    }
    const timer = this.state.state.timer;
    this.showingTimer = timer ? previewTimer(timer.durationMs, timerElapsed(timer, false)) : null;
    this.dispatch({
      type: "question-answer",
      payload: { userId: id, timer: previewTimer(60_000) },
    });
  }
  submit(answer: string, order?: number) {
    if (phaseOf(this.state) !== "answering" || this.state.submittedAnswer != null || !answer.trim())
      return;
    const options =
      this.question.type === "choice"
        ? [...(this.question.answers ?? [])].sort((a, b) => a.order - b.order)
        : [];
    const normalize = (text: string | null | undefined) =>
      (text ?? "").trim().replace(/\s+/g, " ").toLocaleLowerCase();
    const matches =
      order == null
        ? options.filter(
            (option) => normalize(option.text) && normalize(option.text) === normalize(answer),
          )
        : options.filter((option) => option.order === order);
    if (order != null && matches.length !== 1) return;
    const option =
      matches.length === 1 && options.filter((o) => o.order === matches[0]!.order).length === 1
        ? matches[0]
        : undefined;
    if (
      option &&
      order != null &&
      normalize(answer) !== normalize(optionAnswer(option.text, options.indexOf(option), options))
    )
      return;
    const choiceOrder = option?.order;
    if (
      choiceOrder != null &&
      (this.state.state.answeredPlayers ?? []).some(
        (entry) => entry.answerType === "wrong" && entry.choiceOrder === choiceOrder,
      )
    )
      return;
    this.dispatch({
      type: "answer-submitted",
      payload: { answerText: answer.trim(), choiceOrder },
    });
    const result =
      order != null && !option?.text?.trim() ? null : checkPreviewAnswer(this.question, answer);
    if (result != null) this.judge(result ? "correct" : "wrong");
  }
  judge(answerType: "correct" | "wrong" | "skip", scoreResult?: number) {
    const id = this.state.state.answeringPlayer;
    if (phaseOf(this.state) !== "answering" || id == null) return;
    const value = questionValue(this.state);
    const correct = answerType === "correct";
    const requested = scoreResult ?? (correct ? value : answerType === "skip" ? 0 : -value);
    const delta =
      requested < 0 && !wrongCostsPoints(this.state)
        ? 0
        : Math.max(-2_000_000, Math.min(2_000_000, requested));
    const score = clampPreviewScore(
      (this.state.players.find((p) => p.meta.id === id)?.score ?? 0) + delta,
    );
    const single = ["stake", "secret", "noRisk"].includes(this.question.type);
    this.dispatch({
      type: "answer-result",
      payload: {
        answerResult: {
          player: id,
          answerType,
          answerText: this.state.submittedAnswer,
          choiceOrder: this.state.state.submittedChoiceOrder,
          result: delta,
          score,
        },
        timer:
          !correct && !single && this.showingTimer
            ? previewTimer(this.showingTimer.durationMs, this.showingTimer.elapsedMs)
            : null,
      },
    });
    if (correct || single || this.allExhausted()) this.finish(correct ? id : undefined);
  }
  private allExhausted() {
    const eligible = this.state.state.questionEligiblePlayers?.length
      ? this.state.state.questionEligiblePlayers
      : PREVIEW_PLAYERS;
    return eligible.every(
      (id) =>
        this.state.state.skippedPlayers?.includes(id) ||
        this.state.state.answeredPlayers?.some((entry) => entry.player === id),
    );
  }
  finish(id: number | null = this.picker) {
    const files = this.question.answerFiles?.map((file) => ({
      ...file,
      displayTime:
        file.displayTime ??
        (file.file.type === "audio" ? 10_000 : file.file.type === "video" ? 15_000 : 5000),
    }));
    const answerContentPlan = buildContentPlan({ files });
    this.revealTimer = previewTimer(
      answerContentPlan?.totalMs || this.question.showAnswerDuration || 5000,
    );
    this.dispatch({
      type: "question-finish",
      payload: {
        answerText: this.question.answerText ?? null,
        answerFiles: this.question.answerFiles ?? null,
        rightAnswers: this.question.rightAnswers ?? null,
        answerPoint: this.question.answerPoint ?? null,
        answerDeviation: this.question.answerDeviation ?? null,
        answerContentPlan,
        authors: this.credits.authors,
        sources: this.credits.sources,
        nextTurnPlayerId: id,
      },
    });
  }
  pause(paused: boolean) {
    if (this.disposed || this.state.finished) return;
    const timer = this.activeTimer;
    const elapsed = timer ? timerElapsed(timer, this.state.state.isPaused) : 0;
    const next = timer ? previewTimer(timer.durationMs, elapsed) : null;
    if (phaseOf(this.state) === "reveal") this.revealTimer = next;
    this.dispatch({
      type: paused ? "game-pause" : "game-unpause",
      payload: { timer: next },
    });
  }
  setClock(timer: Timer) {
    this.dispatch({ type: "game-unpause", payload: { timer } });
  }
  timeout() {
    if (this.disposed || this.state.state.isPaused) return;
    if (timeoutFinal(this) || timeoutSpecial(this)) return;
    switch (phaseOf(this.state)) {
      case "media":
        this.ready();
        break;
      case "showing":
        this.finish();
        break;
      case "answering":
        this.judge("wrong");
        break;
      case "reveal":
        this.endRound();
        break;
    }
  }
  private endRound() {
    this.dispatch({ type: "answer-show-end", payload: {} });
    this.dispatch({ type: "game-finished", payload: {} });
  }
  advanceWait(): boolean {
    const timer = this.state.state.timer;
    if (!timer || this.state.state.isPaused) return false;
    const elapsed = timerElapsed(timer, false);
    const nextStep =
      this.state.content?.kind === "question"
        ? nextChangeAt(this.state.content.plan, elapsed)
        : null;
    const opens = this.state.state.buzzerOpensAtMs ?? 0;
    const next =
      nextStep != null
        ? Math.min(nextStep, opens > elapsed ? opens : nextStep)
        : opens > elapsed
          ? opens
          : null;
    if (next == null) return false;
    this.dispatch({
      type: "game-unpause",
      payload: { timer: previewTimer(timer.durationMs, next) },
    });
    return true;
  }
  advance() {
    if (this.disposed || this.state.state.isPaused) return;
    switch (phaseOf(this.state)) {
      case "choosing":
        this.pick();
        break;
      case "media":
        this.ready();
        break;
      case "showing":
        this.advanceWait();
        break;
      case "reveal":
        this.endRound();
        break;
    }
  }
}
