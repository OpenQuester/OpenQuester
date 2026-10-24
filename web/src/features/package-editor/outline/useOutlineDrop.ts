import { useDragging, useDropTarget } from "../packageDragDrop";
import type { DraftRound, DraftTheme } from "../packageDraft";
import * as ops from "../packageOperations";
import { usePackageEditor } from "../packageEditorStore";

export function useRoundDrop(round: DraftRound, index: number) {
  const apply = usePackageEditor((s) => s.apply);
  const selectRound = usePackageEditor((s) => s.selectRound);
  const drag = useDragging();
  const drop = useDropTarget({
    accepts: (d) => (d.kind === "round" ? d.id !== round.id : true),
    axis: drag?.kind === "round" ? "y" : "none",
    onDrop: (d, edge) => {
      if (d.kind === "round")
        apply((p) => ops.moveRound(p, d.id, edge === "before" ? index : index + 1), {
          key: "roundMoved",
        });
      if (d.kind === "theme")
        apply((p) => ops.moveTheme(p, d.id, round.id, round.themes.length), {
          key: "themeMoved",
          args: { to: round.name || "—" },
        });
      if (d.kind === "question" && round.themes.length) {
        const last = round.themes[round.themes.length - 1]!;
        apply((p) => ops.moveQuestion(p, d.id, last.id, last.questions.length), {
          key: "questionMoved",
          args: { to: last.name || "—" },
        });
      }
    },
    onHold: (d) => {
      if (d.kind !== "round") selectRound(round.id);
    },
  });

  return { drag, drop };
}
export function useThemeDrop(theme: DraftTheme, round: DraftRound, index: number) {
  const apply = usePackageEditor((s) => s.apply);
  const drag = useDragging();
  const drop = useDropTarget({
    accepts: (d) => (d.kind === "question" || d.kind === "theme") && d.id !== theme.id,
    axis: drag?.kind === "theme" ? "y" : "none",
    onDrop: (d, edge) => {
      if (d.kind === "question")
        apply((p) => ops.moveQuestion(p, d.id, theme.id, theme.questions.length), {
          key: "questionMoved",
          args: { to: theme.name || "—" },
        });
      if (d.kind === "theme")
        apply((p) => ops.moveTheme(p, d.id, round.id, edge === "before" ? index : index + 1), {
          key: "themeMoved",
          args: { to: round.name || "—" },
        });
    },
  });
  return { drag, drop };
}
