import { cn } from "@/lib/cn";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { timerElapsed } from "@/game/contentPlan";
import type { GameSession } from "@/game/reducer";
import {
  canAnswerNow,
  pointPicture,
  boardQuestionMeta,
  findPlayer,
  myRole,
  phaseOf,
  seatedPlayers,
} from "@/game/selectors";
import { formatScore, formatSigned } from "@/lib/format";
import { Badge } from "@/ui/Badge";

import { useGame, useSession } from "../GameContext";
import { ContentStage } from "./ContentStage";
import { PointPicker, pointAnswer, type Spot } from "./PointPicker";
import { QuestionMedia } from "./QuestionMedia";

/** Question content, the reveal, and (for the showman) the private answer panel. */
export function QuestionStage() {
  const { t } = useTranslation();
  const session = useSession();
  const { myId } = useGame();
  const s = session.state;
  const phase = phaseOf(session);
  const role = myRole(session, myId);
  const q = s.currentQuestion;
  const meta = boardQuestionMeta(
    session,
    q?.id ?? s.stakeQuestionData?.questionId ?? s.secretQuestionData?.questionId,
  );
  const reveal = phase === "reveal";
  const gated = phase === "media" && role !== "showman";
  const playing = phase === "showing" && !s.isPaused;
  const content = session.content;
  const showmanPreview = phase === "media" && role === "showman";
  // A sequenced text appears in its own step instead of under the media.
  const textIsStep =
    content?.kind === "question" &&
    content.plan.steps.some((st) => st.items.some((i) => i.kind === "text"));
  const price = s.stakeQuestionData?.highestBid ?? q?.price ?? meta?.question.price ?? null;
  // Point answers: the player who answers now clicks the spot on the picture.
  const picture = pointPicture(q);
  const picking = !!picture && canAnswerNow(session, myId);

  return (
    <div className="flex flex-1 flex-col gap-5 lg:flex-row lg:items-start">
      <section
        className="flex min-w-0 flex-1 flex-col items-center gap-5"
        aria-label={t("question.region")}
      >
        <div className="flex w-full flex-wrap items-center justify-center gap-2 text-muted 3xl:text-xl">
          {meta && <span className="font-semibold text-soft">{meta.theme.name}</span>}
          {price != null && (
            <span className="font-mono font-bold text-accent-strong">{formatScore(price)}</span>
          )}
          {q && q.type !== "simple" && <Badge tone="info">{t(`questionTypes.${q.type}`)}</Badge>}
          {q?.type === "noRisk" && <span className="text-sm">{t("question.noRiskHelp")}</span>}
        </div>

        {gated ? (
          <MediaWait />
        ) : reveal ? (
          <AnswerReveal />
        ) : (
          <div
            className="flex w-full max-w-[920px] flex-col items-center gap-5 oq-pop 3xl:max-w-[1280px] 4xl:max-w-[1600px]"
            key={q?.id ?? "q"}
          >
            {picking ? (
              <PointAnswer src={picture!} />
            ) : showmanPreview ? (
              <QuestionMedia files={q?.questionFiles ?? []} playing={false} />
            ) : (
              content?.kind === "question" && (
                <ContentStage
                  content={content}
                  files={q?.questionFiles ?? []}
                  text={q?.text}
                  paused={s.isPaused}
                />
              )
            )}
            {/* Fallback (no timeline), the showman's preview, or a caption next to the media. */}
            {!content && !showmanPreview && q?.questionFiles && q.questionFiles.length > 0 && (
              <QuestionMedia files={q.questionFiles} playing={playing} />
            )}
            {q?.text && (showmanPreview || !textIsStep) && (
              <p
                className="m-0 text-center font-display text-[clamp(22px,3.4vw,38px)] font-semibold 3xl:text-[clamp(40px,2.4vw,64px)] leading-tight [overflow-wrap:anywhere]"
                data-testid="question-text"
              >
                {q.text}
              </p>
            )}
            {!q?.text && (!q?.questionFiles || q.questionFiles.length === 0) && (
              <p className="m-0 text-muted">{t("question.noContent")}</p>
            )}
            {q?.type === "choice" && q.answers && (
              <ChoiceOptions key={`${q.id}:${s.answeringPlayer ?? "open"}`} />
            )}
            {phase === "media" && role === "showman" && (
              <p className="m-0 rounded-sm bg-surface-2 px-3 py-2 text-sm text-muted">
                {t("question.showmanPreview")}
              </p>
            )}
          </div>
        )}
      </section>
      {role === "showman" && !reveal && <ShowmanPanel />}
    </div>
  );
}

