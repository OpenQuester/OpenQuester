import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { Avatar } from "@/ui/Avatar";
import { Button } from "@/ui/Button";
import { lobbyStyles } from "./lobbyStyles";
import type { LobbyModel } from "./useLobby";

export function LobbyShowman({ lobby }: { lobby: LobbyModel }) {
  const { t } = useTranslation();
  const { host, myId, connection, pending, autoStart } = lobby;
  const available = !host || host.status !== "in-game";
  return (
    <section aria-labelledby="showman-h" className="flex flex-col gap-3">
      <h2 id="showman-h" className="m-0 text-lg font-semibold">
        {t("roles.showman")}
      </h2>
      <div
        className={cn(lobbyStyles.seat, "border-warning/40 bg-warning-surface")}
        data-testid="lobby-showman"
      >
        {host ? (
          <Avatar name={host.meta.username} src={host.meta.avatar} muted={available} />
        ) : (
          <span aria-hidden="true" className={lobbyStyles.emptyAvatar}>
            +
          </span>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="truncate font-semibold">
            {host?.meta.username ?? t("lobby.showmanOpen")}
            {host?.meta.id === myId && (
              <span className="font-normal text-muted"> ({t("common.you")})</span>
            )}
          </span>
          <span className="text-sm text-soft">
            {host && available ? t("lobby.offline") : t("lobby.showmanHelp")}
          </span>
        </div>
        {available && (
          <Button
            size="sm"
            disabled={pending?.action === "player-role-change"}
            onClick={() => {
              connection.setJoinRole("showman");
              connection.emit("player-role-change", { playerId: myId, newRole: "showman" });
            }}
          >
            {t("lobby.becomeShowman")}
          </Button>
        )}
      </div>
      <p className="m-0 text-sm text-muted" data-testid="lobby-start-mode">
        {t(autoStart ? "lobby.automaticMode" : "lobby.manualMode")}
      </p>
    </section>
  );
}
