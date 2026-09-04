import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Gamepad2, ShieldCheck } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";

import { API_BASE_URL, ApiError, api } from "../../shared/api/client";
import styles from "../../shared/ui/ui.module.css";

export function useSession() {
  return useQuery({
    queryKey: ["session"],
    queryFn: api.me,
    retry: (count, error) =>
      !(error instanceof ApiError && error.status === 401) && count < 1,
    staleTime: 60_000,
  });
}

export function RequireSession({ children }: { children: React.ReactNode }) {
  const session = useSession();
  const location = useLocation();
  const { t } = useTranslation();
  if (session.isLoading)
    return <div className={styles.centerState}>{t("common.loading")}</div>;
  if (!session.data) {
    return (
      <Navigate to="/sign-in" replace state={{ from: location.pathname }} />
    );
  }
  return children;
}

export function SignInPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const session = useSession();
  const [name, setName] = useState("");
  const from = (location.state as { from?: string } | null)?.from ?? "/";
  const guest = useMutation({
    mutationFn: () => api.guestLogin(name.trim()),
    onSuccess: (user) => {
      queryClient.setQueryData(["session"], user);
      void navigate(from, { replace: true });
    },
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (name.trim().length >= 2) guest.mutate();
  };

  if (session.data) return <Navigate to={from} replace />;

  return (
    <main className={styles.authPage}>
      <Link to="/" className={styles.authBrand} aria-label={t("brand.name")}>
        <img src="/assets/logo.png" alt="" />
        <span>{t("brand.name")}</span>
      </Link>
      <section className={styles.authCard}>
        <div className={styles.authIcon}>
          <Gamepad2 aria-hidden="true" />
        </div>
        <p className={styles.eyebrow}>{t("brand.tagline")}</p>
        <h1>{t("auth.title")}</h1>
        <p className={styles.lede}>{t("auth.subtitle")}</p>
        <a
          className={styles.discordButton}
          href={`${API_BASE_URL}/v1/auth/oauth2/discord/start?returnTo=${encodeURIComponent(from)}`}
        >
          <ShieldCheck aria-hidden="true" /> {t("auth.discord")}{" "}
          <ArrowRight aria-hidden="true" />
        </a>
        <div className={styles.divider}>
          <span>{t("auth.orGuest")}</span>
        </div>
        <form onSubmit={submit} className={styles.stack}>
          <label>
            <span>{t("auth.nickname")}</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              minLength={2}
              maxLength={32}
              autoComplete="nickname"
              required
            />
          </label>
          <button
            className={styles.primaryButton}
            disabled={guest.isPending || name.trim().length < 2}
          >
            {guest.isPending ? t("common.loading") : t("auth.guest")}
          </button>
          {guest.error ? (
            <p role="alert" className={styles.errorText}>
              {guest.error.message}
            </p>
          ) : null}
        </form>
        <p className={styles.finePrint}>{t("auth.publicNote")}</p>
      </section>
    </main>
  );
}

export function DiscordCallbackPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    api
      .me()
      .then((user) => {
        queryClient.setQueryData(["session"], user);
        const returnTo = new URLSearchParams(window.location.search).get(
          "returnTo",
        );
        void navigate(
          returnTo?.startsWith("/") && !returnTo.startsWith("//")
            ? returnTo
            : "/",
          {
            replace: true,
          },
        );
      })
      .catch(() => setFailed(true));
  }, [navigate, queryClient]);
  return (
    <main className={styles.centerState}>
      {failed ? t("auth.failed") : t("auth.callback")}
    </main>
  );
}
