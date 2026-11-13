import { useContext, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import type { QuestionTextItem } from "@/features/upload/types";
import type { QuestionFile } from "@/game/protocol";
import type { ContentClock } from "@/game/reducer";
import { isMainTextItem } from "@/game/contentPlan";
import { isVisual, VISUAL_QUEUE_THRESHOLD } from "@/game/authoredContentGroups";
import { cn } from "@/lib/cn";
import { ReplayIcon } from "@/ui/icons";
import { GameContext, useGameState } from "../GameContext";
import { ContentControls } from "./ContentControls";
import { ExpandableVisual } from "./media/ExpandableVisual";
import { MediaHistory } from "./media/MediaHistory";
import { QuestionMediaItem } from "./media/QuestionMediaItem";
import { scheduledMedia, type ScheduledMedia } from "./media/mediaLayout";
import { playbackStyles } from "./media/playbackStyles";
import { useContentPosition } from "./media/useContentPosition";
import { QuestionBody } from "./question/QuestionBody";
import { questionStyles, questionText } from "./question/questionStyles";

interface ContentStageProps {
  content: ContentClock;
  files: QuestionFile[];
  text?: string | null;
  textOrder?: number | null;
  textItems?: readonly QuestionTextItem[] | null;
  paused: boolean;
  pointAnswer?: { file: QuestionFile; view: ReactNode };
  caption?: ReactNode;
  captionLength?: number;
  label?: string;
  footer?: ReactNode;
  initialView?: (controls: ReactNode, history: ReactNode) => ReactNode;
  wrapBody?: (body: ReactNode) => ReactNode;
}

/** The phase clock runs every authored step; replays are local to this presentation. */
export function ContentStage(props: ContentStageProps) {
  const { content, files, paused } = props;
  const { t } = useTranslation();
  const game = useContext(GameContext);
  const showman = useGameState(
    (s) =>
      s.session?.players.some((p) => p.meta.id === game?.myId && p.role === "showman") ?? false,
  );
  const online = useGameState((s) => s.connection === "connected");
  const clock = useContentPosition(content, paused, !game || online);
  const { position, running, now, attempt, restart, canRestart, finished, fileReplay, select } =
    clock;
  const elapsed = now();
  const media = useMemo(() => scheduledMedia(content.plan, files), [content.plan, files]);
  const [captures, setCaptures] = useState<{
    plan: ContentClock["plan"];
    posters: Map<string, string>;
  }>();
  const posters = captures?.plan === content.plan ? captures.posters : new Map<string, string>();
  function rememberPoster(id: string, src: string) {
    setCaptures((previous) => {
      const next = previous?.plan === content.plan ? previous.posters : new Map<string, string>();
      if (next.has(id)) return previous;
      return { plan: content.plan, posters: new Map(next).set(id, src) };
    });
  }

  const stepMedia = media.filter(
    ({ step, background }) => step === position.screenIndex && !background,
  );
  const allVisuals = media.filter(({ file }) => isVisual(file));
  const stepVisuals = stepMedia.filter(({ file }) => isVisual(file));
  const queue = stepVisuals.length >= VISUAL_QUEUE_THRESHOLD;
  const thumbnailMedia = allVisuals.filter(({ step }) => step === position.index);
  const showHistory = thumbnailMedia.length >= VISUAL_QUEUE_THRESHOLD;
  const lastVisual = allVisuals.findLast(
    ({ start, step }) => step <= position.screenIndex && start <= elapsed,
  );
  const selected = fileReplay && thumbnailMedia.find(({ id }) => id === fileReplay.id);
  const displayed = selected ? [selected] : queue ? (lastVisual ? [lastVisual] : []) : stepVisuals;
  const point = attempt > 0 && !finished ? undefined : props.pointAnswer;
  const audio = media.filter(
    ({ file, background, start, step }) =>
      file.file.type === "audio" && (background ? start <= elapsed : step === position.screenIndex),
  );
  const timer = content.timer;
  const clockKey = timer
    ? `${timer.startedAt}:${timer.resumedAt}:${timer.elapsedMs}`
    : content.frozenAtMs;
  const hasVolume = files.some(({ file }) => file.type !== "image");
  const canReplay = hasVolume || allVisuals.length > 1 || content.plan.steps.length > 1;
  const controls = canReplay ? (
    <ContentControls volume={hasVolume}>
      {finished && (
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
      )}
    </ContentControls>
  ) : null;

  function renderMedia(item: ScheduledMedia, audioNumber?: number) {
    const replayed = selected?.id === item.id && fileReplay;
    const localElapsed = replayed ? replayed.elapsed : elapsed - item.start;
    const completed = localElapsed >= item.duration;
    const playing = running && localElapsed >= 0 && !completed && (!selected || !!replayed);
    return (
      <QuestionMediaItem
        key={`${attempt}:${item.id}:${replayed ? replayed.generation : 0}`}
        file={item.file}
        playing={playing}
        completed={completed}
        started={
          localElapsed >= 0 &&
          (!item.background || !completed || item.step === position.screenIndex)
        }
        audioNumber={audioNumber}
        clockKey={clockKey}
        positionMs={() => Math.min(item.duration, replayed ? replayed.now() : now() - item.start)}
        onPoster={
          item.file.file.type === "video" && !replayed
            ? (src) => rememberPoster(item.id, src)
            : undefined
        }
      />
    );
  }

  const history = showHistory && (
    <MediaHistory
      visuals={thumbnailMedia}
      posters={posters}
      current={selected?.id ?? (queue ? lastVisual?.id : undefined)}
      revealed={finished}
      enabled={finished && canRestart && !point}
      onSelect={(item) => select(item.id, item.duration)}
    />
  );

  const mediaView =
    point && !displayed.some((item) => item.file === point.file)
      ? point.view
      : (displayed.length > 0 || showHistory) && (
          <div className="question-visuals">
            <div
              className="question-visual-grid"
              data-count={displayed.length}
              data-testid="visual-grid"
            >
              {displayed.map((item) =>
                point && item.file === point.file ? (
                  <div className="question-visual-cell" key={item.id}>
                    {point.view}
                  </div>
                ) : (
                  <ExpandableVisual
                    key={queue && !selected ? "queue" : item.id}
                    suspended={paused || (!!game && !online)}
                  >
                    {renderMedia(item)}
                  </ExpandableVisual>
                ),
              )}
              {!displayed.length && (
                <div className="question-visual-placeholder" data-testid="visual-placeholder" />
              )}
            </div>
            {history}
          </div>
        );

  const copy = stageText(props, position.screen, position.done, attempt, t);
  const replics =
    content.plan.steps[position.index]?.items.filter(
      (item) => item.kind === "text" && item.placement === "replic",
    ) ?? [];
  const privateCopy = showman
    ? replics.flatMap((item) => {
        const text = props.textItems?.find((entry) => entry.order === item.order)?.text;
        return text
          ? [
              <p key={item.order} className={questionText} data-testid="showman-replic">
                {text}
              </p>,
            ]
          : [];
      })
    : [];
  const oralPlaceholder =
    replics.length > 0 && privateCopy.length === 0 ? (
      <p className={questionStyles.contentNote} data-testid="oral-placeholder">
        {t("question.showmanReading")}
      </p>
    ) : null;
  const textRevision = `${attempt}:${copy.hasStepText ? position.screenIndex : copy.recapped ? "recap" : "caption"}`;
  const screenSteps = content.plan.steps.flatMap((step, index) =>
    step.items.some(({ placement }) => placement === "screen") ? [index] : [],
  );
  const current = Math.max(1, screenSteps.indexOf(position.screenIndex) + 1);
  const initial = props.initialView && attempt === 0 && !selected;
  const body = initial ? (
    props.initialView?.(controls, history)
  ) : (
    <div className={questionStyles.mediaStep} data-testid="content-step" data-step={current}>
      <QuestionBody
        label={props.label}
        footer={props.footer}
        text={
          <>
            {copy.text}
            {privateCopy.length ? privateCopy : oralPlaceholder}
          </>
        }
        textLength={copy.length}
        textRevision={textRevision}
        media={mediaView || undefined}
        controls={controls}
        audio={
          audio.length > 0
            ? audio.map((item, index) => (
                <div
                  key={`${attempt}:${item.id}`}
                  data-testid={item.background ? "background-sound" : undefined}
                >
                  {renderMedia(item, audio.length > 1 ? index + 1 : undefined)}
                </div>
              ))
            : undefined
        }
      />
    </div>
  );
  return (
    <div className="question-timeline" data-testid="content-stage">
      {!initial && screenSteps.length > 1 && (
        <ContentProgress total={screenSteps.length} current={current} />
      )}
      {props.wrapBody ? props.wrapBody(body) : body}
    </div>
  );
}

function ContentProgress({ total, current }: { total: number; current: number }) {
  const { t } = useTranslation();
  return (
    <div
      className="question-steps"
      role="group"
      aria-label={t("question.stepsLabel")}
      data-testid="content-steps"
    >
      <div className="question-step-segments" aria-hidden="true">
        {Array.from({ length: total }, (_, index) => (
          <span key={index} className={index < current ? "bg-accent" : "bg-surface-3"} />
        ))}
      </div>
      <span data-testid="content-step-label">{t("question.step", { current, total })}</span>
    </div>
  );
}

function stageText(
  props: ContentStageProps,
  items: ContentClock["plan"]["steps"][number]["items"],
  done: boolean,
  attempt: number,
  t: ReturnType<typeof useTranslation>["t"],
) {
  const { text, textOrder, textItems, content } = props;
  const isMain = (item: { kind: string; order: number }) =>
    isMainTextItem(item, textOrder, textItems);
  const shown = items
    .filter((item) => item.kind === "text")
    .flatMap((item) => {
      const value =
        textItems?.find((entry) => entry.order === item.order)?.text ??
        (isMain(item) ? text : null);
      return value?.trim() ? [{ order: item.order, value }] : [];
    });
  const recap =
    done &&
    !items.some(
      (item) =>
        item.kind === "text" &&
        props.textItems?.some((text) => text.order === item.order && !text.text.trim()),
    ) &&
    !items.some(isMain) &&
    content.plan.steps.some((step) => step.items.some(isMain))
      ? text
      : null;
  const hideCaption = attempt > 0 && textOrder != null;
  const caption = hideCaption ? undefined : props.caption;
  return {
    hasStepText: shown.length > 0,
    recapped: !!recap,
    length:
      shown.reduce((sum, item) => sum + item.value.length, 0) +
      (recap?.length ?? 0) +
      (hideCaption ? 0 : (props.captionLength ?? 0)),
    text:
      shown.length || recap || caption ? (
        <>
          {shown.map(({ order, value }) => (
            <p key={order} className={questionText} data-testid="question-text">
              {value}
            </p>
          ))}
          {recap && (
            <p className={questionStyles.contentNote} data-testid="question-recap">
              {t("question.recap", { text: recap })}
            </p>
          )}
          {caption}
        </>
      ) : undefined,
  };
}