/** The answering player clicks a spot; it is sent as their answer. */
function PointAnswer({ src }: { src: string }) {
  const { t } = useTranslation();
  const session = useSession();
  const { connection } = useGame();
  const [picked, setPicked] = useState<Spot | null>(null);
  const event = phaseOf(session) === "all_play_answering" ? "all-play-answer" : "answer-submitted";
  return (
    <div className="flex flex-col items-center gap-3">
      <p className="m-0 font-semibold text-accent-strong">{t("point.prompt")}</p>
      <PointPicker
        src={src}
        picked={picked}
        onPick={(spot) => {
          if (picked) return;
          setPicked(spot);
          connection.emit(event, { answerText: pointAnswer(spot) });
        }}
      />
    </div>
  );
}

function MediaWait() {
  const { t } = useTranslation();
  const session = useSession();
  const players = seatedPlayers(session).filter((p) => p.status === "in-game");
  const ready = players.filter((p) => p.mediaDownloaded).length;
  return (
    <div className="flex min-h-[240px] w-full max-w-[720px] flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-line-strong p-8 text-center">
      <span className="font-display text-2xl font-extrabold">{t("question.getReady")}</span>
      <span className="text-muted">
        {t("question.mediaReady", { ready, total: players.length })}
      </span>
    </div>
  );
}

/**
 * Milliseconds until a choice question's options appear. With false starts
 * on, the server times them on the question timer just before the buzzer
 * opens (`buzzerOpensAtMs`); otherwise they follow
 * the package's show delay from now.
 */
function optionsShowIn(session: GameSession): number {
  const s = session.state;
  const q = s.currentQuestion;
  const opensAt = s.buzzerOpensAtMs ?? 0;
  if (opensAt > 0 && phaseOf(session) === "showing") {
    const at = opensAt;
    return Math.max(0, at - timerElapsed(s.timer, s.isPaused));
  }
  if (opensAt > 0) return 0;
  return Math.max(0, q?.showDelay ?? 0);
}

function ChoiceOptions() {
  const { t } = useTranslation();
  const session = useSession();
  const { connection, myId } = useGame();
  const s = session.state;
  const q = s.currentQuestion!;
  const role = myRole(session, myId);
  const answering = s.answeringPlayer === myId && phaseOf(session) === "answering";
  const [visible, setVisible] = useState(() => optionsShowIn(session) <= 0);
  const [picked, setPicked] = useState<number | null>(null);

  useEffect(() => {
    if (visible) return;
    const id = window.setTimeout(() => setVisible(true), optionsShowIn(session));
    return () => window.clearTimeout(id);
  }, [visible, session]);

  if (!visible) return <p className="m-0 text-muted">{t("question.optionsSoon")}</p>;
  const answers = [...(q.answers ?? [])].sort((a, b) => a.order - b.order);
  const correct = role === "showman" ? q.answerText?.trim().toLowerCase() : undefined;

  return (
    <ol
      className="m-0 grid w-full max-w-[820px] list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2"
      aria-label={t("question.options")}
    >
      {answers.map((a, i) => {
        const text = a.text ?? "";
        const isCorrect = correct != null && text.trim().toLowerCase() === correct;
        return (
          <li key={a.id ?? i}>
            <button
              type="button"
              disabled={!answering || picked != null}
              data-option={i + 1}
              onClick={() => {
                setPicked(i);
                connection.emit("answer-submitted", { answerText: text });
              }}
              className={cn(
                "flex min-h-14 w-full items-center gap-3 rounded-md border px-4 py-3 text-left text-lg",
                picked === i
                  ? "border-accent bg-accent-surface"
                  : isCorrect
                    ? "border-success-line bg-success-surface"
                    : "border-line-strong bg-surface-2",
                answering && picked == null ? "hover:border-accent" : "cursor-default",
              )}
            >
              <kbd className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-surface-3 text-sm">
                {i + 1}
              </kbd>
              <span className="[overflow-wrap:anywhere]">{text}</span>
              {a.file?.link && (
                <img src={a.file.link} alt="" className="ml-auto h-12 w-12 rounded object-cover" />
              )}
            </button>
          </li>
        );
      })}
    </ol>
  );
}

