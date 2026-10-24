import { useTranslation } from "react-i18next";
import { Button } from "@/ui/Button";
import { TrashIcon } from "@/ui/icons";

/** The owner retains confirmation state, help and mutation errors. */
export function PackageDeleteButtons({
  confirm,
  pending,
  onConfirmChange,
  onDelete,
  deleteTestId,
  confirmTestId,
}: {
  confirm: boolean;
  pending: boolean;
  onConfirmChange: (confirm: boolean) => void;
  onDelete: () => void;
  deleteTestId?: string;
  confirmTestId?: string;
}) {
  const { t } = useTranslation();
  return confirm ? (
    <>
      <Button variant="danger" disabled={pending} onClick={onDelete} data-testid={confirmTestId}>
        {t("myPackages.confirmDelete")}
      </Button>
      <Button variant="ghost" onClick={() => onConfirmChange(false)}>
        {t("common.cancel")}
      </Button>
    </>
  ) : (
    <Button
      variant="ghost"
      icon={<TrashIcon size={18} />}
      onClick={() => onConfirmChange(true)}
      data-testid={deleteTestId}
    >
      {t("myPackages.delete")}
    </Button>
  );
}
