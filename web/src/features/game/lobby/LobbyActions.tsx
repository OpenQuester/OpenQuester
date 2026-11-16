import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { lobbyStyles } from "./lobbyStyles";

import { Button } from "@/ui/Button";
import { DeleteGameButton } from "../DeleteGameButton";
import { Avatar } from "@/ui/Avatar";
import { spectators } from "@/game/selectors";
import type { LobbyModel } from "./useLobby";
export function LobbyActions({ lobby }: { lobby: LobbyModel }) {
  const { t } = useTranslation();
  const { role, session } = lobby;
  const watching = spectators(session);
  return (
    <aside className={lobbyStyles.actions}>
      {role === "player" && <PlayerReadiness lobby={lobby} />}

      {role === "spectator" && <SpectatorActions lobby={lobby} />}

      {role === "showman" && <HostStart lobby={lobby} />}

      <section aria-labelledby="spec-h" className={lobbyStyles.panel}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="spec-h" className={lobbyStyles.actionTitle}>
            {t("lobby.spectators")}
          </h2>
          <span className="text-sm text-muted">
            {t("lobby.watching", { count: watching.length })}
          </span>
        </div>
        {watching.length > 0 && (
          <ul className="mt-3 mb-0 flex max-h-[min(18rem,40dvh)] list-none flex-col gap-2 overflow-y-auto overscroll-contain p-0">
            {watching.map((player) => (
              <li
                key={player.meta.id}
                className={cn(lobbyStyles.seat, "min-h-0 border-line-strong bg-surface-2 p-2")}
              >
                <Avatar name={player.meta.username} src={player.meta.avatar} />
                <span className="min-w-0 truncate font-semibold">{player.meta.username}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </aside>
  );
}
function PlayerReadiness({ lobby }: { lobby: LobbyModel }) {
  const { t } = useTranslation();
  const { me, pending, meReady, connection, host, readyCount, seated, myId, autoStart } = lobby;
  return (
    <section className={cn("flex flex-col gap-3.5", lobbyStyles.actionPanel)}>
      <h2 className={lobbyStyles.actionTitle}>
        {t("lobby.youreSeated", { n: (me?.slot ?? 0) + 1 })}
      </h2>
      <button
        type="button"
        aria-pressed={meReady}
        disabled={pending?.action === "player-ready" || pending?.action === "player-unready"}
        onClick={() => connection.emit(meReady ? "player-unready" : "player-ready")}
        className={cn(
          "min-h-16 rounded-md border-2 text-xl font-bold",
          meReady
            ? "border-success-line bg-success-surface text-success"
            : "border-accent-strong bg-accent text-on-accent oq-pulse",
        )}
      >
        {meReady ? t("lobby.readyUndo") : t("lobby.imReady")}
      </button>
      <p className="m-0 text-sm text-soft">
        {meReady
          ? t(autoStart ? "lobby.waitingForReady" : "lobby.waitingForHost", {
              name: host?.meta.username ?? t("roles.showman"),
              ready: readyCount,
              total: seated.length,
            })
          : t(autoStart ? "lobby.readyHelp" : "lobby.readyManualHelp")}
      </p>
      <Button
        size="sm"
        variant="ghost"
        className="self-start"
        onClick={() =>
          connection.emit("player-role-change", { playerId: myId, newRole: "spectator" })
        }
      >
        {t("lobby.watchInstead")}
      </Button>
    </section>
  );
}
function SpectatorActions({ lobby }: { lobby: LobbyModel }) {
  const { t } = useTranslation();
  const { freeSlots, connection, myId } = lobby;
  return (
    <section className={cn("flex flex-col gap-3.5", lobbyStyles.actionPanel)}>
      <h2 className={lobbyStyles.actionTitle}>{t("lobby.youreWatching")}</h2>
      <p className="m-0 text-sm text-soft">
        {freeSlots > 0 ? t("lobby.spectatorHelp") : t("lobby.noSeats")}
      </p>
      <Button
        variant="accent"
        size="lg"
        disabled={freeSlots === 0}
        onClick={() => {
          connection.setJoinRole("player");
          connection.emit("player-role-change", { playerId: myId, newRole: "player" });
        }}
      >
        {t("lobby.takeSeat")}
      </Button>
    </section>
  );
}
function HostStart({ lobby }: { lobby: LobbyModel }) {
  const { t } = useTranslation();
  const { seated, readyCount, pending, connection, session, autoStart } = lobby;
  return (
    <section className={cn("flex flex-col gap-4", lobbyStyles.actionPanel)}>
      <h2 className={lobbyStyles.actionTitle}>{t("lobby.startTitle")}</h2>
      <ul className={lobbyStyles.checklist}>
        <Check ok>{t("lobby.checkPackage")}</Check>
        <Check ok={seated.length >= 1} warn={seated.length === 0}>
          {seated.length === 0
            ? t("lobby.checkNoPlayers")
            : t("lobby.checkPlayers", { count: seated.length })}
        </Check>
        <Check ok={readyCount === seated.length && seated.length > 0} warn>
          {readyCount === seated.length && seated.length > 0
            ? t("lobby.checkAllReady")
            : t("lobby.checkNotReady", { count: seated.length - readyCount })}
        </Check>
      </ul>
      <Button
        variant="accent"
        size="lg"
        disabled={pending?.action === "start"}
        onClick={() => connection.emit("start")}
      >
        {t("lobby.start")}
      </Button>
      <p className="m-0 text-sm text-muted">
        {seated.length === 0
          ? t("lobby.startAloneHelp")
          : t(autoStart ? "lobby.startHelp" : "lobby.startManualHelp")}
      </p>
      <div className="border-t border-line-strong pt-4">
        <DeleteGameButton gameId={session.gameId} />
      </div>
    </section>
  );
}
function Check({
  ok,
  warn,
  children,
}: {
  ok?: boolean;
  warn?: boolean;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-center gap-2.5">
      <span
        aria-hidden="true"
        className={cn("w-4 font-bold", ok ? "text-success" : warn ? "text-warning" : "text-muted")}
      >
        {ok ? "✓" : "!"}
      </span>
      {children}
    </li>
  );
}