/** Showman-only column: the answer, what the player said, and who buzzed. */
function ShowmanPanel() {
  const { t } = useTranslation();
  const session = useSession();
  const s = session.state;
  const q = s.currentQuestion;
  const answering = findPlayer(session, s.answeringPlayer);
  return (
    <aside
      aria-label={t("showman.panel")}
      className="flex w-full shrink-0 flex-col gap-2 rounded-lg border border-accent-line bg-accent-surface p-4 lg:w-[320px] lg:gap-3 lg:p-5 3xl:w-[420px] 3xl:text-lg"
      data-testid="showman-panel"
    >
      <span className="text-xs font-semibold uppercase tracking-wider text-accent-strong">
        {t("showman.onlyYou")}
      </span>
      <div className="flex flex-col gap-1">
        <span className="text-sm text-muted">{t("showman.answer")}</span>
        <span
          className="text-lg font-semibold [overflow-wrap:anywhere] lg:text-xl"
          data-testid="showman-answer"
        >
          {q?.answerText || t("showman.noAnswerText")}
        </span>
        {q?.answerHint && (
          <span className="text-sm text-soft">{t("showman.hint", { hint: q.answerHint })}</span>
        )}
        {q?.answerType === "number" && q.answerNumber != null && (
          <span className="text-sm text-success" data-testid="showman-number">
            {t("showman.number", {
              number: q.answerNumber,
              deviation: q.answerDeviation ? ` ± ${q.answerDeviation}` : "",
            })}
          </span>
        )}
        {q?.answerType === "point" && q.answerPoint && pointPicture(q) && (
          <PointPicker
            src={pointPicture(q)!}
            target={q.answerPoint}
            radius={q.answerDeviation}
            className="max-w-full"
          />
        )}
        {(q?.answerType === "number" || q?.answerType === "point") && (
          <span className="text-xs text-muted">{t("showman.autoChecked")}</span>
        )}
        {!!q?.rightAnswers?.length && (
          <span className="text-sm text-success" data-testid="showman-right-answers">
            {t("showman.alsoRight", { answers: q.rightAnswers.join(" · ") })}
          </span>
        )}
        {!!q?.wrongAnswers?.length && (
          <span className="text-sm text-danger" data-testid="showman-wrong-answers">
            {t("showman.notRight", { answers: q.wrongAnswers.join(" · ") })}
          </span>
        )}
      </div>
      {answering && (
        <div className="flex flex-col gap-1 rounded-md bg-bg/40 p-3">
          <span className="text-sm text-muted">
            {t("showman.answering", { name: answering.meta.username })}
          </span>
          <span className="text-lg [overflow-wrap:anywhere]">
            {session.submittedAnswer ? `“${session.submittedAnswer}”` : t("showman.sayingOutLoud")}
          </span>
        </div>
      )}
      {(s.answeredPlayers ?? []).length > 0 && (
        <div className="flex flex-col gap-1 text-sm">
          <span className="text-muted">{t("showman.alreadyAnswered")}</span>
          {(s.answeredPlayers ?? []).map((a, i) => (
            <span key={i}>
              {findPlayer(session, a.player)?.meta.username} · {formatSigned(a.result)}
            </span>
          ))}
        </div>
      )}
      {q?.questionComment && (
        <details className="text-sm">
          <summary className="cursor-pointer font-semibold">{t("showman.comment")}</summary>
          <p className="mb-0 mt-2 text-soft">{q.questionComment}</p>
        </details>
      )}
    </aside>
  );
}

function AnswerReveal() {
  const { t } = useTranslation();
  const session = useSession();
  const s = session.state;
  const data = s.answerShowData;
  const result = data?.answerResult ?? (s.answeredPlayers ?? []).at(-1) ?? null;
  const winner =
    result && result.answerType === "correct" ? findPlayer(session, result.player) : undefined;
  const answerText = data?.answerText ?? s.currentQuestion?.answerText ?? null;
  return (
    <div
      className="flex w-full max-w-[920px] flex-col items-center gap-5 oq-pop 3xl:max-w-[1280px] 4xl:max-w-[1600px]"
      data-testid="answer-reveal"
    >
      <span className="text-sm font-semibold uppercase tracking-wider text-muted">
        {t("reveal.answer")}
      </span>
      {answerText && (
        <p className="m-0 text-center font-display text-[clamp(26px,4vw,44px)] font-extrabold 3xl:text-[clamp(44px,2.8vw,72px)] leading-tight text-success [overflow-wrap:anywhere]">
          {answerText}
        </p>
      )}
      {data?.answerPoint && pointPicture(s.currentQuestion) && (
        <PointPicker
          src={pointPicture(s.currentQuestion)!}
          target={data.answerPoint}
          radius={data.answerDeviation}
        />
      )}
      {!!data?.rightAnswers?.length && (
        <p className="m-0 text-center text-soft">
          {t("reveal.alsoRight", { answers: data.rightAnswers.join(" · ") })}
        </p>
      )}
      {session.content?.kind === "answer" ? (
        <ContentStage
          content={session.content}
          files={data?.answerFiles ?? []}
          paused={s.isPaused}
        />
      ) : (
        data?.answerFiles &&
        data.answerFiles.length > 0 && <QuestionMedia files={data.answerFiles} playing />
      )}
      <p className="m-0 text-lg text-soft 3xl:text-2xl">
        {winner
          ? t("reveal.gotIt", { name: winner.meta.username, points: formatSigned(result!.result) })
          : t("reveal.nobody")}
      </p>
      {(!!data?.authors?.length || !!data?.sources?.length) && (
        <p className="m-0 text-center text-sm text-muted" data-testid="answer-credits">
          {[
            data?.authors?.length ? t("reveal.authors", { names: data.authors.join(", ") }) : null,
            data?.sources?.length ? t("reveal.sources", { list: data.sources.join(", ") }) : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      )}
      {s.currentQuestion?.questionComment && (
        <p className="m-0 max-w-[60ch] text-center text-muted">
          {s.currentQuestion.questionComment}
        </p>
      )}
    </div>
  );
}
