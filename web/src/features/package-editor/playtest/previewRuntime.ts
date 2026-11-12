import { questionMediaFiles } from "@/game/questionMediaFiles";
import { answerFormat } from "@/game/answerFormat";
import type { SecretQuestionAward } from "@/game/protocol";
import { answerWindowDuration } from "@/game/answerWindowDuration";
import { PreviewScript } from "./previewScript";
import type { GameCommands } from "@/features/game/GameContext";
import {
  buildAnswerContentPlan,
  buildContentPlan,
  nextChangeAt,
  textDuration,
  timerElapsed,
} from "@/game/contentPlan";
import type { ClientEventName, ClientEvents, Question, ServerEvent, Timer } from "@/game/protocol";
import { reduce, type GameSession } from "@/game/reducer";
import { canAnswerNow, canBuzz, phaseOf, questionValue, wrongCostsPoints } from "@/game/selectors";
import { createGameStore } from "@/game/store";
import { serverNow } from "@/lib/clock";
import {
  contentElapsed,
  MEDIA_PLAYBACK_START_DELAY_MS,
  QUESTION_TRANSITION_MS,
  QUESTION_PICK_TIMING,
  QUESTION_CONTENT_START_LEAD_MS,
  presentedQuestionContent,
} from "@/game/questionPresentation";
import { timerStartDelay } from "@/lib/timer";
import { checkPreviewAnswer } from "./checkPreviewAnswer";
import { previewChoiceSelection } from "./previewChoiceSelection";
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
export const previewTimer = (durationMs: number, elapsedMs = 0, delayMs = 0): Timer => ({
  startedAt: new Date(serverNow() + delayMs).toISOString(),
  durationMs,
  elapsedMs,
  resumedAt: null,
});

/** Project the private simulation into the selected player's visible session. */
function previewView(
  s: GameSession,
  perspective: number,
  scriptView: ReturnType<PreviewScript["viewFor"]>,
): GameSession {
  const isHost = perspective === PREVIEW_SHOWMAN;
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
              Number(id) === perspective ? amount : 0,
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
            choiceOrder: undefined,
          })),
        });
  return {
    ...s,
    submittedAnswer: isHost || s.state.answeringPlayer === perspective ? s.submittedAnswer : null,
    state: {
      ...s.state,
      currentQuestion:
        q && !isHost
          ? publicQuestion(
              s.state.scriptView &&
                s.state.scriptView.waitingFor !== "answer" &&
                s.state.questionState !== "media_downloading"
                ? { ...q, answers: [] }
                : q,
            )
          : q,
      answerShowData:
        s.state.answerShowData && !isHost
          ? {
              ...s.state.answerShowData,
              answerTextItems: s.state.answerShowData.answerTextItems?.map((item) =>
                item.placement === "replic"
                  ? { ...item, text: "", durationMs: item.durationMs ?? textDuration(item.text) }
                  : item,
              ),
            }
          : s.state.answerShowData,
      submittedAnswer:
        isHost || s.state.answeringPlayer === perspective ? s.state.submittedAnswer : null,
      scriptView,
      finalRoundData: visibleFinal,
      allPlay: visibleAll,
    },
  };
}

