import { useTranslation } from "react-i18next";
import type { useSettings } from "@/features/settings/settingsStore";
import { Toggle } from "@/ui/Toggle";
import { menuTitle } from "./gameMenuStyles";
export function GamePreferences({
  settings,
}: {
  settings: ReturnType<typeof useSettings.getState>;
}) {
  const { t } = useTranslation();
  return (
    <section className="flex flex-col gap-1">
      <h3 className={menuTitle}>{t("menu.feel")}</h3>
      <Toggle
        label={t("settings.sound")}
        checked={settings.sound}
        onChange={(v) => settings.update({ sound: v })}
      />
      <Toggle
        label={t("settings.reduceMotion")}
        checked={settings.reduceMotion}
        onChange={(v) => settings.update({ reduceMotion: v })}
      />
      <label htmlFor="menu-vol" className="mt-1 text-[15px]">
        {t("settings.volume")}
      </label>
      <input
        id="menu-vol"
        type="range"
        min={0}
        max={100}
        value={Math.round(settings.volume * 100)}
        onChange={(e) => settings.update({ volume: Number(e.target.value) / 100 })}
        className="accent-[var(--oq-accent)]"
      />
    </section>
  );
}
