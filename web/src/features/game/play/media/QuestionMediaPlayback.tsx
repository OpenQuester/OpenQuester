import { playbackStyles, mediaFrame } from "./playbackStyles";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { ReplayIcon, VolumeIcon } from "@/ui/icons";
import { useQuestionMediaPlayback } from "./useQuestionMediaPlayback";

/** Video or audio without controls, started and stopped by the game. */
export function QuestionMediaPlayback({
  src,
  type,
  playing,
  positionMs,
  loaded,
  onLoaded,
  onFailed,
  loading,
}: {
  src: string;
  type: "video" | "audio";
  playing: boolean;
  positionMs?: () => number;
  loaded: boolean;
  onLoaded: () => void;
  onFailed: () => void;
  loading: ReactNode;
}) {
  const { t } = useTranslation();
  const { volume, update, ref, blocked, ended, setEnded, replay, enableSound } =
    useQuestionMediaPlayback(playing, positionMs);

  const common = {
    src,
    preload: "auto" as const,
    onCanPlay: onLoaded,
    onLoadedData: onLoaded,
    onError: onFailed,
    onEnded: () => setEnded(true),
    onPlay: () => setEnded(false),
    "data-testid": `media-${type}`,
  };

  return (
    <div
      className={cn("flex w-full flex-col gap-2", type === "video" && "question-media-playback")}
    >
      {type === "video" ? (
        <div className={cn(mediaFrame, "bg-black")} data-testid="media-frame">
          <video
            ref={(el) => {
              ref.current = el;
            }}
            {...common}
            playsInline
            disablePictureInPicture
            className="absolute inset-0 h-full w-full object-contain"
          />
          {loading}
        </div>
      ) : (
        <div className={playbackStyles.audioPlayer} data-testid="media-frame">
          <span
            className={cn(playbackStyles.audioIcon, playing && loaded && !ended && "animate-pulse")}
          >
            <VolumeIcon size={26} />
          </span>
          <span className="font-semibold">
            {ended
              ? t("question.audioEnded")
              : playing
                ? t("question.audioPlaying")
                : t("question.audioWaiting")}
          </span>
          <audio
            ref={(el) => {
              ref.current = el;
            }}
            {...common}
            aria-label={t("question.audio")}
          />
          {loading}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-center gap-3">
        {ended && (
          <button
            type="button"
            onClick={replay}
            className={playbackStyles.replay}
            data-testid="media-replay"
          >
            <ReplayIcon size={18} />
            {t("question.replay")}
          </button>
        )}
        {blocked ? (
          <button
            type="button"
            onClick={enableSound}
            className={playbackStyles.enableSound}
            data-testid="enable-sound"
          >
            <VolumeIcon size={18} />
            {t("question.enableSound")}
          </button>
        ) : (
          <label className="inline-flex items-center gap-2 text-sm text-muted">
            <VolumeIcon size={18} />
            <span className="sr-only">{t("settings.volume")}</span>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(volume * 100)}
              onChange={(e) => update({ volume: Number(e.target.value) / 100 })}
              className="w-36 accent-[var(--oq-accent)]"
            />
          </label>
        )}
      </div>
    </div>
  );
}
