import { useState } from "react";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/cn";
import { Button } from "@/ui/Button";
import { Dialog } from "@/ui/Dialog";
import { Label, Select } from "@/ui/Field";

import * as ops from "./ops";
import { useEditor } from "./store";

export type MoveTarget = { kind: "question"; id: string } | { kind: "theme"; id: string };

/**
 * Moving without dragging: works on touch screens and from the keyboard. Any
 * theme of any round for a question, any round for a theme.
 */
export function MoveDialog({
  target,
  onClose,
}: {
  target: MoveTarget | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Dialog
      open={target != null}
      onOpenChange={(o) => !o && onClose()}
      title={
        target?.kind === "theme" ? t("editor.move.themeTitle") : t("editor.move.questionTitle")
      }
      closeLabel={t("common.close")}
    >
      {target && <MoveForm key={target.id} target={target} onClose={onClose} />}
    </Dialog>
  );
}

function MoveForm({ target, onClose }: { target: MoveTarget; onClose: () => void }) {
  const { t } = useTranslation();
  const pkg = useEditor((s) => s.pkg);
  const apply = useEditor((s) => s.apply);
  const selectRound = useEditor((s) => s.selectRound);
  const select = useEditor((s) => s.select);

  const fromQ = target.kind === "question" ? ops.findQuestion(pkg, target.id) : null;
  const fromT = target.kind === "theme" ? ops.findTheme(pkg, target.id) : null;
  const [roundId, setRoundId] = useState(
    fromQ?.round.id ?? fromT?.round.id ?? pkg.rounds[0]?.id ?? "",
  );
  const [themeId, setThemeId] = useState(fromQ?.theme.id ?? "");
  const round = pkg.rounds.find((r) => r.id === roundId);
  const theme = round?.themes.find((th) => th.id === themeId);
  const slots = target.kind === "question" ? (theme?.questions ?? []) : (round?.themes ?? []);
  const [position, setPosition] = useState<number>(-1);

  const move = () => {
    if (!round) return;
    const at = position < 0 ? slots.length : position;
    if (target.kind === "question" && theme) {
      apply(
        (p) =>
          ops.moveQuestion(p, target.id, theme.id, at, {
            keepPrices: fromQ?.theme.id === theme.id,
          }),
        {
          key: "questionMoved",
          args: { to: theme.name || "—" },
        },
      );
      select(target.id);
    }
    if (target.kind === "theme")
      apply((p) => ops.moveTheme(p, target.id, round.id, at), {
        key: "themeMoved",
        args: { to: round.name || "—" },
      });
    selectRound(round.id);
    onClose();
  };

  return (
    <div className="flex flex-col gap-4 p-5">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="move-round">{t("editor.move.round")}</Label>
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
      </div>

      {target.kind === "question" && (
        <fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0">
          <legend className="mb-1.5 text-[15px] font-semibold">{t("editor.move.theme")}</legend>
          {round?.themes.length ? (
            <div className="flex max-h-[40dvh] flex-col gap-1 overflow-y-auto">
              {round.themes.map((th) => (
                <label
                  key={th.id}
                  className={cn(
                    "flex min-h-11 cursor-pointer items-center gap-3 rounded-sm border px-3",
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
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="move-pos">{t("editor.move.position")}</Label>
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
        </div>
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
