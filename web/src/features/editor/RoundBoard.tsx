import { useTranslation } from "react-i18next";

import { cn } from "@/lib/cn";
import { Button } from "@/ui/Button";
import { CopyIcon, GripIcon, MoveIcon, PlusIcon, TrashIcon } from "@/ui/icons";
import { Menu } from "@/ui/Menu";

import { dragSource, useDragging, useDropTarget } from "./dnd";
import { InlineText } from "./InlineText";
import { newQuestion, nextPrice, starterTheme, type EditorRound, type EditorTheme } from "./model";
import * as ops from "./ops";
import { QuestionCard, type CardActions } from "./QuestionCard";
import { useEditor } from "./store";
import type { Report } from "./validate";

export interface BoardActions extends Omit<CardActions, "dropQuestion"> {
  moveTheme: (id: string) => void;
  removeTheme: (id: string) => void;
  removeRound: (id: string) => void;
}

export function RoundBoard({
  round,
  roundIndex,
  roundCount,
  report,
  actions,
}: {
  round: EditorRound;
  roundIndex: number;
  roundCount: number;
  report: Report;
  actions: BoardActions;
}) {
  const { t } = useTranslation();
  const apply = useEditor((s) => s.apply);
  const readOnly = useEditor((s) => s.readOnly);
  const final = round.type === "final";
  const hasFinal = useEditor((s) =>
    s.pkg.rounds.some((r) => r.type === "final" && r.id !== round.id),
  );

  const addTheme = () => {
    const theme = final
      ? { ...starterTheme("", roundIndex), questions: [newQuestion(null)] }
      : starterTheme("", roundIndex);
    apply((p) => ops.addTheme(p, round.id, theme), { key: "themeAdded" });
    requestAnimationFrame(() => document.getElementById(`theme-name-${theme.id}`)?.focus());
  };

  return (
    <div className="flex flex-col gap-4" data-testid="round-board">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-0 flex-[1_1_280px] flex-col gap-1">
          <span className="text-sm text-faint">
            {t("editor.board.roundOf", { n: roundIndex + 1, total: roundCount })}
          </span>
          <InlineText
            value={round.name}
            label={t("editor.board.roundName")}
            placeholder={t("editor.board.roundNamePlaceholder")}
            onCommit={(name) =>
              apply((p) => ops.updateRound(p, round.id, { name }), { key: "renamed" })
            }
            readOnly={readOnly}
            className="-ml-1.5 font-display text-[clamp(24px,3vw,34px)] font-extrabold tracking-tight"
          />
        </div>
        {readOnly ? (
          round.type === "final" && (
            <span className="rounded-[8px] bg-accent-surface px-2.5 py-1 text-sm font-bold text-accent-strong">
              {t("editor.board.roundTypes.final")}
            </span>
          )
        ) : (
          <div className="flex items-center gap-2">
            <div
              role="group"
              aria-label={t("editor.board.roundType")}
              className="flex rounded-[12px] border border-line bg-surface p-1"
            >
              {(["simple", "final"] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  aria-pressed={round.type === type}
                  disabled={type === "final" && hasFinal}
                  title={type === "final" && hasFinal ? t("editor.board.oneFinal") : undefined}
                  onClick={() =>
                    apply(
                      (p) => {
                        let next = ops.updateRound(p, round.id, { type });
                        // The final round has to be last.
                        if (type === "final")
                          next = ops.moveRound(next, round.id, next.rounds.length);
                        return next;
                      },
                      { key: "roundType" },
                    )
                  }
                  className={cn(
                    "min-h-9 rounded-[9px] px-3.5 text-sm font-semibold disabled:cursor-not-allowed disabled:text-ghost",
                    round.type === type ? "bg-surface-3 text-text" : "text-muted hover:text-text",
                  )}
                >
                  {t(`editor.board.roundTypes.${type}`)}
                </button>
              ))}
            </div>
            <Button
              icon={<PlusIcon size={18} />}
              onClick={addTheme}
              data-testid="add-theme"
              className="whitespace-nowrap"
            >
              {t("editor.board.addTheme")}
            </Button>
            <Menu
              label={t("editor.board.roundActions")}
              size={44}
              className="border border-line-strong"
              items={[
                {
                  label: t("editor.actions.deleteRound"),
                  icon: <TrashIcon size={16} />,
                  danger: true,
                  onSelect: () => actions.removeRound(round.id),
                },
              ]}
            />
          </div>
        )}
      </div>
      {final && <p className="m-0 text-sm text-muted">{t("editor.board.finalHelp")}</p>}

      {round.themes.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border-2 border-dashed border-line-strong px-5 py-10 text-center">
          <p className="m-0 font-semibold">{t("editor.board.noThemes")}</p>
          <p className="m-0 max-w-[44ch] text-sm text-muted">{t("editor.board.noThemesHelp")}</p>
          {!readOnly && (
            <Button variant="accent" icon={<PlusIcon size={18} />} onClick={addTheme}>
              {t("editor.board.addTheme")}
            </Button>
          )}
        </div>
      ) : (
        <ol className="m-0 flex list-none flex-col gap-3 p-0">
          {round.themes.map((theme, i) => (
            <ThemeRow
              key={theme.id}
              theme={theme}
              index={i}
              round={round}
              roundIndex={roundIndex}
              report={report}
              actions={actions}
            />
          ))}
        </ol>
      )}
    </div>
  );
}

