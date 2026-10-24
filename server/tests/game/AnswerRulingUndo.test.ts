import { describe, expect, it } from "@jest/globals";

import { SCORE_ABS_LIMIT } from "domain/constants/game";
import { ShowmanToolsLogic } from "domain/logic/game/ShowmanToolsLogic";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { AnswerResultType } from "domain/types/socket/game/AnswerResultData";
import { buildGame } from "tests/integration/recovery/SingleInstanceRestartRecoveryFixtures";

describe("undoing an answer ruling", () => {
  it.each([
    { score: SCORE_ABS_LIMIT, requested: 100, applied: 0 },
    { score: SCORE_ABS_LIMIT - 40, requested: 100, applied: 40 },
    { score: -SCORE_ABS_LIMIT, requested: -100, applied: 0 },
    { score: -SCORE_ABS_LIMIT + 40, requested: -100, applied: -40 },
    { score: 200, requested: 100, applied: 100 },
    { score: 200, requested: -100, applied: -100 }
  ])("restores $score after a requested $requested ruling", ({ score, requested, applied }) => {
    const game = buildGame("UNDO", null);
    const player = game.getPlayer(2, { fetchDisconnected: true })!;
    player.score = score;
    game.gameState.answeringPlayer = 2;

    const answerType = requested > 0 ? AnswerResultType.CORRECT : AnswerResultType.WRONG;
    const ruling = game.handleQuestionAnswer(requested, answerType, QuestionState.SHOWING_ANSWER);
    expect(ruling.appliedChange).toBe(applied);
    expect(player.score).toBe(score + applied);
    game.gameState.answerShowData = {
      answerFiles: null,
      answerText: null,
      nextTurnPlayerId: null,
      answerResult: ruling
    };

    const undone = ShowmanToolsLogic.undoLastRuling(game);

    expect(undone.result.revertedResult).toBe(applied);
    expect(undone.answerType).toBe(answerType);
    expect(player.score).toBe(score);
  });
});
