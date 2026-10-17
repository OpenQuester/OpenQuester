import { useTranslation } from "react-i18next";

import { cn } from "@/lib/cn";
import { Badge } from "@/ui/Badge";
import { AlertIcon, ImageIcon, VideoIcon, VolumeIcon } from "@/ui/icons";

import { mediaUrl, useMediaDuration } from "./media";
import type { EditorMedia, EditorQuestion } from "./model";
import { useEditor } from "./store";

export function MediaIcon({ type, size = 16 }: { type: EditorMedia["type"]; size?: number }) {
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
export function MediaView({
  media,
  small,
  className,
}: {
  media: Pick<EditorMedia, "md5" | "type">;
  small?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  const file = useEditor((s) => s.media.get(media.md5));
  const url = mediaUrl(file);
  const seconds = useMediaDuration(small ? undefined : file);
  if (!url)
    return (
      <div
        className={cn(
          "flex items-center justify-center gap-2 rounded-sm border border-danger/40 bg-danger-surface p-2 text-center text-xs text-danger",
          className,
        )}
      >
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
      <div
        className={cn(
          "flex items-center justify-center rounded-sm bg-surface-3 text-info-soft",
          className,
        )}
      >
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
          className="max-h-56 w-full rounded-sm bg-black"
        />
      ) : (
        <audio src={url} controls preload="metadata" className="w-full" />
      )}
      {seconds != null && (
        <span className="text-xs text-muted">
          {t(`editor.media.${media.type}`)} · {t("editor.seconds", { count: Math.round(seconds) })}
        </span>
      )}
    </div>
  );
}

/** Everything a question shows, read-only: used on hover, in the side panel and in big cards. */
export function QuestionPreview({
  question: q,
  final,
  compact,
}: {
  question: EditorQuestion;
  final?: boolean;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const type = final ? "simple" : q.type;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {!final && (
          <span className="font-display text-xl font-extrabold text-accent">{q.price ?? "—"}</span>
        )}
        {type !== "simple" && <Badge tone="accent">{t(`questionTypes.${type}`)}</Badge>}
      </div>
      {q.text.trim() ? (
        <p
          className={cn(
            "m-0 whitespace-pre-wrap font-semibold leading-snug [overflow-wrap:anywhere]",
            !compact && "text-lg",
          )}
        >
          {q.text}
        </p>
      ) : q.questionFiles.length === 0 ? (
        <p className="m-0 text-sm text-danger">{t("editor.preview.noQuestion")}</p>
      ) : null}
      {q.questionFiles.length > 0 && (
        <div className="flex flex-col gap-2">
          {q.questionFiles.map((m, i) => (
            <MediaView
              key={`${m.md5}-${i}`}
              media={m}
              className={compact ? "max-h-40 w-full" : "max-h-64 w-full"}
            />
          ))}
        </div>
      )}
      {type === "choice" && q.options.length > 0 && (
        <ol className="m-0 grid list-none grid-cols-2 gap-1.5 p-0">
          {q.options.map((o, i) => {
            const correct = o.text.trim() !== "" && o.text.trim() === q.answerText.trim();
            return (
              <li
                key={o.id}
                className={cn(
                  "flex items-center gap-2 rounded-sm border px-2.5 py-1.5 text-sm [overflow-wrap:anywhere]",
                  correct
                    ? "border-success-line bg-success-surface text-success"
                    : "border-line bg-surface-2",
                )}
              >
                <span className="font-semibold text-muted">{String.fromCharCode(65 + i)}</span>
                {o.text || (o.file ? <MediaIcon type={o.file.type} /> : "—")}
              </li>
            );
          })}
        </ol>
      )}
      <div className="flex flex-col gap-1 rounded-sm bg-success-surface px-3 py-2">
        <span className="text-xs font-bold tracking-wider text-success uppercase">
          {t("editor.preview.answer")}
        </span>
        {q.answerText.trim() ? (
          <span className="font-semibold whitespace-pre-wrap [overflow-wrap:anywhere]">
            {q.answerText}
          </span>
        ) : q.answerFiles.length === 0 ? (
          <span className="text-sm text-warning">{t("editor.preview.noAnswer")}</span>
        ) : null}
        {q.answerFiles.map((m, i) => (
          <MediaView key={`${m.md5}-${i}`} media={m} className="max-h-40 w-full" />
        ))}
      </div>
      {(q.answerHint.trim() || q.questionComment.trim() || (!final && typeDetail(q, t))) && (
        <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          {!final && typeDetail(q, t) && (
            <>
              <dt className="text-faint">{t(`questionTypes.${q.type}`)}</dt>
              <dd className="m-0">{typeDetail(q, t)}</dd>
            </>
          )}
          {q.answerHint.trim() && (
            <>
              <dt className="text-faint">{t("editor.preview.hint")}</dt>
              <dd className="m-0 [overflow-wrap:anywhere]">{q.answerHint}</dd>
            </>
          )}
          {q.questionComment.trim() && (
            <>
              <dt className="text-faint">{t("editor.preview.comment")}</dt>
              <dd className="m-0 [overflow-wrap:anywhere]">{q.questionComment}</dd>
            </>
          )}
        </dl>
      )}
    </div>
  );
}

function typeDetail(
  q: EditorQuestion,
  t: (k: string, o?: Record<string, unknown>) => string,
): string {
  switch (q.type) {
    case "stake":
      return [
        q.maxPrice != null
          ? t("editor.preview.maxBid", { max: q.maxPrice })
          : t("editor.preview.allIn"),
        q.forEveryone ? t("editor.preview.everyone") : "",
      ]
        .filter(Boolean)
        .join(" · ");
    case "secret":
      return [
        q.allowedPrices.length ? q.allowedPrices.join(" / ") : "",
        t(`editor.form.transfer.${q.transferType}`),
      ]
        .filter(Boolean)
        .join(" · ");
    case "noRisk":
      return [`×${q.priceMultiplier}`, q.forEveryone ? t("editor.preview.everyone") : ""]
        .filter(Boolean)
        .join(" · ");
    default:
      return "";
  }
}
