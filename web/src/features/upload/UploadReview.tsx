import { typographyStyles } from "@/ui/typographyStyles";
import { uploadStyles } from "./uploadStyles";
import { linkStyles } from "@/ui/linkStyles";
import { layoutStyles } from "@/ui/layoutStyles";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useMe } from "@/features/auth/useMe";
import { StorageMeter } from "@/features/storage/StorageMeter";
import { formatBytes, timeAgo } from "@/lib/format";
import { Badge } from "@/ui/Badge";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { AlertIcon, EditIcon, UploadIcon } from "@/ui/icons";
import { MediaCompressionToggle } from "./MediaCompressionToggle";
import { ImportWarnings } from "./ImportWarnings";
import type { ParsedPackage } from "./types";
import { contentHash, describe, findDuplicates } from "./upload";

export function UploadReview({
  parsed,
  name,
  onUpload,
  onResume,
  onEdit,
  onCancel,
  editing = false,
  error,
}: {
  parsed: ParsedPackage;
  name: string;
  onUpload: () => void;
  onResume: (id: number) => void;
  onEdit: () => void;
  onCancel: () => void;
  editing?: boolean;
  error?: string;
}) {
  const { t } = useTranslation();
  const c = parsed.content;
  const totals = describe(parsed);
  const empty = totals.questions === 0;
  const needsChoiceRepair = parsed.warnings.some(
    (warning) => warning.code === "choiceCorrectUnresolved",
  );
  const duplicates = useDuplicates(parsed);
  const hasDuplicates = (duplicates.data?.length ?? 0) > 0;
  return (
    <div className="flex flex-col gap-5" data-testid="upload-review">
      {/* First, so nobody scrolls past it to the upload button. */}
      {hasDuplicates && (
        <Duplicates packages={duplicates.data ?? []} onResume={onResume} disabled={editing} />
      )}
      <Card>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-sm text-muted [overflow-wrap:anywhere]">
              {t(`upload.format.${parsed.format}`)} · {name}
            </span>
            <h2 className={typographyStyles.packageTitle}>{c.title}</h2>
            {c.description && <p className="m-0 text-soft">{c.description}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge>{t("upload.questionCount", { count: totals.questions })}</Badge>
            <Badge>
              {t("upload.mediaCount", {
                count: totals.mediaCount,
                size: formatBytes(totals.bytes),
              })}
            </Badge>
            {c.language && <Badge>{c.language.toUpperCase()}</Badge>}
            {c.ageRestriction !== "NONE" && (
              <Badge tone="warning">{c.ageRestriction.replace("A", "")}+</Badge>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <span className="font-semibold">{t("packages.rounds")}</span>
            {c.rounds.map((r, i) => (
              <div key={i} className={layoutStyles.summaryRow}>
                <span className="font-medium [overflow-wrap:anywhere]">
                  {i + 1} · {r.name}
                </span>
                <span className="text-muted">
                  {r.type === "final"
                    ? t("packages.finalThemes", { count: r.themes.length })
                    : t("packages.roundCounts", {
                        themes: r.themes.length,
                        questions: r.themes.reduce((n, th) => n + th.questions.length, 0),
                      })}
                </span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {parsed.warnings.length > 0 && <ImportWarnings warnings={parsed.warnings} />}

      {totals.mediaCount > 0 && <MediaCompressionToggle />}
      {totals.mediaCount > 0 && <StorageMeter />}

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          variant={hasDuplicates ? "secondary" : "accent"}
          size="lg"
          inactive={empty || needsChoiceRepair}
          disabled={empty || needsChoiceRepair || editing}
          onClick={onUpload}
          className="sm:min-w-[240px]"
          icon={<UploadIcon size={20} />}
        >
          {hasDuplicates ? t("upload.uploadAnyway") : t("upload.upload")}
        </Button>
        <Button
          size="lg"
          onClick={onEdit}
          disabled={editing}
          icon={<EditIcon size={20} />}
          data-testid="upload-edit"
        >
          {t("upload.editFirst")}
        </Button>
        <Button size="lg" variant="ghost" onClick={onCancel} disabled={editing}>
          {t("upload.another")}
        </Button>
      </div>
      {empty && <p className="m-0 text-sm text-danger">{t("upload.noQuestions")}</p>}
      {editing && <p role="status">{t("common.loading")}</p>}
      {error && (
        <p role="alert" className="m-0 text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

interface Duplicate {
  id: number;
  title: string;
  createdAt: string;
  author: { id: number; username: string };
  uploadStatus?: "uploading" | "ready";
}

/** Packages already uploaded from this same file, so nobody makes a copy by accident. */
function useDuplicates(parsed: ParsedPackage) {
  const hash = contentHash(parsed);
  return useQuery({
    queryKey: ["package-duplicates", hash],
    queryFn: async () => (await findDuplicates(hash)) as unknown as Duplicate[],
    staleTime: 0,
  });
}

function Duplicates({
  packages,
  onResume,
  disabled,
}: {
  packages: Duplicate[];
  onResume: (id: number) => void;
  disabled: boolean;
}) {
  const { t } = useTranslation();
  const me = useMe();
  return (
    <Card tone="raised" data-testid="upload-duplicates">
      <div className="flex flex-col gap-3">
        <p className={typographyStyles.warningHeading}>
          <AlertIcon size={20} />
          {t("upload.duplicates.title", { count: packages.length })}
        </p>
        <p className="m-0 text-sm text-soft">{t("upload.duplicates.help")}</p>
        <ul className={layoutStyles.list}>
          {packages.map((p) => {
            const mine = p.author.id === me.data?.id;
            const unfinished = p.uploadStatus === "uploading";
            return (
              <li key={p.id} data-testid="upload-duplicate" className={uploadStyles.reviewActions}>
                <div className={uploadStyles.fileSummary}>
                  <span className="font-semibold [overflow-wrap:anywhere]">{p.title}</span>
                  <span className="text-sm text-muted">
                    {mine
                      ? t("upload.duplicates.yours", { when: timeAgo(p.createdAt) })
                      : t("upload.duplicates.by", {
                          author: p.author.username,
                          when: timeAgo(p.createdAt),
                        })}
                  </span>
                  {unfinished && (
                    <Badge tone="warning" className="self-start">
                      {t("packages.uploadUnfinished")}
                    </Badge>
                  )}
                </div>
                {unfinished && mine ? (
                  <Button variant="accent" onClick={() => onResume(p.id)} disabled={disabled}>
                    {t("upload.duplicates.resume")}
                  </Button>
                ) : (
                  <Link to="/packages" search={{ id: p.id }} className={linkStyles.primary}>
                    {t("upload.duplicates.open")}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </Card>
  );
}
