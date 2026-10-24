import { Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";

import type { GameListItem } from "@/api/types";
import { displayName, useGuestLogin, useMe } from "@/features/auth/useMe";
import { gameStatus, playerCount } from "@/features/home/useGames";
import type { JoinOptions } from "@/game/connection";
import { Badge } from "@/ui/Badge";
import { Button } from "@/ui/Button";
import { FieldError, Label, TextInput } from "@/ui/Field";
import { BackIcon, LockIcon } from "@/ui/icons";
import { LogoMark } from "@/ui/Logo";

/** What you see when you open a game link and are not in the game yet. */
export function JoinPanel({
  gameId,
  game,
  loading,
  onJoin,
}: {
  gameId: string;
  game: GameListItem | null;
  loading: boolean;
  onJoin: (options: JoinOptions) => void;
}) {
  const { t } = useTranslation();
  const me = useMe();
  const guest = useGuestLogin();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!loading && !game) {
    return (
      <Frame>
        <h1 className="m-0 font-display text-3xl font-extrabold">{t("join.notFound")}</h1>
        <p className="m-0 text-muted">{t("join.notFoundHelp", { code: gameId })}</p>
        <Link to="/" className="font-semibold">
          {t("game.backHome")}
        </Link>
      </Frame>
    );
  }
  if (!game) return null;

  const status = gameStatus(game);
  const full = playerCount(game) >= game.maxPlayers;
  // Players may also join a game in progress; the server refuses only in the
  // final round and names the reason.
  const canPlay = !full && status !== "finished";
  const needsPassword = game.isPrivate;

  async function go(role: JoinOptions["role"], e?: FormEvent) {
    e?.preventDefault();
    setError(null);
    if (!me.data) {
      const trimmed = name.trim().replace(/\s+/g, " ");
      if (!trimmed) {
        setError(t("login.nameRequired"));
        return;
      }
      try {
        await guest.mutateAsync(trimmed);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        return;
      }
    }
    if (needsPassword && !password.trim()) {
      setError(t("join.passwordRequired"));
      return;
    }
    onJoin({ role, targetSlot: null, password: needsPassword ? password.trim() : null });
  }

  return (
    <Frame>
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={status === "lobby" ? "success" : "accent"}>
            {status === "lobby"
              ? t("home.status.lobby")
              : status === "playing"
                ? t("home.status.playing")
                : t("join.finished")}
          </Badge>
          {game.isPrivate && (
            <Badge>
              <LockIcon size={14} /> {t("home.private")}
            </Badge>
          )}
        </div>
        <h1 className="m-0 font-display text-[clamp(28px,5vw,40px)] font-extrabold tracking-tight [overflow-wrap:anywhere]">
          {game.title}
        </h1>
        <p className="m-0 text-muted">
          {t("home.package", { title: game.package.title })} ·{" "}
          {t("home.host", { name: game.createdBy.username })} ·{" "}
          <span className="font-mono text-text">
            {playerCount(game)}/{game.maxPlayers}
          </span>{" "}
          {t("home.players")}
        </p>
      </div>

      {status === "finished" ? (
        <p className="m-0 text-soft">{t("join.finishedHelp")}</p>
      ) : (
        <form
          onSubmit={(e) => void go(canPlay ? "player" : "spectator", e)}
          className="flex flex-col gap-4"
          noValidate
        >
          {me.data ? (
            <p className="m-0 text-soft">{t("join.signedInAs", { name: displayName(me.data) })}</p>
          ) : (
            <div className="flex flex-col gap-2">
              <Label htmlFor="join-name">{t("join.yourName")}</Label>
              <TextInput
                id="join-name"
                autoComplete="nickname"
                maxLength={50}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("login.namePlaceholder")}
                autoFocus
              />
              <p className="m-0 text-sm text-muted">
                {t("join.guestHelp")}{" "}
                <Link to="/login" search={{ redirect: `/games/${gameId}` }}>
                  {t("join.otherSignIn")}
                </Link>
              </p>
            </div>
          )}
          {needsPassword && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="join-pass">{t("join.password")}</Label>
              <TextInput
                id="join-pass"
                value={password}
                autoComplete="off"
                maxLength={16}
                onChange={(e) => setPassword(e.target.value)}
                className="font-mono"
              />
            </div>
          )}
          <FieldError>{error}</FieldError>
          <div className="flex flex-wrap gap-3">
            {canPlay && (
              <Button type="submit" variant="accent" size="lg" disabled={guest.isPending}>
                {t("join.asPlayer")}
              </Button>
            )}
            <Button
              type="button"
              variant={canPlay ? "ghost" : "accent"}
              size="lg"
              disabled={guest.isPending}
              onClick={() => void go("spectator")}
            >
              {t("join.watch")}
            </Button>
          </div>
          <p className="m-0 text-sm text-muted">
            {full
              ? t("join.fullHelp")
              : status === "playing"
                ? t("join.playingHelp")
                : t("join.lobbyHelp")}
          </p>
        </form>
      )}
    </Frame>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Link to="/" className="inline-flex min-h-11 items-center gap-2 text-muted no-underline">
          <BackIcon /> {t("game.backHome")}
        </Link>
        <div className="flex-1" />
        <LogoMark />
      </div>
      <section className="flex flex-col gap-6 rounded-lg border border-line bg-surface p-6 sm:p-8">
        {children}
      </section>
    </div>
  );
}
