import { playbackStyles, mediaFrame } from "./playbackStyles";
import { AudioCard } from "./AudioCard";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { QuestionFile } from "@/game/protocol";
import { cn } from "@/lib/cn";
import { Spinner } from "@/ui/Spinner";
import { QuestionMediaPlayback } from "./QuestionMediaPlayback";
import { mapUrl } from "@/lib/urlMappings";

interface MediaItemProps {
  file: QuestionFile;
  playing: boolean;
  /** Where playback should be now (ms into the file), to stay in sync. */
  positionMs?: () => number;
  completed?: boolean;
  clockKey?: string | number | null;
  started?: boolean;
  audioNumber?: number;
  onPoster?: (src: string) => void;
}

export function QuestionMediaItem({ file, ...playback }: MediaItemProps) {
  // Inside a Discord Activity the file comes through Discord's proxy. Setting
  // that URL up front matters: swapping src after the element started loading
  // aborts play() and audio/video would stay paused.
  const type = file.file.type;
  if (playback.started === false && type === "audio") {
    return (
      <AudioCard
        number={playback.audioNumber}
        status={playback.completed ? "audioEnded" : "audioReady"}
      />
    );
  }
  if (playback.started === false && type === "video")
    return <div className={cn(mediaFrame, "bg-surface-2")} />;
  const src = file.file.link ? mapUrl(file.file.link) : "";
  return <MediaItem key={`${type}:${src}`} src={src} type={type} {...playback} />;
}

function isNetworkMedia(src: string) {
  try {
    const url = new URL(src, window.location.href);
    return /^https?:$/.test(url.protocol);
  } catch {
    return false;
  }
}

function MediaItem({
  src,
  type,
  playing,
  positionMs,
  completed,
  audioNumber,
  onPoster,
  clockKey,
}: Omit<MediaItemProps, "file"> & { src: string; type: QuestionFile["file"]["type"] }) {
  const { t } = useTranslation();
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [fallbackPositionMs, setFallbackPositionMs] = useState<number | null>(null);
  const nativePlayback = fallbackPositionMs !== null;
  // HTTP URLs can redirect off-origin. A successful CORS-mode load stays safe to analyse.
  const anonymous =
    (type === "audio" || (type === "video" && !!onPoster)) &&
    !nativePlayback &&
    isNetworkMedia(src);

  function retryAsNative(positionMs: number) {
    setLoaded(false);
    setFallbackPositionMs((previous) => previous ?? positionMs);
  }

  if (failed || !src) {
    // A broken file must not look like an empty question: say so, offer the link.
    return (
      <div
        role="alert"
        className={cn(
          mediaFrame,
          type === "audio" && "aspect-auto min-h-40",
          playbackStyles.failure,
        )}
        data-testid="media-failed"
      >
        <span className="font-semibold text-danger">{t(`question.mediaFailed.${type}`)}</span>
        <span className="text-sm text-soft">{t("question.mediaFailedHelp")}</span>
        {src && (
          <a href={src} target="_blank" rel="noreferrer" className="text-sm">
            {t("question.openFile")}
          </a>
        )}
      </div>
    );
  }

  const loading = !loaded && (
    <div className={playbackStyles.loading}>
      <Spinner label={t("question.mediaLoading")} />
    </div>
  );

  if (type === "image") {
    return (
      <div className={cn(mediaFrame, "bg-surface")} data-testid="media-frame">
        <img
          ref={(el) => {
            // Already in the cache (it was preloaded): no load event will come.
            if (el?.complete && el.naturalWidth > 0) setLoaded(true);
          }}
          src={src}
          alt={t("question.image")}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={cn(playbackStyles.image, loaded ? "opacity-100" : "opacity-0")}
        />
        {loading}
      </div>
    );
  }
  return (
    <QuestionMediaPlayback
      key={nativePlayback ? "native" : "default"}
      src={src}
      type={type}
      playing={playing}
      completed={completed}
      audioNumber={audioNumber}
      onPoster={onPoster}
      positionMs={positionMs}
      clockKey={clockKey}
      loaded={loaded}
      onLoaded={() => setLoaded(true)}
      onFailed={anonymous ? retryAsNative : () => setFailed(true)}
      crossOrigin={anonymous ? "anonymous" : undefined}
      fallbackPositionMs={fallbackPositionMs}
      onUseNativeAudio={retryAsNative}
      loading={loading}
    />
  );
}
