import { adminStyles } from "../adminStyles";
import { layoutStyles } from "@/ui/layoutStyles";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { formatScore } from "@/lib/format";
import { Avatar } from "@/ui/Avatar";
import { Badge } from "@/ui/Badge";
import { Button } from "@/ui/Button";
import type { AdminGamePlayer } from "../useAdmin";

export function AdminGamePlayerRow({
  player,
  busy,
  onKick,
}: {
  player: AdminGamePlayer;
  busy: boolean;
  onKick: () => void;
}) {
  const { t } = useTranslation();
  const [confirm, setConfirm] = useState(false);
  return (
    <li className={layoutStyles.spacedActions} data-testid="admin-game-player">
      <Avatar name={player.username} src={player.avatar} size={32} />
      <span className={adminStyles.playerName}>{player.username}</span>
      <Badge tone={player.role === "showman" ? "accent" : "neutral"}>
        {t(`roles.${player.role}`)}
      </Badge>
      {player.role === "player" && (
        <span className="text-sm tabular-nums text-soft">{formatScore(player.score)}</span>
      )}
      {/* Leaving keeps the seat and score as "disconnected"; nothing left to remove */}
      {player.status === "disconnected" ? (
        <Badge tone="warning">{t("adminPanel.offline")}</Badge>
      ) : confirm ? (
        <>
          <Button
            size="sm"
            variant="danger"
            disabled={busy}
            onClick={() => {
              setConfirm(false);
              onKick();
            }}
          >
            {t("adminPanel.confirmRemove")}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirm(false)}>
            {t("common.cancel")}
          </Button>
        </>
      ) : (
        <Button
          size="sm"
          variant="ghost"
          aria-label={t("adminPanel.removeNamed", { name: player.username })}
          onClick={() => setConfirm(true)}
        >
          {t("adminPanel.remove")}
        </Button>
      )}
    </li>
  );
}
