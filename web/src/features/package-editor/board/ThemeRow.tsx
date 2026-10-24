import { packageBoardStyles, questionCardHeight } from "./packageBoardStyles";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { CopyIcon, GripIcon, MoveIcon, PlusIcon, TrashIcon } from "@/ui/icons";
import { Menu } from "@/ui/Menu";
import { dragSource } from "../packageDragDrop";
import { InlineText } from "../InlineText";
import type { DraftRound, DraftTheme } from "../packageDraft";
import * as ops from "../packageOperations";
import { QuestionCard } from "../QuestionCard";
import type { BoardActions } from "../RoundBoard";
import type { PackageValidationReport } from "../validatePackage";

import { useThemeRow } from "./useThemeRow";

export function ThemeRow({
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
  const { t } = useTranslation();
  const {
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
  } = useThemeRow({ theme, index, round, roundIndex, report, actions });
  return (
    <li
      {...rowDrop.props}
      data-testid="theme-row"
      className={cn(
        packageBoardStyles.theme,
        issue === "critical" ? "border-danger-strong/50" : "border-line",
        drag?.kind === "theme" && drag.id === theme.id && "opacity-40",
      )}
    >
      {rowDrop.over && (
        <span
          aria-hidden
          className={cn(
            packageBoardStyles.themeInsertion,
            rowDrop.over === "before" ? "-top-2" : "-bottom-2",
          )}
        />
      )}
      <div className={packageBoardStyles.themeHeading}>
        <div className={packageBoardStyles.themeTitle}>
          {!readOnly && (
            <span
              {...dragSource({ kind: "theme", id: theme.id })}
              aria-hidden
              title={t("editor.board.dragTheme")}
              className={packageBoardStyles.themeDragHandle}
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
        <span className={packageBoardStyles.themeHint}>
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
              packageBoardStyles.addQuestion,
              questionCardHeight(density === "cards"),
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
