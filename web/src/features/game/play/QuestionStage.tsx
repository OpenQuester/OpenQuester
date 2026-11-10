import { questionStyles, questionContentLayout, questionText } from "./question/questionStyles";
import { useTranslation } from "react-i18next";
import { formatScore } from "@/lib/format";
import { QuestionTypeBadge } from "./question/QuestionTypeBadge";
import { ContentStage } from "./ContentStage";
import { AnswerReveal } from "./question/AnswerReveal";
import { AnswerChoices } from "./question/AnswerChoices";
import { PointAnswer } from "./question/PointAnswer";
import { MediaWait } from "./question/QuestionStatus";
import { ShowmanPanel } from "./question/ShowmanPanel";
import { QuestionBody } from "./question/QuestionBody";
import { useQuestionStage } from "./question/useQuestionStage";
import { pointImage } from "@/lib/pointImage";
import type { ReactNode } from "react";
import { buildContentPlan } from "@/game/contentPlan";
import { ChoiceLayout } from "./question/ChoiceLayout";

/** Question content, the reveal, and the showman's private answer panel. */
export function QuestionStage() {
  const { t } = useTranslation();
  const stage = useQuestionStage();
  const { q, meta, role, reveal, price } = stage;

  return (
    <div className={questionStyles.layout}>
      <section className={questionStyles.content} aria-label={t("question.region")}>
        <div className={`question-heading ${questionStyles.heading}`}>
          {meta && <span className="font-semibold text-soft">{meta.theme.name}</span>}
          {price != null && (
            <span className="font-mono font-bold text-accent-strong">{formatScore(price)}</span>
          )}
          {q && <QuestionTypeBadge type={q.type} />}
        </div>

        <QuestionContent stage={stage} />
      </section>
      {role === "showman" && !reveal && <ShowmanPanel />}
    </div>
  );
}

/** Keep the question timeline and answer controls under one stable boundary. */
function QuestionContent({ stage }: { stage: ReturnType<typeof useQuestionStage> }) {
  const { q, s, gated, reveal } = stage;
  if (gated) return <MediaWait />;
  if (reveal) return <AnswerReveal />;
  const wrapBody =
    q?.type === "choice" && q.answers
      ? (body: ReactNode) => (
          <ChoiceLayout prompt={body} count={q.answers!.length}>
            <AnswerChoices key={`${q.id}:${s.answeringPlayer ?? "open"}`} />
          </ChoiceLayout>
        )
      : undefined;
  return (
    <div className={questionContentLayout} key={q?.id ?? "q"}>
      <QuestionPrompt stage={stage} wrapBody={wrapBody} />
    </div>
  );
}

type QuestionPromptProps = {
  stage: ReturnType<typeof useQuestionStage>;
  wrapBody?: (body: ReactNode) => ReactNode;
};

function QuestionPrompt({ stage, wrapBody }: QuestionPromptProps) {
  const { t } = useTranslation();
  const { q, phase, role } = stage;
  const isEmpty = !q?.text && !q?.textItems?.length && !q?.questionFiles?.length;
  return (
    <>
      <QuestionPromptMedia stage={stage} wrapBody={wrapBody} />
      {isEmpty && (
        <p className="m-0 text-muted">
          {t(!q && phase === "answering" ? "dock.answering.questionLoading" : "question.noContent")}
        </p>
      )}
      {phase === "media" && role === "showman" && !stage.s.questionTransition?.mediaReady && (
        <p className={questionStyles.waiting}>{t("question.showmanPreview")}</p>
      )}
    </>
  );
}

function QuestionPromptMedia({ stage, wrapBody }: QuestionPromptProps) {
  const { myId, s, q, content, showmanPreview, textIsStep, picture, picking, phase } = stage;
  const files = q?.questionFiles ?? [];
  const selectedPoint = picking ? pointImage(files, q?.pointImageOrder) : null;
  const fallback =
    q && !content && (showmanPreview || phase === "showing")
      ? buildContentPlan({
          text: q.text,
          textOrder: q.textOrder,
          textItems: q.textItems,
          files,
          playMediaSimultaneously: q.playMediaSimultaneously,
        })
      : null;
  const clock = fallback
    ? {
        kind: "question" as const,
        plan: fallback,
        timer: showmanPreview ? null : s.timer,
        frozenAtMs: showmanPreview ? 0 : null,
      }
    : content;
  const showCaption = !!q?.text && !(fallback ? q.textOrder != null : textIsStep);
  const caption = showCaption ? (
    <p className={questionText} data-testid="question-text">
      {q?.text}
    </p>
  ) : undefined;
  if (clock?.kind === "question") {
    return (
      <ContentStage
        content={clock}
        files={files}
        text={q?.text}
        textOrder={q?.textOrder}
        textItems={q?.textItems}
        paused={s.isPaused}
        caption={caption}
        captionLength={showCaption ? q?.text?.length : 0}
        wrapBody={wrapBody}
        pointAnswer={
          selectedPoint && picture
            ? { file: selectedPoint, view: <PointAnswer key={myId} src={picture} /> }
            : undefined
        }
      />
    );
  }
  const body = (
    <QuestionBody
      media={picking && picture ? <PointAnswer key={myId} src={picture} /> : undefined}
      text={caption}
      textLength={q?.text?.length}
    />
  );
  return wrapBody ? wrapBody(body) : body;
}
