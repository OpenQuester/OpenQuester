import { packageEditorStyles } from "../packageEditorStyles";
import { layoutStyles } from "@/ui/layoutStyles";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { Button } from "@/ui/Button";
import { FieldGroup, Select } from "@/ui/Field";
import type { MoveTarget } from "../MovePackageItemDialog";
import { useMoveTarget } from "./useMoveTarget";

export function MovePackageItemForm({
  target,
  onClose,
}: {
  target: MoveTarget;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const {
    pkg,
    roundId,
    setRoundId,
    themeId,
    setThemeId,
    round,
    theme,
    slots,
    position,
    setPosition,
    move,
  } = useMoveTarget(target, onClose);

  return (
    <div className={layoutStyles.cardBody}>
      <FieldGroup htmlFor="move-round" label={t("editor.move.round")}>
        <Select
          id="move-round"
          value={roundId}
          onChange={(e) => {
            setRoundId(e.target.value);
            setThemeId("");
            setPosition(-1);
          }}
        >
          {pkg.rounds.map((r, i) => (
            <option key={r.id} value={r.id}>
              {i + 1} · {r.name || t("editor.outline.untitled")}
            </option>
          ))}
        </Select>
      </FieldGroup>

      {target.kind === "question" && (
        <fieldset className={packageEditorStyles.moveChoices}>
          <legend className="mb-1.5 text-[15px] font-semibold">{t("editor.move.theme")}</legend>
          {round?.themes.length ? (
            <div className={packageEditorStyles.moveDestinations}>
              {round.themes.map((th) => (
                <label
                  key={th.id}
                  className={cn(
                    packageEditorStyles.moveChoice,
                    th.id === themeId
                      ? "border-accent bg-accent-surface"
                      : "border-line hover:bg-surface-2",
                  )}
                >
                  <input
                    type="radio"
                    name="move-theme"
                    checked={th.id === themeId}
                    onChange={() => {
                      setThemeId(th.id);
                      setPosition(-1);
                    }}
                  />
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {th.name || t("editor.outline.untitled")}
                  </span>
                  <span className="text-sm text-faint">
                    {t("editor.board.questionCount", { count: th.questions.length })}
                  </span>
                </label>
              ))}
            </div>
          ) : (
            <p className="m-0 text-sm text-muted">{t("editor.move.noThemes")}</p>
          )}
        </fieldset>
      )}

      {(target.kind === "theme" || theme) && (
        <FieldGroup htmlFor="move-pos" label={t("editor.move.position")}>
          <Select
            id="move-pos"
            value={position}
            onChange={(e) => setPosition(Number(e.target.value))}
          >
            <option value={-1}>{t("editor.move.atEnd")}</option>
            {slots.map((s, i) => (
              <option key={s.id} value={i}>
                {t("editor.move.before", {
                  name:
                    "price" in s
                      ? (s.price ?? s.text.slice(0, 30))
                      : s.name || t("editor.outline.untitled"),
                })}
              </option>
            ))}
          </Select>
        </FieldGroup>
      )}

      <div className="flex flex-wrap gap-3">
        <Button
          variant="accent"
          size="lg"
          disabled={!round || (target.kind === "question" && !theme)}
          onClick={move}
          data-testid="move-confirm"
        >
          {t("editor.move.confirm")}
        </Button>
        <Button size="lg" variant="ghost" onClick={onClose}>
          {t("editor.cancel")}
        </Button>
      </div>
    </div>
  );
}
