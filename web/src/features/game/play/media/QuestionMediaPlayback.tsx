import { playbackStyles, mediaFrame } from "./playbackStyles";
import { useRef, useState, type ReactNode, type SyntheticEvent } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { VolumeIcon } from "@/ui/icons";
import { useQuestionMediaPlayback } from "./useQuestionMediaPlayback";
import { AudioCard } from "./AudioCard";
import { AudioEqualizer } from "./AudioEqualizer";
import "../question/QuestionLayout.css";

type AudioStatus = "audioReady" | "audioBuffering" | "audioActive" | "audioPaused" | "audioEnded";

function audioStatus(native: AudioStatus, playing: boolean, completed: boolean): AudioStatus {
  if (completed || native === "audioEnded") return "audioEnded";
  return playing || native === "audioReady" ? native : "audioPaused";
}

function pauseAudio(status: AudioStatus): AudioStatus {
  return audioStatus(status, false, false);
}

/** Video or audio without controls, started and stopped by the game. */
export function QuestionMediaPlayback({
  src,
  type,
  playing,
  positionMs,
  clockKey,
  loaded,
  onLoaded,
  onFailed,
  crossOrigin,
  fallbackPositionMs,
  onUseNativeAudio,
  loading,
  completed = false,
  audioNumber,
  onPoster,
}: {
  src: string;
  type: "video" | "audio";
  playing: boolean;
  positionMs?: () => number;
  clockKey?: string | number | null;
  loaded: boolean;
  onLoaded: () => void;
  onFailed: (positionMs: number) => void;
  crossOrigin?: "anonymous";
  fallbackPositionMs: number | null;
  onUseNativeAudio: (positionMs: number) => void;
  loading: ReactNode;
  completed?: boolean;
  audioNumber?: number;
  onPoster?: (src: string) => void;
}) {
  const { t } = useTranslation();
  const posterCaptured = useRef(false);
  const { ref, blocked, enableSound, volume } = useQuestionMediaPlayback(
    playing,
    positionMs,
    fallbackPositionMs,
    completed && type === "video",
    clockKey,
  );
  const [nativeStatus, setNativeStatus] = useState<AudioStatus>("audioReady");
  const status = audioStatus(nativeStatus, playing, completed);
  const showEnableSound = blocked && (type === "video" || status !== "audioEnded");
  function capturePoster(video: HTMLVideoElement) {
    if (!onPoster || posterCaptured.current || !video.videoWidth) return;
    posterCaptured.current = true;
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 144;
      canvas.height = Math.max(1, Math.round((144 * video.videoHeight) / video.videoWidth));
      canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
      onPoster(canvas.toDataURL("image/jpeg", 0.65));
    } catch {
      // A cross-origin source can play normally without exposing its pixels.
    }
  }

  const common = {
    src,
    preload: "auto" as const,
    onCanPlay: onLoaded,
    onLoadedData: onLoaded,
    onError: (event: SyntheticEvent<HTMLMediaElement>) =>
      onFailed(event.currentTarget.currentTime * 1000),
    "data-testid": `media-${type}`,
  };

  return (
    <div
      className={cn(
        "flex w-full flex-col gap-2",
        type === "video" ? "question-media-playback" : "question-audio-playback relative",
      )}
    >
      {type === "video" ? (
        <div className={cn(mediaFrame, "bg-black")} data-testid="media-frame">
          <video
            ref={(el) => {
              ref.current = el;
            }}
            crossOrigin={crossOrigin}
            {...common}
            onLoadedData={(event) => {
              onLoaded();
              capturePoster(event.currentTarget);
            }}
            playsInline
            disablePictureInPicture
            className="absolute inset-0 h-full w-full object-contain"
          />
          {loading}
        </div>
      ) : (
        <AudioCard
          number={audioNumber}
          status={!loaded && playing && !completed ? "audioBuffering" : status}
        >
          <audio
            ref={(el) => {
              ref.current = el;
            }}
            crossOrigin={crossOrigin}
            {...common}
            aria-label={t("question.audio")}
            onPlaying={() => setNativeStatus("audioActive")}
            onWaiting={() => setNativeStatus("audioBuffering")}
            onPause={() => setNativeStatus(pauseAudio)}
            onEnded={() => setNativeStatus("audioEnded")}
          />
          <AudioEqualizer
            mediaRef={ref}
            active={loaded && volume > 0 && status === "audioActive"}
            enabled={fallbackPositionMs === null}
            onUseNative={onUseNativeAudio}
          />
        </AudioCard>
      )}
      {showEnableSound && (
        <div className="media-enable-row flex justify-center">
          <button
            type="button"
            onClick={enableSound}
            className={playbackStyles.enableSound}
            data-testid="enable-sound"
          >
            <VolumeIcon size={18} />
            {t("question.enableSound")}
          </button>
        </div>
      )}
    </div>
  );
}
