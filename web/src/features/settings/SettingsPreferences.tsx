import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { LANGUAGES, type LanguageId } from "@/i18n/index";
import { THEMES } from "@/theme/themes";
import { Badge } from "@/ui/Badge";
import { Card } from "@/ui/Card";
import { Label, Select } from "@/ui/Field";
import { Toggle } from "@/ui/Toggle";
import { onChoiceKeyDown } from "@/ui/choiceNavigation";
import type { ProfileSettings } from "./useProfileSettings";

const sectionTitle = "m-0 text-xl font-semibold";
const themeOption =
  "flex min-h-16 flex-col items-start gap-1 rounded-md px-4 py-3 text-left text-text";

export function AppearanceSettings({ settings }: Pick<ProfileSettings, "settings">) {
  const { t } = useTranslation();
  return (
    <Card className="flex flex-col gap-4">
      <h2 className={sectionTitle}>{t("settings.look")}</h2>
      <div
        role="radiogroup"
        aria-label={t("settings.theme")}
        className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3"
      >
        {THEMES.map((th) => (
          <button
            key={th.id}
            type="button"
            role="radio"
            aria-checked={settings.theme === th.id}
            tabIndex={settings.theme === th.id ? 0 : -1}
            onKeyDown={onChoiceKeyDown}
            aria-disabled={!th.available || undefined}
            onClick={() => th.available && settings.update({ theme: th.id })}
            className={cn(
              themeOption,
              settings.theme === th.id
                ? "border-2 border-accent bg-accent-surface"
                : "border border-line-strong",
              !th.available && "cursor-not-allowed opacity-60",
            )}
          >
            <span className="font-semibold">{t(th.labelKey)}</span>
            {!th.available && <Badge tone="neutral">{t("settings.comingLater")}</Badge>}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="s-lang">{t("settings.language")}</Label>
        <Select
          id="s-lang"
          className="max-w-xs"
          value={settings.language}
          onChange={(e) => settings.update({ language: e.target.value as LanguageId })}
        >
          {LANGUAGES.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
        </Select>
      </div>
    </Card>
  );
}

export function SoundSettings({ settings }: Pick<ProfileSettings, "settings">) {
  const { t } = useTranslation();
  return (
    <Card className="flex flex-col gap-3">
      <h2 className={sectionTitle}>{t("settings.feel")}</h2>
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
      <label htmlFor="s-vol" className="font-semibold">
        {t("settings.volume")}
      </label>
      <input
        id="s-vol"
        type="range"
        min={0}
        max={100}
        value={Math.round(settings.volume * 100)}
        onChange={(e) => settings.update({ volume: Number(e.target.value) / 100 })}
        className="max-w-sm accent-[var(--oq-accent)]"
      />
    </Card>
  );
}
