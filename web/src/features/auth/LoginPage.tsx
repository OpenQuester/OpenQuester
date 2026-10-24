import { useTranslation } from "react-i18next";
import { PageContainer, PageTitle } from "@/ui/Page";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { FieldError, Label, TextInput } from "@/ui/Field";
import { startDiscordLogin } from "./discord";
import { useLoginForm } from "./useLoginForm";

export function LoginPage() {
  const { t } = useTranslation();
  const { name, setName, error, guest, discordClientId, target, onSubmit } = useLoginForm();
  return (
    <PageContainer width={560}>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <PageTitle>{t("login.title")}</PageTitle>
          <p className="m-0 text-muted">{t("login.subtitle")}</p>
        </div>
        <Card>
          <form onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
            <Label htmlFor="guest-name">{t("login.nameLabel")}</Label>
            <TextInput
              id="guest-name"
              autoComplete="nickname"
              maxLength={50}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("login.namePlaceholder")}
              aria-describedby={error ? "guest-error" : "guest-help"}
              aria-invalid={error ? true : undefined}
              autoFocus
            />
            <p id="guest-help" className="m-0 text-sm text-muted">
              {t("login.nameHelp")}
            </p>
            <FieldError id="guest-error">{error}</FieldError>
            <Button type="submit" variant="accent" size="lg" disabled={guest.isPending}>
              {guest.isPending ? t("login.signingIn") : t("login.continueGuest")}
            </Button>
          </form>
        </Card>
        {discordClientId && (
          <Card tone="raised" className="flex flex-col gap-3">
            <p className="m-0 text-soft">{t("login.discordHelp")}</p>
            <Button
              variant="primary"
              size="lg"
              onClick={() => void startDiscordLogin(discordClientId, target)}
            >
              {t("login.discord")}
            </Button>
          </Card>
        )}
      </div>
    </PageContainer>
  );
}
