import { packageEditorStyles } from "./packageEditorStyles";
import { useState, type SyntheticEvent } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { AlertIcon, ImageIcon, VideoIcon, VolumeIcon } from "@/ui/icons";
import { mediaUrl } from "./packageMedia";
import { useMediaFile } from "./packageEditorStore";
import type { DraftMedia } from "./packageDraft";

export function MediaIcon({ type, size = 16 }: { type: DraftMedia["type"]; size?: number }) {
  return type === "image" ? (
    <ImageIcon size={size} />
  ) : type === "audio" ? (
    <VolumeIcon size={size} />
  ) : (
    <VideoIcon size={size} />
  );
}

/**
 * A stored media file. `small` is a thumbnail for cards (images only, others
 * are an icon tile); full size plays audio and video with controls.
 */
export function AttachmentPreview({
  media,
  small,
  className,
}: {
  media: Pick<DraftMedia, "md5" | "type">;
  small?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  const file = useMediaFile(media.md5);
  const url = mediaUrl(file);
  const [duration, setDuration] = useState<{ url: string; seconds: number } | null>(null);
  const seconds = duration?.url === url ? duration?.seconds : null;
  const readDuration = (event: SyntheticEvent<HTMLMediaElement>) => {
    const seconds = event.currentTarget.duration;
    setDuration(url && Number.isFinite(seconds) ? { url, seconds } : null);
  };
  if (!url)
    return (
      <div className={cn(packageEditorStyles.missingAttachment, className)}>
        <AlertIcon size={14} />
        {t("editor.media.missing")}
      </div>
    );
  if (media.type === "image")
    return (
      <img
        src={url}
        alt=""
        loading="lazy"
        className={cn("rounded-sm bg-surface-3 object-contain", className)}
      />
    );
  if (small)
    return (
      <div className={cn(packageEditorStyles.attachmentIcon, className)}>
        <MediaIcon type={media.type} size={18} />
      </div>
    );
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {media.type === "video" ? (
        <video
          src={url}
          controls
          preload="metadata"
          onDurationChange={readDuration}
          className="max-h-56 w-full rounded-sm bg-black"
        />
      ) : (
        <audio
          src={url}
          controls
          preload="metadata"
          onDurationChange={readDuration}
          className="w-full"
        />
      )}
      {seconds != null && (
        <span className="text-xs text-muted">
          {t(`editor.media.${media.type}`)} · {t("editor.seconds", { count: Math.round(seconds) })}
        </span>
      )}
    </div>
  );
}
