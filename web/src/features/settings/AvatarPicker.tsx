import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/ui/Button";

import { useChangeAvatar } from "./avatar";

const KNOWN = ["notImage", "tooBig"];

/** Picks a photo, crops it square and stores it as the profile picture. */
export function AvatarPicker() {
  const { t } = useTranslation();
  const input = useRef<HTMLInputElement>(null);
  const change = useChangeAvatar();
  const [done, setDone] = useState(false);
  const code = change.error instanceof Error ? change.error.message : "";

  return (
    <div className="flex flex-col items-start gap-1.5">
      <input
        ref={input}
        id="avatar-file"
        type="file"
        accept="image/*"
        className="sr-only"
        aria-hidden
        tabIndex={-1}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          setDone(false);
          change.mutate(file, { onSuccess: () => setDone(true) });
        }}
      />
      <Button
        size="sm"
        disabled={change.isPending}
        onClick={() => input.current?.click()}
        data-testid="change-avatar"
      >
        {change.isPending ? t("settings.avatarSaving") : t("settings.changeAvatar")}
      </Button>
      <span role="status" className="text-sm text-muted">
        {done && !change.isPending ? t("settings.avatarSaved") : ""}
      </span>
      {change.isError && (
        <span role="alert" className="text-sm text-danger">
          {t(`settings.avatarErrors.${KNOWN.includes(code) ? code : "generic"}`)}
        </span>
      )}
    </div>
  );
}
