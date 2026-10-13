import { useTranslation } from "react-i18next";

import { cn } from "@/lib/cn";
import { PlusIcon } from "@/ui/icons";

import { dragSource, useDragging, useDropTarget } from "./dnd";
import type { EditorRound, EditorTheme } from "./model";
import * as ops from "./ops";
import { useEditor } from "./store";
import type { Report, Severity } from "./validate";

/**
 * The package tree on wide screens. Every round and theme is a drop target, so
 * a question or theme can go anywhere in the package without scrolling the
 * board; resting on a round opens it.
 */
export function Outline({
  report,
  onAddRound,
  onDetails,
  onJumpTheme,
}: {
  report: Report;
  onAddRound: () => void;
  onDetails: () => void;
  onJumpTheme: (roundId: string, themeId: string) => void;
}) {
  const { t } = useTranslation();
  const rounds = useEditor((s) => s.pkg.rounds);
  return (
    <nav
      aria-label={t("editor.outline.label")}
      className="flex flex-col gap-1.5"
      data-testid="outline"
    >
      <button
        type="button"
        onClick={onDetails}
        className="flex min-h-11 items-center gap-2.5 rounded-sm px-3 text-left font-medium text-soft hover:bg-surface-2"
      >
        {t("editor.outline.details")}
      </button>
      <div className="mx-3 mt-3 mb-1 text-xs font-bold tracking-[0.08em] text-faint uppercase">
        {t("editor.outline.rounds")}
      </div>
      <ol className="m-0 flex list-none flex-col gap-1 p-0">
        {rounds.map((r, i) => (
          <RoundItem key={r.id} round={r} index={i} report={report} onJumpTheme={onJumpTheme} />
        ))}
      </ol>
      <button
        type="button"
        onClick={onAddRound}
        className="mt-1.5 flex min-h-11 items-center gap-2 rounded-sm border border-dashed border-line-strong px-3 text-sm font-semibold text-muted hover:text-text"
      >
        <PlusIcon size={16} />
        {t("editor.outline.addRound")}
      </button>
    </nav>
  );
}

function Dot({ severity }: { severity?: Severity }) {
  const { t } = useTranslation();
  if (!severity || severity === "info") return null;
  return (
    <span
      role="img"
      aria-label={t(severity === "critical" ? "editor.board.needsFix" : "editor.board.check")}
      className={cn(
        "size-2 shrink-0 rounded-full",
        severity === "critical" ? "bg-danger-strong" : "bg-warning",
      )}
    />
  );
}

function RoundItem({
  round,
  index,
  report,
  onJumpTheme,
}: {
  round: EditorRound;
  index: number;
  report: Report;
  onJumpTheme: (roundId: string, themeId: string) => void;
}) {
  const { t } = useTranslation();
  const apply = useEditor((s) => s.apply);
  const current = useEditor((s) => s.roundId === round.id);
  const selectRound = useEditor((s) => s.selectRound);
  const drag = useDragging();
  const questions = round.themes.reduce((n, th) => n + th.questions.length, 0);

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

  return (
    <li className="relative">
      {drop.over && drag?.kind === "round" && (
        <span
          aria-hidden
          className={cn(
            "absolute inset-x-2 h-1 rounded-full bg-accent",
            drop.over === "before" ? "-top-1" : "-bottom-1",
          )}
        />
      )}
      <button
        type="button"
        {...dragSource({ kind: "round", id: round.id })}
        {...drop.props}
        aria-current={current ? "page" : undefined}
        onClick={() => selectRound(round.id)}
        className={cn(
          "flex w-full flex-col gap-0.5 rounded-sm border-2 px-3 py-2 text-left text-text",
          drop.over && drag?.kind !== "round"
            ? "border-accent bg-accent-surface"
            : current
              ? "border-transparent bg-surface-2"
              : "border-transparent hover:bg-surface-2",
        )}
      >
        <span className="flex items-center gap-2 font-semibold">
          <span className="min-w-0 flex-1 truncate">
            {index + 1} · {round.name || t("editor.outline.untitled")}
          </span>
          {round.type === "final" && (
            <span className="rounded-[6px] bg-accent-surface px-1.5 text-[11px] font-bold text-accent-strong">
              {t("editor.board.roundTypes.final")}
            </span>
          )}
          <Dot severity={report.byNode.get(round.id)} />
        </span>
        <span className="text-[13px] text-muted">
          {t("editor.outline.counts", { themes: round.themes.length, questions })}
        </span>
      </button>
      {round.themes.length > 0 && (
        <ol className="m-0 mt-0.5 mb-1.5 flex list-none flex-col gap-0.5 py-0 pr-0 pl-4">
          {round.themes.map((th, i) => (
            <ThemeItem
              key={th.id}
              theme={th}
              index={i}
              round={round}
              report={report}
              onJump={onJumpTheme}
            />
          ))}
        </ol>
      )}
    </li>
  );
}

function ThemeItem({
  theme,
  index,
  round,
  report,
  onJump,
}: {
  theme: EditorTheme;
  index: number;
  round: EditorRound;
  report: Report;
  onJump: (roundId: string, themeId: string) => void;
}) {
  const { t } = useTranslation();
  const apply = useEditor((s) => s.apply);
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
  return (
    <li className="relative">
      {drop.over && drag?.kind === "theme" && (
        <span
          aria-hidden
          className={cn(
            "absolute inset-x-1 h-0.5 rounded-full bg-accent",
            drop.over === "before" ? "-top-px" : "-bottom-px",
          )}
        />
      )}
      <button
        type="button"
        {...dragSource({ kind: "theme", id: theme.id })}
        {...drop.props}
        data-testid="outline-theme"
        onClick={() => onJump(round.id, theme.id)}
        className={cn(
          "flex min-h-9 w-full items-center gap-2 rounded-[8px] border-2 px-2.5 text-left text-sm",
          drop.over && drag?.kind === "question"
            ? "border-accent bg-accent-surface text-accent-strong"
            : "border-transparent text-soft hover:bg-surface-2 hover:text-text",
        )}
      >
        <span className="min-w-0 flex-1 truncate">
          {theme.name || t("editor.outline.untitled")}
        </span>
        <span className="text-xs text-faint">{theme.questions.length}</span>
        <Dot severity={report.byNode.get(theme.id)} />
      </button>
    </li>
  );
}
