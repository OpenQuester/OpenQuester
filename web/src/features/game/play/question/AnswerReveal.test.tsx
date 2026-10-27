import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { GameContext } from "@/features/game/GameContext";
import { ALICE, question, round, session } from "@/game/fixtures";
import { createGameStore } from "@/game/store";
import { AnswerReveal } from "./AnswerReveal";

afterEach(cleanup);

describe("point answer reveal", () => {
  it("restores the image and radius from a rejoined snapshot without a current question", () => {
    const store = createGameStore();
    store.setState({
      session: session({
        currentRound: round(),
        questionState: "showing_answer",
        currentQuestion: null,
        answerShowData: {
          answerText: "Center",
          answerFiles: null,
          nextTurnPlayerId: ALICE,
          answerPoint: { x: 0.5, y: 0.5, imageAspectRatio: 2 },
          answerDeviation: 0.1,
          answerPointImage: "/point.png",
        },
      }),
    });
    render(
      <GameContext.Provider
        value={{ store, myId: ALICE, connection: { connected: true, emit: () => {} } }}
      >
        <AnswerReveal />
      </GameContext.Provider>,
    );
    expect(screen.getByRole("img")).toHaveAttribute("src", "/point.png");
    expect(screen.getByTestId("point-target")).toHaveStyle({
      left: "50%",
      top: "50%",
      width: "20%",
    });
    expect(screen.getByText("Center")).toBeInTheDocument();
  });

  it("uses the current question image when an older reveal payload has no image field", () => {
    const store = createGameStore();
    store.setState({
      session: session({
        currentRound: round(),
        questionState: "showing_answer",
        currentQuestion: question(100, {
          answerType: "point",
          questionFiles: [
            {
              order: 0,
              displayTime: null,
              file: { md5: "image", type: "image", link: "/legacy.png" },
            },
          ],
        }),
        answerShowData: {
          answerText: "Center",
          answerFiles: null,
          nextTurnPlayerId: ALICE,
          answerPoint: { x: 0.5, y: 0.5 },
          answerDeviation: 0.1,
        },
      }),
    });
    render(
      <GameContext.Provider
        value={{ store, myId: ALICE, connection: { connected: true, emit: () => {} } }}
      >
        <AnswerReveal />
      </GameContext.Provider>,
    );
    expect(screen.getByRole("img")).toHaveAttribute("src", "/legacy.png");
    expect(screen.getByTestId("point-target")).toBeInTheDocument();
  });
});
