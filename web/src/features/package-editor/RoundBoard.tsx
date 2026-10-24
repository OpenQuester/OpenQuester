import { packageBoardStyles } from "./board/packageBoardStyles";
import { layoutStyles } from "@/ui/layoutStyles";
import { useTranslation } from "react-i18next";
import { Button } from "@/ui/Button";
import { PlusIcon } from "@/ui/icons";
import type { DraftRound } from "./packageDraft";
import type { CardActions } from "./QuestionCard";
import type { PackageValidationReport } from "./validatePackage";
import { RoundHeader } from "./board/RoundHeader";
import { ThemeRow } from "./board/ThemeRow";
import { useRoundBoard } from "./board/useRoundBoard";

export interface BoardActions extends Omit<CardActions, "dropQuestion"> {
  moveTheme: (id: string) => void;
  removeTheme: (id: string) => void;
  removeRound: (id: string) => void;
  setPrices: (roundId: string) => void;
  pasteQuestions: (roundId: string) => void;
}

export function RoundBoard({
  round,
  roundIndex,
  roundCount,
  report,
  actions,
}: {
  round: DraftRound;
  roundIndex: number;
  roundCount: number;
  report: PackageValidationReport;
  actions: BoardActions;
}) {
  const { t } = useTranslation();
  const controls = useRoundBoard(round, roundIndex);
  const { readOnly, final, addTheme } = controls;
  return (
    <div className="flex flex-col gap-4" data-testid="round-board">
      <RoundHeader
        round={round}
        roundIndex={roundIndex}
        roundCount={roundCount}
        actions={actions}
        controls={controls}
      />
      {final && <p className="m-0 text-sm text-muted">{t("editor.board.finalHelp")}</p>}

      {round.themes.length === 0 ? (
        <div className={packageBoardStyles.emptyRound}>
          <p className="m-0 font-semibold">{t("editor.board.noThemes")}</p>
          <p className={packageBoardStyles.emptyThemeHelp}>{t("editor.board.noThemesHelp")}</p>
          {!readOnly && (
            <Button variant="accent" icon={<PlusIcon size={18} />} onClick={addTheme}>
              {t("editor.board.addTheme")}
            </Button>
          )}
        </div>
      ) : (
        <ol className={layoutStyles.spacedList}>
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
