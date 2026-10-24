import { Navigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { PageContainer, PageTitle } from "@/ui/Page";
import type { User } from "@/api/types";
import { useMe } from "@/features/auth/useMe";
import { PlayerStatsSummary } from "@/features/stats/PlayerStatsSummary";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { Spinner } from "@/ui/Spinner";
import { AppearanceSettings, SoundSettings } from "./SettingsPreferences";
import { ProfileCard } from "./ProfileCard";
import { useProfileSettings } from "./useProfileSettings";

export function SettingsPage() {
  const me = useMe();
  if (me.isLoading)
    return (
      <PageContainer>
        <Spinner />
      </PageContainer>
    );
  if (!me.data) return <Navigate to="/login" search={{ redirect: "/settings" }} />;
  return <SettingsForm key={me.data.id} user={me.data} />;
}

function SettingsForm({ user }: { user: User }) {
  const { t } = useTranslation();
  const profile = useProfileSettings(user);
  const { settings, logout, navigate } = profile;

  return (
    <PageContainer width={880}>
      <div className="flex flex-col gap-6">
        <PageTitle>{t("settings.title")}</PageTitle>

        <ProfileCard profile={profile} />

        <Card>
          <PlayerStatsSummary />
        </Card>

        <AppearanceSettings settings={settings} />

        <SoundSettings settings={settings} />

        <div>
          <Button
            variant="danger"
            onClick={() =>
              logout.mutate(undefined, { onSuccess: () => void navigate({ to: "/" }) })
            }
          >
            {t("settings.signOut")}
          </Button>
          {logout.isError && (
            <p className="mt-2 text-sm text-danger" role="alert" data-testid="sign-out-failed">
              {t("settings.signOutFailed")}
            </p>
          )}
          {user.isGuest && (
            <p className="mt-2 text-sm text-muted">{t("settings.guestSignOutHelp")}</p>
          )}
        </div>
      </div>
    </PageContainer>
  );
}
