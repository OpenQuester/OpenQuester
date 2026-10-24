import { useTranslation } from "react-i18next";
import { PageContainer } from "@/ui/Page";
import { Spinner } from "@/ui/Spinner";
import { useDiscordCallback } from "./useDiscordCallback";

export function DiscordCallbackPage() {
  const { t } = useTranslation();
  const failed = useDiscordCallback();
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
