import { linkStyles } from "@/ui/linkStyles";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { startDiscordLogin, useDiscordClientId } from "@/features/auth/discord";
import { useMe } from "@/features/auth/useMe";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { Spinner } from "@/ui/Spinner";

export function UploadAccess({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const me = useMe();
  const discordClientId = useDiscordClientId();
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
              <Button
                variant="primary"
                size="lg"
                className="sm:self-start"
                onClick={() => void startDiscordLogin(discordClientId, "/packages/upload")}
              >
                {t("login.discord")}
              </Button>
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
