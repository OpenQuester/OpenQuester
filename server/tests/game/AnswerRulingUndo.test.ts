import { describe, expect, it } from "@jest/globals";

import { SCORE_ABS_LIMIT } from "domain/constants/game";
import { ShowmanToolsLogic } from "domain/logic/game/ShowmanToolsLogic";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { AnswerResultType } from "domain/types/socket/game/AnswerResultData";
import { buildGame } from "tests/integration/recovery/SingleInstanceRestartRecoveryFixtures";

describe("undoing an answer ruling", () => {
  it("takes back only what the ruling really changed at the score limit", () => {
    const game = buildGame("UNDO", null);
    const player = game.getPlayer(2, { fetchDisconnected: true })!;
    player.score = SCORE_ABS_LIMIT;
    game.gameState.answeringPlayer = 2;

    // +100 is asked for, but the score is already at the limit
    const ruling = game.handleQuestionAnswer(
      100,
      AnswerResultType.CORRECT,
      QuestionState.SHOWING_ANSWER
    );
    expect(ruling.appliedChange).toBe(0);
    game.gameState.answerShowData = {
      answerFiles: null,
      answerText: null,
      nextTurnPlayerId: null,
      answerResult: ruling
    };

    const undone = ShowmanToolsLogic.undoLastRuling(game);

    expect(undone.result.revertedResult).toBe(0);
    expect(undone.answerType).toBe(AnswerResultType.CORRECT);
    expect(player.score).toBe(SCORE_ABS_LIMIT);
  });
});
