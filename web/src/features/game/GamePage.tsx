import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { PageContainer } from "@/app/AppShell";
import { useMe } from "@/features/auth/useMe";
import { GameConnection, type JoinOptions } from "@/game/connection";
import { isStarted } from "@/game/reducer";
import { useGameStore } from "@/game/store";
import { translateServerError } from "@/i18n/serverErrors";
import { Button } from "@/ui/Button";
import { Spinner } from "@/ui/Spinner";

import { GameContext } from "./GameContext";
import { takeJoinIntent } from "./joinIntent";
import { JoinPanel } from "./JoinPanel";
import { LobbyScreen } from "./lobby/LobbyScreen";
import { GameScreen } from "./play/GameScreen";
import { Toasts } from "./play/Toasts";
import { useGamePreview } from "./useGamePreview";

export function GamePage() {
  const { gameId: rawId } = useParams({ from: "/games/$gameId" });
  const gameId = rawId.toUpperCase();
  const { t } = useTranslation();
  const me = useMe();
  const preview = useGamePreview(gameId);
  const [intent] = useState(() => takeJoinIntent(gameId));
  const [chosen, setChosen] = useState<JoinOptions | null>(intent ?? null);
  const [autoRejoin, setAutoRejoin] = useState(true);

  // Members (including after a refresh) go straight back in with their old role.
  const myListing = useMemo(
    () =>
      me.data && preview.data ? preview.data.players.find((p) => p.id === me.data!.id) : undefined,
    [me.data, preview.data],
  );
  const join: JoinOptions | null =
    chosen ??
    (autoRejoin && myListing && !preview.data?.finishedAt
      ? { role: myListing.role, targetSlot: myListing.slot ?? null }
      : null);

  if (me.isLoading || (preview.isLoading && !join)) {
    return (
      <PageContainer>
        <Spinner label={t("common.loading")} />
      </PageContainer>
    );
  }

  if (!join || !me.data) {
    return (
      <PageContainer width={720}>
        <JoinPanel
          gameId={gameId}
          game={preview.data ?? null}
          loading={preview.isLoading}
          onJoin={setChosen}
        />
      </PageContainer>
    );
  }

  return (
    <ConnectedGame
      key={gameId}
      gameId={gameId}
      myId={me.data.id}
      join={join}
      onReset={() => {
        setChosen(null);
        setAutoRejoin(false);
      }}
    />
  );
}

function ConnectedGame({
  gameId,
  myId,
  join,
  onReset,
}: {
  gameId: string;
  myId: number;
  join: JoinOptions;
  onReset: () => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [connection] = useState(() => new GameConnection(gameId, myId, join));
  const session = useGameStore((s) => s.session);
  const joinError = useGameStore((s) => s.joinError);
  const left = useGameStore((s) => s.left);

  useEffect(() => {
    connection.connect();
    return () => connection.close();
  }, [connection]);

  useEffect(() => {
    if (left) void navigate({ to: "/", search: left === "kicked" ? { notice: "kicked" } : {} });
  }, [left, navigate]);

  const value = useMemo(() => ({ connection, myId }), [connection, myId]);

  if (joinError) {
    return (
      <PageContainer width={640}>
        <div
          className="flex flex-col gap-4 rounded-lg border border-danger/40 bg-danger-surface p-6"
          role="alert"
        >
          <h1 className="m-0 font-display text-2xl font-extrabold">{t("game.joinFailed")}</h1>
          <p className="m-0 text-soft">
            {translateServerError(joinError === "auth_failed" ? t("game.authFailed") : joinError)}
          </p>
          <div className="flex flex-wrap gap-3">
            <Button variant="accent" onClick={onReset}>
              {t("game.tryAgain")}
            </Button>
            <Link to="/" className="inline-flex min-h-11 items-center px-2">
              {t("game.backHome")}
            </Link>
          </div>
        </div>
      </PageContainer>
    );
  }

  if (!session) {
    return (
      <PageContainer>
        <Spinner label={t("game.joining")} />
      </PageContainer>
    );
  }

  return (
    <GameContext.Provider value={value}>
      {isStarted(session) ? <GameScreen /> : <LobbyScreen />}
      <Toasts />
    </GameContext.Provider>
  );
}