/** One private local game; views receive a role-filtered projection in a separate store. */
export class PreviewRuntime {
  readonly store = createGameStore();
  readonly commands: GameCommands;
  private state: GameSession;
  private readonly script: PreviewScript;
  private readonly picker: number | null;
  private disposed = false;
  private showingTimer: Timer | null = null;
  private revealTimer: Timer | null = null;
  private perspective: number = PREVIEW_PLAYERS[0];
  readonly answers = new Map<number, string>();
  readonly choices = new Map<number, number>();
  readonly stakes = new Map<number, number>();
  readonly question: Question;
  readonly secretRoundPrices: { min: number; max: number };
  constructor(
    initial: GameSession,
    question: Question,
    private readonly credits: { authors: string[]; sources: string[] } = {
      authors: [],
      sources: [],
    },
    roundNominalPrices?: number[],
    readonly finalRoundPrices?: { min: number; max: number },
  ) {
    const nominal = (
      roundNominalPrices ?? [
        ...(initial.state.currentRound?.themes.flatMap((t) => t.questions.map((q) => q.price)) ??
          []),
        question.price,
      ]
    ).filter(
      (price): price is number => price != null && price >= 0 && Number.isSafeInteger(price),
    );
    this.secretRoundPrices = { min: Math.min(...nominal), max: Math.max(...nominal) };
    this.question = { ...question };
    this.state = initial;
    this.script = new PreviewScript(this);
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
    if (this.state.state.scriptView) return this.state.state.timer;
    const opening = this.state.state.questionTransition;
    if (
      opening &&
      (opening.mediaReady ||
        timerElapsed(opening.timer, this.state.state.isPaused) < opening.timer.durationMs)
    )
      return opening.timer;
    return phaseOf(this.state) === "reveal"
      ? (this.revealTimer ?? this.state.state.timer)
      : this.state.state.timer;
  }
  setPerspective(id: number) {
    if (this.disposed) return;
    this.perspective = id;
    this.publish();
  }
  dispatch(event: ServerEvent) {
    if (this.disposed) return;
    this.state = reduce(this.state, event);
    this.publish(event);
  }
  private publish(event?: ServerEvent) {
    this.store
      .getState()
      .setSession(
        previewView(this.state, this.perspective, this.script.viewFor(this.perspective)),
        event,
      );
  }
  command(command: PreviewCommand, sender = this.perspective) {
    if (this.disposed) return;
    if (this.state.state.isPaused && command.type !== "game-unpause") return;
    if (command.type === "game-pause" || command.type === "game-unpause") {
      this.pause(command.type === "game-pause");
      return;
    }
    if (this.script.handle(command, sender)) return;
    if (handleFinal(this, command, sender)) {
      if (this.question.script && this.state.state.finalRoundData?.phase === "bidding")
        this.script.start();
      return;
    }
    if (handleSpecial(this, command, sender)) return;
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
    if (this.script.start() || startSpecial(this)) return;
    this.showQuestion();
  }
  showQuestion() {
    const { duration, opensAt, plan } = this.questionTiming();
    const direct =
      this.state.state.stakeQuestionData?.winnerPlayerId != null ||
      (this.state.state.secretQuestionData != null && this.state.state.answeringPlayer != null);
    const gated = !direct && this.question.type !== "secret" && this.question.type !== "stake";
    const hasMedia = questionMediaFiles(this.question).length > 0;
    this.dispatch({
      type: "question-data",
      payload: {
        data: this.question,
        contentPlan: plan,
        questionState: direct ? (hasMedia ? "media_downloading" : "answering") : undefined,
        timer: gated && !hasMedia ? null : previewTimer(direct && !hasMedia ? duration : 30_000),
        questionTransition: gated
          ? {
              timer: previewTimer(QUESTION_TRANSITION_MS),
              mediaReady: !hasMedia,
            }
          : null,
        buzzerOpensAtMs: opensAt,
        questionEligiblePlayers:
          this.question.type === "noRisk" && this.question.subType !== "forEveryone"
            ? [PREVIEW_PLAYERS[0]]
            : null,
      },
    });
  }
  ready() {
    if (this.script.ready()) return;
    const plan = buildContentPlan({
      text: this.question.text,
      answerDurationMs: this.question.answerDurationMs,
      textOrder: this.question.textOrder,
      textItems: this.question.textItems,
      textDurationMs: this.question.textDurationMs,
      textWaitForFinish: this.question.textWaitForFinish,
      playMediaSimultaneously: this.question.playMediaSimultaneously,
      files: this.question.questionFiles,
    });
    const { duration, opensAt } = this.questionTiming();
    const opening = this.state.state.questionTransition;
    if (opening) {
      const elapsed = timerElapsed(opening.timer, this.state.state.isPaused);
      const next = {
        ...opening,
        mediaReady: true,
        timer: {
          ...opening.timer,
          durationMs: opening.mediaReady
            ? opening.timer.durationMs
            : Math.max(opening.timer.durationMs, elapsed + QUESTION_PICK_TIMING.fadeOut),
        },
      };
      if (this.state.state.isPaused || elapsed < next.timer.durationMs) {
        this.dispatch({
          type: "media-download-status",
          payload: {
            playerId: PREVIEW_PLAYERS[0],
            mediaDownloaded: true,
            allPlayersReady: true,
            timer: null,
            questionTransition: next,
            contentPlan: plan,
          },
        });
        return;
      }
    }
    this.dispatch({
      type: "media-download-status",
      payload: {
        playerId: PREVIEW_PLAYERS[0],
        mediaDownloaded: true,
        allPlayersReady: true,
        timer: previewTimer(
          duration,
          0,
          opening ? QUESTION_CONTENT_START_LEAD_MS : MEDIA_PLAYBACK_START_DELAY_MS,
        ),
        questionTransition: null,
        contentPlan: plan,
        buzzerOpensAtMs: opensAt,
      },
    });
  }
  private questionTiming() {
    const q = this.question;
    const plan = buildContentPlan({
      text: q.text,
      answerDurationMs: q.answerDurationMs,
      textOrder: q.textOrder,
      textItems: q.textItems,
      textDurationMs: q.textDurationMs,
      textWaitForFinish: q.textWaitForFinish,
      playMediaSimultaneously: q.playMediaSimultaneously,
      files: q.questionFiles,
    });
    const content = plan?.totalMs ?? 0;
    const caption =
      q.text?.trim() && q.textOrder == null ? (q.textDurationMs ?? textDuration(q.text.trim())) : 0;
    const opensAt =
      this.state.settings?.falseStart ||
      (answerFormat(q) === "select" &&
        (this.state.state.allPlay || ["stake", "secret", "noRisk"].includes(q.type)))
        ? Math.max(content, caption) +
          (answerFormat(q) === "select" ? Math.max(0, q.showDelay ?? 0) : 0)
        : 0;
    const answerMs = this.state.state.allPlay ? 45_000 : 20_500;
    return {
      plan,
      opensAt,
      duration: Math.max(content, opensAt) + answerWindowDuration(q, answerMs),
    };
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
    if (
      !canAnswerNow(this.state, this.state.state.answeringPlayer ?? -1) ||
      this.state.submittedAnswer != null ||
      !answer.trim()
    )
      return;
    const selection = previewChoiceSelection(this.question, answer, order);
    if (!selection) return;
    const choiceOrder = selection.choiceOrder;
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
    const result = checkPreviewAnswer(this.question, answer, choiceOrder ?? null, order != null);
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
    const correctChoices =
      answerFormat(this.question) === "select" && this.question.correctChoiceOrder != null
        ? (this.question.answers ?? []).filter(
            (option) => option.order === this.question.correctChoiceOrder,
          )
        : [];
    const correctChoice = correctChoices.length === 1 ? correctChoices[0] : undefined;
    const files = this.question.answerFiles?.map((file) => ({
      ...file,
      displayTime:
        file.displayTime ??
        (file.file.type === "audio" ? 10_000 : file.file.type === "video" ? 15_000 : 5000),
    }));
    const answerContentPlan = buildAnswerContentPlan({
      files,
      textItems: this.question.answerTextItems,
      playMediaSimultaneously: this.question.playMediaSimultaneously,
    });
    this.revealTimer = previewTimer(
      answerContentPlan
        ? answerContentPlan.totalMs + 5000
        : this.question.showAnswerDuration || 5000,
    );
    this.dispatch({
      type: "question-finish",
      payload: {
        answerText: this.question.answerText ?? null,
        answerFiles: this.question.answerFiles ?? null,
        correctChoice: correctChoice ?? null,
        answerTextItems: this.question.answerTextItems ?? null,
        answerExplanation: this.question.answerExplanation ?? null,
        correctChoiceImage:
          !this.question.answerFiles?.length &&
          !correctChoice?.text?.trim() &&
          correctChoice?.file?.type === "image"
            ? (correctChoice.file.link ?? null)
            : null,
        rightAnswers:
          this.question.answerType === "select" ? null : (this.question.rightAnswers ?? null),
        answerPoint: this.question.answerPoint ?? null,
        answerDeviation: this.question.answerDeviation ?? null,
        answerContentPlan,
        ...(answerContentPlan || (this.state.state.currentRound?.type === "final" && correctChoice)
          ? { timer: this.revealTimer }
          : {}),
        authors: this.credits.authors,
        sources: this.credits.sources,
        nextTurnPlayerId: id,
      },
    });
  }
  award(data: SecretQuestionAward) {
    this.revealTimer = previewTimer(this.question.showAnswerDuration ?? 5000);
    this.dispatch({
      type: "secret-question-awarded",
      payload: { ...data, timer: this.revealTimer },
    });
  }
  pause(paused: boolean) {
    if (this.disposed || this.state.finished) return;
    const timer = phaseOf(this.state) === "reveal" ? this.revealTimer : this.state.state.timer;
    const elapsed = timer ? timerElapsed(timer, this.state.state.isPaused) : 0;
    const delay = timerStartDelay(timer, this.state.state.pausedAt ?? serverNow());
    const next = timer ? previewTimer(timer.durationMs, elapsed, delay) : null;
    if (phaseOf(this.state) === "reveal") this.revealTimer = next;
    this.dispatch({
      type: paused ? "game-pause" : "game-unpause",
      payload: {
        timer: next,
        questionTransition: this.state.state.questionTransition
          ? {
              ...this.state.state.questionTransition,
              timer: previewTimer(
                this.state.state.questionTransition.timer.durationMs,
                timerElapsed(this.state.state.questionTransition.timer, this.state.state.isPaused),
              ),
            }
          : null,
      },
    });
  }
  setClock(timer: Timer) {
    this.dispatch({ type: "game-unpause", payload: { timer } });
  }
  timeout() {
    if (this.disposed || this.state.state.isPaused) return;
    if (this.script.timeout() || timeoutFinal(this) || timeoutSpecial(this)) return;
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
    if (this.state.state.currentRound?.type !== "final") {
      this.dispatch({ type: "answer-show-end", payload: {} });
    }
    this.dispatch({ type: "game-finished", payload: {} });
  }
  advanceWait(): boolean {
    const timer = this.state.state.timer;
    if (!timer || this.state.state.isPaused) return false;
    const elapsed = timerElapsed(timer, false);
    const content = presentedQuestionContent(
      this.state,
      this.store.getState().questionPresentation,
    );
    const localElapsed = content ? contentElapsed(content, false) : elapsed;
    const localStep =
      content?.kind === "question" ? nextChangeAt(content.plan, localElapsed) : null;
    const nextStep = localStep == null ? null : elapsed + localStep - localElapsed;
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
    if (this.script.running) {
      this.script.timeout();
      return;
    }
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
