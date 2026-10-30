import { questionStyles, questionText } from "./question/questionStyles";
import { useTranslation } from "react-i18next";

import type { QuestionFile } from "@/game/protocol";
import type { ContentClock } from "@/game/reducer";
import { isMainTextItem } from "@/game/contentPlan";
import { cn } from "@/lib/cn";

import { QuestionMediaItem } from "./media/QuestionMediaItem";
import { useContentPosition } from "./media/useContentPosition";
import type { ReactNode } from "react";
import { QuestionBody } from "./question/QuestionBody";

/**
 * Plays question or answer content one step at a time, the way the server
 * times it: each step replaces the previous one on the stage, background
 * sounds play underneath, and every client is on the same step because the
 * position comes from the shared phase timer.
 */
export function ContentStage({
  content,
  files,
  text,
  textOrder,
  textItems,
  paused,
  pointAnswer,
  caption,
  captionLength = 0,
  label,
}: {
  content: ContentClock;
  files: QuestionFile[];
  /** Text shown by a text step (the question text). */
  text?: string | null;
  textOrder?: number | null;
  textItems?: readonly { order: number; text: string }[] | null;
  paused: boolean;
  pointAnswer?: { order: number; view: ReactNode };
  caption?: ReactNode;
  captionLength?: number;
  label?: string;
}) {
  const { t } = useTranslation();
  const { position, running, now } = useContentPosition(content, paused);
  const byOrder = new Map(files.filter((f) => f.file.link).map((f) => [f.order, f]));
  const screenSteps = content.plan.steps.filter((s) =>
    s.items.some((i) => i.placement === "screen"),
  );
  const currentScreenStep = screenSteps.findIndex((s) => s.startMs === position.screenStartMs) + 1;
  const isMainText = (item: { kind: string; order: number }) =>
    isMainTextItem(item, textOrder, textItems);
  const textShown = position.screen.some(isMainText);
  const textSequenced = content.plan.steps.some((s) => s.items.some(isMainText));
  const visibleText = position.screen
    .filter((item) => item.kind === "text")
    .flatMap((item) => {
      const value =
        textItems?.find((entry) => entry.order === item.order)?.text ??
        (isMainText(item) ? text : null);
      return value ? [{ order: item.order, value }] : [];
    });
  const recap = position.done && textSequenced && !textShown && text;
  const textContent =
    visibleText.length > 0 || recap || caption ? (
      <>
        {visibleText.map((item) => (
          <p key={item.order} className={questionText} data-testid="question-text">
            {item.value}
          </p>
        ))}
        {recap && (
          <p className={questionStyles.contentNote} data-testid="question-recap">
            {t("question.recap", { text })}
          </p>
        )}
        {caption}
      </>
    ) : null;
  const mediaItems = position.screen.filter(
    (item) => item.kind === "file" && byOrder.has(item.order),
  );

  return (
    <div
      className="question-timeline flex w-full flex-col items-center gap-4"
      data-testid="content-stage"
    >
      {screenSteps.length > 1 && (
        <div
          className="question-steps flex items-center gap-2 text-sm text-muted"
          role="group"
          aria-label={t("question.stepsLabel")}
          data-testid="content-steps"
        >
          {screenSteps.map((s, i) => (
            <span
              key={s.startMs}
              aria-hidden
              className={cn(
                "h-1.5 w-6 rounded-full transition-colors",
                i < currentScreenStep ? "bg-accent" : "bg-surface-3",
              )}
            />
          ))}
          <span data-testid="content-step-label">
            {t("question.step", { current: currentScreenStep, total: screenSteps.length })}
          </span>
        </div>
      )}

      <div
        key={position.screenStartMs}
        className={questionStyles.mediaStep}
        data-testid="content-step"
        data-step={currentScreenStep}
      >
        <QuestionBody
          label={label}
          text={textContent}
          textLength={
            visibleText.reduce((sum, item) => sum + item.value.length, 0) +
            (recap || "").length +
            captionLength
          }
          media={
            pointAnswer || mediaItems.length > 0 ? (
              <>
                {pointAnswer &&
                !position.screen.some(
                  (item) => item.kind === "file" && item.order === pointAnswer.order,
                )
                  ? pointAnswer.view
                  : mediaItems.map((item) => {
                      const file = byOrder.get(item.order);
                      if (!file) return null;
                      if (pointAnswer && item.order === pointAnswer.order) return pointAnswer.view;
                      return (
                        <QuestionMediaItem
                          key={`${item.order}-${file.file.md5}`}
                          file={file}
                          playing={running}
                          positionMs={() => now() - position.screenStartMs}
                        />
                      );
                    })}
              </>
            ) : undefined
          }
        />
      </div>

      {position.background.map(({ item, startMs }) => {
        const file = byOrder.get(item.order);
        if (!file) return null;
        return (
          <BackgroundSound
            key={`bg-${item.order}`}
            file={file}
            playing={running}
            positionMs={() => now() - startMs}
          />
        );
      })}
    </div>
  );
}

/** A sound under the stage: the compact audio card, below the current step. */
function BackgroundSound({
  file,
  playing,
  positionMs,
}: {
  file: QuestionFile;
  playing: boolean;
  positionMs: () => number;
}) {
  return (
    <div className="question-background-sound w-full max-w-[560px]" data-testid="background-sound">
      <QuestionMediaItem file={file} playing={playing} positionMs={positionMs} />
    </div>
  );
}
