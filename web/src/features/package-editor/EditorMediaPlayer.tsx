import { useEffect, useRef, useState, type SyntheticEvent } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { FullscreenIcon, PauseIcon, PlayIcon, VolumeIcon, VolumeOffIcon } from "@/ui/icons";
import { formatTime } from "./media-editor/mediaEdits";

/** Editor playback is local and seekable; live game media has its own clock. */
export function EditorMediaPlayer({
  src,
  type,
  className,
  onDuration,
}: {
  src: string;
  type: "audio" | "video";
  className?: string;
  onDuration: (seconds: number | null) => void;
}) {
  const { t } = useTranslation();
  const ref = useRef<HTMLMediaElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const lastVolume = useRef(1);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [fullscreenError, setFullscreenError] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const effectivelyMuted = muted || volume === 0;

  useEffect(() => {
    const media = ref.current;
    return () => {
      if (media && !media.paused) media.pause();
    };
  }, []);

  useEffect(() => {
    const syncFullscreen = () => setFullscreen(document.fullscreenElement === container.current);
    document.addEventListener("fullscreenchange", syncFullscreen);
    return () => document.removeEventListener("fullscreenchange", syncFullscreen);
  }, []);

  const metadata = (event: SyntheticEvent<HTMLMediaElement>) => {
    const value = event.currentTarget.duration;
    const seconds = Number.isFinite(value) ? value : null;
    setDuration(seconds ?? 0);
    setLoading(false);
    onDuration(seconds);
  };
  const mediaProps = {
    src,
    preload: "metadata" as const,
    onDurationChange: metadata,
    onTimeUpdate: (event: SyntheticEvent<HTMLMediaElement>) =>
      setPosition(event.currentTarget.currentTime),
    onPlay: () => {
      setPlaying(true);
      setError(false);
    },
    onPause: () => setPlaying(false),
    onWaiting: () => setLoading(true),
    onCanPlay: () => setLoading(false),
    onError: () => {
      setLoading(false);
      setError(true);
    },
  };
  const buttonClass =
    "inline-flex size-9 shrink-0 items-center justify-center rounded-sm hover:bg-surface-3 disabled:opacity-50";
  return (
    <div
      ref={container}
      className="editor-media-player flex min-w-0 flex-col gap-1 rounded-sm bg-surface-2"
    >
      {type === "video" ? (
        <div className="relative min-w-0">
          <video
            {...mediaProps}
            ref={(element) => {
              ref.current = element;
            }}
            className={cn("max-h-56 w-full rounded-sm bg-black", className)}
          />
          {typeof document !== "undefined" && document.fullscreenEnabled && (
            <button
              type="button"
              className={cn(
                buttonClass,
                "absolute bottom-1 right-1 bg-scrim/70 text-on-scrim hover:bg-scrim/90",
              )}
              aria-label={t(
                fullscreen ? "editor.player.exitFullscreen" : "editor.player.fullscreen",
              )}
              onClick={() => {
                setFullscreenError(false);
                const request = fullscreen
                  ? document.exitFullscreen()
                  : container.current?.requestFullscreen();
                void request?.catch(() => setFullscreenError(true));
              }}
            >
              <FullscreenIcon size={16} />
            </button>
          )}
        </div>
      ) : (
        <audio
          {...mediaProps}
          ref={(element) => {
            ref.current = element;
          }}
          className="sr-only"
        />
      )}
      <div className="flex min-w-0 flex-col gap-1 px-1 pb-1 text-sm">
        <div className="flex items-center gap-1">
          <button
            type="button"
            className={buttonClass}
            aria-label={t(playing ? "editor.player.pause" : "editor.player.play")}
            onClick={() => {
              const media = ref.current;
              if (!media) return;
              if (media.paused) {
                setError(false);
                void media.play().catch(() => setError(true));
              } else media.pause();
            }}
          >
            {playing ? <PauseIcon size={16} /> : <PlayIcon size={16} />}
          </button>
          <span className="shrink-0 tabular-nums" aria-live="off">
            {formatTime(position)} / {formatTime(duration)}
          </span>
        </div>
        <input
          type="range"
          className="w-full min-w-0"
          aria-label={t("editor.player.seek")}
          min={0}
          max={duration || 0}
          step={0.1}
          value={Math.min(position, duration)}
          disabled={!duration || error}
          onChange={(event) => {
            if (ref.current) {
              const value = Number(event.target.value);
              ref.current.currentTime = value;
              setPosition(value);
            }
          }}
        />
        <div className="flex min-w-0 items-center gap-1">
          <button
            type="button"
            className={buttonClass}
            aria-label={t(effectivelyMuted ? "editor.player.unmute" : "editor.player.mute")}
            onClick={() => {
              if (ref.current) {
                if (effectivelyMuted) {
                  ref.current.muted = false;
                  ref.current.volume = lastVolume.current;
                  setVolume(lastVolume.current);
                  setMuted(false);
                } else {
                  ref.current.muted = true;
                  setMuted(true);
                }
              }
            }}
          >
            {effectivelyMuted ? <VolumeOffIcon size={16} /> : <VolumeIcon size={16} />}
          </button>
          <input
            type="range"
            className="min-w-0 w-full max-w-28"
            aria-label={t("editor.player.volume")}
            min={0}
            max={1}
            step={0.05}
            value={muted ? 0 : volume}
            onChange={(event) => {
              const value = Number(event.target.value);
              if (value > 0) lastVolume.current = value;
              if (ref.current) {
                ref.current.volume = value;
                ref.current.muted = false;
              }
              setVolume(value);
              setMuted(false);
            }}
          />
        </div>
      </div>
      {loading && !error && (
        <span className="px-2 text-xs text-muted">{t("editor.player.loading")}</span>
      )}
      {error && (
        <span className="px-2 text-xs text-danger" role="alert">
          {t("editor.player.error")}
        </span>
      )}
      {fullscreenError && (
        <span className="px-2 text-xs text-danger" role="status">
          {t("editor.player.fullscreenError")}
        </span>
      )}
    </div>
  );
}
