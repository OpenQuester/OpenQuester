import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { lobbyStyles } from "./lobbyStyles";

import { Button } from "@/ui/Button";
import { DeleteGameButton } from "../DeleteGameButton";
import { InviteCard } from "./InviteCard";
import type { LobbyModel } from "./useLobby";
export function LobbyActions({ lobby }: { lobby: LobbyModel }) {
  const { role, session } = lobby;
  return (
    <aside className={lobbyStyles.actions}>
      {role === "player" && <PlayerReadiness lobby={lobby} />}

      {role === "spectator" && <SpectatorActions lobby={lobby} />}

      {role === "showman" && <HostStart lobby={lobby} />}

      <InviteCard gameId={session.gameId} password={session.state.password ?? null} />
    </aside>
  );
}
function PlayerReadiness({ lobby }: { lobby: LobbyModel }) {
  const { t } = useTranslation();
  const { me, pending, meReady, connection, host, readyCount, activeSeated, myId, autoStart } =
    lobby;
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
              total: activeSeated.length,
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
  const { activeSeated, readyCount, pending, connection, session, autoStart } = lobby;
  return (
    <section className={cn("flex flex-col gap-4", lobbyStyles.actionPanel)}>
      <h2 className={lobbyStyles.actionTitle}>{t("lobby.startTitle")}</h2>
      <ul className={lobbyStyles.checklist}>
        <Check ok>{t("lobby.checkPackage")}</Check>
        <Check ok={activeSeated.length >= 1} warn={activeSeated.length === 0}>
          {activeSeated.length === 0
            ? t("lobby.checkNoPlayers")
            : t("lobby.checkPlayers", { count: activeSeated.length })}
        </Check>
        <Check ok={readyCount === activeSeated.length && activeSeated.length > 0} warn>
          {readyCount === activeSeated.length && activeSeated.length > 0
            ? t("lobby.checkAllReady")
            : t("lobby.checkNotReady", { count: activeSeated.length - readyCount })}
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
        {activeSeated.length === 0
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
