import { io, type Socket } from "socket.io-client";

import { api } from "@/api/client";
import { API_URL } from "@/api/config";
import { i18n } from "@/i18n";
import { translateServerError } from "@/i18n/serverErrors";
import { formatScore } from "@/lib/format";

import { preloadQuestionMedia } from "./media";
import {
  SERVER_EVENT_NAMES,
  type ClientEventName,
  type ClientEvents,
  type PlayerRole,
  type ServerEvent,
} from "./protocol";
import { forgetLeftGame, useGameStore } from "./store";

export interface JoinOptions {
  role: PlayerRole;
  targetSlot?: number | null;
  password?: string | null;
}

/** How long an emitted action may wait for the server before we stop showing "sending". */
const PENDING_TIMEOUT_MS = 5000;

/**
 * A buzz stays locked until the server says who answers (the random draw
 * closes the accept window). The server sends nothing for a press that only
 * joined the draw, so this is a safety net in case the result never comes.
 */
export const BUZZ_PENDING_TIMEOUT_MS = 15_000;

/**
 * One Socket.IO connection to one game.
 *
 * On every (re)connect it authenticates the socket with the HTTP session and
 * re-sends `join`; the server answers with a full `game-data` snapshot that
 * replaces local state. Socket.IO handles reconnect backoff.
 */
export class GameConnection {
  private socket: Socket | null = null;
  private joinOptions: JoinOptions;
  private closed = false;
  private pendingTimer: number | undefined;
  private mediaToken = 0;
  /** Seat a spectator asked for: the server seats them first, then they move. */
  private wantedSlot: number | null = null;

  constructor(
    readonly gameId: string,
    readonly myId: number,
    options: JoinOptions,
  ) {
    this.joinOptions = options;
  }

  get connected(): boolean {
    return this.socket?.connected ?? false;
  }

  connect(): void {
    forgetLeftGame(this.gameId);
    // React StrictMode mounts, unmounts and remounts: a closed connection must
    // be able to start over.
    this.closed = false;
    const store = useGameStore.getState();
    store.begin(this.gameId);

    const socket = io(`${API_URL}/games`, {
      transports: ["websocket"],
      withCredentials: true,
      reconnectionDelay: 500,
      reconnectionDelayMax: 4000,
    });
    this.socket = socket;

    socket.on("connect", () => void this.onConnect());
    socket.on("disconnect", (reason) => {
      if (this.closed) return;
      // The server drops a socket on purpose when the same account connects
      // again (another tab or device). Reconnecting here would drop that one in
      // turn, and the two would take the seat from each other forever: wait
      // until the person picks this tab instead.
      if (reason === "io server disconnect") {
        useGameStore.getState().setConnection("replaced");
        return;
      }
      useGameStore.getState().setConnection("reconnecting");
    });
    socket.on("connect_error", () => {
      if (this.closed || useGameStore.getState().connection === "replaced") return;
      useGameStore.getState().setConnection("reconnecting");
    });
    socket.on("error", (payload: unknown) => this.onError(payload));
    // The lobby-wide games feed tells us when the showman deletes this game.
    socket.on("games", (payload: { event?: string; data?: { id?: string } }) => {
      if (payload?.event === "deleted" && payload.data?.id?.toUpperCase() === this.gameId) {
        useGameStore.getState().markLeft("deleted");
        this.close();
      }
    });

    for (const name of SERVER_EVENT_NAMES) {
      socket.on(name, (payload: unknown) =>
        this.onServerEvent({ type: name, payload } as ServerEvent),
      );
    }
  }

  /** Take the game back after another tab or device took over. */
  takeOver(): void {
    if (this.closed || !this.socket || this.socket.connected) return;
    useGameStore.getState().setConnection("connecting");
    this.socket.connect();
  }

  /** Leave the game for good (explicit "Leave game"). */
  leave(): void {
    this.socket?.emit("user-leave");
    useGameStore.getState().markLeft("left");
    this.close();
  }

  /** Drop the connection without leaving (page unmount); the seat is kept. */
  close(): void {
    this.closed = true;
    window.clearTimeout(this.pendingTimer);
    this.socket?.removeAllListeners();
    this.socket?.disconnect();
    this.socket = null;
  }

  /** Changes the role used for future rejoins (after a role change). */
  setJoinRole(role: PlayerRole, targetSlot: number | null = null): void {
    this.joinOptions = { ...this.joinOptions, role, targetSlot };
  }

  /**
   * A spectator takes a seat. Becoming a player puts them in the first free
   * seat, so once that happens they move to the seat they clicked.
   */
  takeSeat(slot: number): void {
    this.setJoinRole("player", slot);
    this.wantedSlot = slot;
    this.emit("player-role-change", { playerId: this.myId, newRole: "player" });
  }

  emit<K extends ClientEventName>(
    name: K,
    ...args: ClientEvents[K] extends undefined ? [] : [ClientEvents[K]]
  ): void {
    if (!this.socket?.connected) {
      useGameStore.getState().toast("error", "connection_lost");
      return;
    }
    const store = useGameStore.getState();
    store.setPending(name);
    window.clearTimeout(this.pendingTimer);
    this.pendingTimer = window.setTimeout(
      () => {
        if (useGameStore.getState().pending?.action === name)
          useGameStore.getState().setPending(null);
      },
      name === "question-answer" ? BUZZ_PENDING_TIMEOUT_MS : PENDING_TIMEOUT_MS,
    );
    if (args.length > 0) this.socket.emit(name, args[0]);
    else this.socket.emit(name);
  }

