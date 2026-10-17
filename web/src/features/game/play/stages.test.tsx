import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GameConnection } from "@/game/connection";
import { ALICE, question, round, session, timer } from "@/game/fixtures";
import type { GameSession } from "@/game/reducer";
import { useGameStore } from "@/game/store";

import { GameContext } from "../GameContext";
import { FinalAnswerStage } from "./FinalStages";

function renderStage(s: GameSession, ui: ReactNode, myId = ALICE) {
  const emit = vi.fn();
  useGameStore.setState({ session: s, connection: "connected", pending: null });
  const connection = { emit, connected: true } as unknown as GameConnection;
  render(<GameContext.Provider value={{ connection, myId }}>{ui}</GameContext.Provider>);
  return emit;
}

describe("final answer stage", () => {
  beforeEach(() => useGameStore.setState({ session: null, pending: null }));

  it("shows a media-only final question instead of 'no content'", () => {
    renderStage(
      session({
        currentRound: round("final"),
        questionState: "answering",
        timer: timer(),
        currentQuestion: question(100, {
          text: null,
          questionFiles: [
            {
              order: 0,
              displayTime: null,
              file: { md5: "0123456789abcdef0123456789abcdef", type: "image", link: "https://x/i" },
            },
          ],
        }),
      }),
      <FinalAnswerStage />,
    );

    expect(screen.getByTestId("media-frame")).toBeInTheDocument();
    expect(screen.queryByTestId("question-text")).toBeNull();
  });
});
