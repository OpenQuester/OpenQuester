import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Gamepad2, Search } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { api, pageTotal, unwrapPage } from "../../shared/api/client";
import { SelectField } from "../../shared/ui/SelectField";
import styles from "../../shared/ui/ui.module.css";

/** Returns `value` only after it has stopped changing for `delay` ms. */
function useDebounced<T>(value: T, delay: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setSettled(value), delay);
    return () => window.clearTimeout(id);
  }, [value, delay]);
  return settled;
}

export function CreateGamePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [packageSearch, setPackageSearch] = useState("");
  const debouncedPackageSearch = useDebounced(packageSearch, 300);
  // The picker searches the API rather than filtering a first page of 30,
  // which silently hid every package beyond it.
  const packages = useQuery({
    queryKey: ["packages", "select", debouncedPackageSearch],
    queryFn: () =>
      api.packages({
        limit: 30,
        offset: 0,
        status: "published",
        title: debouncedPackageSearch.trim() || undefined,
      }),
    placeholderData: keepPreviousData,
    retry: false,
  });
  const list = unwrapPage(packages.data);
  const total = pageTotal(packages.data);
  const [title, setTitle] = useState("");
  const [packageId, setPackageId] = useState(params.get("packageId") ?? "");
  const [password, setPassword] = useState("");
  const [maxPlayers, setMaxPlayers] = useState(8);
  const mutation = useMutation({
    mutationFn: () =>
      api.createGame({
        title,
        packageId: Number(packageId),
        password: password || undefined,
        maxPlayers,
      }),
    onSuccess: (game) => navigate(`/games/${game.id}?role=showman`),
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    mutation.mutate();
  };
  return (
    <div className={styles.page}>
      <Link className={styles.textLink} to="/">
        <ArrowLeft size={14} /> {t("nav.back")}
      </Link>
      <section className={styles.formCard}>
        <header className={styles.formHeader}>
          <p className={styles.eyebrow}>{t("game.newRoom")}</p>
          <h1>{t("game.createTitle")}</h1>
          <p className={styles.lede}>{t("game.createSubtitle")}</p>
        </header>
        <form className={styles.stack} onSubmit={submit}>
          <label>
            <span>{t("game.title")}</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={t("game.titlePlaceholder")}
              minLength={3}
              required
            />
          </label>
          <label>
            <span>{t("game.package")}</span>
            <span className={styles.search}>
              <Search size={15} aria-hidden="true" />
              <input
                value={packageSearch}
                onChange={(event) => setPackageSearch(event.target.value)}
                placeholder={t("packages.search")}
                aria-label={t("packages.search")}
              />
            </span>
            <SelectField
              value={packageId}
              onValueChange={setPackageId}
              ariaLabel={t("game.package")}
              options={[
                { value: "", label: "—" },
                ...list.map((pack) => ({
                  value: String(pack.id),
                  label: pack.title,
                })),
              ]}
              required
            />
            {total > list.length ? (
              <small className={styles.fileHint}>
                {t("game.packageNarrow", { count: total })}
              </small>
            ) : null}
          </label>
          <div className={styles.twoCol}>
            <label>
              <span>
                {t("game.password")} · {t("game.passwordOptional")}
              </span>
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                autoComplete="new-password"
              />
            </label>
            <label>
              <span>{t("game.maxPlayers")}</span>
              <input
                value={maxPlayers}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  // An emptied number input parses to NaN; keep the last valid
                  // value rather than submitting NaN as maxPlayers.
                  if (Number.isFinite(next))
                    setMaxPlayers(Math.min(12, Math.max(2, next)));
                }}
                type="number"
                min={2}
                max={12}
              />
            </label>
          </div>
          <button
            className={styles.primaryButton}
            disabled={mutation.isPending || !packageId}
          >
            <Gamepad2 size={16} />
            {mutation.isPending ? t("common.loading") : t("game.create")}
          </button>
          {mutation.error ? (
            <p className={styles.errorText} role="alert">
              {mutation.error.message}
            </p>
          ) : null}
        </form>
      </section>
    </div>
  );
}
