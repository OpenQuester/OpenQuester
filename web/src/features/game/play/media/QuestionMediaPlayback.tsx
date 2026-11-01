import { playbackStyles, mediaFrame } from "./playbackStyles";
import { useContext, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { VolumeIcon } from "@/ui/icons";
import { useQuestionMediaPlayback } from "./useQuestionMediaPlayback";
import { MediaVolume } from "./MediaVolume";
import { ContentControlsContext } from "../ContentControlsContext";

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
  completed = false,
}: {
  src: string;
  type: "video" | "audio";
  playing: boolean;
  positionMs?: () => number;
  loaded: boolean;
  onLoaded: () => void;
  onFailed: () => void;
  loading: ReactNode;
  completed?: boolean;
}) {
  const { t } = useTranslation();
  const sharedControls = useContext(ContentControlsContext) !== undefined;
  const { ref, blocked, ended, setEnded, enableSound } = useQuestionMediaPlayback(
    playing,
    positionMs,
  );

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
            {ended || completed
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
      {(blocked || !sharedControls) && (
        <div className="flex flex-wrap items-center justify-center gap-3">
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
            <MediaVolume />
          )}
        </div>
      )}
    </div>
  );
}
