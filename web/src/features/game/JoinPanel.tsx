import { gameEntryStyles } from "./gameEntryStyles";
import { useTranslation } from "react-i18next";

import { Link } from "@tanstack/react-router";
import type { GameListItem } from "@/api/types";
import { useMe } from "@/features/auth/useMe";
import { gameStatus, playerCount } from "@/features/home/useGames";
import type { JoinOptions } from "@/game/connection";
import { BackIcon } from "@/ui/icons";
import { LogoMark } from "@/ui/Logo";
import { Button } from "@/ui/Button";
import { JoinForm } from "./join/JoinForm";
import { JoinSummary } from "./join/JoinSummary";
import { useJoinForm } from "./join/useJoinForm";

export function JoinPanel({
  gameId,
  game,
  loading,
  onJoin,
  error,
  onRetry,
  joinError,
  joining = false,
}: {
  gameId: string;
  game: GameListItem | null;
  loading: boolean;
  onJoin: (options: JoinOptions) => void;
  error?: Error | null;
  onRetry?: () => void;
  joinError?: string | null;
  joining?: boolean;
}) {
  const { t } = useTranslation();
  const me = useMe();
  const needsPassword = passwordNeeded(game, me.data?.id);
  const form = useJoinForm(needsPassword, onJoin, joining, joinError);
  if (error && !game)
    return (
      <Frame>
        <p role="alert">{error.message}</p>
        <Button onClick={onRetry}>{t("game.tryAgain")}</Button>
      </Frame>
    );
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
  const canPlay = !full && status !== "finished";
  return (
    <Frame>
      <JoinSummary game={game} status={status} />

      {status === "finished" ? (
        <p className="m-0 text-soft">{t("join.finishedHelp")}</p>
      ) : (
        <JoinForm
          gameId={gameId}
          model={form}
          canPlay={canPlay}
          needsPassword={needsPassword}
          full={full}
          status={status}
        />
      )}
    </Frame>
  );
}
function Frame({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Link to="/" className={gameEntryStyles.backLink}>
          <BackIcon /> {t("game.backHome")}
        </Link>
        <div className="flex-1" />
        <LogoMark />
      </div>
      <section className={gameEntryStyles.joinForm}>{children}</section>
    </div>
  );
}

/**
 * The server skips the password for the host and for anyone who already has a
 * place in the game (a seat kept after leaving), so don't ask them for it.
 */
export function passwordNeeded(game: GameListItem | null, myId: number | undefined): boolean {
  if (!game?.isPrivate) return false;
  if (myId == null) return true;
  return game.createdBy.id !== myId && !game.players.some((p) => p.id === myId);
}
