import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { VolumeIcon } from "@/ui/icons";
import { playbackStyles } from "./playbackStyles";

export function AudioCard({
  number,
  status,
  children,
}: {
  number?: number;
  status: "audioReady" | "audioBuffering" | "audioActive" | "audioPaused" | "audioEnded";
  children?: ReactNode;
}) {
  const { t } = useTranslation();
  const label = number == null ? t("question.audioTitle") : t("question.audioNumber", { number });
  return (
    <div className={playbackStyles.audioPlayer} data-testid="media-frame">
      <span className={playbackStyles.audioIcon} aria-hidden="true">
        <VolumeIcon size={22} />
      </span>
      <div className="min-w-0">
        <div className="font-semibold">{label}</div>
        {status === "audioBuffering" && (
          <div className="text-xs text-muted" role="status">
            {t("question.audioBuffering")}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}
