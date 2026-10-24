import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { Dialog } from "@/ui/Dialog";
import { PackageDetailsForm } from "./package-details/PackageDetailsForm";

/** Title, description, language, age rating and tags: one undo step on Save. */
export function PackageDetailsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const requestCloseRef = useRef<(() => void) | null>(null);
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && (requestCloseRef.current ? requestCloseRef.current() : onClose())}
      wide
      title={t("editor.details.title")}
      closeLabel={t("common.close")}
    >
      {open && <PackageDetailsForm onClose={onClose} requestCloseRef={requestCloseRef} />}
    </Dialog>
  );
}
