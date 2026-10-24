import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { lobbyStyles } from "./lobbyStyles";

import { useEffect, useState } from "react";
import { Button } from "@/ui/Button";
import { CheckIcon, CopyIcon } from "@/ui/icons";
export function InviteCard({ gameId, password }: { gameId: string; password: string | null }) {
  const { t } = useTranslation();
  const [copiedAt, setCopiedAt] = useState<number | null>(null);
  const copied = copiedAt !== null;
  useEffect(() => {
    if (copiedAt === null) return;
    const timer = window.setTimeout(() => setCopiedAt(null), 2000);
    return () => window.clearTimeout(timer);
  }, [copiedAt]);
  const link = `${window.location.origin}/games/${gameId}`;
  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopiedAt(Date.now());
    } catch {
      // Clipboard can be blocked; the field stays selectable.
    }
  }
  return (
    <section className={cn("flex flex-col gap-3", lobbyStyles.panel)}>
      <h2 className={lobbyStyles.actionTitle}>{t("lobby.invite")}</h2>
      <div className="flex gap-2">
        <label htmlFor="invite-link" className="sr-only">
          {t("lobby.inviteLink")}
        </label>
        <input
          id="invite-link"
          readOnly
          value={link}
          onFocus={(e) => e.currentTarget.select()}
          className={lobbyStyles.inviteCode}
        />
        <Button
          onClick={() => void copy()}
          icon={copied ? <CheckIcon size={16} /> : <CopyIcon size={16} />}
        >
          {copied ? t("lobby.copied") : t("lobby.copy")}
        </Button>
      </div>
      <p className="m-0 text-sm text-muted">
        {t("lobby.roomCode")}{" "}
        <span className="font-mono text-text" data-testid="room-code">
          {gameId}
        </span>
        {password && (
          <>
            {" · "}
            {t("lobby.password")} <span className="font-mono text-text">{password}</span>
          </>
        )}
      </p>
    </section>
  );
}
