import { questionStyles, questionText } from "./question/questionStyles";
import { useTranslation } from "react-i18next";

import type { QuestionFile } from "@/game/protocol";
import type { ContentClock } from "@/game/reducer";
import { cn } from "@/lib/cn";

import { QuestionMediaItem } from "./media/QuestionMediaItem";
import { useContentPosition } from "./media/useContentPosition";

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
  paused,
}: {
  content: ContentClock;
  files: QuestionFile[];
  /** Text shown by a text step (the question text). */
  text?: string | null;
  paused: boolean;
}) {
  const { t } = useTranslation();
  const { position, running, now } = useContentPosition(content, paused);
  const byOrder = new Map(files.filter((f) => f.file.link).map((f) => [f.order, f]));
  const screenSteps = content.plan.steps.filter((s) =>
    s.items.some((i) => i.placement === "screen"),
  );
  const currentScreenStep = screenSteps.findIndex((s) => s.startMs === position.screenStartMs) + 1;
  const textShown = position.screen.some((i) => i.kind === "text");
  const textSequenced = content.plan.steps.some((s) => s.items.some((i) => i.kind === "text"));

  return (
    <div className="flex w-full flex-col items-center gap-4" data-testid="content-stage">
      {screenSteps.length > 1 && (
        <div
          className="flex items-center gap-2 text-sm text-muted"
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
        {position.screen.map((item) => {
          if (item.kind === "text") {
            return text ? (
              <p key="text" className={questionText} data-testid="question-text">
                {text}
              </p>
            ) : null;
          }
          const file = byOrder.get(item.order);
          if (!file) return null;
          return (
            <QuestionMediaItem
              key={`${item.order}-${file.file.md5}`}
              file={file}
              playing={running}
              positionMs={() => now() - position.screenStartMs}
            />
          );
        })}
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

      {/* After the last step the text may be gone from the stage: keep it in view. */}
      {position.done && textSequenced && !textShown && text && (
        <p className={questionStyles.contentNote} data-testid="question-recap">
          {t("question.recap", { text })}
        </p>
      )}
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
    <div className="w-full max-w-[560px]" data-testid="background-sound">
      <QuestionMediaItem file={file} playing={playing} positionMs={positionMs} />
    </div>
  );
}
