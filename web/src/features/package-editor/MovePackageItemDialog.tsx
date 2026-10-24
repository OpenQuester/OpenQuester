import { useTranslation } from "react-i18next";
import { Dialog } from "@/ui/Dialog";
import { MovePackageItemForm } from "./tools/MovePackageItemForm";

export type MoveTarget = { kind: "question"; id: string } | { kind: "theme"; id: string };

/**
 * Moving without dragging: works on touch screens and from the keyboard. Any
 * theme of any round for a question, any round for a theme.
 */
export function MovePackageItemDialog({
  target,
  onClose,
}: {
  target: MoveTarget | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Dialog
      open={target != null}
      onOpenChange={(o) => !o && onClose()}
      title={
        target?.kind === "theme" ? t("editor.move.themeTitle") : t("editor.move.questionTitle")
      }
      closeLabel={t("common.close")}
    >
      {target && <MovePackageItemForm key={target.id} target={target} onClose={onClose} />}
    </Dialog>
  );
}
