import { layoutStyles } from "@/ui/layoutStyles";
import { useTranslation } from "react-i18next";
import { displayName } from "@/features/auth/useMe";
import { Avatar } from "@/ui/Avatar";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { FieldError, Label, TextInput } from "@/ui/Field";
import { AvatarPicker } from "./AvatarPicker";
import type { ProfileSettings } from "./useProfileSettings";

export function ProfileCard({ profile }: { profile: ProfileSettings }) {
  const { t } = useTranslation();
  const { user, name, setName, saved, error, update, onSave } = profile;
  return (
    <Card>
      <form onSubmit={onSave} className="flex flex-col gap-4" noValidate>
        <div className="flex flex-wrap items-center gap-4">
          <Avatar name={displayName(user)} src={user.avatar} size={72} />
          <div className={layoutStyles.contentColumn}>
            <span className="truncate text-lg font-semibold">{displayName(user)}</span>
            <span className="text-sm text-muted">
              {user.isGuest ? t("settings.guestAccount") : `@${user.username}`}
            </span>
          </div>
          <AvatarPicker />
        </div>
        <Label htmlFor="s-name">{t("settings.displayName")}</Label>
        <div className="flex flex-wrap gap-3">
          <TextInput
            id="s-name"
            value={name}
            maxLength={50}
            onChange={(e) => setName(e.target.value)}
            className="flex-[1_1_240px]"
          />
          <Button type="submit" variant="primary" disabled={update.isPending}>
            {saved ? t("settings.saved") : t("settings.save")}
          </Button>
        </div>
        <FieldError>{error}</FieldError>
      </form>
    </Card>
  );
}
