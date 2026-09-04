import * as Dialog from "@radix-ui/react-dialog";
import {
  CirclePause,
  CirclePlay,
  Copy,
  HelpCircle,
  LayoutGrid,
  List,
  LogOut,
  MessageSquare,
  Play,
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
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";

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
              void navigate(
                `/games/${gameId}?role=${role}${password ? `&password=${encodeURIComponent(password)}` : ""}`,
              )
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
  const navigate = useNavigate();
  const { t } = useTranslation();
  const session = useSession();
  const store = useGameStore();
  const preferences = usePreferences();
  const roleFromUrl = params.get("role") as
    "showman" | "player" | "spectator" | null;
  useEffect(() => {
    if (!session.data || !gameId) return;
    connectToGame(gameId, roleFromUrl ?? "player", params.get("password"));
    return () => disconnectFromGame();
  }, [gameId, params, roleFromUrl, session.data]);
  const role = getRole(store.players, session.data?.id);
  const phase = derivePhase(store.gameState, store.finished);
  const leave = () => {
    getGameSocket()?.emit("user-leave");
    void navigate("/");
  };
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
          <h1>{store.title || `${t("common.room")} ${gameId}`}</h1>
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
                  store.gameState?.isPaused ? "game-unpause" : "game-pause",
                )
              }
              aria-label={
                store.gameState?.isPaused ? t("game.resume") : t("game.pause")
              }
            >
              {store.gameState?.isPaused ? (
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
                `${location.origin}/j/${gameId}`,
              )
            }
            aria-label={t("lobby.copyInvite")}
          >
            <Copy size={16} />
          </button>
        </div>
      </header>
      {store.connection !== "connected" ? (
        <div className={styles.connection}>
          {store.connection === "reconnecting"
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
          <Guidance phase={phase} role={role} players={store.players} />
          <PlayerRail
            players={store.players}
            activeId={
              store.gameState?.answeringPlayer ??
              store.gameState?.currentTurnPlayerId
            }
          />
          {phase === "lobby" ? (
            <Lobby
              role={role}
              players={store.players}
              userId={session.data?.id}
            />
          ) : phase === "choosing" ? (
            <Board
              role={role}
              layout={preferences.boardLayout}
              onLayout={preferences.setBoardLayout}
            />
          ) : phase === "finished" ? (
            <Results players={store.players} />
          ) : (
            <Question
              phase={phase}
              role={role}
              userId={session.data?.id}
              players={store.players}
            />
          )}
        </section>
        <Chat players={store.players} />
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
}: {
  phase: Phase;
  role: string;
  players: Player[];
}) {
  const { t } = useTranslation();
  const turn =
    players.find(
      (p) =>
        p.meta.id === useGameStore.getState().gameState?.currentTurnPlayerId,
    )?.meta.username ?? t("game.somePlayer");
  const key =
    role === "spectator"
      ? "game.action.spectator"
      : phase === "choosing"
        ? role === "player"
          ? "game.action.yourPick"
          : "game.action.waitPick"
        : phase === "buzzer"
          ? "game.action.buzz"
          : phase === "question"
            ? "game.action.reading"
            : "game.action.reading";
  return (
    <div className={styles.guidance}>
      <strong>{t(`game.phase.${phase}`)}.</strong> {t(key, { name: turn })}
    </div>
  );
}

function PlayerRail({
  players,
  activeId,
}: {
  players: Player[];
  activeId?: number | null;
}) {
  return (
    <div className={styles.playersRail}>
      {players
        .filter((p) => p.role !== "spectator")
        .map((player) => (
          <div
            className={styles.playerChip}
            data-active={player.meta.id === activeId}
            key={player.meta.id}
          >
            <span className={styles.playerAvatar}>
              {player.meta.username.slice(0, 1).toUpperCase()}
            </span>
            <strong>{player.meta.username}</strong>
            <span>
              {player.score >= 0 ? "+" : ""}
              {player.score}
            </span>
          </div>
        ))}
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
          {players
            .filter((p) => p.role !== "spectator")
            .map((p) => (
              <div className={styles.seat} key={p.meta.id}>
                <strong>
                  {p.meta.username}
                  {p.role === "showman" ? ` · ${t("common.showman")}` : ""}
                </strong>
                <span className={styles.ready}>
                  {ready.includes(p.meta.id) || p.role === "showman"
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
  const question = state?.currentQuestion as {
    id?: number;
    text?: string;
    questionText?: string;
    price?: number;
    answer?: string;
    questionFiles?: Array<{
      file: { link?: string | null; type: "image" | "audio" | "video" };
    }> | null;
  } | null;
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
    if (state?.questionState !== "media_downloading" || !question?.id) return;
    let cancelled = false;
    const preload = media.map(({ file }) => preloadMedia(file.link, file.type));
    let timeoutId: number | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timeoutId = window.setTimeout(() => reject(new Error("timeout")), 15_000);
    });
    Promise.race([Promise.all(preload), timeout])
      .then(
        () =>
          !cancelled &&
          setMediaResult({ questionId: question.id!, status: "ready" }),
      )
      .catch(
        () =>
          !cancelled &&
          setMediaResult({ questionId: question.id!, status: "error" }),
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
  const doBuzz = useCallback(() => buzz(), []);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (
        event.code === "Space" &&
        !(
          event.target instanceof HTMLInputElement ||
          event.target instanceof HTMLTextAreaElement ||
          event.target instanceof HTMLSelectElement
        )
      ) {
        event.preventDefault();
        doBuzz();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [doBuzz]);
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
          : `${question?.price ?? 500} ${t("common.points")}`}
      </span>
      <h2>
        {question?.questionText ??
          question?.text ??
          t("game.questionUnavailable")}
      </h2>
      {media.length ? (
        <div className={styles.questionMedia} aria-live="polite">
          {media.map(({ file }, index) =>
            file.type === "image" && file.link ? (
              <img key={file.link} src={file.link} alt="" />
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
        <div
          className={styles.timer}
          aria-label={t("common.seconds", {
            count: Math.ceil(remaining / 1000),
          })}
        >
          <span
            style={
              {
                "--remaining": `${Math.min(100, (remaining / state.timer.durationMs) * 100)}%`,
              } as React.CSSProperties
            }
          />
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
                scoreResult: Math.abs(question?.price ?? 0),
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
                scoreResult: -Math.abs(question?.price ?? 0),
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
          <button
            className={ui.ghostButton}
            onClick={() =>
              getGameSocket()?.emit("question-guidance", {
                message: t("game.explain"),
                questionId: question?.id,
              })
            }
          >
            {t("game.explain")}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function preloadMedia(link: string | null | undefined, type: string) {
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
          disabled={!canBid}
          onClick={() =>
            getGameSocket()?.emit("stake-bid-submit", {
              bidType: "normal",
              bidAmount: bid,
            })
          }
        >
          {t("game.placeBid")}
        </button>
        <button
          className={ui.secondaryButton}
          disabled={!canBid}
          onClick={() =>
            getGameSocket()?.emit("stake-bid-submit", {
              bidType: "all-in",
              bidAmount: null,
            })
          }
        >
          {t("game.allIn")}
        </button>
        <button
          className={ui.ghostButton}
          disabled={!canBid}
          onClick={() =>
            getGameSocket()?.emit("stake-bid-submit", {
              bidType: "pass",
              bidAmount: null,
            })
          }
        >
          {t("game.pass")}
        </button>
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

function Chat({ players }: { players: Player[] }) {
  const { t } = useTranslation();
  const messages = useGameStore((s) => s.messages);
  const [message, setMessage] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (message.trim()) {
      getGameSocket()?.emit("chat-message", { message: message.trim() });
      setMessage("");
    }
  };
  return (
    <aside className={styles.sidePanel}>
      <header>
        <span>
          <MessageSquare size={15} /> {t("game.chat")}
        </span>
        <span className={ui.badge}>{messages.length}</span>
      </header>
      <div className={styles.messages}>
        {messages.map((item, index) => {
          const user = players.find((p) => p.meta.id === item.user);
          return (
            <div className={styles.message} key={item.uuid ?? index}>
              <strong>{user?.meta.username ?? t("common.player")}</strong>
              <p>
                {String(
                  (item as { message?: string; content?: string }).message ??
                    (item as { content?: string }).content ??
                    "",
                )}
              </p>
            </div>
          );
        })}
      </div>
      <form className={styles.chatForm} onSubmit={submit}>
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={t("game.chatPlaceholder")}
        />
        <button className={ui.iconButton} aria-label={t("game.send")}>
          →
        </button>
      </form>
    </aside>
  );
}

function Results({ players }: { players: Player[] }) {
  const { t } = useTranslation();
  const sorted = [...players]
    .filter((p) => p.role === "player")
    .sort((a, b) => b.score - a.score);
  return (
    <div className={styles.results}>
      <p className={ui.eyebrow}>{t("results.subtitle")}</p>
      <h2>{t("results.title")}</h2>
      <div className={styles.podium}>
        {sorted.map((p, i) => (
          <div className={styles.rank} key={p.meta.id}>
            <span>
              {i === 0 ? (
                <img
                  className={styles.crown}
                  src="/assets/crown.svg"
                  alt={t("results.winner")}
                />
              ) : (
                `#${i + 1}`
              )}
            </span>
            <strong>{p.meta.username}</strong>
            <span>{p.score}</span>
          </div>
        ))}
      </div>
      <div className={ui.toolbar}>
        <Link className={ui.primaryButton} to="/games/new">
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
        <Dialog.Overlay
          style={{
            position: "fixed",
            inset: 0,
            background: "#000a",
            zIndex: 80,
          }}
        />
        <Dialog.Content
          style={{
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%,-50%)",
            width: "min(520px,calc(100% - 28px))",
            background: "var(--card)",
            border: "1px solid var(--line-strong)",
            borderRadius: 12,
            padding: 24,
            zIndex: 81,
          }}
        >
          <Dialog.Title>{t("tutorial.title")}</Dialog.Title>
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
            <button
              className={ui.primaryButton}
              style={{ width: "100%", marginTop: 16 }}
            >
              {t("common.continue")}
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