function ThemeRow({
  theme,
  index,
  round,
  roundIndex,
  report,
  actions,
}: {
  theme: EditorTheme;
  index: number;
  round: EditorRound;
  roundIndex: number;
  report: Report;
  actions: BoardActions;
}) {
  const { t } = useTranslation();
  const apply = useEditor((s) => s.apply);
  const density = useEditor((s) => s.density);
  const readOnly = useEditor((s) => s.readOnly);
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

  return (
    <li
      {...rowDrop.props}
      data-testid="theme-row"
      className={cn(
        "relative flex flex-col gap-2.5 rounded-lg border bg-surface p-3 md:grid md:grid-cols-[200px_1fr] md:gap-3",
        issue === "critical" ? "border-danger-strong/50" : "border-line",
        drag?.kind === "theme" && drag.id === theme.id && "opacity-40",
      )}
    >
      {rowDrop.over && (
        <span
          aria-hidden
          className={cn(
            "absolute inset-x-2 z-10 h-1 rounded-full bg-accent",
            rowDrop.over === "before" ? "-top-2" : "-bottom-2",
          )}
        />
      )}
      <div className="flex min-w-0 items-start gap-1 md:flex-col md:items-stretch">
        <div className="flex min-w-0 flex-1 items-center gap-1 md:flex-none">
          {!readOnly && (
            <span
              {...dragSource({ kind: "theme", id: theme.id })}
              aria-hidden
              title={t("editor.board.dragTheme")}
              className="hidden h-9 w-6 shrink-0 cursor-grab items-center justify-center text-faint hover:text-text md:inline-flex"
            >
              <GripIcon size={16} />
            </span>
          )}
          <InlineText
            id={`theme-name-${theme.id}`}
            value={theme.name}
            label={t("editor.board.themeName")}
            placeholder={t("editor.board.themeNamePlaceholder")}
            onCommit={(name) =>
              apply((p) => ops.updateTheme(p, theme.id, { name }), { key: "renamed" })
            }
            readOnly={readOnly}
            className="w-full flex-1 font-semibold"
          />
          {!readOnly && (
            <Menu
              label={t("editor.board.themeActions", { name: theme.name || "—" })}
              items={[
                {
                  label: t("editor.actions.moveTheme"),
                  icon: <MoveIcon size={16} />,
                  onSelect: () => actions.moveTheme(theme.id),
                },
                {
                  label: t("editor.actions.duplicate"),
                  icon: <CopyIcon size={16} />,
                  onSelect: () =>
                    apply((p) => ops.duplicateTheme(p, theme.id).pkg, { key: "duplicated" }),
                },
                {
                  label: t("editor.actions.deleteTheme"),
                  icon: <TrashIcon size={16} />,
                  danger: true,
                  onSelect: () => actions.removeTheme(theme.id),
                },
              ]}
            />
          )}
        </div>
        <span className="hidden px-1.5 text-xs text-faint md:block md:pl-8">
          {t("editor.board.questionCount", { count: theme.questions.length })}
        </span>
      </div>
      <div
        className={cn(
          "grid gap-2.5",
          density === "cards"
            ? "grid-cols-[repeat(auto-fill,minmax(min(190px,100%),1fr))]"
            : "grid-cols-[repeat(auto-fill,minmax(132px,1fr))]",
        )}
      >
        {theme.questions.map((q, qi) => (
          <QuestionCard
            key={q.id}
            question={q}
            index={qi}
            final={final}
            issue={report.byNode.get(q.id)}
            actions={cardActions}
          />
        ))}
        {(canAdd || (!readOnly && drag?.kind === "question")) && (
          <button
            type="button"
            {...appendDrop.props}
            onClick={canAdd ? addQuestion : undefined}
            aria-label={t("editor.board.addQuestionTo", { name: theme.name || "—" })}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-md border-2 border-dashed text-sm font-semibold",
              density === "cards" ? "min-h-[150px]" : "min-h-[84px]",
              appendDrop.over
                ? "border-accent bg-accent-surface text-accent-strong"
                : "border-line-strong text-faint hover:text-text",
            )}
          >
            <PlusIcon size={16} />
            {drag?.kind === "question" ? t("editor.board.dropHere") : t("editor.board.addQuestion")}
          </button>
        )}
      </div>
    </li>
  );
}
