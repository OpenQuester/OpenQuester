import { questionStyles, questionContentLayout, questionText } from "./question/questionStyles";
import { useTranslation } from "react-i18next";
import { formatScore } from "@/lib/format";
import { Badge } from "@/ui/Badge";
import { ContentStage } from "./ContentStage";
import { QuestionMedia } from "./QuestionMedia";
import { AnswerReveal } from "./question/AnswerReveal";
import { AnswerChoices } from "./question/AnswerChoices";
import { PointAnswer } from "./question/PointAnswer";
import { BuzzerCue, MediaWait } from "./question/QuestionStatus";
import { ShowmanPanel } from "./question/ShowmanPanel";
import { ShowmanInstruction } from "./question/ShowmanInstruction";
import { useQuestionStage } from "./question/useQuestionStage";
import { pointImage } from "@/lib/pointImage";

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

        {role === "showman" && !reveal && <ShowmanInstruction comment={q?.questionComment} />}
        <QuestionContent stage={stage} />
      </section>
      {role === "showman" && !reveal && <ShowmanPanel />}
    </div>
  );
}

/** Keep the question timeline and answer controls under one stable boundary. */
function QuestionContent({ stage }: { stage: ReturnType<typeof useQuestionStage> }) {
  const { t } = useTranslation();
  const {
    myId,
    s,
    phase,
    role,
    q,
    reveal,
    gated,
    playing,
    content,
    showmanPreview,
    textIsStep,
    picture,
    picking,
    cue,
  } = stage;
  if (gated) return <MediaWait />;
  if (reveal) return <AnswerReveal />;

  const files = q?.questionFiles ?? [];
  const selectedPoint = picking ? pointImage(q?.questionFiles, q?.pointImageOrder) : null;
  const showFallbackMedia = !content && !showmanPreview && files.length > 0;
  const showCaption = !!q?.text && (showmanPreview || !textIsStep);
  const isEmpty = !q?.text && !q?.textItems?.length && files.length === 0;

  return (
    <div className={questionContentLayout} key={q?.id ?? "q"}>
      {showmanPreview ? (
        <QuestionMedia files={files} playing={false} />
      ) : (
        content?.kind === "question" && (
          <ContentStage
            content={content}
            files={files}
            text={q?.text}
            textOrder={q?.textOrder}
            textItems={q?.textItems}
            paused={s.isPaused}
            pointAnswer={
              selectedPoint && picture
                ? {
                    order: selectedPoint.order,
                    view: <PointAnswer key={myId} src={picture} />,
                  }
                : undefined
            }
          />
        )
      )}
      {/* Fallback (no timeline), the showman's preview, or a caption next to the media. */}
      {showFallbackMedia &&
        (picking && picture ? (
          <PointAnswer key={myId} src={picture} />
        ) : (
          <QuestionMedia files={files} playing={playing} />
        ))}
      {showCaption && (
        <p className={questionText} data-testid="question-text">
          {q?.text}
        </p>
      )}
      {isEmpty && (
        <p className="m-0 text-muted">
          {t(!q && phase === "answering" ? "dock.answering.questionLoading" : "question.noContent")}
        </p>
      )}
      {cue && <BuzzerCue />}
      {q?.type === "choice" && q.answers && (
        <AnswerChoices key={`${q.id}:${s.answeringPlayer ?? "open"}`} />
      )}
      {phase === "media" && role === "showman" && (
        <p className={questionStyles.waiting}>{t("question.showmanPreview")}</p>
      )}
    </div>
  );
}
