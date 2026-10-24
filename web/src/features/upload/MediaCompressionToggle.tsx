import { useTranslation } from "react-i18next";
import { Toggle } from "@/ui/Toggle";
import { useSettings } from "@/features/settings/settingsStore";

/** Whether media is re-encoded before upload; remembered on this device. */
export function MediaCompressionToggle() {
  const { t } = useTranslation();
  const on = useSettings((s) => s.compressMedia);
  const update = useSettings((s) => s.update);
  return (
    <div className="flex flex-col gap-1" data-testid="compress-toggle">
      <Toggle
        label={t("upload.compress.label")}
        checked={on}
        onChange={(v) => update({ compressMedia: v })}
      />
      <p className="m-0 text-sm text-muted">{t("upload.compress.help")}</p>
    </div>
  );
}
