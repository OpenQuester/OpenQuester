import type { PackageValidationIssue, PackageValidationReport } from "../validatePackage";
import { PublishCheck } from "./PublishCheck";
import { PublishDone, PublishProgress } from "./PublishStatus";
import { usePublishPackage, type PublishStep } from "./usePublishPackage";

export function PublishBody({
  report,
  step,
  setStep,
  onJump,
}: {
  report: PackageValidationReport;
  step: PublishStep;
  setStep: (step: PublishStep) => void;
  onJump: (issue: PackageValidationIssue) => void;
}) {
  const publishing = usePublishPackage(setStep);
  if (step.kind === "uploading") return <PublishProgress progress={step.progress} />;
  if (step.kind === "done") return <PublishDone step={step} />;
  return <PublishCheck report={report} step={step} onJump={onJump} publishing={publishing} />;
}
