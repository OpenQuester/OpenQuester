import { questionStyles, questionContentLayout, questionText } from "./question/questionStyles";
import { useTranslation } from "react-i18next";
import { formatScore } from "@/lib/format";
import { Badge } from "@/ui/Badge";
import { ContentStage } from "./ContentStage";
import { QuestionMedia } from "./QuestionMedia";
import { AnswerReveal } from "./question/AnswerReveal";
import { AnswerChoices } from "./question/AnswerChoices";
import { PointAnswer } from "./question/PointAnswer";
import { MediaWait } from "./question/QuestionStatus";
import { ShowmanPanel } from "./question/ShowmanPanel";
import { QuestionBody } from "./question/QuestionBody";
import { useQuestionStage } from "./question/useQuestionStage";
import { pointImage } from "@/lib/pointImage";
import { ChoiceLayout } from "./question/ChoiceLayout";

/** Question content, the reveal, and the showman's private answer panel. */
export function QuestionStage() {
  const { t } = useTranslation();
  const stage = useQuestionStage();
  const { q, meta, role, reveal, price } = stage;

  return (
    <div className={questionStyles.layout}>
      <section className={questionStyles.content} aria-label={t("question.region")}>
        <div className={questionStyles.heading}>
          {meta && <span className="font-semibold text-soft">{meta.theme.name}</span>}
          {price != null && (
            <span className="font-mono font-bold text-accent-strong">{formatScore(price)}</span>
          )}
          {q && q.type !== "simple" && <Badge tone="info">{t(`questionTypes.${q.type}`)}</Badge>}
          {q?.type === "noRisk" && <span className="text-sm">{t("question.noRiskHelp")}</span>}
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
  const prompt = <QuestionPrompt stage={stage} />;
  return (
    <div className={questionContentLayout} key={q?.id ?? "q"}>
      {q?.type === "choice" && q.answers ? (
        <ChoiceLayout prompt={prompt} count={q.answers.length}>
          <AnswerChoices key={`${q.id}:${s.answeringPlayer ?? "open"}`} />
        </ChoiceLayout>
      ) : (
        prompt
      )}
    </div>
  );
}

function QuestionPrompt({ stage }: { stage: ReturnType<typeof useQuestionStage> }) {
  const { t } = useTranslation();
  const { q, phase, role } = stage;
  const isEmpty = !q?.text && !q?.textItems?.length && !q?.questionFiles?.length;
  return (
    <>
      <QuestionPromptMedia stage={stage} />
      {isEmpty && (
        <p className="m-0 text-muted">
          {t(!q && phase === "answering" ? "dock.answering.questionLoading" : "question.noContent")}
        </p>
      )}
      {phase === "media" && role === "showman" && (
        <p className={questionStyles.waiting}>{t("question.showmanPreview")}</p>
      )}
    </>
  );
}

function QuestionPromptMedia({ stage }: { stage: ReturnType<typeof useQuestionStage> }) {
  const { myId, s, q, content, showmanPreview, textIsStep, picture, picking } = stage;
  const files = q?.questionFiles ?? [];
  const selectedPoint = picking ? pointImage(q?.questionFiles, q?.pointImageOrder) : null;
  const showCaption = !!q?.text && (showmanPreview || !textIsStep);
  const caption = showCaption ? (
    <p className={questionText} data-testid="question-text">
      {q?.text}
    </p>
  ) : undefined;
  if (!showmanPreview && content) {
    if (content.kind !== "question") return null;
    return (
      <ContentStage
        content={content}
        files={files}
        text={q?.text}
        textOrder={q?.textOrder}
        textItems={q?.textItems}
        paused={s.isPaused}
        caption={caption}
        captionLength={showCaption ? q?.text?.length : 0}
        pointAnswer={
          selectedPoint && picture
            ? {
                order: selectedPoint.order,
                view: <PointAnswer key={myId} src={picture} />,
              }
            : undefined
        }
      />
    );
  }
  return (
    <QuestionBody
      media={files.length > 0 ? <LegacyQuestionMedia stage={stage} /> : undefined}
      text={caption}
      textLength={q?.text?.length}
    />
  );
}

function LegacyQuestionMedia({ stage }: { stage: ReturnType<typeof useQuestionStage> }) {
  const { picking, picture, showmanPreview, myId, q, playing } = stage;
  if (picking && picture && !showmanPreview) return <PointAnswer key={myId} src={picture} />;
  return <QuestionMedia files={q?.questionFiles ?? []} playing={!showmanPreview && playing} />;
}
