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
import { useQuestionStage } from "./question/useQuestionStage";

/** Question content, the reveal, and the showman's private answer panel. */
export function QuestionStage() {
  const { t } = useTranslation();
  const {
    s,
    phase,
    role,
    q,
    meta,
    reveal,
    gated,
    playing,
    content,
    showmanPreview,
    textIsStep,
    price,
    picture,
    picking,
    cue,
  } = useQuestionStage();

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

        {gated ? (
          <MediaWait />
        ) : reveal ? (
          <AnswerReveal />
        ) : (
          <div className={questionContentLayout} key={q?.id ?? "q"}>
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
              <p className={questionText} data-testid="question-text">
                {q.text}
              </p>
            )}
            {!q?.text && (!q?.questionFiles || q.questionFiles.length === 0) && (
              <p className="m-0 text-muted">{t("question.noContent")}</p>
            )}
            {cue && <BuzzerCue />}
            {q?.type === "choice" && q.answers && (
              <AnswerChoices key={`${q.id}:${s.answeringPlayer ?? "open"}`} />
            )}
            {phase === "media" && role === "showman" && (
              <p className={questionStyles.waiting}>{t("question.showmanPreview")}</p>
            )}
          </div>
        )}
      </section>
      {role === "showman" && !reveal && <ShowmanPanel />}
    </div>
  );
}
