import { useTranslation } from "react-i18next";
import { VolumeIcon } from "@/ui/icons";
import { useMediaVolume } from "./useMediaVolume";

export function MediaVolume() {
  const { t } = useTranslation();
  const { volume, setVolume } = useMediaVolume();
  return (
    <label className="inline-flex min-w-0 items-center gap-2 text-sm text-muted">
      <VolumeIcon size={18} />
      <span className="sr-only">{t("settings.volume")}</span>
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(volume * 100)}
        onChange={(e) => setVolume(Number(e.target.value) / 100)}
        className="w-36 min-w-12 accent-[var(--oq-accent)]"
      />
    </label>
  );
}
