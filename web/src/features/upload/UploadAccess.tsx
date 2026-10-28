import { linkStyles } from "@/ui/linkStyles";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { authSettingsQuery, oauthClientId } from "@/features/auth/discord";
import { DiscordSignInButton } from "@/features/auth/DiscordSignInButton";
import { useMe } from "@/features/auth/useMe";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { Spinner } from "@/ui/Spinner";

export function UploadAccess({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const me = useMe();
  const settings = useQuery(authSettingsQuery);
  const discordClientId = oauthClientId(settings.data, "discord");
  return (
    <>
      {me.isLoading ? (
        <Spinner label={t("common.loading")} />
      ) : !me.data ? (
        <Card>
          <div className="flex flex-col gap-4">
            <p className="m-0 text-soft">{t("upload.signInFirst")}</p>
            <Link
              to="/login"
              search={{ redirect: "/packages/upload" }}
              className={linkStyles.signIn}
            >
              {t("nav.signIn")}
            </Link>
          </div>
        </Card>
      ) : me.data.isGuest ? (
        <Card data-testid="upload-guest">
          <div className="flex flex-col gap-4">
            <p className="m-0 font-semibold">{t("upload.guestTitle")}</p>
            <p className="m-0 text-soft">{t("upload.guestHelp")}</p>
            {discordClientId ? (
              <DiscordSignInButton
                clientId={discordClientId}
                returnTo="/packages/upload"
                className="sm:self-start"
              />
            ) : settings.isPending ? (
              <Spinner label={t("common.loading")} />
            ) : settings.isError ? (
              <div className="flex flex-col items-start gap-2">
                <p role="alert" className="m-0 text-sm text-danger">
                  {t("common.loadFailed")}
                </p>
                <Button size="sm" onClick={() => void settings.refetch()}>
                  {t("common.retry")}
                </Button>
              </div>
            ) : (
              <p className="m-0 text-sm text-muted">{t("upload.discordUnavailable")}</p>
            )}
          </div>
        </Card>
      ) : (
        children
      )}
    </>
  );
}
