import { packageOutlineStyles } from "./packageOutlineStyles";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { dragSource } from "../packageDragDrop";
import type { DraftRound, DraftTheme } from "../packageDraft";
import { usePackageEditor } from "../packageEditorStore";
import type { PackageValidationReport, ValidationSeverity } from "../validatePackage";
import { useRoundDrop, useThemeDrop } from "./useOutlineDrop";

function Dot({ severity }: { severity?: ValidationSeverity }) {
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

export function OutlineRoundItem({
  round,
  index,
  report,
  onJumpTheme,
}: {
  round: DraftRound;
  index: number;
  report: PackageValidationReport;
  onJumpTheme: (roundId: string, themeId: string) => void;
}) {
  const { t } = useTranslation();
  const current = usePackageEditor((s) => s.roundId === round.id);
  const selectRound = usePackageEditor((s) => s.selectRound);
  const readOnly = usePackageEditor((s) => s.readOnly);
  const questions = round.themes.reduce((n, th) => n + th.questions.length, 0);

  const { drag, drop } = useRoundDrop(round, index);

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
        {...dragSource({ kind: "round", id: round.id }, !readOnly)}
        {...drop.props}
        aria-current={current ? "page" : undefined}
        onClick={() => selectRound(round.id)}
        className={cn(
          packageOutlineStyles.round,
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
            <span className={packageOutlineStyles.finalBadge}>
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
        <ol className={packageOutlineStyles.themes}>
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
  theme: DraftTheme;
  index: number;
  round: DraftRound;
  report: PackageValidationReport;
  onJump: (roundId: string, themeId: string) => void;
}) {
  const { t } = useTranslation();
  const readOnly = usePackageEditor((s) => s.readOnly);
  const { drag, drop } = useThemeDrop(theme, round, index);

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
        {...dragSource({ kind: "theme", id: theme.id }, !readOnly)}
        {...drop.props}
        data-testid="outline-theme"
        onClick={() => onJump(round.id, theme.id)}
        className={cn(
          packageOutlineStyles.theme,
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
