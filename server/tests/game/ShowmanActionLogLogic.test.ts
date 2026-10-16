import { describe, expect, it } from "@jest/globals";

import { GameActionType } from "domain/enums/GameActionType";
import { ShowmanActionLogLogic } from "domain/logic/chat/ShowmanActionLogLogic";
import { type GameAction } from "domain/types/action/GameAction";
import { AnswerResultType } from "domain/types/socket/game/AnswerResultData";
import { buildGame } from "tests/integration/recovery/SingleInstanceRestartRecoveryFixtures";

/** Showman is user 1, players are users 2 and 3 */
function action(type: GameActionType, playerId: number, payload: unknown = {}): GameAction {
  return {
    id: "a1",
    type,
    gameId: "LOG",
    playerId,
    socketId: "s1",
    timestamp: new Date(),
    payload
  };
}

describe("ShowmanActionLogLogic", () => {
  it("logs a ruling with the player's name and the real score change", () => {
    const game = buildGame("LOG", null);
    const line = ShowmanActionLogLogic.build(
      action(GameActionType.ANSWER_RESULT, 1, { scoreResult: 400, answerType: "correct" }),
      {
        success: true,
        data: {
          answerResult: {
            player: 2,
            result: 400,
            score: 600,
            answerType: AnswerResultType.CORRECT
          },
          timer: null
        }
      },
      game
    );

    expect(line?.system).toEqual({
      action: GameActionType.ANSWER_RESULT,
      params: { player: "user-2", points: 400, answerType: AnswerResultType.CORRECT }
    });
    expect(line?.message).toBe("Showman judged user-2's answer right (+400)");
  });

  it("logs score changes and kicks, keeping the name after the player left", () => {
    const game = buildGame("LOG", null);
    game.removePlayer(3);

    const kick = ShowmanActionLogLogic.build(
      action(GameActionType.PLAYER_KICK, 1, { playerId: 3 }),
      { success: true, data: {} },
      game
    );
    const score = ShowmanActionLogLogic.build(
      action(GameActionType.PLAYER_SCORE_CHANGE, 1, { playerId: 2, newScore: 900 }),
      { success: true, data: {} },
      game
    );

    expect(kick?.system.params).toEqual({ player: "user-3" });
    expect(score?.system.params).toEqual({ player: "user-2", score: 900 });
  });

  it("ignores players, failed actions and routine moves", () => {
    const game = buildGame("LOG", null);

    expect(
      ShowmanActionLogLogic.build(
        action(GameActionType.QUESTION_ANSWER, 2),
        { success: true },
        game
      )
    ).toBeNull();
    expect(
      ShowmanActionLogLogic.build(action(GameActionType.PAUSE, 2), { success: true }, game)
    ).toBeNull();
    expect(
      ShowmanActionLogLogic.build(action(GameActionType.PAUSE, 1), { success: false }, game)
    ).toBeNull();
    expect(
      ShowmanActionLogLogic.build(
        action(GameActionType.SKIP_SHOW_ANSWER, 1),
        { success: true },
        game
      )
    ).toBeNull();
    expect(
      ShowmanActionLogLogic.build(action(GameActionType.PAUSE, 1), { success: true }, game)?.system
    ).toEqual({ action: GameActionType.PAUSE, params: {} });
  });
});
