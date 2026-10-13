import { cn } from "@/lib/cn";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { Player } from "@/game/protocol";
import { me as findMe, seatedPlayers, showman, spectators } from "@/game/selectors";
import { useGameStore } from "@/game/store";
import { Avatar } from "@/ui/Avatar";
import { Button } from "@/ui/Button";
import { BackIcon, ChatIcon, CheckIcon, CloseIcon, CopyIcon, EyeIcon } from "@/ui/icons";

import { DeleteGameButton } from "../DeleteGameButton";
import { useGame, useSession } from "../GameContext";
import { ChatDrawer } from "../play/ChatPanel";
import { ConnectionBanner } from "../play/ConnectionBanner";
import { useGamePreview } from "../useGamePreview";

export function LobbyScreen() {
  const { t } = useTranslation();
  const session = useSession();
  const { connection, myId } = useGame();
  const preview = useGamePreview(session.gameId);
  const pending = useGameStore((s) => s.pending);
  const [chatOpen, setChatOpen] = useState(false);

  const me = findMe(session, myId);
  const role = me?.role ?? "spectator";
  const host = showman(session);
  const seated = seatedPlayers(session);
  const maxPlayers = preview.data?.maxPlayers ?? Math.max(seated.length, 2);
  const ready = new Set(session.state.readyPlayers ?? []);
  const activeSeated = seated.filter((p) => p.status === "in-game");
  const readyCount = activeSeated.filter((p) => ready.has(p.meta.id)).length;
  const meReady = ready.has(myId);
  const freeSlots = Math.max(0, maxPlayers - seated.length);

  const allSlots: (Player | null)[] = Array.from(
    { length: maxPlayers },
    (_, i) => seated.find((p) => p.slot === i) ?? null,
  );
  // Players without a slot number still need a card.
  for (const p of seated) if (!allSlots.includes(p)) allSlots[allSlots.indexOf(null)] = p;
  // Long rows of empty seats push the important parts off a phone screen.
  const emptyShown = 2;
  let emptySeen = 0;
  const slots = allSlots
    .map((p, index) => ({ p, index }))
    .filter(({ p }) => p != null || emptySeen++ < emptyShown);
  const hiddenEmpty =
    allSlots.filter((p) => p == null).length - slots.filter(({ p }) => p == null).length;

  const takeSlot = (slot: number) => {
    if (role === "player") connection.emit("player-slot-change", { targetSlot: slot });
    else {
      connection.setJoinRole("player", slot);
      connection.emit("player-role-change", { playerId: myId, newRole: "player" });
    }
  };

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <ConnectionBanner />
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-[1240px] flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => connection.leave()}
            icon={<BackIcon size={18} />}
          >
            {t("lobby.leave")}
          </Button>
          <div className="flex-1" />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setChatOpen(true)}
            icon={<ChatIcon size={18} />}
          >
            {t("chat.title")}
            {session.chat.length > 0 && (
              <span className="font-mono text-muted">{session.chat.length}</span>
            )}
          </Button>
          <span className="rounded-sm bg-surface-2 px-3 py-1.5 text-sm text-muted">
            {t("lobby.youAre")} <strong className="text-accent">{t(`roles.${role}`)}</strong>
          </span>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[1240px] flex-1 flex-wrap items-start gap-6 px-4 pb-16 pt-6 sm:px-6 sm:pt-8">
        <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-6">
          <section className="flex flex-col gap-2">
            <p className="m-0 text-sm font-semibold uppercase tracking-[0.08em] text-muted">
              {t("lobby.kicker")}
            </p>
            <h1 className="m-0 font-display text-[clamp(28px,5vw,40px)] font-extrabold tracking-tight [overflow-wrap:anywhere]">
              {session.title}
            </h1>
            {preview.data && (
              <p className="m-0 text-muted">
                {t("home.package", { title: preview.data.package.title })}
              </p>
            )}
          </section>

          <section
            aria-labelledby="players-h"
            className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-5 sm:p-6"
          >
            <div className="flex flex-wrap items-center gap-3">
              <h2 id="players-h" className="m-0 text-xl font-semibold">
                {t("lobby.players")}
              </h2>
              <span className="font-mono text-muted">
                {seated.length} / {maxPlayers}
              </span>
              <div className="flex-1" />
              <span className="text-sm font-medium text-success" data-testid="ready-count">
                {t("lobby.readyCount", { count: readyCount, total: activeSeated.length })}
              </span>
            </div>
            <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(min(220px,100%),1fr))] gap-3 p-0">
              {slots.map(({ p, index: i }) =>
                p ? (
                  <PlayerSlot
                    key={p.meta.id}
                    player={p}
                    isMe={p.meta.id === myId}
                    ready={ready.has(p.meta.id)}
                    canManage={role === "showman"}
                    onKick={() => connection.emit("player-kicked", { playerId: p.meta.id })}
                    onSpectate={() =>
                      connection.emit("player-role-change", {
                        playerId: p.meta.id,
                        newRole: "spectator",
                      })
                    }
                  />
                ) : (
                  <li key={`empty-${i}`}>
                    <button
                      type="button"
                      disabled={role === "showman"}
                      onClick={() => takeSlot(i)}
                      className="flex min-h-[76px] w-full items-center gap-3 rounded-md border border-dashed border-line-strong bg-transparent p-3.5 text-left text-muted enabled:hover:border-info disabled:cursor-default"
                      aria-label={
                        role === "showman" ? t("lobby.openSlot") : t("lobby.takeSlot", { n: i + 1 })
                      }
                    >
                      <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-avatar font-semibold">
                        +
                      </span>
                      <span className="flex flex-col">
                        <span className="font-semibold">{t("lobby.openSlot")}</span>
                        <span className="text-[13px]">
                          {role === "showman" ? t("lobby.waitingForPlayer") : t("lobby.clickToSit")}
                        </span>
                      </span>
                    </button>
                  </li>
                ),
              )}
            </ul>
            {hiddenEmpty > 0 && (
              <p className="m-0 text-sm text-muted">
                {t("lobby.moreSeats", { count: hiddenEmpty })}
              </p>
            )}
          </section>

          <section
            aria-labelledby="spec-h"
            className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted"
          >
            <h2 id="spec-h" className="m-0 text-base font-semibold text-text">
              {t("lobby.spectators")}
            </h2>
            <span>{t("lobby.watching", { count: spectators(session).length })}</span>
            <span aria-hidden="true">·</span>
            <span>{t("lobby.spectatorsHelp")}</span>
          </section>
        </div>

        <aside className="order-first flex flex-[1_1_320px] flex-col gap-4 lg:order-none">
          {role === "player" && (
            <section className="flex flex-col gap-3.5 rounded-lg border border-line-strong bg-surface-2 p-5 sm:p-6">
              <h2 className="m-0 text-lg font-semibold">
                {t("lobby.youreSeated", { n: (me?.slot ?? 0) + 1 })}
              </h2>
              <button
                type="button"
                aria-pressed={meReady}
                disabled={
                  pending?.action === "player-ready" || pending?.action === "player-unready"
                }
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
                  ? t("lobby.waitingForHost", {
                      name: host?.meta.username ?? t("roles.showman"),
                      ready: readyCount,
                      total: activeSeated.length,
                    })
                  : t("lobby.readyHelp")}
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
          )}

          {role === "spectator" && (
            <section className="flex flex-col gap-3.5 rounded-lg border border-line-strong bg-surface-2 p-5 sm:p-6">
              <h2 className="m-0 text-lg font-semibold">{t("lobby.youreWatching")}</h2>
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
          )}

          {role === "showman" && (
            <section className="flex flex-col gap-4 rounded-lg border border-line-strong bg-surface-2 p-5 sm:p-6">
              <h2 className="m-0 text-lg font-semibold">{t("lobby.startTitle")}</h2>
              <ul className="m-0 flex list-none flex-col gap-2.5 p-0 text-[15px]">
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
                {activeSeated.length === 0 ? t("lobby.startAloneHelp") : t("lobby.startHelp")}
              </p>
              <div className="border-t border-line-strong pt-4">
                <DeleteGameButton gameId={session.gameId} />
              </div>
            </section>
          )}

          <InviteCard gameId={session.gameId} password={session.state.password ?? null} />
        </aside>
      </main>
      <ChatDrawer open={chatOpen} onOpenChange={setChatOpen} />
    </div>
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

