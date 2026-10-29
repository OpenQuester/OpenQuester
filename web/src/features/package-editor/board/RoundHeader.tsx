import { packageBoardStyles } from "./packageBoardStyles";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { Button } from "@/ui/Button";
import { PlusIcon, TrashIcon } from "@/ui/icons";
import { Menu } from "@/ui/Menu";
import { InlineText } from "../InlineText";
import * as ops from "../packageOperations";
import type { BoardActions } from "../RoundBoard";
import type { DraftRound } from "../packageDraft";
import type { useRoundBoard } from "./useRoundBoard";

export function RoundHeader({
  round,
  roundIndex,
  roundCount,
  actions,
  controls,
}: {
  round: DraftRound;
  roundIndex: number;
  roundCount: number;
  actions: BoardActions;
  controls: ReturnType<typeof useRoundBoard>;
}) {
  const { t } = useTranslation();
  const { apply, readOnly, final, hasFinal, addTheme, setRoundType } = controls;
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className={packageBoardStyles.roundSummary}>
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
          className={packageBoardStyles.roundTitle}
        />
      </div>
      {readOnly ? (
        round.type === "final" && (
          <span className={packageBoardStyles.finalBadge}>
            {t("editor.board.roundTypes.final")}
          </span>
        )
      ) : (
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label={t("editor.board.roundType")}
            className={packageBoardStyles.roundActions}
          >
            {(["simple", "final"] as const).map((type) => (
              <button
                key={type}
                type="button"
                aria-pressed={round.type === type}
                disabled={type === "final" && hasFinal}
                title={type === "final" && hasFinal ? t("editor.board.oneFinal") : undefined}
                onClick={() => setRoundType(type)}
                className={cn(
                  packageBoardStyles.roundAction,
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
              ...(final
                ? []
                : [
                    {
                      label: t("editor.tools.pricesTitle"),
                      onSelect: () => actions.setPrices(round.id),
                    },
                  ]),
              {
                label: t("editor.tools.pasteTitle"),
                onSelect: () => actions.pasteQuestions(round.id),
              },
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
  );
}
