import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Gamepad2 } from "lucide-react";
import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { api, unwrapPage } from "../../shared/api/client";
import styles from "../../shared/ui/ui.module.css";

export function CreateGamePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const packages = useQuery({
    queryKey: ["packages", "select"],
    queryFn: () => api.packages(),
    retry: false,
  });
  const list = unwrapPage(packages.data);
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
            <select
              value={packageId}
              onChange={(event) => setPackageId(event.target.value)}
              required
            >
              <option value="">—</option>
              {list.map((pack) => (
                <option value={pack.id} key={pack.id}>
                  {pack.title}
                </option>
              ))}
            </select>
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
              />
            </label>
            <label>
              <span>{t("game.maxPlayers")}</span>
              <input
                value={maxPlayers}
                onChange={(event) => setMaxPlayers(Number(event.target.value))}
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
