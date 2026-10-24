import { layoutStyles } from "@/ui/layoutStyles";
import { useTranslation } from "react-i18next";
import { Button } from "@/ui/Button";
import { Dialog } from "@/ui/Dialog";
import { PasteQuestionsDialog } from "../tools/PasteQuestionsDialog";
import { RoundPricesDialog } from "../tools/RoundPricesDialog";
import { QuestionSearchDialog } from "../tools/QuestionSearchDialog";
import { MovePackageItemDialog } from "../MovePackageItemDialog";
import { PackageDetailsDialog } from "../PackageDetailsDialog";
import { PublishPackageDialog } from "../PublishPackageDialog";
import { QuestionDialog } from "../QuestionDialog";
import type { usePackageEditorShell } from "./usePackageEditorShell";

export function PackageEditorDialogs({
  moveTarget,
  setMoveTarget,
  pricesRound,
  setPricesRound,
  pasteRound,
  setPasteRound,
  search,
  setSearch,
  details,
  setDetails,
  publish,
  setPublish,
  confirm,
  setConfirm,
  selectRound,
  edit,
  report,
  jumpToIssue,
  confirmRemoval,
}: ReturnType<typeof usePackageEditorShell>["dialogs"]) {
  const { t } = useTranslation();
  return (
    <>
      <QuestionDialog />
      <MovePackageItemDialog target={moveTarget} onClose={() => setMoveTarget(null)} />
      <RoundPricesDialog roundId={pricesRound} onClose={() => setPricesRound(null)} />
      <PasteQuestionsDialog roundId={pasteRound} onClose={() => setPasteRound(null)} />
      <QuestionSearchDialog
        open={search}
        onClose={() => setSearch(false)}
        onOpen={(roundId, questionId) => {
          selectRound(roundId);
          edit(questionId);
        }}
      />
      <PackageDetailsDialog open={details} onClose={() => setDetails(false)} />
      <PublishPackageDialog
        open={publish}
        onClose={() => setPublish(false)}
        report={report}
        onJump={jumpToIssue}
      />
      <Dialog
        open={confirm != null}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={
          confirm?.kind === "round"
            ? t("editor.confirm.roundTitle")
            : t("editor.confirm.themeTitle")
        }
        closeLabel={t("common.close")}
      >
        {confirm && (
          <div className={layoutStyles.cardBody}>
            <p className="m-0 text-soft [overflow-wrap:anywhere]">
              {t(`editor.confirm.${confirm.kind}Body`, {
                name: confirm.name || "—",
                count: confirm.questions,
              })}
            </p>
            <div className="flex flex-wrap gap-3">
              <Button
                variant="danger"
                size="lg"
                data-testid="confirm-delete"
                onClick={confirmRemoval}
              >
                {t("editor.actions.delete")}
              </Button>
              <Button size="lg" variant="ghost" onClick={() => setConfirm(null)}>
                {t("editor.cancel")}
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </>
  );
}
