import { packageEditorStyles } from "./packageEditorStyles";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { AlertIcon, ImageIcon, VideoIcon, VolumeIcon } from "@/ui/icons";
import { mediaUrl } from "./packageMedia";
import { useMediaFile } from "./packageEditorStore";
import type { DraftMedia } from "./packageDraft";
import { formatBytes } from "@/lib/format";
import { EditorMediaPlayer } from "./EditorMediaPlayer";
import { useAttachmentSize } from "./useAttachmentSize";

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
  const size = useAttachmentSize(small ? undefined : file);
  const [duration, setDuration] = useState<{ url: string; seconds: number } | null>(null);
  const seconds = duration?.url === url ? duration?.seconds : null;
  if (!url)
    return (
      <div className={cn(packageEditorStyles.missingAttachment, className)}>
        <AlertIcon size={14} />
        {t("editor.media.missing")}
      </div>
    );
  if (small)
    return media.type === "image" ? (
      <img
        src={url}
        alt=""
        loading="lazy"
        className={cn("rounded-sm bg-surface-3 object-contain", className)}
      />
    ) : (
      <div className={cn(packageEditorStyles.attachmentIcon, className)}>
        <MediaIcon type={media.type} size={18} />
      </div>
    );
  return (
    <div className="flex min-w-0 flex-col gap-1">
      {media.type === "image" ? (
        <img
          src={url}
          alt=""
          loading="lazy"
          className={cn("rounded-sm bg-surface-3 object-contain", className)}
        />
      ) : (
        <EditorMediaPlayer
          key={url}
          src={url}
          type={media.type}
          className={className}
          onDuration={(value) => setDuration(value == null ? null : { url, seconds: value })}
        />
      )}
      <span className="text-xs text-muted">
        {t(`editor.media.${media.type}`)}
        {seconds != null && ` · ${t("editor.seconds", { count: Math.round(seconds) })}`}
        {` · ${size == null ? t("editor.media.sizeUnknown") : formatBytes(size)}`}
      </span>
    </div>
  );
}
