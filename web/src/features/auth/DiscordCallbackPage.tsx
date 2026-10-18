import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { PageContainer } from "@/app/AppShell";
import { Spinner } from "@/ui/Spinner";

import { authSettingsQuery, finishDiscordLogin } from "./discord";
import { meKey } from "./useMe";

export function DiscordCallbackPage() {
  const { t } = useTranslation();
  const { code, error } = useSearch({ from: "/shell/auth/discord" });
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [failed, setFailed] = useState<string | null>(error ?? null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current || !code) return;
    started.current = true;
    qc.fetchQuery(authSettingsQuery)
      .then(({ discordClientId }) => {
        if (!discordClientId) throw new Error("discord_disabled");
        return finishDiscordLogin(discordClientId, code);
      })
      .then(async (to) => {
        await qc.invalidateQueries({ queryKey: meKey });
        await navigate({ to, replace: true });
      })
      .catch((e: unknown) => setFailed(e instanceof Error ? e.message : String(e)));
  }, [code, navigate, qc]);

  return (
    <PageContainer width={560}>
      {failed ? (
        <p role="alert" className="text-danger">
          {t("login.discordFailed")} ({failed})
        </p>
      ) : (
        <Spinner label={t("login.signingIn")} />
      )}
    </PageContainer>
  );
}
