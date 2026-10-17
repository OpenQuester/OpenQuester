import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { nextChangeAt, positionAt, timerElapsed } from "@/game/contentPlan";
import type { QuestionFile } from "@/game/protocol";
import type { ContentClock } from "@/game/reducer";
import { serverNow } from "@/lib/clock";
import { cn } from "@/lib/cn";

import { MediaItem } from "./QuestionMedia";

/** Where the timeline is now, re-rendering exactly when the stage changes. */
function useContentPosition(content: ContentClock, paused: boolean) {
  const [, setTick] = useState(0);
  const running = content.frozenAtMs == null && content.timer != null && !paused;
  const elapsed =
    content.frozenAtMs ??
    (content.timer ? timerElapsed(content.timer, paused) : content.plan.totalMs);
  const position = positionAt(content.plan, elapsed);
  const next = running ? nextChangeAt(content.plan, elapsed) : null;

  useEffect(() => {
    if (next == null) return;
    const id = window.setTimeout(() => setTick((n) => n + 1), Math.max(0, next - elapsed) + 30);
    return () => window.clearTimeout(id);
  }, [next, elapsed]);

  // Read live when a clip (re)starts, so it seeks to where everyone else is.
  const clockRef = useRef({ content, paused });
  useEffect(() => {
    clockRef.current = { content, paused };
  });
  const now = () => {
    const c = clockRef.current;
    return (
      c.content.frozenAtMs ??
      (c.content.timer
        ? timerElapsed(c.content.timer, c.paused, serverNow())
        : c.content.plan.totalMs)
    );
  };

  return { position, running, now };
}

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
        className="flex w-full flex-col items-center gap-4 oq-pop"
        data-testid="content-step"
        data-step={currentScreenStep}
      >
        {position.screen.map((item) => {
          if (item.kind === "text") {
            return text ? (
              <p
                key="text"
                className="m-0 text-center font-display text-[clamp(22px,3.4vw,38px)] font-semibold 3xl:text-[clamp(40px,2.4vw,64px)] leading-tight [overflow-wrap:anywhere]"
                data-testid="question-text"
              >
                {text}
              </p>
            ) : null;
          }
          const file = byOrder.get(item.order);
          if (!file) return null;
          return (
            <MediaItem
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
        <p className="m-0 max-w-[60ch] text-center text-soft" data-testid="question-recap">
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
      <MediaItem file={file} playing={playing} positionMs={positionMs} />
    </div>
  );
}
