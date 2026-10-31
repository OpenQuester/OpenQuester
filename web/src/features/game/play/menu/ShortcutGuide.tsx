import { gameMenuStyles, menuTitle } from "./gameMenuStyles";
import { useTranslation } from "react-i18next";

const KEYS = [
  ["menu.keys.buzz", "keys.space"],
  ["dock.showing.pass", "P"],
  ["menu.keys.option", "1 – 9"],
  ["menu.keys.judge", "C / W"],
  ["menu.keys.chat", "T"],
  ["menu.keys.menu", "?"],
] as const;
export function ShortcutGuide() {
  const { t } = useTranslation();
  return (
    <section className="flex flex-col gap-2">
      <h3 className={menuTitle}>{t("menu.shortcuts")}</h3>
      {KEYS.map(([what, key]) => (
        <div key={what} className={gameMenuStyles.shortcutRow}>
          <span className="min-w-0">{t(what)}</span>
          <kbd className={gameMenuStyles.shortcut}>{key.startsWith("keys.") ? t(key) : key}</kbd>
        </div>
      ))}
    </section>
  );
}
