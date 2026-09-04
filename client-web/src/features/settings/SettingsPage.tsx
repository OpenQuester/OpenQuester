import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, LogOut } from "lucide-react";
import { md5 } from "hash-wasm";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { useSession } from "../auth/auth";
import { api } from "../../shared/api/client";
import {
  applyPreferences,
  type Accent,
  type BoardLayout,
  type Theme,
  usePreferences,
} from "../../shared/preferences";
import styles from "../../shared/ui/ui.module.css";

export function SettingsPage() {
  const { t, i18n } = useTranslation();
  const session = useSession();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const preferences = usePreferences();
  const [nameOverride, setNameOverride] = useState<string | null>(null);
  const name =
    nameOverride ?? session.data?.name ?? session.data?.username ?? "";
  const [saved, setSaved] = useState(false);
  const [avatarProgress, setAvatarProgress] = useState<number | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  useEffect(() => applyPreferences(preferences), [preferences]);
  const update = useMutation({
    mutationFn: () => api.updateMe({ name }),
    onSuccess: (user) => {
      queryClient.setQueryData(["session"], user);
      setSaved(true);
    },
  });
  const logout = useMutation({
    mutationFn: api.logout,
    onSuccess: () => {
      queryClient.setQueryData(["session"], undefined);
      void navigate("/");
    },
  });
  const uploadAvatar = async (file: File) => {
    setAvatarError(null);
    if (!file.type.startsWith("image/") || file.size > 8 * 1024 * 1024) {
      setAvatarError(t("settings.avatarInvalid"));
      return;
    }
    try {
      setAvatarProgress(10);
      const hash = await md5(new Uint8Array(await file.arrayBuffer()));
      const { url } = await api.fileUploadUrl(hash);
      await new Promise<void>((resolve, reject) => {
        const request = new XMLHttpRequest();
        request.open("PUT", url);
        request.upload.onprogress = (event) =>
          event.lengthComputable &&
          setAvatarProgress(10 + Math.round((event.loaded / event.total) * 75));
        request.onload = () =>
          request.status >= 200 && request.status < 300
            ? resolve()
            : reject(new Error("upload failed"));
        request.onerror = () => reject(new Error("upload failed"));
        request.send(file);
      });
      const user = await api.updateMe({ avatar: hash });
      queryClient.setQueryData(["session"], user);
      setAvatarProgress(100);
      setSaved(true);
    } catch {
      setAvatarError(t("settings.avatarFailed"));
    } finally {
      window.setTimeout(() => setAvatarProgress(null), 500);
    }
  };
  const setLanguage = (language: string) => {
    localStorage.setItem("oq-language", language);
    void i18n.changeLanguage(language);
    setSaved(true);
  };
  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>{t("nav.settings")}</p>
          <h1>{t("settings.title")}</h1>
          <p className={styles.lede}>{t("settings.subtitle")}</p>
        </div>
        {saved ? (
          <span className={styles.status}>
            <Check size={13} />
            {t("settings.saved")}
          </span>
        ) : null}
      </header>
      <div className={styles.twoCol}>
        <section className={styles.formCard}>
          <h2>{t("settings.profile")}</h2>
          <div className={styles.stack}>
            <label>
              <span>{t("settings.avatar")}</span>
              {session.data?.avatar ? (
                <img
                  src={session.data.avatar}
                  alt=""
                  style={{ width: 64, height: 64, borderRadius: "50%" }}
                />
              ) : null}
              <input
                type="file"
                accept="image/*"
                disabled={!session.data || avatarProgress !== null}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void uploadAvatar(file);
                  event.target.value = "";
                }}
              />
              {avatarProgress !== null ? (
                <progress value={avatarProgress} max={100} />
              ) : null}
              {avatarError ? (
                <span className={styles.errorText}>{avatarError}</span>
              ) : null}
            </label>
            <label>
              <span>{t("settings.displayName")}</span>
              <input
                value={name}
                onChange={(e) => {
                  setNameOverride(e.target.value);
                  setSaved(false);
                }}
                disabled={!session.data}
              />
            </label>
            <button
              className={styles.primaryButton}
              onClick={() => update.mutate()}
              disabled={!session.data || update.isPending}
            >
              {t("common.save")}
            </button>
          </div>
        </section>
        <section className={styles.formCard}>
          <h2>{t("settings.appearance")}</h2>
          <div className={styles.stack}>
            <label>
              <span>{t("settings.theme")}</span>
              <select
                value={preferences.theme}
                onChange={(e) => preferences.setTheme(e.target.value as Theme)}
              >
                <option value="system">{t("settings.system")}</option>
                <option value="light">{t("settings.light")}</option>
                <option value="dark">{t("settings.dark")}</option>
                <option value="pure-dark">{t("settings.pureDark")}</option>
              </select>
            </label>
            <label>
              <span>{t("settings.accent")}</span>
              <select
                value={preferences.accent}
                onChange={(e) =>
                  preferences.setAccent(e.target.value as Accent)
                }
              >
                <option value="cyan">{t("settings.cyan")}</option>
                <option value="violet">{t("settings.violet")}</option>
                <option value="lime">{t("settings.lime")}</option>
                <option value="coral">{t("settings.coral")}</option>
              </select>
            </label>
            <label>
              <span>{t("settings.language")}</span>
              <select
                value={i18n.language}
                onChange={(e) => setLanguage(e.target.value)}
              >
                <option value="en">{t("language.en")}</option>
                <option value="uk">{t("language.uk")}</option>
                <option value="ru">{t("language.ru")}</option>
              </select>
            </label>
            <label>
              <span>{t("settings.board")}</span>
              <select
                value={preferences.boardLayout}
                onChange={(e) =>
                  preferences.setBoardLayout(e.target.value as BoardLayout)
                }
              >
                <option value="rows">{t("game.rows")}</option>
                <option value="matrix">{t("game.matrix")}</option>
              </select>
            </label>
            <label style={{ flexDirection: "row", alignItems: "center" }}>
              <input
                style={{ width: 18, minHeight: 18 }}
                type="checkbox"
                checked={preferences.reducedMotion}
                onChange={(e) => preferences.setReducedMotion(e.target.checked)}
              />
              <span>
                {t("settings.motion")}
                <small style={{ display: "block", color: "var(--faint)" }}>
                  {t("settings.motionHint")}
                </small>
              </span>
            </label>
          </div>
        </section>
      </div>
      {session.data ? (
        <section className={styles.formCard} style={{ marginTop: 14 }}>
          <h2>{t("settings.account")}</h2>
          <button
            className={styles.dangerButton}
            onClick={() => logout.mutate()}
          >
            <LogOut size={16} />
            {t("settings.logout")}
          </button>
        </section>
      ) : null}
    </div>
  );
}
