import { newQuestion, starterTheme, type DraftRound } from "../packageDraft";
import * as ops from "../packageOperations";
import { usePackageEditor } from "../packageEditorStore";

export function useRoundBoard(round: DraftRound, roundIndex: number) {
  const apply = usePackageEditor((s) => s.apply);
  const readOnly = usePackageEditor((s) => s.readOnly);
  const final = round.type === "final";
  const hasFinal = usePackageEditor((s) =>
    s.pkg.rounds.some((r) => r.type === "final" && r.id !== round.id),
  );

  const addTheme = () => {
    const theme = final
      ? { ...starterTheme("", roundIndex), questions: [newQuestion(null)] }
      : starterTheme("", roundIndex);
    apply((p) => ops.addTheme(p, round.id, theme), { key: "themeAdded" });
    requestAnimationFrame(() => document.getElementById(`theme-name-${theme.id}`)?.focus());
  };

  const setRoundType = (type: DraftRound["type"]) =>
    apply(
      (pkg) => {
        let next = ops.updateRound(pkg, round.id, { type });
        if (type === "final") next = ops.moveRound(next, round.id, next.rounds.length);
        return next;
      },
      { key: "roundType" },
    );
  return { apply, readOnly, final, hasFinal, addTheme, setRoundType };
}
