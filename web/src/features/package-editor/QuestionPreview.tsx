import { packageEditorStyles } from "./packageEditorStyles";
import { layoutStyles } from "@/ui/layoutStyles";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { Badge } from "@/ui/Badge";
import type { DraftQuestion } from "./packageDraft";
import { MediaIcon, AttachmentPreview } from "./AttachmentPreview";
import { questionTypeDetail } from "./questionPresentation";
import { useMediaFile } from "./packageEditorStore";
import { numericAnswerText } from "./numericAnswer";
import { correctChoice } from "./choiceCorrectness";

/** Everything a question shows, read-only: used in the inspector and full previews. */
export function QuestionPreview({
  question: q,
  final,
}: {
  question: DraftQuestion;
  final?: boolean;
}) {
  const image = q.questionFiles.find((file) => file.type === "image");
  return <QuestionPreviewContent key={`${q.id}:${image?.md5 ?? ""}`} question={q} final={final} />;
}

function QuestionPreviewContent({
  question: q,
  final,
}: {
  question: DraftQuestion;
  final?: boolean;
}) {
  const { t } = useTranslation();
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pinned, setPinned] = useState(false);
  const type = final ? "simple" : q.type;
  const detail = final ? "" : questionTypeDetail(q, t);
  const pointAnswer = type !== "choice" && q.answerType === "point";
  const numberAnswer = type !== "choice" && q.answerType === "number";
  const numberText = numberAnswer ? numericAnswerText(q.answerNumber) : null;
  const selectedChoice = type === "choice" ? correctChoice(q) : undefined;
  const imageIndex = q.questionFiles.findIndex((file) => file.type === "image");
  const image = q.questionFiles[imageIndex];
  const imageFile = useMediaFile(pointAnswer ? image?.md5 : undefined);
  const target = q.answerPoint;
  const validTarget =
    target &&
    [target.x, target.y].every((value) => Number.isFinite(value) && value >= 0 && value <= 1);
  const canShowPoint = pointAnswer && image && imageFile && validTarget;
  const showPoint = canShowPoint && (hovered || focused || pinned);
  return (
    <div className="flex flex-col gap-4">
      <div className={layoutStyles.actions}>
        {!final && (
          <span className="font-display text-xl font-extrabold text-accent">{q.price ?? "—"}</span>
        )}
        {type !== "simple" && <Badge tone="accent">{t(`questionTypes.${type}`)}</Badge>}
      </div>
      {q.text.trim() ? (
        <p className={cn(packageEditorStyles.questionPreviewText, "text-lg")}>{q.text}</p>
      ) : q.questionFiles.length === 0 ? (
        <p className="m-0 text-sm text-danger">{t("editor.preview.noQuestion")}</p>
      ) : null}
      {q.questionFiles.length > 0 && (
        <div className="flex flex-col gap-2">
          {q.questionFiles.map((m, i) => (
            <AttachmentPreview
              key={`${m.md5}-${i}`}
              media={m}
              className="max-h-64 w-full"
              point={
                pointAnswer && i === imageIndex
                  ? { target: showPoint ? target : null, radius: q.answerDeviation }
                  : undefined
              }
            />
          ))}
        </div>
      )}
      {type === "choice" && q.options.length > 0 && (
        <ol className={packageEditorStyles.previewChoices}>
          {q.options.map((o, i) => {
            const correct = o.id === selectedChoice?.id;
            return (
              <li
                key={o.id}
                className={cn(
                  packageEditorStyles.previewChoice,
                  correct
                    ? "border-success-line bg-success-surface text-success"
                    : "border-line bg-surface-2",
                )}
              >
                <span className="font-semibold text-muted">{String.fromCharCode(65 + i)}</span>
                {o.text || (o.file ? <MediaIcon type={o.file.type} /> : "—")}
              </li>
            );
          })}
        </ol>
      )}
      <div className={packageEditorStyles.previewAnswer}>
        <span className="text-xs font-bold tracking-wider text-success uppercase">
          {t("editor.preview.answer")}
        </span>
        {pointAnswer ? (
          canShowPoint && target ? (
            <button
              type="button"
              className="self-start rounded-sm text-left font-semibold underline decoration-dotted underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              aria-pressed={pinned}
              onMouseEnter={() => setHovered(true)}
              onMouseLeave={() => setHovered(false)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onClick={() => {
                setPinned(!pinned);
                if (pinned) {
                  setHovered(false);
                  setFocused(false);
                }
              }}
            >
              {t("editor.preview.pointAnswer", {
                x: Math.round(target.x * 1000) / 10,
                y: Math.round(target.y * 1000) / 10,
              })}
            </button>
          ) : (
            <span className="text-sm text-warning">{t("editor.preview.pointUnavailable")}</span>
          )
        ) : numberAnswer ? (
          numberText != null ? (
            <span className="font-semibold">{numberText}</span>
          ) : (
            <span className="text-sm text-warning">{t("editor.form.answerNumberMissing")}</span>
          )
        ) : q.answerText.trim() ? (
          <span className="font-semibold whitespace-pre-wrap [overflow-wrap:anywhere]">
            {q.answerText}
          </span>
        ) : selectedChoice?.file ? (
          <span className="font-semibold">{t("editor.preview.mediaOnly")}</span>
        ) : q.answerFiles.length === 0 ? (
          <span className="text-sm text-warning">{t("editor.preview.noAnswer")}</span>
        ) : null}
        {q.answerFiles.map((m, i) => (
          <AttachmentPreview key={`${m.md5}-${i}`} media={m} className="max-h-40 w-full" />
        ))}
      </div>
      {(q.answerHint.trim() || q.questionComment.trim() || detail) && (
        <dl className={packageEditorStyles.previewDetails}>
          {detail && (
            <>
              <dt className="text-faint">{t(`questionTypes.${q.type}`)}</dt>
              <dd className="m-0">{detail}</dd>
            </>
          )}
          {q.answerHint.trim() && (
            <>
              <dt className="text-faint">{t("editor.preview.hint")}</dt>
              <dd className="m-0 [overflow-wrap:anywhere]">{q.answerHint}</dd>
            </>
          )}
          {q.questionComment.trim() && (
            <>
              <dt className="text-faint">{t("editor.preview.comment")}</dt>
              <dd className="m-0 [overflow-wrap:anywhere]">{q.questionComment}</dd>
            </>
          )}
        </dl>
      )}
    </div>
  );
}
