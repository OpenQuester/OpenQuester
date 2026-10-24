import { playbackStyles, mediaFrame } from "./playbackStyles";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { QuestionFile } from "@/game/protocol";
import { cn } from "@/lib/cn";
import { Spinner } from "@/ui/Spinner";
import { QuestionMediaPlayback } from "./QuestionMediaPlayback";

export function QuestionMediaItem({
  file,
  playing,
  positionMs,
}: {
  file: QuestionFile;
  playing: boolean;
  /** Where playback should be now (ms into the file), to stay in sync. */
  positionMs?: () => number;
}) {
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
          mediaFrame,
          type === "audio" && "aspect-auto min-h-40",
          playbackStyles.failure,
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
      src={src}
      type={type === "video" ? "video" : "audio"}
      playing={playing}
      positionMs={positionMs}
      loaded={loaded}
      onLoaded={() => setLoaded(true)}
      onFailed={() => setFailed(true)}
      loading={loading}
    />
  );
}
