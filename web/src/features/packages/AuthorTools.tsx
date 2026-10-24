import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/ui/Button";
import { EditIcon } from "@/ui/icons";
import { useDeletePackage, useOpenInEditor } from "./packageActions";
import { PackageDeleteButtons } from "./PackageDeleteButtons";

/** Edit and delete for the package's own author. */
export function AuthorTools({ id }: { id: number }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { opening, error, open } = useOpenInEditor();
  const del = useDeletePackage();
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="flex flex-col gap-2" data-testid="author-tools">
      <div className="flex flex-wrap gap-2">
        <Button icon={<EditIcon size={18} />} disabled={opening} onClick={() => void open(id)}>
          {opening ? t("myPackages.opening") : t("myPackages.edit")}
        </Button>
        <PackageDeleteButtons
          confirm={confirm}
          pending={del.isPending}
          onConfirmChange={setConfirm}
          onDelete={() =>
            del.mutate(id, { onSuccess: () => void navigate({ to: "/packages/mine" }) })
          }
        />
      </div>
      {confirm && <p className="m-0 text-sm text-muted">{t("myPackages.deleteHelp")}</p>}
      {(error || del.isError) && (
        <p role="alert" className="m-0 text-sm text-danger">
          {error ?? t("myPackages.deleteFailed")}
        </p>
      )}
    </div>
  );
}
