import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useSettings } from "@/features/settings/settingsStore";
import type { QuestionFile } from "@/game/protocol";
import { VolumeIcon } from "@/ui/icons";

/**
 * Question or answer media. Audio and video play only while `playing` is true,
 * so everybody's playback starts together when the server opens the question
 * and stops while someone answers.
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

function MediaItem({ file, playing }: { file: QuestionFile; playing: boolean }) {
  const { t } = useTranslation();
  const volume = useSettings((s) => s.volume);
  const ref = useRef<HTMLMediaElement | null>(null);
  const src = file.file.link!;
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.volume = volume;
    if (playing) void el.play().catch(() => undefined);
    else el.pause();
  }, [playing, volume]);

  if (failed) {
    // A broken file must not look like an empty question: say so, offer the link.
    return (
      <div
        role="alert"
        className="flex min-h-40 w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-danger/50 bg-danger-surface p-6 text-center"
        data-testid="media-failed"
      >
        <span className="font-semibold text-danger">
          {t(`question.mediaFailed.${file.file.type}`)}
        </span>
        <span className="text-sm text-soft">{t("question.mediaFailedHelp")}</span>
        <a href={src} target="_blank" rel="noreferrer" className="text-sm">
          {t("question.openFile")}
        </a>
      </div>
    );
  }
  if (file.file.type === "image") {
    return (
      <img
        src={src}
        alt={t("question.image")}
        onError={() => setFailed(true)}
        className="mx-auto max-h-[min(55dvh,560px)] min-h-32 w-full max-w-full rounded-lg border border-line bg-surface object-contain"
      />
    );
  }
  if (file.file.type === "video") {
    return (
      <video
        ref={(el) => {
          ref.current = el;
        }}
        src={src}
        playsInline
        controls
        preload="auto"
        onError={() => setFailed(true)}
        className="mx-auto aspect-video max-h-[min(52dvh,560px)] w-full max-w-full rounded-lg border border-line bg-black"
      />
    );
  }
  return (
    <div className="flex items-center gap-3 rounded-lg border border-line bg-surface-2 p-4">
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-accent-surface text-accent">
        <VolumeIcon />
      </span>
      <audio
        ref={(el) => {
          ref.current = el;
        }}
        src={src}
        controls
        preload="auto"
        onError={() => setFailed(true)}
        className="w-full"
        aria-label={t("question.audio")}
      />
    </div>
  );
}
