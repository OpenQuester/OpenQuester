import { useState } from "react";
import type { MoveTarget } from "../MovePackageItemDialog";
import * as ops from "../packageOperations";
import { usePackageEditor } from "../packageEditorStore";

export function useMoveTarget(target: MoveTarget, onClose: () => void) {
  const pkg = usePackageEditor((s) => s.pkg);
  const apply = usePackageEditor((s) => s.apply);
  const selectRound = usePackageEditor((s) => s.selectRound);
  const select = usePackageEditor((s) => s.select);

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

  return {
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
  };
}
