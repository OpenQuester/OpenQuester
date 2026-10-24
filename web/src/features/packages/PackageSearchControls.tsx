import { packageBrowserStyles } from "./packageBrowserStyles";
import { layoutStyles } from "@/ui/layoutStyles";
import { useTranslation } from "react-i18next";
import { Button } from "@/ui/Button";
import { LANGUAGES } from "@/i18n/index";
import { Badge } from "@/ui/Badge";
import { Select, TextInput } from "@/ui/Field";
import { NO_FILTERS, type PackageFilters, type PackageSort } from "./usePackages";
import type { PackageBrowser } from "./usePackageBrowser";

export function PackageSearchControls({ browser }: { browser: PackageBrowser }) {
  const { t } = useTranslation();
  const { query, setQuery, filters, change, showMore, setShowMore, extra, me } = browser;
  return (
    <>
      <div className={layoutStyles.spacedActions}>
        <label htmlFor="pk-search" className="sr-only">
          {t("packages.search")}
        </label>
        <TextInput
          id="pk-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("packages.search")}
          className="flex-[1_1_260px] bg-surface"
        />
        <label htmlFor="pk-lang" className="text-sm text-muted">
          {t("packages.language")}
        </label>
        <Select
          id="pk-lang"
          className="w-auto bg-surface"
          value={filters.language}
          onChange={(e) => change({ language: e.target.value })}
        >
          <option value="">{t("packages.anyLanguage")}</option>
          {LANGUAGES.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
        </Select>
        <label htmlFor="pk-sort" className="text-sm text-muted">
          {t("packages.sort")}
        </label>
        <Select
          id="pk-sort"
          className="w-auto bg-surface"
          value={filters.sort}
          onChange={(e) => change({ sort: e.target.value as PackageSort })}
        >
          <option value="newest">{t("packages.sortNewest")}</option>
          <option value="oldest">{t("packages.sortOldest")}</option>
          <option value="title">{t("packages.sortTitle")}</option>
          <option value="titleDesc">{t("packages.sortTitleDesc")}</option>
          <option value="author">{t("packages.sortAuthor")}</option>
        </Select>
        <Button
          size="sm"
          variant="ghost"
          aria-expanded={showMore}
          aria-controls="pk-more"
          onClick={() => setShowMore((v) => !v)}
          className="min-h-11"
        >
          {showMore ? t("packages.hideFilters") : t("packages.moreFilters")}
          {extra > 0 && <Badge tone="accent">{extra}</Badge>}
        </Button>
      </div>
      {showMore && (
        <MoreFilters
          filters={filters}
          myId={me.data && !me.data.isGuest ? me.data.id : null}
          onChange={change}
          onClear={() => change({ ...NO_FILTERS, language: filters.language })}
        />
      )}
    </>
  );
}

const AGES = ["NONE", "A12", "A16", "A18"] as const;

function MoreFilters({
  filters,
  myId,
  onChange,
  onClear,
}: {
  filters: PackageFilters;
  myId: number | null;
  onChange: (patch: Partial<PackageFilters>) => void;
  onClear: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div id="pk-more" className={packageBrowserStyles.filters} data-testid="package-filters">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="pk-age" className="text-sm text-muted">
          {t("packages.age")}
        </label>
        <Select
          id="pk-age"
          className="w-auto"
          value={filters.age}
          onChange={(e) => onChange({ age: e.target.value as PackageFilters["age"] })}
        >
          <option value="">{t("packages.anyAge")}</option>
          {AGES.map((a) => (
            <option key={a} value={a}>
              {a === "NONE" ? t("packages.ageNone") : `${a.slice(1)}+`}
            </option>
          ))}
        </Select>
      </div>
      <RangeFilter
        id="pk-rounds"
        label={t("packages.roundsRange")}
        min={filters.minRounds}
        max={filters.maxRounds}
        onChange={(minRounds, maxRounds) => onChange({ minRounds, maxRounds })}
      />
      <RangeFilter
        id="pk-questions"
        label={t("packages.questionsRange")}
        min={filters.minQuestions}
        max={filters.maxQuestions}
        onChange={(minQuestions, maxQuestions) => onChange({ minQuestions, maxQuestions })}
      />
      {myId != null && (
        <label className="flex min-h-11 items-center gap-2.5">
          <input
            type="checkbox"
            checked={filters.authorId === myId}
            onChange={(e) => onChange({ authorId: e.target.checked ? myId : null })}
            className="h-5 w-5 accent-[var(--oq-accent)]"
          />
          {t("packages.onlyMine")}
        </label>
      )}
      <Button size="sm" variant="ghost" className="min-h-11" onClick={onClear}>
        {t("packages.clearFilters")}
      </Button>
    </div>
  );
}

function RangeFilter({
  id,
  label,
  min,
  max,
  onChange,
}: {
  id: string;
  label: string;
  min: number | null;
  max: number | null;
  onChange: (min: number | null, max: number | null) => void;
}) {
  const { t } = useTranslation();
  const parse = (v: string) => {
    const n = Number.parseInt(v, 10);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };
  return (
    <fieldset className={layoutStyles.compactOptionGroup}>
      <legend className="mb-1.5 p-0 text-sm text-muted">{label}</legend>
      <div className="flex items-center gap-2">
        <label htmlFor={`${id}-min`} className="sr-only">
          {t("packages.min")}
        </label>
        <TextInput
          id={`${id}-min`}
          inputMode="numeric"
          placeholder={t("packages.min")}
          value={min ?? ""}
          onChange={(e) => onChange(parse(e.target.value), max)}
          className="w-20"
        />
        <span className="text-muted">–</span>
        <label htmlFor={`${id}-max`} className="sr-only">
          {t("packages.max")}
        </label>
        <TextInput
          id={`${id}-max`}
          inputMode="numeric"
          placeholder={t("packages.max")}
          value={max ?? ""}
          onChange={(e) => onChange(min, parse(e.target.value))}
          className="w-20"
        />
      </div>
    </fieldset>
  );
}
