import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { Button } from "@/ui/Button";
import { startDiscordLogin } from "./discord";
import discordMark from "./discord-mark.svg";

export function DiscordSignInButton({
  clientId,
  returnTo,
  className,
}: {
  clientId: string;
  returnTo: string;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <Button
      variant="primary"
      size="lg"
      className={cn(
        "bg-[var(--oq-discord)] text-[var(--oq-on-discord)] hover:brightness-95",
        className,
      )}
      onClick={() => void startDiscordLogin(clientId, returnTo)}
      icon={<img src={discordMark} width={24} height={18} alt="" aria-hidden="true" />}
    >
      {t("login.discord")}
    </Button>
  );
}
