import { packageBrowserStyles } from "./packageBrowserStyles";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { Badge } from "@/ui/Badge";
import type { PackageCard } from "./usePackages";
export function PackageTile({
  pkg,
  selected,
  onSelect,
}: {
  pkg: PackageCard;
  selected: boolean;
  onSelect: () => void;
}) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        packageBrowserStyles.package,
        selected ? "border-accent" : "border-line hover:border-line-strong",
      )}
      data-testid="package-tile"
    >
      <span className="text-lg font-semibold [overflow-wrap:anywhere]">{pkg.title}</span>
      <span className="text-sm text-muted">
        {t("packages.by", { name: pkg.author.username })}
        {pkg.language ? ` · ${pkg.language.toUpperCase()}` : ""}
      </span>
      {pkg.roundsCount != null && (
        <span className="text-sm text-soft">
          {t("packages.counts", { rounds: pkg.roundsCount, questions: pkg.questionsCount ?? 0 })}
        </span>
      )}
      {pkg.ageRestriction && pkg.ageRestriction !== "NONE" && (
        <Badge tone="warning" className="self-start">
          {pkg.ageRestriction.replace("A", "")}+
        </Badge>
      )}
      {pkg.uploadStatus === "uploading" && (
        <Badge tone="warning" className="self-start">
          {t("packages.uploadUnfinished")}
        </Badge>
      )}
    </button>
  );
}