  /** Chat bypasses pending-state tracking: it never blocks gameplay. */
  sendChat(message: string): void {
    this.socket?.emit("chat-message", { message });
  }

  private async onConnect(): Promise<void> {
    const socket = this.socket;
    if (!socket?.id) return;
    useGameStore.getState().setConnection("connecting");
    try {
      const { response } = await api.POST("/v1/auth/socket", { body: { socketId: socket.id } });
      if (!response.ok) throw new Error(`auth ${response.status}`);
    } catch {
      if (this.closed || socket !== this.socket) return;
      useGameStore.getState().setConnection("failed");
      useGameStore.getState().setJoinError("auth_failed");
      return;
    }
    if (this.closed || socket !== this.socket) return;

    // Rejoin with the role we actually hold now, not the one we first asked for.
    const current = useGameStore.getState().session?.players.find((p) => p.meta.id === this.myId);
    const role = current?.role ?? this.joinOptions.role;
    socket.emit("join", {
      gameId: this.gameId,
      role,
      targetSlot: role === "player" ? (current?.slot ?? this.joinOptions.targetSlot ?? null) : null,
      password: this.joinOptions.password ?? null,
    });
  }

  private onError(payload: unknown): void {
    const message =
      payload && typeof payload === "object" && "message" in payload
        ? String((payload as { message: unknown }).message)
        : String(payload);
    const store = useGameStore.getState();
    store.setPending(null);
    if (!store.session) {
      // Errors before the first snapshot mean the join itself was refused.
      store.setJoinError(message);
      store.setConnection("failed");
      this.close();
      return;
    }
    store.toast("error", translateServerError(message));
  }

  private onServerEvent(event: ServerEvent): void {
    const store = useGameStore.getState();
    if (event.type === "game-data") store.setConnection("connected");

    const before = store.session;
    store.dispatch(event);
    this.announce(event, before);

    switch (event.type) {
      case "user-leave":
        if (event.payload.user === this.myId && before) {
          store.markLeft("left");
          this.close();
        }
        break;
      case "player-kicked":
        if (event.payload.playerId === this.myId) {
          store.markLeft("kicked");
          this.close();
        }
        break;
      case "game-closed":
        store.markLeft("closed");
        this.close();
        break;
      case "player-restricted":
        if (event.payload.playerId === this.myId && event.payload.banned) {
          store.markLeft("kicked");
          this.close();
        }
        break;
      case "question-data":
      case "game-data":
        this.maybeReportMedia();
        break;
      case "player-role-change":
        if (event.payload.playerId === this.myId) this.moveToWantedSlot();
        break;
      default:
        break;
    }
  }

  /** Short notices for things that change the game but have no screen of their own. */
  private announce(
    event: ServerEvent,
    before: ReturnType<typeof useGameStore.getState>["session"],
  ): void {
    if (!before) return;
    const name = (id: number | null | undefined) =>
      before.players.find((p) => p.meta.id === id)?.meta.username ??
      useGameStore.getState().session?.players.find((p) => p.meta.id === id)?.meta.username ??
      "";
    const info = (key: string, options: Record<string, unknown>) =>
      useGameStore.getState().toast("info", i18n.t(key, options));
    switch (event.type) {
      case "join":
        if (event.payload.meta.id !== this.myId) {
          const known = before.players.some((p) => p.meta.id === event.payload.meta.id);
          info(known ? "notices.back" : "notices.joined", { name: event.payload.meta.username });
        }
        break;
      case "user-leave":
        if (event.payload.user !== this.myId)
          info("notices.left", { name: name(event.payload.user) });
        break;
      case "player-kicked":
        if (event.payload.playerId !== this.myId)
          info("notices.kicked", { name: name(event.payload.playerId) });
        break;
      case "stake-question-winner":
        info("notices.stakeWinner", {
          name: name(event.payload.winnerPlayerId),
          amount: formatScore(event.payload.finalBid ?? 0),
        });
        break;
      case "secret-question-transfer":
        info("notices.secretTransfer", { name: name(event.payload.toPlayerId) });
        break;
      case "score-changed":
        info("notices.scoreChanged", {
          name: name(event.payload.playerId),
          score: formatScore(event.payload.newScore),
        });
        break;
      case "turn-player-changed":
        if (event.payload.newTurnPlayerId != null)
          info("notices.turnChanged", { name: name(event.payload.newTurnPlayerId) });
        break;
      default:
        break;
    }
  }

  private moveToWantedSlot(): void {
    const wanted = this.wantedSlot;
    this.wantedSlot = null;
    if (wanted === null) return;
    const me = useGameStore.getState().session?.players.find((p) => p.meta.id === this.myId);
    if (me?.role === "player" && me.slot !== wanted) {
      this.emit("player-slot-change", { targetSlot: wanted });
    }
  }

  /** Players preload question media, then tell the server they are ready. */
  private maybeReportMedia(): void {
    const session = useGameStore.getState().session;
    if (!session || session.state.questionState !== "media_downloading") return;
    const meNow = session.players.find((p) => p.meta.id === this.myId);
    if (meNow?.role !== "player") return;
    const token = ++this.mediaToken;
    void preloadQuestionMedia(session.state.currentQuestion).then((mediaDurations) => {
      if (mediaDurations === null) return;
      if (token !== this.mediaToken || this.closed) return;
      const latest = useGameStore.getState().session;
      if (latest?.state.questionState !== "media_downloading") return;
      if (mediaDurations.length > 0) this.socket?.emit("media-downloaded", { mediaDurations });
      else this.socket?.emit("media-downloaded");
    });
  }
}
