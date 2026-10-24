import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Dialog } from "@/ui/Dialog";
import { PublishBody } from "./publish/PublishBody";
import type { PublishStep } from "./publish/usePublishPackage";
import type { PackageValidationIssue, PackageValidationReport } from "./validatePackage";

/**
 * The publish check: every issue grouped by severity with a jump to its
 * question; Publish stays off while anything critical is left and says why.
 */
export function PublishPackageDialog({
  open,
  onClose,
  report,
  onJump,
}: {
  open: boolean;
  onClose: () => void;
  report: PackageValidationReport;
  onJump: (issue: PackageValidationIssue) => void;
}) {
  const { t } = useTranslation();
  const [step, setStep] = useState<PublishStep>({ kind: "check" });
  const busy = step.kind === "uploading";
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o || busy) return;
        onClose();
        if (step.kind !== "check") setStep({ kind: "check" });
      }}
      title={t("editor.publish.title")}
      closeLabel={t("common.close")}
    >
      <PublishBody
        report={report}
        step={step}
        setStep={setStep}
        onJump={(i) => (onClose(), onJump(i))}
      />
    </Dialog>
  );
}
