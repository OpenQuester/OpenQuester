import { gamePanelStyles } from "../gamePanelStyles";
import { useTranslation } from "react-i18next";
import type { Player } from "@/game/protocol";
import { Button } from "@/ui/Button";
import { Label, TextInput } from "@/ui/Field";
import { usePlayerModeration } from "./usePlayerModeration";

/** Showman tools for one player, opened inline under their row. */
export function PlayerModerationForm({ player, onDone }: { player: Player; onDone: () => void }) {
  const { t } = useTranslation();
  const {
    score,
    setScore,
    isTurn,
    inputId,
    limits,
    confirmBan,
    setConfirmBan,
    restrict,
    onScore,
    giveTurn,
    spectate,
    kick,
    toggleRestriction,
    ban,
  } = usePlayerModeration(player, onDone);

  return (
    <div className={gamePanelStyles.moderation} data-testid="player-admin" data-no-shortcuts>
      <form onSubmit={onScore} className="flex flex-col gap-2">
        <Label htmlFor={inputId}>{t("admin.score")}</Label>
        <div className="flex gap-2">
          <TextInput
            id={inputId}
            inputMode="numeric"
            value={score}
            onChange={(e) => setScore(e.target.value)}
            className="font-mono"
          />
          <Button type="submit" variant="primary">
            {t("admin.setScore")}
          </Button>
        </div>
        <p className="m-0 text-sm text-muted">{t("admin.scoreHelp")}</p>
      </form>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={isTurn} onClick={giveTurn}>
          {isTurn ? t("admin.isTurn") : t("admin.giveTurn")}
        </Button>
        <Button size="sm" onClick={spectate}>
          {t("admin.toSpectators")}
        </Button>
        <Button size="sm" variant="danger" onClick={kick}>
          {t("admin.kick")}
        </Button>
      </div>
      <div className={gamePanelStyles.playerRestrictions}>
        <div className="flex flex-col gap-1">
          <Button
            size="sm"
            className="self-start"
            aria-pressed={limits.muted}
            onClick={() => restrict({ muted: !limits.muted })}
            data-testid="admin-mute"
          >
            {limits.muted ? t("admin.unmute") : t("admin.mute")}
          </Button>
          <span className="text-sm text-muted">{t("admin.muteHelp")}</span>
        </div>
        <div className="flex flex-col gap-1">
          <Button
            size="sm"
            className="self-start"
            aria-pressed={limits.restricted}
            onClick={toggleRestriction}
            data-testid="admin-restrict"
          >
            {limits.restricted ? t("admin.unrestrict") : t("admin.restrict")}
          </Button>
          <span className="text-sm text-muted">{t("admin.restrictHelp")}</span>
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap gap-2">
            {confirmBan ? (
              <>
                <Button size="sm" variant="danger" onClick={ban} data-testid="admin-ban-confirm">
                  {t("admin.banConfirm", { name: player.meta.username })}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmBan(false)}>
                  {t("common.cancel")}
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                variant="danger"
                onClick={() => setConfirmBan(true)}
                data-testid="admin-ban"
              >
                {t("admin.ban")}
              </Button>
            )}
          </div>
          <span className="text-sm text-muted">{t("admin.banHelp")}</span>
        </div>
      </div>
    </div>
  );
}
