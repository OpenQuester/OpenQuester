import * as Dialog from "@radix-ui/react-dialog";
import {
  CirclePause,
  CirclePlay,
  Copy,
  ChevronDown,
  ChevronUp,
  Download,
  HelpCircle,
  LayoutGrid,
  List,
  LogOut,
  MessageSquare,
  MicOff,
  Play,
  SendHorizontal,
  WifiOff,
  X,
} from "lucide-react";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import {
  Link,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";

import { useQuery } from "@tanstack/react-query";

import { api } from "../../shared/api/client";
import { useSession } from "../auth/auth";
import { type BoardLayout, usePreferences } from "../../shared/preferences";
import {
  disconnectFromGame,
  getGameSocket,
  connectToGame,
} from "../../shared/realtime/socket";
import {
  getRole,
  getTimerRemaining,
  reconcileBuzzer,
  useGameStore,
} from "../../shared/realtime/gameStore";
import type { Player } from "../../shared/realtime/contracts";
import { SelectField } from "../../shared/ui/SelectField";
import ui from "../../shared/ui/ui.module.css";
import styles from "./game.module.css";

type Phase =
  | "lobby"
  | "choosing"
  | "question"
  | "buzzer"
  | "answer"
  | "stake"
  | "secret"
  | "final"
  | "finished"
  | "pause";

export function derivePhase(
  state: ReturnType<typeof useGameStore.getState>["gameState"],
  finished = false,
): Phase {
  if (finished) return "finished";
  if (!state?.currentRound) return "lobby";
  if (state.isPaused) return "pause";
  if (state.finalRoundData) return "final";
  if (state.stakeQuestionData?.biddingPhase) return "stake";
  if (state.secretQuestionData?.transferDecisionPhase) return "secret";
  if (state.currentQuestion && state.answeringPlayer) return "answer";
  if (state.currentQuestion) {
    if (state.questionState === "answering") return "buzzer";
    if (state.questionState === "showing_answer") return "answer";
    return "question";
  }
  return "choosing";
}

export function GameJoinPage() {
  const { gameId = "" } = useParams();
  const navigate = useNavigate();
  const session = useSession();
  const { t } = useTranslation();
  const [role, setRole] = useState<"player" | "spectator">("player");
  const [password, setPassword] = useState("");
  if (!session.data)
    return (
      <div className={ui.page}>
        <section className={ui.formCard}>
          <h1>{t("game.join")}</h1>
          <p>{t("game.loginRequired")}</p>
          <Link
            className={ui.primaryButton}
            to="/sign-in"
            state={{ from: `/j/${gameId}` }}
          >
            {t("nav.signIn")}
          </Link>
        </section>
      </div>
    );
  return (
    <div className={ui.page}>
      <section className={ui.formCard}>
        <header className={ui.formHeader}>
          <p className={ui.eyebrow}>
            {t("common.room")} {gameId}
          </p>
          <h1>{t("game.join")}</h1>
        </header>
        <div className={ui.stack}>
          <label>
            <span>{t("common.role")}</span>
            <SelectField
              value={role}
              onValueChange={(value) => setRole(value as typeof role)}
              ariaLabel={t("common.role")}
              options={[
                { value: "player", label: t("lobby.players") },
                { value: "spectator", label: t("lobby.spectators") },
              ]}
            />
          </label>
          <label>
            <span>
              {t("game.password")} · {t("game.passwordOptional")}
            </span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button
            className={ui.primaryButton}
            onClick={() =>
              // The room password travels in history state, never in the URL:
              // a query string ends up in referrers, proxy logs and any link
              // the player copies or screen-shares.
              void navigate(`/games/${gameId}?role=${role}`, {
                state: { password: password || null },
              })
            }
          >
            {role === "player" ? t("game.join") : t("game.watch")}
          </button>
        </div>
      </section>
    </div>
  );
}

export function GamePage() {
  const { gameId = "" } = useParams();
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const session = useSession();
  const players = useGameStore((state) => state.players);
  const gameState = useGameStore((state) => state.gameState);
  const finished = useGameStore((state) => state.finished);
  const title = useGameStore((state) => state.title);
  const connection = useGameStore((state) => state.connection);
  const preferences = usePreferences();
  const roleFromUrl = params.get("role") as
    "showman" | "player" | "spectator" | null;
  const userId = session.data?.id;
  const removedFromGame = useGameStore((state) => state.removedFromGame);
  const setSelfId = useGameStore((state) => state.setSelfId);
  useEffect(() => setSelfId(userId), [setSelfId, userId]);
  const password = (location.state as { password?: string | null } | null)
    ?.password;
  // Older invite links carried the password in the query string. Honour one
  // last time, then rewrite the URL so it leaves the address bar and history.
  const legacyPassword = params.get("password");
  useEffect(() => {
    if (legacyPassword === null) return;
    const next = new URLSearchParams(params);
    next.delete("password");
    void navigate(
      { pathname: location.pathname, search: next.toString() },
      { replace: true, state: { password: legacyPassword } },
    );
  }, [legacyPassword, location.pathname, navigate, params]);
  useEffect(() => {
    if (!userId || !gameId || legacyPassword !== null) return;
    connectToGame(gameId, roleFromUrl ?? "player", password ?? null);
    return () => disconnectFromGame();
    // Keyed on the user id rather than the session object: a background
    // session refetch returns a new object and would otherwise drop the
    // socket and rejoin the game mid-round.
  }, [gameId, legacyPassword, password, roleFromUrl, userId]);
  // Only for the rematch link: the join snapshot carries the room title but
  // not which package it is playing.
  const gameDetail = useQuery({
    queryKey: ["game", gameId],
    queryFn: () => api.game(gameId),
    enabled: Boolean(gameId),
    retry: false,
  });
  const role = getRole(players, userId);
  const phase = derivePhase(gameState, finished);
  const leave = () => {
    getGameSocket()?.emit("user-leave");
    void navigate("/");
  };
  if (removedFromGame)
    return (
      <div className={ui.centerState}>
        <div>
          <h1>{t(`game.removed.${removedFromGame}.title`)}</h1>
          <p className={ui.lede}>{t(`game.removed.${removedFromGame}.body`)}</p>
          <Link
            className={`${ui.primaryButton} ${ui.spacedAction}`}
            to="/"
            onClick={() => disconnectFromGame()}
          >
            {t("results.home")}
          </Link>
        </div>
      </div>
    );
  return (
    <div className={styles.gamePage}>
      <header className={styles.gameTop}>
        <div className={styles.roomTitle}>
          <button
            className={ui.iconButton}
            onClick={leave}
            aria-label={t("lobby.leave")}
          >
            <LogOut size={16} />
          </button>
          <h1>{title || `${t("common.room")} ${gameId}`}</h1>
        </div>
        <div className={styles.phase} aria-live="polite">
          <strong>{t(`game.phase.${phase}`)}</strong>
          <span>
            {t(`common.${role}`)} · {gameId}
          </span>
        </div>
        <div className={styles.topActions}>
          {role === "showman" && phase !== "lobby" ? (
            <button
              className={ui.iconButton}
              onClick={() =>
                getGameSocket()?.emit(
                  gameState?.isPaused ? "game-unpause" : "game-pause",
                )
              }
              aria-label={
                gameState?.isPaused ? t("game.resume") : t("game.pause")
              }
            >
              {gameState?.isPaused ? (
                <CirclePlay size={16} />
              ) : (
                <CirclePause size={16} />
              )}
            </button>
          ) : null}
          <TutorialButton />
          <button
            className={ui.iconButton}
            onClick={() =>
              void navigator.clipboard.writeText(
                `${window.location.origin}/j/${gameId}`,
              )
            }
            aria-label={t("lobby.copyInvite")}
          >
            <Copy size={16} />
          </button>
        </div>
      </header>
      {connection !== "connected" ? (
        <div className={styles.connection}>
          {connection === "reconnecting"
            ? t("game.reconnecting")
            : t("game.connectionLost")}
        </div>
      ) : null}
      <div className={styles.arena}>
        <section
          className={styles.stage}
          onContextMenu={(event) => {
            if (phase === "buzzer" && role === "player") {
              event.preventDefault();
              buzz();
            }
          }}
        >
          <Guidance
            phase={phase}
            role={role}
            players={players}
            userId={userId}
          />
          <PlayerRail
            players={players}
            activeId={
              gameState?.answeringPlayer ?? gameState?.currentTurnPlayerId
            }
            awaitingMedia={gameState?.questionState === "media_downloading"}
          />
          {phase === "lobby" ? (
            <Lobby role={role} players={players} userId={session.data?.id} />
          ) : phase === "choosing" ? (
            <Board
              role={role}
              layout={preferences.boardLayout}
              onLayout={preferences.setBoardLayout}
            />
          ) : phase === "finished" ? (
            <Results
              players={players}
              packageId={gameDetail.data?.package?.id}
            />
          ) : (
            <Question
              phase={phase}
              role={role}
              userId={session.data?.id}
              players={players}
            />
          )}
        </section>
        <Chat players={players} userId={userId} />
      </div>
    </div>
  );
}

function buzz() {
  const store = useGameStore.getState();
  if (store.buzzer !== "ready") return;
  store.setBuzzer("pending");
  store.setPending("question-answer");
  getGameSocket()?.emit("question-answer");
}

function Guidance({
  phase,
  role,
  players,
  userId,
}: {
  phase: Phase;
  role: string;
  players: Player[];
  userId?: number;
}) {
  const { t } = useTranslation();
  // Subscribed, not read via getState(): the turn player changes mid-phase and
  // a snapshot read here goes stale without re-rendering.
  const state = useGameStore((store) => store.gameState);
  const showmanGuidance = useGameStore((store) => store.guidance);
  const turnPlayerId = state?.currentTurnPlayerId;
  const turn =
    players.find((player) => player.meta.id === turnPlayerId)?.meta.username ??
    t("game.somePlayer");
  const isMyTurn = turnPlayerId != null && turnPlayerId === userId;
  const key = guidanceKey({ phase, role, isMyTurn });
  const inGameTips = usePreferences((preferences) => preferences.inGameTips);
  const setInGameTips = usePreferences(
    (preferences) => preferences.setInGameTips,
  );
  // The design gives the guidance line an eyebrow naming who you are right
  // now, and a dismiss that points at the Settings toggle it maps to.
  if (!inGameTips) return null;
  return (
    <div className={styles.guidance} aria-live="polite">
      <span className={styles.guidanceRole}>
        {isMyTurn
          ? t("game.yourTurn")
          : `${t("common.you")} · ${t(`common.${role}`)}`}
      </span>
      <span className={styles.guidanceBody}>
        {t(key, { name: turn })}
        {showmanGuidance ? (
          <span className={styles.guidanceNote}>{showmanGuidance}</span>
        ) : null}
      </span>
      <button
        type="button"
        className={styles.guidanceDismiss}
        onClick={() => setInGameTips(false)}
        title={t("game.hideTipsHint")}
        aria-label={t("game.hideTips")}
      >
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  );
}

/**
 * Every phase and role resolves to a line that names the current state and
 * either the primary action or what the room is waiting on.
 */
function guidanceKey(input: {
  phase: Phase;
  role: string;
  isMyTurn: boolean;
}): string {
  const { phase, role, isMyTurn } = input;
  if (role === "spectator") return "game.action.spectator";
  const showman = role === "showman";
  switch (phase) {
    case "lobby":
      return showman ? "game.action.startWhenReady" : "game.action.markReady";
    case "choosing":
      if (showman) return "game.action.waitPick";
      return isMyTurn ? "game.action.yourPick" : "game.action.waitPick";
    case "question":
      return "game.action.reading";
    case "buzzer":
      return showman ? "game.action.waitBuzz" : "game.action.buzz";
    case "answer":
      return showman ? "game.action.judge" : "game.action.waitJudge";
    case "stake":
      return showman ? "game.action.waitBids" : "game.action.placeBid";
    case "secret":
      return showman ? "game.action.waitTransfer" : "game.action.transfer";
    case "final":
      return showman ? "game.action.finalShowman" : "game.action.finalPlayer";
    case "pause":
      return showman ? "game.action.resumeWhenReady" : "game.action.paused";
    case "finished":
      return "game.action.finished";
    default:
      return "game.action.reading";
  }
}

function PlayerAvatar({ player }: { player: Player }) {
  return (
    <span className={styles.playerAvatar}>
      {player.meta.avatar ? (
        <img src={player.meta.avatar} alt="" />
      ) : (
        player.meta.username.slice(0, 1).toUpperCase()
      )}
    </span>
  );
}

function PlayerRail({
  players,
  activeId,
  awaitingMedia,
}: {
  players: Player[];
  activeId?: number | null;
  awaitingMedia: boolean;
}) {
  const { t } = useTranslation();
  const seated = [...players]
    .filter((player) => player.role !== "spectator")
    // Slots are the seat order the server assigns; showman has none.
    .sort(
      (a, b) =>
        (a.slot ?? Number.MAX_SAFE_INTEGER) -
        (b.slot ?? Number.MAX_SAFE_INTEGER),
    );
  return (
    <div className={styles.playersRail}>
      {seated.map((player) => {
        const disconnected = player.status === "disconnected";
        const muted = player.restrictionData?.muted;
        const loading = awaitingMedia && !player.mediaDownloaded;
        return (
          <div
            className={styles.playerChip}
            data-active={player.meta.id === activeId}
            data-disconnected={disconnected || undefined}
            key={player.meta.id}
          >
            <PlayerAvatar player={player} />
            <strong>{player.meta.username}</strong>
            <span className={styles.playerScore}>
              {player.score >= 0 ? "+" : ""}
              {player.score}
            </span>
            <span className={styles.playerFlags}>
              {disconnected ? (
                <WifiOff size={12} aria-label={t("game.disconnected")} />
              ) : null}
              {muted ? <MicOff size={12} aria-label={t("game.muted")} /> : null}
              {loading ? (
                <Download size={12} aria-label={t("game.mediaLoading")} />
              ) : null}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function Lobby({
  role,
  players,
  userId,
}: {
  role: string;
  players: Player[];
  userId?: number;
}) {
  const { t } = useTranslation();
  const state = useGameStore((s) => s.gameState);
  const ready = state?.readyPlayers ?? [];
  const isReady = userId ? ready.includes(userId) : false;
  const playerCount = players.filter((p) => p.role === "player").length;
  return (
    <div className={styles.lobby}>
      <div>
        <h2>{t("lobby.players")}</h2>
        <div className={styles.seatGrid}>
          {[...players]
            .filter((p) => p.role !== "spectator")
            .sort(
              (a, b) =>
                (a.slot ?? Number.MAX_SAFE_INTEGER) -
                (b.slot ?? Number.MAX_SAFE_INTEGER),
            )
            .map((p) => (
              <div
                className={styles.seat}
                key={p.meta.id}
                data-disconnected={p.status === "disconnected" || undefined}
              >
                <PlayerAvatar player={p} />
                <strong>
                  {p.meta.username}
                  {p.role === "showman" ? ` · ${t("common.showman")}` : ""}
                </strong>
                <span className={styles.ready}>
                  {p.status === "disconnected"
                    ? t("game.disconnected")
                    : ready.includes(p.meta.id) || p.role === "showman"
                      ? t("lobby.ready")
                      : t("lobby.notReady")}
                </span>
              </div>
            ))}
        </div>
      </div>
      <aside className={styles.lobbyAside}>
        <h3>{t("lobby.invite")}</h3>
        <p className={ui.lede}>
          {playerCount} {t("game.players")}
        </p>
        {role === "player" ? (
          <button
            className={isReady ? ui.secondaryButton : ui.primaryButton}
            onClick={() =>
              getGameSocket()?.emit(isReady ? "player-unready" : "player-ready")
            }
          >
            {isReady ? t("lobby.notReady") : t("lobby.ready")}
          </button>
        ) : null}
        {role === "showman" ? (
          <button
            className={ui.primaryButton}
            disabled={playerCount < 1}
            onClick={() => getGameSocket()?.emit("start")}
          >
            <Play size={16} />
            {t("lobby.start")}
          </button>
        ) : (
          <p className={ui.finePrint}>{t("lobby.waiting")}</p>
        )}
      </aside>
    </div>
  );
}

function Board({
  role,
  layout,
  onLayout,
}: {
  role: string;
  layout: BoardLayout;
  onLayout: (layout: BoardLayout) => void;
}) {
  const { t } = useTranslation();
  const state = useGameStore((s) => s.gameState);
  const themes = state?.currentRound?.themes ?? [];
  const rows = themes;
  const canPick = role === "showman" || role === "player";
  return (
    <div className={styles.boardWrap}>
      <div className={styles.boardHeader}>
        <h2>{state?.currentRound?.name ?? t("game.defaultRound")}</h2>
        <div className={ui.segmented}>
          <button
            aria-label={t("game.rows")}
            data-active={layout === "rows"}
            onClick={() => onLayout("rows")}
          >
            <List size={14} />
          </button>
          <button
            aria-label={t("game.matrix")}
            data-active={layout === "matrix"}
            onClick={() => onLayout("matrix")}
          >
            <LayoutGrid size={14} />
          </button>
        </div>
      </div>
      <div
        className={`${styles.board} ${layout === "matrix" ? styles.matrix : ""}`}
      >
        {layout === "rows"
          ? rows.map((theme) => (
              <div
                className={styles.themeRow}
                style={
                  {
                    "--question-count": theme.questions.length,
                  } as React.CSSProperties
                }
                key={theme.id ?? theme.order}
              >
                <div className={styles.themeName}>{theme.name}</div>
                {theme.questions.map((q) => (
                  <button
                    className={styles.tile}
                    key={q.id}
                    disabled={q.isPlayed || !canPick}
                    onClick={() =>
                      getGameSocket()?.emit("question-pick", {
                        questionId: q.id,
                      })
                    }
                  >
                    {q.isPlayed ? "—" : (q.price ?? "?")}
                  </button>
                ))}
              </div>
            ))
          : rows.flatMap((theme) =>
              theme.questions.map((q) => (
                <button
                  className={styles.tile}
                  key={q.id}
                  disabled={q.isPlayed || !canPick}
                  onClick={() =>
                    getGameSocket()?.emit("question-pick", { questionId: q.id })
                  }
                >
                  <small>{theme.name}</small>
                  <br />
                  {q.isPlayed ? "—" : (q.price ?? "?")}
                </button>
              )),
            )}
      </div>
    </div>
  );
}

function Question({
  phase,
  role,
  userId,
  players,
}: {
  phase: Phase;
  role: string;
  userId?: number;
  players: Player[];
}) {
  const { t } = useTranslation();
  const state = useGameStore((s) => s.gameState);
  const buzzer = useGameStore((s) => s.buzzer);
  const setBuzzer = useGameStore((s) => s.setBuzzer);
  const [answer, setAnswer] = useState("");
  const [mediaResult, setMediaResult] = useState<{
    questionId: number;
    status: "ready" | "error";
  } | null>(null);
  const [remaining, setRemaining] = useState(() =>
    getTimerRemaining(state?.timer),
  );
  useEffect(() => {
    const timer = window.setInterval(
      () => setRemaining(getTimerRemaining(state?.timer)),
      200,
    );
    return () => clearInterval(timer);
  }, [state?.timer]);
  // Straight from the generated contract. The hand-written shape this replaced
  // also read a `questionText` field, which the API has never sent.
  const question = state?.currentQuestion ?? null;
  const media = useMemo(
    () => question?.questionFiles ?? [],
    [question?.questionFiles],
  );
  useEffect(() => {
    const next = reconcileBuzzer({
      current: buzzer,
      role,
      userId,
      phase,
      state,
    });
    if (next !== buzzer) setBuzzer(next);
  }, [buzzer, phase, role, setBuzzer, state, userId]);
  useEffect(() => {
    const questionId = question?.id;
    if (state?.questionState !== "media_downloading" || !questionId) return;
    let cancelled = false;
    const preload = media.map(({ file }) => preloadMedia(file.link, file.type));
    let timeoutId: number | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timeoutId = window.setTimeout(() => reject(new Error("timeout")), 15_000);
    });
    Promise.race([Promise.all(preload), timeout])
      .then(() => !cancelled && setMediaResult({ questionId, status: "ready" }))
      .catch(
        () => !cancelled && setMediaResult({ questionId, status: "error" }),
      )
      .finally(() => {
        if (!cancelled) getGameSocket()?.emit("media-downloaded");
      });
    return () => {
      cancelled = true;
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    };
  }, [media, question?.id, state?.questionState]);
  const mediaStatus =
    mediaResult && mediaResult.questionId === question?.id
      ? mediaResult.status
      : "loading";
  // What this answer is actually worth. A stake question scores the winning
  // bid and a no-risk question its multiplied price, so the tile price alone
  // awards the wrong amount on exactly the questions where it matters.
  const atStake = useMemo((): number | null => {
    const stake = state?.stakeQuestionData;
    if (stake && stake.highestBid != null) return stake.highestBid;
    if (question?.price != null) return question.price;
    return null;
  }, [question?.price, state?.stakeQuestionData]);
  const doBuzz = useCallback(() => buzz(), []);
  // Space is the buzzer, but only while buzzing is actually possible and only
  // when it is not already the activation key for whatever has focus. Claiming
  // it unconditionally makes every button on the page unreachable by keyboard.
  const buzzerArmed = phase === "buzzer" && role === "player";
  useEffect(() => {
    if (!buzzerArmed) return;
    const handler = (event: KeyboardEvent) => {
      if (event.code !== "Space" || event.repeat) return;
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target instanceof HTMLButtonElement ||
        target instanceof HTMLAnchorElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      )
        return;
      event.preventDefault();
      doBuzz();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [buzzerArmed, doBuzz]);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (answer.trim()) {
      getGameSocket()?.emit("answer-submitted", {
        answerText: answer.trim(),
      });
      setAnswer("");
    }
  };
  return (
    <div className={styles.question}>
      <span className={styles.questionMeta}>
        {phase === "final"
          ? t("game.phase.final")
          : atStake === null
            ? t("game.unknownValue")
            : `${atStake} ${t("common.points")}`}
      </span>
      <h2>{question?.text ?? t("game.questionUnavailable")}</h2>
      {media.length ? (
        <div className={styles.questionMedia} aria-live="polite">
          {media.map(({ file }, index) =>
            file.type === "image" && file.link ? (
              <img
                key={file.link}
                src={file.link}
                alt={t("game.questionImage")}
              />
            ) : file.type === "audio" && file.link ? (
              <audio key={file.link} src={file.link} controls preload="auto" />
            ) : file.link ? (
              <video key={file.link} src={file.link} controls preload="auto" />
            ) : (
              <span key={index}>{t("game.mediaUnavailable")}</span>
            ),
          )}
          {mediaStatus === "loading" ? (
            <span>{t("game.mediaLoading")}</span>
          ) : null}
          {mediaStatus === "error" ? (
            <span>{t("game.mediaFailed")}</span>
          ) : null}
        </div>
      ) : null}
      {state?.timer ? (
        <div className={styles.timerRow}>
          <div className={styles.timer} aria-hidden="true">
            <span
              style={
                {
                  "--remaining": `${Math.min(100, (remaining / state.timer.durationMs) * 100)}%`,
                } as React.CSSProperties
              }
            />
          </div>
          {/* A bar alone tells nobody how long is left. The readout is the
              accessible name and the visible countdown at once. */}
          <output className={styles.timerValue} aria-live="off">
            {t("common.seconds", { count: Math.ceil(remaining / 1000) })}
          </output>
        </div>
      ) : null}
      {phase === "buzzer" && role === "player" ? (
        <div className={styles.playerActions}>
          <button
            className={styles.buzzButton}
            data-state={buzzer}
            disabled={buzzer !== "ready"}
            onClick={doBuzz}
          >
            {buzzer === "pending"
              ? t("game.action.pending")
              : buzzer === "accepted"
                ? t("game.action.accepted")
                : t("game.buzz")}
          </button>
          <HoldToPass />
        </div>
      ) : null}
      {phase === "answer" &&
      role === "player" &&
      state?.answeringPlayer === userId ? (
        <form className={styles.answerForm} onSubmit={submit}>
          <input
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            autoFocus
            aria-label={t("game.answer")}
          />
          <button className={ui.primaryButton}>{t("game.answer")}</button>
        </form>
      ) : null}
      <SpecialPhaseActions
        phase={phase}
        role={role}
        userId={userId}
        players={players}
      />
      {role === "showman" && phase === "answer" && state?.answeringPlayer ? (
        <div className={ui.toolbar}>
          <button
            className={ui.primaryButton}
            onClick={() =>
              getGameSocket()?.emit("answer-result", {
                scoreResult: Math.abs(atStake ?? 0),
                answerType: "correct",
              })
            }
          >
            {t("game.correct")}
          </button>
          <button
            className={ui.dangerButton}
            onClick={() =>
              getGameSocket()?.emit("answer-result", {
                scoreResult: -Math.abs(atStake ?? 0),
                answerType: "wrong",
              })
            }
          >
            {t("game.wrong")}
          </button>
          <button
            className={ui.ghostButton}
            onClick={() => getGameSocket()?.emit("skip-question-force")}
          >
            {t("game.skip")}
          </button>
        </div>
      ) : null}
      {role === "showman" ? (
        <GuidanceComposer questionId={question?.id} />
      ) : null}
    </div>
  );
}

/**
 * Guidance is showman-authored text broadcast to the room. It used to send the
 * localised label of the button itself, which arrived as the word "Explain" in
 * whatever language the showman happened to be using.
 */
function GuidanceComposer({ questionId }: { questionId?: number | null }) {
  const { t } = useTranslation();
  const [message, setMessage] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const text = message.trim();
    if (!text) return;
    getGameSocket()?.emit("question-guidance", {
      message: text,
      questionId: questionId ?? undefined,
    });
    setMessage("");
  };
  return (
    <form className={styles.guidanceForm} onSubmit={submit}>
      <input
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        placeholder={t("game.guidancePlaceholder")}
        aria-label={t("game.guidanceLabel")}
        maxLength={255}
      />
      <button className={ui.secondaryButton} disabled={!message.trim()}>
        {t("game.sendGuidance")}
      </button>
    </form>
  );
}

function preloadMedia(link: string | null | undefined, type: string | null) {
  if (!link) return Promise.reject(new Error("missing media"));
  return new Promise<void>((resolve, reject) => {
    const element =
      type === "image"
        ? new Image()
        : document.createElement(type === "audio" ? "audio" : "video");
    element.addEventListener(
      type === "image" ? "load" : "canplaythrough",
      () => resolve(),
      { once: true },
    );
    element.addEventListener("error", () => reject(new Error("media failed")), {
      once: true,
    });
    element.src = link;
    if (!(element instanceof HTMLImageElement)) element.load();
  });
}

function HoldToPass() {
  const { t } = useTranslation();
  const [holding, setHolding] = useState(false);
  const timer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );
  const cancel = () => {
    setHolding(false);
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  };
  const start = () => {
    cancel();
    setHolding(true);
    timer.current = window.setTimeout(() => {
      getGameSocket()?.emit("question-skip");
      cancel();
    }, 700);
  };
  return (
    <button
      className={ui.secondaryButton}
      data-holding={holding}
      onPointerDown={start}
      onPointerUp={cancel}
      onPointerCancel={cancel}
      onPointerLeave={cancel}
    >
      {t("game.passHold")}
    </button>
  );
}

function SpecialPhaseActions({
  phase,
  role,
  userId,
  players,
}: {
  phase: Phase;
  role: string;
  userId?: number;
  players: Player[];
}) {
  const { t } = useTranslation();
  const state = useGameStore((s) => s.gameState);
  const [bid, setBid] = useState(100);
  const [finalAnswer, setFinalAnswer] = useState("");
  if (phase === "stake" && role === "player") {
    const stake = state?.stakeQuestionData;
    const canBid = stake?.biddingOrder[stake.currentBidderIndex] === userId;
    const minimum = (stake?.highestBid ?? 0) + 100;
    const myScore =
      players.find((player) => player.meta.id === userId)?.score ?? 0;
    // The design leads with quick amounts and keeps the free-entry field for
    // anything in between, rather than making every bid a typed number.
    const quickBids = [minimum, minimum + 400, minimum + 900].filter(
      (amount) => stake?.maxPrice == null || amount <= stake.maxPrice,
    );
    const submit = (bidType: "normal" | "pass" | "all-in", amount?: number) =>
      getGameSocket()?.emit("stake-bid-submit", {
        bidType,
        bidAmount: bidType === "normal" ? (amount ?? bid) : null,
      });
    return (
      <div className={styles.stakeActions}>
        <div className={styles.bidChips}>
          <button
            className={styles.bidChip}
            disabled={!canBid}
            onClick={() => submit("pass")}
          >
            {t("game.pass")}
          </button>
          {quickBids.map((amount) => (
            <button
              key={amount}
              className={styles.bidChip}
              data-active={bid === amount || undefined}
              disabled={!canBid}
              onClick={() => {
                setBid(amount);
                submit("normal", amount);
              }}
            >
              {amount}
            </button>
          ))}
          <button
            className={styles.bidChip}
            disabled={!canBid || myScore <= 0}
            onClick={() => submit("all-in")}
            title={t("game.allInHint")}
          >
            {t("game.allIn")}
          </button>
        </div>
        <div className={styles.bidCustom}>
          <input
            type="number"
            min={minimum}
            max={stake?.maxPrice ?? undefined}
            value={bid}
            aria-label={t("game.customBid")}
            onChange={(event) => {
              const next = Number(event.target.value);
              if (Number.isFinite(next)) setBid(next);
            }}
          />
          <button
            className={ui.primaryButton}
            disabled={!canBid || bid < minimum}
            onClick={() => submit("normal")}
          >
            {t("game.placeBid")}
          </button>
        </div>
        <p className={styles.bidHint}>
          {t("game.bidMinimum", { amount: minimum })}
        </p>
      </div>
    );
  }
  if (
    phase === "secret" &&
    role === "player" &&
    state?.secretQuestionData?.pickerPlayerId === userId
  )
    return (
      <div className={styles.phaseActions}>
        {players
          .filter((player) => player.role === "player")
          .map((player) => (
            <button
              className={ui.secondaryButton}
              key={player.meta.id}
              onClick={() =>
                getGameSocket()?.emit("secret-question-transfer", {
                  targetPlayerId: player.meta.id,
                })
              }
            >
              {t("game.giveTo", { name: player.meta.username })}
            </button>
          ))}
      </div>
    );
  if (phase !== "final" || !state?.finalRoundData) return null;
  const final = state.finalRoundData;
  if (
    final.phase === "theme_elimination" &&
    state.currentTurnPlayerId === userId
  )
    return (
      <div className={styles.phaseActions}>
        {state.currentRound?.themes
          .filter(
            (theme): theme is typeof theme & { id: number } =>
              theme.id !== undefined &&
              !final.eliminatedThemes.includes(theme.id),
          )
          .map((theme) => (
            <button
              className={ui.secondaryButton}
              key={theme.id}
              onClick={() =>
                getGameSocket()?.emit("theme-eliminate", {
                  themeId: theme.id,
                })
              }
            >
              {theme.name}
            </button>
          ))}
      </div>
    );
  if (final.phase === "bidding" && role === "player")
    return (
      <div className={styles.phaseActions}>
        <input
          type="number"
          min={1}
          value={bid}
          onChange={(event) => setBid(Number(event.target.value))}
        />
        <button
          className={ui.primaryButton}
          onClick={() => getGameSocket()?.emit("final-bid-submit", { bid })}
        >
          {t("game.submitBid")}
        </button>
      </div>
    );
  if (final.phase === "answering" && role === "player")
    return (
      <form
        className={styles.answerForm}
        onSubmit={(event) => {
          event.preventDefault();
          getGameSocket()?.emit("final-answer-submit", {
            answerText: finalAnswer,
          });
        }}
      >
        <input
          value={finalAnswer}
          onChange={(event) => setFinalAnswer(event.target.value)}
          aria-label={t("game.finalAnswer")}
        />
        <button className={ui.primaryButton}>{t("game.answer")}</button>
      </form>
    );
  if (final.phase === "reviewing" && role === "showman")
    return (
      <div className={styles.finalReview}>
        {final.answers
          .filter((item) => item.isCorrect == null)
          .map((item) => (
            <div key={item.id}>
              <span>
                {
                  players.find((player) => player.meta.id === item.playerId)
                    ?.meta.username
                }
                : {item.answer}
              </span>
              <button
                className={ui.primaryButton}
                onClick={() =>
                  getGameSocket()?.emit("final-answer-review", {
                    answerId: item.id,
                    isCorrect: true,
                  })
                }
              >
                {t("game.correct")}
              </button>
              <button
                className={ui.dangerButton}
                onClick={() =>
                  getGameSocket()?.emit("final-answer-review", {
                    answerId: item.id,
                    isCorrect: false,
                  })
                }
              >
                {t("game.wrong")}
              </button>
            </div>
          ))}
      </div>
    );
  return null;
}

function Chat({ players, userId }: { players: Player[]; userId?: number }) {
  const { t } = useTranslation();
  const messages = useGameStore((s) => s.messages);
  const [message, setMessage] = useState("");
  const [open, setOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const muted = players.find((player) => player.meta.id === userId)
    ?.restrictionData?.muted;
  // Usernames change far less often than messages; one lookup map beats a
  // linear scan per message on every render.
  const names = useMemo(
    () =>
      new Map(players.map((player) => [player.meta.id, player.meta.username])),
    [players],
  );
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    // Only follow along when the reader is already at the bottom, so scrolling
    // back through history is not yanked away by an incoming message.
    const atBottom =
      list.scrollHeight - list.scrollTop - list.clientHeight < 80;
    if (atBottom) list.scrollTop = list.scrollHeight;
  }, [messages]);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!message.trim() || muted) return;
    getGameSocket()?.emit("chat-message", { message: message.trim() });
    setMessage("");
  };
  return (
    <aside className={styles.sidePanel} data-open={open || undefined}>
      <header>
        <span>
          <MessageSquare size={15} aria-hidden="true" /> {t("game.chat")}
        </span>
        <span className={ui.badge}>{messages.length}</span>
        {/* Below the tablet breakpoint the panel is a sheet rather than a
            column, so it needs its own control instead of being hidden. */}
        <button
          type="button"
          className={styles.chatToggle}
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
        >
          {open ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          <span className={ui.srOnly}>{t("game.chat")}</span>
        </button>
      </header>
      <div
        className={styles.messages}
        ref={listRef}
        role="log"
        aria-live="polite"
        aria-label={t("game.chat")}
      >
        {messages.map((item, index) => (
          <div className={styles.message} key={item.uuid ?? index}>
            <strong>{names.get(item.user) ?? t("common.player")}</strong>
            <p>{item.message}</p>
          </div>
        ))}
      </div>
      <form className={styles.chatForm} onSubmit={submit}>
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={muted ? t("game.mutedHint") : t("game.chatPlaceholder")}
          aria-label={t("game.chat")}
          disabled={muted}
          maxLength={500}
        />
        <button
          className={ui.iconButton}
          aria-label={t("game.send")}
          disabled={muted || !message.trim()}
        >
          <SendHorizontal size={15} aria-hidden="true" />
        </button>
      </form>
    </aside>
  );
}

function Results({
  players,
  packageId,
}: {
  players: Player[];
  packageId?: number;
}) {
  const { t } = useTranslation();
  const sorted = [...players]
    .filter((p) => p.role === "player")
    .sort(
      (a, b) =>
        b.score - a.score || a.meta.username.localeCompare(b.meta.username),
    );
  // Standard competition ranking: equal scores share a place, and the place
  // after a tie skips accordingly. Everyone on the top score gets the crown.
  const places: number[] = [];
  for (let index = 0; index < sorted.length; index += 1) {
    const previous = sorted[index - 1];
    const current = sorted[index];
    const tied = previous && current && current.score === previous.score;
    places.push(tied ? (places[index - 1] ?? index + 1) : index + 1);
  }
  return (
    <div className={styles.results}>
      <p className={ui.eyebrow}>{t("results.subtitle")}</p>
      <h2>{t("results.title")}</h2>
      <div className={styles.podium}>
        {sorted.map((p, i) => (
          <div className={styles.rank} key={p.meta.id} data-place={places[i]}>
            <span>
              {places[i] === 1 ? (
                <img
                  className={styles.crown}
                  src="/assets/crown.svg"
                  alt={t("results.winner")}
                />
              ) : (
                `#${places[i]}`
              )}
            </span>
            <strong>{p.meta.username}</strong>
            <span>{p.score}</span>
          </div>
        ))}
      </div>
      <div className={ui.toolbar}>
        <Link
          className={ui.primaryButton}
          // Carry the package through so a rematch opens the create form
          // already pointed at the pack the room just played.
          to={packageId ? `/games/new?packageId=${packageId}` : "/games/new"}
        >
          {t("results.rematch")}
        </Link>
        <Link className={ui.secondaryButton} to="/">
          {t("results.home")}
        </Link>
      </div>
    </div>
  );
}

function TutorialButton() {
  const { t } = useTranslation();
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button className={ui.iconButton} aria-label={t("lobby.tutorial")}>
          <HelpCircle size={16} />
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className={ui.dialogOverlay} />
        <Dialog.Content
          className={ui.dialogContent}
          aria-describedby={undefined}
        >
          <Dialog.Title className={ui.dialogTitle}>
            {t("tutorial.title")}
          </Dialog.Title>
          <div className={ui.stack}>
            {["pick", "buzz", "score"].map((step, index) => (
              <div className={ui.card} key={step}>
                <span className={ui.badge}>0{index + 1}</span>
                <h3>{t(`tutorial.${step}.title`)}</h3>
                <p>{t(`tutorial.${step}.body`)}</p>
              </div>
            ))}
          </div>
          <Dialog.Close asChild>
            <button className={`${ui.primaryButton} ${ui.dialogAction}`}>
              {t("common.continue")}
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