function PlayerSlot({
  player,
  isMe,
  ready,
  canManage,
  onKick,
  onSpectate,
}: {
  player: Player;
  isMe: boolean;
  ready: boolean;
  canManage: boolean;
  onKick: () => void;
  onSpectate: () => void;
}) {
  const { t } = useTranslation();
  const offline = player.status === "disconnected";
  return (
    <li
      className={cn(
        "flex min-h-[76px] items-center gap-3 rounded-md border p-3.5",
        isMe ? "border-accent-line bg-accent-surface" : "border-line-strong bg-surface-2",
      )}
      data-testid="lobby-player"
    >
      <Avatar name={player.meta.username} src={player.meta.avatar} muted={offline} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate font-semibold">
          {player.meta.username}
          {isMe && <span className="font-normal text-muted"> ({t("common.you")})</span>}
        </span>
        <span
          className={cn(
            "text-[13px]",
            offline ? "text-danger" : ready ? "text-success" : "text-warning",
          )}
        >
          {offline ? t("lobby.offline") : ready ? t("lobby.ready") : t("lobby.notReady")}
        </span>
      </div>
      {canManage && (
        <div className="flex gap-1">
          <button
            type="button"
            onClick={onSpectate}
            aria-label={t("lobby.moveToSpectators", { name: player.meta.username })}
            title={t("lobby.moveToSpectators", { name: player.meta.username })}
            className="inline-flex h-9 w-9 items-center justify-center rounded-sm border border-line-strong text-muted hover:text-text"
          >
            <EyeIcon size={16} />
          </button>
          <button
            type="button"
            onClick={onKick}
            aria-label={t("lobby.kick", { name: player.meta.username })}
            title={t("lobby.kick", { name: player.meta.username })}
            className="inline-flex h-9 w-9 items-center justify-center rounded-sm border border-line-strong text-muted hover:text-danger"
          >
            <CloseIcon size={16} />
          </button>
        </div>
      )}
    </li>
  );
}

function InviteCard({ gameId, password }: { gameId: string; password: string | null }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}/games/${gameId}`;
  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked; the field stays selectable.
    }
  }
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-5 sm:p-6">
      <h2 className="m-0 text-lg font-semibold">{t("lobby.invite")}</h2>
      <div className="flex gap-2">
        <label htmlFor="invite-link" className="sr-only">
          {t("lobby.inviteLink")}
        </label>
        <input
          id="invite-link"
          readOnly
          value={link}
          onFocus={(e) => e.currentTarget.select()}
          className="min-h-11 min-w-0 flex-1 rounded-[12px] border border-line-strong bg-bg px-3 font-mono text-sm text-text"
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
