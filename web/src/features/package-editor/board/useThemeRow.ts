import { useDragging, useDropTarget } from "../packageDragDrop";
import { newQuestion, nextPrice, type DraftRound, type DraftTheme } from "../packageDraft";
import * as ops from "../packageOperations";
import type { CardActions } from "../QuestionCard";
import type { BoardActions } from "../RoundBoard";
import { usePackageEditor } from "../packageEditorStore";
import type { PackageValidationReport } from "../validatePackage";

export function useThemeRow({
  theme,
  index,
  round,
  roundIndex,
  report,
  actions,
}: {
  theme: DraftTheme;
  index: number;
  round: DraftRound;
  roundIndex: number;
  report: PackageValidationReport;
  actions: BoardActions;
}) {
  const apply = usePackageEditor((s) => s.apply);
  const density = usePackageEditor((s) => s.density);
  const readOnly = usePackageEditor((s) => s.readOnly);
  const drag = useDragging();
  const final = round.type === "final";
  const issue = report.byNode.get(theme.id);

  const rowDrop = useDropTarget({
    accepts: (d) => !readOnly && d.kind === "theme" && d.id !== theme.id,
    axis: "y",
    onDrop: (d, edge) =>
      apply((p) => ops.moveTheme(p, d.id, round.id, edge === "before" ? index : index + 1), {
        key: "themeMoved",
        args: { to: round.name },
      }),
  });
  const appendDrop = useDropTarget({
    accepts: (d) => d.kind === "question",
    axis: "none",
    onDrop: (d) => dropQuestion(d.id, theme.questions.length),
  });

  const dropQuestion = (id: string, at: number) =>
    apply(
      (p) => {
        const from = ops.findQuestion(p, id);
        return ops.moveQuestion(p, id, theme.id, at, { keepPrices: from?.theme.id === theme.id });
      },
      { key: "questionMoved", args: { to: theme.name || "—" } },
    );

  const addQuestion = () => {
    const q = newQuestion(final ? null : nextPrice(theme, roundIndex));
    apply((p) => ops.addQuestion(p, theme.id, q), { key: "questionAdded" });
    actions.edit(q.id);
  };

  const cardActions: CardActions = { ...actions, dropQuestion };
  const canAdd = !readOnly && (!final || theme.questions.length === 0);

  return {
    apply,
    density,
    readOnly,
    drag,
    final,
    issue,
    rowDrop,
    appendDrop,
    cardActions,
    canAdd,
    addQuestion,
  };
}
