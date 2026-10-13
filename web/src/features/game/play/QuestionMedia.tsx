import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { useSettings } from "@/features/settings/settingsStore";
import type { QuestionFile } from "@/game/protocol";
import { cn } from "@/lib/cn";
import { Spinner } from "@/ui/Spinner";
import { VolumeIcon } from "@/ui/icons";

/**
 * Question or answer media. Audio and video have no player controls: they play
 * by themselves while `playing` is true, so everybody sees and hears the same
 * thing at the same moment, and they stop while someone answers. Every file
 * sits in a fixed frame, so nothing jumps when it finishes loading.
 */
export function QuestionMedia({ files, playing }: { files: QuestionFile[]; playing: boolean }) {
  const sorted = [...files].filter((f) => f.file.link).sort((a, b) => a.order - b.order);
  if (sorted.length === 0) return null;
  return (
    <div className="flex w-full flex-col gap-3">
      {sorted.map((f, i) => (
        <MediaItem key={`${f.file.md5}-${i}`} file={f} playing={playing} />
      ))}
    </div>
  );
}

const FRAME =
  "relative mx-auto flex aspect-video max-h-[min(55dvh,560px)] 3xl:max-h-[min(58dvh,860px)] w-full items-center justify-center overflow-hidden rounded-lg border border-line";

function MediaItem({ file, playing }: { file: QuestionFile; playing: boolean }) {
  const { t } = useTranslation();
  const src = file.file.link!;
  const type = file.file.type;
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  if (failed) {
    // A broken file must not look like an empty question: say so, offer the link.
    return (
      <div
        role="alert"
        className={cn(
          FRAME,
          type === "audio" && "aspect-auto min-h-40",
          "flex-col gap-2 border-dashed border-danger/50 bg-danger-surface p-6 text-center",
        )}
        data-testid="media-failed"
      >
        <span className="font-semibold text-danger">{t(`question.mediaFailed.${type}`)}</span>
        <span className="text-sm text-soft">{t("question.mediaFailedHelp")}</span>
        <a href={src} target="_blank" rel="noreferrer" className="text-sm">
          {t("question.openFile")}
        </a>
      </div>
    );
  }

  const loading = !loaded && (
    <div className="absolute inset-0 flex items-center justify-center bg-surface-2">
      <Spinner label={t("question.mediaLoading")} />
    </div>
  );

  if (type === "image") {
    return (
      <div className={cn(FRAME, "bg-surface")} data-testid="media-frame">
        <img
          ref={(el) => {
            // Already in the cache (it was preloaded): no load event will come.
            if (el?.complete && el.naturalWidth > 0) setLoaded(true);
          }}
          src={src}
          alt={t("question.image")}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={cn(
            "absolute inset-0 h-full w-full object-contain transition-opacity duration-200",
            loaded ? "opacity-100" : "opacity-0",
          )}
        />
        {loading}
      </div>
    );
  }
  return (
    <Playback
      src={src}
      type={type === "video" ? "video" : "audio"}
      playing={playing}
      loaded={loaded}
      onLoaded={() => setLoaded(true)}
      onFailed={() => setFailed(true)}
      loading={loading}
    />
  );
}

/** Video or audio without controls, started and stopped by the game. */
function Playback({
  src,
  type,
  playing,
  loaded,
  onLoaded,
  onFailed,
  loading,
}: {
  src: string;
  type: "video" | "audio";
  playing: boolean;
  loaded: boolean;
  onLoaded: () => void;
  onFailed: () => void;
  loading: ReactNode;
}) {
  const { t } = useTranslation();
  const volume = useSettings((s) => s.volume);
  const update = useSettings((s) => s.update);
  const ref = useRef<HTMLMediaElement | null>(null);
  // Browsers block sound until the page has been tapped once. Then we play
  // muted, in sync with everyone, and offer one tap to turn the sound on.
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.volume = volume;
    if (!playing) {
      el.pause();
      return;
    }
    el.play().catch((err: unknown) => {
      if ((err as DOMException)?.name !== "NotAllowedError") return;
      el.muted = true;
      setBlocked(true);
      void el.play().catch(() => undefined);
    });
  }, [playing, volume]);

  function enableSound() {
    const el = ref.current;
    if (!el) return;
    el.muted = false;
    setBlocked(false);
    if (playing) void el.play().catch(() => undefined);
  }

  const common = {
    src,
    preload: "auto" as const,
    onCanPlay: onLoaded,
    onLoadedData: onLoaded,
    onError: onFailed,
    "data-testid": `media-${type}`,
  };

  return (
    <div className="flex w-full flex-col gap-2">
      {type === "video" ? (
        <div className={cn(FRAME, "bg-black")} data-testid="media-frame">
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
        <div
          className="relative flex min-h-24 items-center gap-4 overflow-hidden rounded-lg border border-line bg-surface-2 p-4"
          data-testid="media-frame"
        >
          <span
            className={cn(
              "inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-accent-surface text-accent",
              playing && loaded && "animate-pulse",
            )}
          >
            <VolumeIcon size={26} />
          </span>
          <span className="font-semibold">
            {playing ? t("question.audioPlaying") : t("question.audioWaiting")}
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
      <div className="flex items-center justify-center gap-3">
        {blocked ? (
          <button
            type="button"
            onClick={enableSound}
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-accent px-4 font-semibold text-on-accent"
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
