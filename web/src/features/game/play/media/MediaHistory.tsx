import { useTranslation } from "react-i18next";
import { ImageIcon, VideoIcon } from "@/ui/icons";
import { mapUrl } from "@/lib/urlMappings";
import type { ScheduledMedia } from "./mediaLayout";

export function MediaHistory({
  visuals,
  posters,
  current,
  revealed,
  enabled,
  onSelect,
}: {
  visuals: ScheduledMedia[];
  posters: ReadonlyMap<string, string>;
  current?: string;
  revealed: boolean;
  enabled: boolean;
  onSelect: (media: ScheduledMedia) => void;
}) {
  const { t } = useTranslation();
  const mixed =
    visuals.some(({ file }) => file.file.type === "image") &&
    visuals.some(({ file }) => file.file.type === "video");
  return (
    <div
      className="question-thumbnails"
      data-testid="media-history"
      aria-label={t("question.mediaHistory")}
      role="group"
    >
      {visuals.map((media, index) => {
        const type = media.file.file.type;
        const link = media.file.file.link;
        const poster = type === "image" && link ? mapUrl(link) : posters.get(media.id);
        const future = !revealed;
        const Icon = type === "image" ? ImageIcon : VideoIcon;
        return (
          <button
            key={media.id}
            type="button"
            disabled={!enabled || !link}
            aria-pressed={current === media.id}
            aria-label={t(type === "image" ? "question.imageNumber" : "question.videoNumber", {
              number: index + 1,
            })}
            data-future={future}
            className="question-thumbnail"
            onClick={() => onSelect(media)}
          >
            <span className="question-thumbnail-preview">
              {poster && <img alt="" loading="lazy" src={poster} />}
            </span>
            {mixed && (
              <span aria-hidden="true" className="question-thumbnail-type">
                <Icon size={13} />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
