import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRootRoute, createRouter, RouterProvider } from "@tanstack/react-router";
import { GameContext } from "../src/features/game/GameContext";
import { GameScreen } from "../src/features/game/play/GameScreen";
import { LobbyScreen } from "../src/features/game/lobby/LobbyScreen";
import { GameRules } from "../src/features/create-game/GameRules";
import { DEFAULT_GAME_SETTINGS } from "../src/features/create-game/gameSettings";
import { GameConnection } from "../src/game/connection";
import { ALICE, player, question, round, session, timer } from "../src/game/fixtures";
import { useGameStore } from "../src/game/store";
import { useSettings } from "../src/features/settings/settingsStore";
import { useState } from "react";
export { useGameStore };

export const sent: { action: string; args: unknown[] }[] = [];
const picture = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000"><rect width="800" height="1000" fill="#456b9c"/><circle cx="400" cy="400" r="220" fill="#ffd166"/></svg>')}`;

export function mountMaxPlayers(
  mode: Parameters<typeof mountLobbyQuestion>[0] = "long",
  myId = ALICE,
) {
  const client = mountLobbyQuestion(mode, myId);
  const game = useGameStore.getState().session!;
  useGameStore.setState({
    session: {
      ...game,
      players: Array.from({ length: 16 }, (_, index) =>
        player(index + 1, index === 0 ? "showman" : "player", {
          meta: {
            id: index + 1,
            username: `Very_long_player_nickname_${String(index + 1).padStart(2, "0")}_XYZ`,
            avatar: picture,
          },
          score: index % 2 ? -2_100_000_000 : 2_100_000_000,
        }),
      ),
    },
  });
  return client;
}

export function mountLobbyQuestion(
  mode: "lobby" | "caption" | "long" | "timeline" | "text" | "secret" | "video" | "point" | "buzz",
  myId = ALICE,
  autoStart = true,
) {
  document.getElementById("root")!.hidden = true;
  sent.length = 0;
  useSettings.getState().update({ language: "en", sound: false, reduceMotion: true, pins: {} });
  const game = session(
    mode === "lobby"
      ? {}
      : {
          currentRound: round(),
          questionState:
            mode === "secret" ? "secret_transfer" : mode === "point" ? "answering" : "showing",
          currentQuestion: question(100, {
            ...(mode === "point" ? { answerType: "point" } : {}),
            text:
              mode === "long" || mode === "text"
                ? "A long question with more details. ".repeat(150)
                : "Знаменитий японський рід спадкових шаманів",
            questionFiles:
              mode === "text"
                ? []
                : [
                    {
                      order: 1,
                      displayTime: null,
                      file: {
                        type: mode === "video" ? "video" : "image",
                        md5: "layout-media",
                        link: mode === "video" ? "/e2e/fixtures/clip.webm" : picture,
                      },
                    },
                  ],
          }),
          skippedPlayers: mode === "point" || mode === "buzz" ? [] : [ALICE],
          answeringPlayer: mode === "point" ? ALICE : null,
          timer: timer(120_000),
          ...(mode === "secret"
            ? {
                secretQuestionData: {
                  questionId: 100,
                  pickerPlayerId: 3,
                  transferType: "any",
                  transferDecisionPhase: true,
                },
              }
            : {}),
        },
  );
  game.settings = { ...DEFAULT_GAME_SETTINGS, autoStart };
  if (mode === "timeline")
    game.content = {
      kind: "question",
      timer: null,
      frozenAtMs: 2000,
      plan: {
        totalMs: 2000,
        steps: [
          {
            startMs: 0,
            durationMs: 1000,
            items: [{ kind: "text", order: 0, durationMs: 1000, placement: "screen" }],
          },
          {
            startMs: 1000,
            durationMs: 1000,
            items: [{ kind: "file", order: 1, durationMs: 1000, placement: "screen" }],
          },
        ],
      },
    };
  useGameStore.setState({
    session: game,
    gameId: "ABCD",
    connection: "connected",
    pending: null,
    left: null,
  });
  const connection = new GameConnection("ABCD", myId, { role: "player" });
  connection.emit = (action, ...args) => {
    sent.push({ action, args });
  };
  Object.defineProperty(connection, "connected", { get: () => true });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  client.setQueryData(["game", "ABCD"], {
    maxPlayers: 6,
    settings: game.settings,
    package: { id: 1, title: "Evening quiz" },
  });
  client.setQueryData(["package", 1], {
    rounds: [
      round(),
      {
        ...round("final"),
        id: 2,
        order: 1,
        themes: [{ id: 21, order: 0, name: "Final discoveries", questions: [] }],
      },
    ],
  });
  function Fixture() {
    return (
      <GameContext.Provider value={{ connection, myId }}>
        {mode === "lobby" ? <LobbyScreen /> : <GameScreen />}
      </GameContext.Provider>
    );
  }
  const router = createRouter({ routeTree: createRootRoute({ component: Fixture }) });
  const node = document.createElement("div");
  document.body.append(node);
  createRoot(node).render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return client;
}

