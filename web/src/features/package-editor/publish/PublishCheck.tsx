import { packagePublishStyles } from "./packagePublishStyles";
import { useTranslation } from "react-i18next";
import { startDiscordLogin } from "@/features/auth/discord";
import { MediaCompressionToggle } from "@/features/upload/MediaCompressionToggle";
import { ImportWarnings } from "@/features/upload/ImportWarnings";
import { cn } from "@/lib/cn";
import { Button } from "@/ui/Button";
import { AlertIcon, CheckIcon, UploadIcon } from "@/ui/icons";
import type { PackageValidationIssue, PackageValidationReport } from "../validatePackage";
import type { PublishStep, usePublishPackage } from "./usePublishPackage";

export function PublishCheck({
  report,
  step,
  onJump,
  publishing,
}: {
  report: PackageValidationReport;
  step: Extract<PublishStep, { kind: "check" | "failed" }>;
  onJump: (issue: PackageValidationIssue) => void;
  publishing: ReturnType<typeof usePublishPackage>;
}) {
  const { t } = useTranslation();
  const { me, discordClientId, publishedId, importWarnings, publish } = publishing;
  const groups = (["critical", "warning", "info"] as const)
    .map((s) => ({ s, items: report.issues.filter((i) => i.severity === s) }))
    .filter((g) => g.items.length);
  const signedIn = me.data && !me.data.isGuest;
  const blocked = report.critical > 0 || !signedIn;

  return (
    <div className="flex flex-col gap-5 p-5" data-testid="publish-check">
      {/* What importing the original file changed; the checks below can't see it */}
      {importWarnings.length > 0 && <ImportWarnings warnings={importWarnings} />}
      <p
        className={cn(
          "m-0 flex items-center gap-2 font-semibold",
          report.health === "broken"
            ? "text-danger"
            : report.health === "needsAttention"
              ? "text-warning"
              : "text-success",
        )}
      >
        {report.health === "good" ? <CheckIcon size={20} /> : <AlertIcon size={20} />}
        {t(`editor.health.${report.health}`, { count: report.critical })}
      </p>
      {groups.map((g) => (
        <section key={g.s} className="flex flex-col gap-2">
          <h3 className={packagePublishStyles.issueGroupTitle}>
            {t(`editor.severity.${g.s}`, { count: g.items.length })}
          </h3>
          <ul className={packagePublishStyles.issues}>
            {g.items.map((i) => (
              <li key={i.id}>
                <button
                  type="button"
                  onClick={() => onJump(i)}
                  className={cn(
                    packagePublishStyles.issue,
                    g.s === "critical"
                      ? "border-danger/40 bg-danger-surface"
                      : g.s === "warning"
                        ? "border-line bg-warning-surface/50"
                        : "border-line bg-surface-2",
                  )}
                >
                  {i.where && (
                    <span className="text-xs text-faint [overflow-wrap:anywhere]">{i.where}</span>
                  )}
                  <span className="text-sm">{t(`editor.issues.${i.code}`, i.args)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {signedIn && report.critical === 0 && <MediaCompressionToggle />}
      {step.kind === "failed" && (
        <p role="alert" className="m-0 text-danger [overflow-wrap:anywhere]">
          {step.error}
        </p>
      )}
      <div className="flex flex-col gap-2">
        <Button
          variant="accent"
          size="lg"
          inactive={blocked}
          disabled={blocked}
          icon={<UploadIcon size={20} />}
          onClick={() => void publish(publishedId != null)}
          data-testid="publish-confirm"
        >
          {publishedId != null ? t("editor.publish.saveChanges") : t("editor.publish.publish")}
        </Button>
        {publishedId != null && !blocked && (
          <Button
            size="sm"
            variant="ghost"
            className="self-start"
            onClick={() => void publish(false)}
          >
            {t("editor.publish.publishAsNew")}
          </Button>
        )}
        {report.critical > 0 ? (
          <p className="m-0 text-sm text-danger">
            {t("editor.publish.blocked", { count: report.critical })}
          </p>
        ) : !signedIn ? (
          <div className="flex flex-col gap-2">
            <p className="m-0 text-sm text-muted">
              {me.data?.isGuest ? t("upload.guestHelp") : t("upload.signInFirst")}
            </p>
            {discordClientId && (
              <Button
                size="sm"
                className="self-start"
                onClick={() => void startDiscordLogin(discordClientId, window.location.pathname)}
              >
                {t("login.discord")}
              </Button>
            )}
          </div>
        ) : (
          <p className="m-0 text-sm text-muted">{t("editor.publish.help")}</p>
        )}
      </div>
    </div>
  );
}
