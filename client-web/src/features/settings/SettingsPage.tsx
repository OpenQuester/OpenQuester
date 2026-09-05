import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, ImageUp, LogOut } from "lucide-react";
import { md5 } from "hash-wasm";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { useSession } from "../auth/auth";
import { api } from "../../shared/api/client";
import {
  type Accent,
  type BoardLayout,
  type Language,
  type Theme,
  usePreferences,
} from "../../shared/preferences";
import { SelectField } from "../../shared/ui/SelectField";
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
  const avatarInputRef = useRef<HTMLInputElement>(null);
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
      // Clear every cached query, not just the session: package "mine" lists
      // and game rows from the previous account must not survive a sign-out.
      queryClient.clear();
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
    preferences.setLanguage(language as Language);
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
                  className={styles.avatarPreview}
                />
              ) : null}
              <input
                ref={avatarInputRef}
                hidden
                type="file"
                accept="image/*"
                disabled={!session.data || avatarProgress !== null}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void uploadAvatar(file);
                  event.target.value = "";
                }}
              />
              <button
                type="button"
                className={styles.secondaryButton}
                disabled={!session.data || avatarProgress !== null}
                onClick={() => avatarInputRef.current?.click()}
              >
                <ImageUp size={16} aria-hidden="true" />
                {t("settings.chooseAvatar")}
              </button>
              <small className={styles.fileHint}>
                {t("settings.avatarHint")}
              </small>
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
              <SelectField
                value={preferences.theme}
                ariaLabel={t("settings.theme")}
                onValueChange={(value) => preferences.setTheme(value as Theme)}
                options={[
                  { value: "system", label: t("settings.system") },
                  { value: "light", label: t("settings.light") },
                  { value: "dark", label: t("settings.dark") },
                  { value: "pure-dark", label: t("settings.pureDark") },
                ]}
              />
            </label>
            <label>
              <span>{t("settings.accent")}</span>
              <SelectField
                value={preferences.accent}
                ariaLabel={t("settings.accent")}
                onValueChange={(value) =>
                  preferences.setAccent(value as Accent)
                }
                options={[
                  { value: "cyan", label: t("settings.cyan") },
                  { value: "violet", label: t("settings.violet") },
                  { value: "lime", label: t("settings.lime") },
                  { value: "coral", label: t("settings.coral") },
                ]}
              />
            </label>
            <label>
              <span>{t("settings.language")}</span>
              <SelectField
                value={preferences.language}
                ariaLabel={t("settings.language")}
                onValueChange={setLanguage}
                options={[
                  { value: "en", label: t("language.en") },
                  { value: "uk", label: t("language.uk") },
                  { value: "ru", label: t("language.ru") },
                ]}
              />
            </label>
            <label>
              <span>{t("settings.board")}</span>
              <SelectField
                value={preferences.boardLayout}
                ariaLabel={t("settings.board")}
                onValueChange={(value) =>
                  preferences.setBoardLayout(value as BoardLayout)
                }
                options={[
                  { value: "rows", label: t("game.rows") },
                  { value: "matrix", label: t("game.matrix") },
                ]}
              />
            </label>
            <label className={styles.checkboxRow}>
              <input
                className={styles.checkbox}
                type="checkbox"
                checked={preferences.reducedMotion}
                onChange={(e) => preferences.setReducedMotion(e.target.checked)}
              />
              <span>
                {t("settings.motion")}
                <small className={styles.checkboxHint}>
                  {t("settings.motionHint")}
                </small>
              </span>
            </label>
            <label className={styles.checkboxRow}>
              <input
                className={styles.checkbox}
                type="checkbox"
                checked={preferences.inGameTips}
                onChange={(e) => preferences.setInGameTips(e.target.checked)}
              />
              <span>
                {t("settings.tips")}
                <small className={styles.checkboxHint}>
                  {t("settings.tipsHint")}
                </small>
              </span>
            </label>
            <label className={styles.checkboxRow}>
              <input
                className={styles.checkbox}
                type="checkbox"
                checked={preferences.limitLobbyWidth}
                onChange={(e) =>
                  preferences.setLimitLobbyWidth(e.target.checked)
                }
              />
              <span>
                {t("settings.lobbyWidth")}
                <small className={styles.checkboxHint}>
                  {t("settings.lobbyWidthHint")}
                </small>
              </span>
            </label>
          </div>
        </section>
      </div>
      {session.data ? (
        <section className={`${styles.formCard} ${styles.accountCard}`}>
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