export function mountRoundIndicator(count = 4, current = 1, final = true, metadata = true) {
  const client = mountMaxPlayers("buzz");
  const rounds = Array.from({ length: count }, (_, index) => ({
    ...round(final && index === count - 1 ? "final" : "simple"),
    id: index + 1,
    order: index * 2,
    name:
      index === 1
        ? "A long round name with discoveries and journeys around the world"
        : `Round ${index + 1}`,
  }));
  if (metadata) client.setQueryData(["package", 1], { rounds: [...rounds].reverse() });
  else client.removeQueries({ queryKey: ["package", 1] });
  const game = useGameStore.getState().session!;
  useGameStore.setState({
    session: {
      ...game,
      state: {
        ...game.state,
        currentRound: rounds[current]!,
        currentQuestion: null,
        questionState: "choosing",
        currentTurnPlayerId: ALICE,
      },
    },
  });
  useSettings.getState().update({ reduceMotion: false });
}

export function vacateShowman() {
  const game = useGameStore.getState().session!;
  useGameStore.getState().dispatch({
    type: "player-role-change",
    payload: {
      playerId: 1,
      newRole: "player",
      players: game.players.map((p) => (p.meta.id === 1 ? { ...p, role: "player", slot: 2 } : p)),
    },
  });
}

export function mountSecretRecipients() {
  mountLobbyQuestion("secret");
  const game = useGameStore.getState().session!;
  useGameStore.setState({
    session: {
      ...game,
      players: game.players.map((p) => ({
        ...p,
        meta: {
          ...p.meta,
          username:
            p.meta.id === ALICE
              ? "PlayerWithAVeryLongUnbrokenNickname"
              : p.meta.id === 3
                ? "asion.desu"
                : p.meta.username,
        },
        score: p.meta.id === ALICE ? -1234567 : 10400,
      })),
    },
  });
}

export function mountStartRules() {
  document.getElementById("root")!.hidden = true;
  const node = document.createElement("div");
  document.body.append(node);
  function Rules() {
    const [value, onChange] = useState(DEFAULT_GAME_SETTINGS);
    return <GameRules value={value} onChange={onChange} />;
  }
  createRoot(node).render(<Rules />);
}

export function mountLayoutLimits(mode: "choice" | "board" | "finished", myId = ALICE) {
  mountMaxPlayers("long", myId);
  const game = useGameStore.getState().session!;
  const prices = [
    1, 10, 100, 1000, 10000, 100000, 1000000, 999999, 500000, 99999, 500, 5000, 50000, 250000,
    750000,
  ];
  useGameStore.setState({
    session: {
      ...game,
      finished: mode === "finished",
      content: null,
      state: {
        ...game.state,
        questionState: mode === "board" ? "choosing" : "answering",
        currentTurnPlayerId: ALICE,
        answeringPlayer: mode === "choice" ? ALICE : null,
        skippedPlayers: [],
        currentQuestion:
          mode === "board"
            ? null
            : {
                ...game.state.currentQuestion!,
                type: "choice",
                showDelay: 0,
                answers: Array.from({ length: 8 }, (_, i) => ({
                  order: i,
                  text: `Option ${i + 1}: ${"Complete answer details. ".repeat(15)}`,
                  file: i % 2 ? null : { type: "image", md5: `option-${i}`, link: picture },
                })),
              },
        currentRound:
          mode !== "board"
            ? game.state.currentRound
            : {
                ...round(),
                themes: Array.from({ length: 15 }, (_, i) => ({
                  id: i + 10,
                  order: i,
                  name: `Theme ${i + 1}: ${"A very long theme name with details. ".repeat(5)}`,
                  questions: prices.map((price, j) => ({
                    id: 100 + i * 100 + j,
                    order: j,
                    price,
                    isPlayed: false,
                  })),
                })),
              },
      },
    },
  });
}

export function setSpectatorCount(count: number) {
  const game = useGameStore.getState().session!;
  useGameStore.setState({
    session: {
      ...game,
      players: [
        ...game.players.filter((p) => p.role !== "spectator"),
        ...Array.from({ length: count }, (_, i) => player(100 + i, "spectator")),
      ],
    },
  });
}

export function mountPointResults(count = 15) {
  mountMaxPlayers("long");
  const game = useGameStore.getState().session!;
  const players = game.players.slice(0, count + 1).map((p) => ({
    ...p,
    meta: { ...p.meta, username: `player_${p.meta.id}_${"w".repeat(22)}` },
  }));
  useGameStore.setState({
    session: {
      ...game,
      players,
      content: null,
      state: {
        ...game.state,
        questionState: "showing_answer",
        answeringPlayer: null,
        currentQuestion: {
          ...game.state.currentQuestion!,
          type: "noRisk",
          subType: "forEveryone",
          answerType: "point",
        },
        allPlay: {
          mode: "noRisk",
          questionId: 100,
          price: 100,
          maxStake: null,
          priceMultiplier: 1,
          entries: players
            .filter((p) => p.role === "player")
            .map((p) => ({
              playerId: p.meta.id,
              stake: null,
              answer: "0.5,0.5",
              submitted: true,
              isCorrect: true,
              scoreChange: 100,
            })),
        },
        answerShowData: {
          answerText: "The center",
          answerFiles: null,
          nextTurnPlayerId: ALICE,
          answerPoint: { x: 0.5, y: 0.5 },
          answerDeviation: 0.05,
          answerPointImage: picture,
        },
      },
    },
  });
}
