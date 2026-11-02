import { questionStyles, questionText } from "./question/questionStyles";
import { useTranslation } from "react-i18next";

import type { QuestionFile } from "@/game/protocol";
import type { ContentClock } from "@/game/reducer";
import { isMainTextItem } from "@/game/contentPlan";
import type { ContentPosition } from "@/game/contentPlan";
import { cn } from "@/lib/cn";

import { QuestionMediaItem } from "./media/QuestionMediaItem";
import { useContentPosition } from "./media/useContentPosition";
import { useContext, type ReactNode } from "react";
import { GameContext, useGameState } from "../GameContext";
import { QuestionBody } from "./question/QuestionBody";
import { ReplayIcon } from "@/ui/icons";
import { playbackStyles } from "./media/playbackStyles";
import { ContentControls } from "./ContentControls";
import { ContentControlsContext } from "./ContentControlsContext";

/**
 * The shared phase timer drives the initial presentation. Local replay shifts
 * that clock while preserving every step's authored order, duration and background tracks.
 */
interface ContentStageProps {
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
  /** Preserve a legacy initial presentation while sharing the ordered local replay. */
  initialView?: ReactNode;
}

export function ContentStage(props: ContentStageProps) {
  const { content, files, paused, initialView, pointAnswer } = props;
  const game = useContext(GameContext);
  const online = useGameState((s) => s.connection === "connected");
  const { position, running, now, attempt, restart, canRestart, finished } = useContentPosition(
    content,
    paused,
    !game || online,
  );
  const byOrder = new Map(files.filter((f) => f.file.link).map((f) => [f.order, f]));
  const screenSteps = content.plan.steps.filter((s) =>
    s.items.some((i) => i.placement === "screen"),
  );
  const currentScreenStep = screenSteps.findIndex((s) => s.startMs === position.screenStartMs) + 1;
  const point = attempt > 0 && !finished ? undefined : pointAnswer;
  const showInitial = !!initialView && attempt === 0;
  const hideCaption = attempt > 0 && props.textOrder != null;
  const hasVolume = files.some(({ file }) => file.type !== "image");
  const controls =
    hasVolume || content.plan.steps.length > 1 ? (
      <ContentControls volume={hasVolume}>
        <ContentReplayButton
          plan={content.plan}
          files={files}
          finished={finished}
          canRestart={canRestart}
          restart={restart}
        />
      </ContentControls>
    ) : null;

  return (
    <ContentControlsContext value={controls}>
      <div
        className="question-timeline flex w-full flex-col items-center gap-4"
        data-testid="content-stage"
      >
        {screenSteps.length > 1 && !showInitial && (
          <ContentProgress steps={screenSteps} current={currentScreenStep} />
        )}

        {showInitial ? (
          initialView
        ) : (
          <ContentStep
            {...props}
            key={`${attempt}:${position.screenStartMs}`}
            position={position}
            currentScreenStep={currentScreenStep}
            byOrder={byOrder}
            now={now}
            playing={running && !position.done}
            pointAnswer={point}
            caption={hideCaption ? undefined : props.caption}
            captionLength={hideCaption ? 0 : props.captionLength}
          />
        )}

        {!showInitial &&
          position.background.map(({ item, startMs }) => {
            const file = byOrder.get(item.order);
            if (!file) return null;
            return (
              <BackgroundSound
                key={`bg-${attempt}-${item.order}`}
                file={file}
                playing={running}
                positionMs={() => now() - startMs}
              />
            );
          })}
      </div>
    </ContentControlsContext>
  );
}

function ContentReplayButton({
  plan,
  files,
  finished,
  canRestart,
  restart,
}: {
  plan: ContentClock["plan"];
  files: QuestionFile[];
  finished: boolean;
  canRestart: boolean;
  restart: () => void;
}) {
  const { t } = useTranslation();
  if (!finished) return null;
  if (plan.steps.length < 2 && !files.some(({ file }) => file.type !== "image")) return null;
  return (
    <button
      type="button"
      className={cn(playbackStyles.replay, "shrink-0 text-sm disabled:opacity-50")}
      onClick={restart}
      disabled={!canRestart}
      data-testid="content-replay"
    >
      <ReplayIcon size={18} />
      {t("question.replay")}
    </button>
  );
}

function ContentProgress({
  steps,
  current,
}: {
  steps: ContentClock["plan"]["steps"];
  current: number;
}) {
  const { t } = useTranslation();
  return (
    <div
      className="question-steps flex items-center gap-2 text-sm text-muted"
      role="group"
      aria-label={t("question.stepsLabel")}
      data-testid="content-steps"
    >
      {steps.map((step, index) => (
        <span
          key={step.startMs}
          aria-hidden
          className={cn(
            "h-1.5 w-6 rounded-full transition-colors",
            index < current ? "bg-accent" : "bg-surface-3",
          )}
        />
      ))}
      <span data-testid="content-step-label">
        {t("question.step", { current, total: steps.length })}
      </span>
    </div>
  );
}

/** The current step's body stays separate from playback and replay lifecycle. */
function ContentStep({
  content,
  text,
  textOrder,
  textItems,
  caption,
  captionLength = 0,
  label,
  pointAnswer: point,
  position,
  currentScreenStep,
  byOrder,
  now,
  playing,
}: ContentStageProps & {
  position: ContentPosition;
  currentScreenStep: number;
  byOrder: Map<number, QuestionFile>;
  now: () => number;
  playing: boolean;
}) {
  const { t } = useTranslation();
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
  const media =
    point && !mediaItems.some((item) => item.order === point.order)
      ? point.view
      : mediaItems.map((item) => {
          const file = byOrder.get(item.order)!;
          if (point && item.order === point.order) return point.view;
          return (
            <QuestionMediaItem
              key={`${item.order}-${file.file.md5}`}
              file={file}
              playing={playing}
              completed={position.done}
              positionMs={() => now() - position.screenStartMs}
            />
          );
        });
  return (
    <div
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
        media={point || mediaItems.length > 0 ? media : undefined}
      />
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
