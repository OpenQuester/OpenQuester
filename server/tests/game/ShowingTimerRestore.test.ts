import { describe, expect, it } from "@jest/globals";

import { timerKey } from "domain/constants/redisKeys";
import { MIN_TIMER_TTL_MS } from "domain/constants/timer";
import { AnsweringToShowingHandler } from "domain/state-machine/handlers/regular-round/AnsweringToShowingHandler";
import { TransitionTrigger } from "domain/state-machine/types";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { AnswerResultType } from "domain/types/socket/game/AnswerResultData";
import { buildGame, buildTimer } from "tests/integration/recovery/SingleInstanceRestartRecoveryFixtures";

describe("restoring the showing timer", () => {
  it("clears the answering timer without fabricating a missing saved timer", async () => {
    const game = buildGame("MISSING", null);
    game.gameState.questionState = QuestionState.ANSWERING;
    game.gameState.answeringPlayer = 2;
    const result = await new AnsweringToShowingHandler().execute({
      game,
      trigger: TransitionTrigger.USER_ACTION,
      triggeredBy: { isSystem: false, playerId: 1 },
      payload: { answerType: AnswerResultType.WRONG }
    });
    expect(game.gameState.timer).toBeNull();
    expect(result.timerMutations).toEqual([{ op: "delete", key: timerKey(game.id) }]);
  });

  it("rearms an already elapsed saved timer at the minimum Redis TTL", async () => {
    const game = buildGame("ELAPSED", null);
    game.gameState.questionState = QuestionState.ANSWERING;
    game.gameState.answeringPlayer = 2;
    const saved = { ...buildTimer(), elapsedMs: 31_000 };
    const result = await new AnsweringToShowingHandler().execute({
      game,
      trigger: TransitionTrigger.USER_ACTION,
      triggeredBy: { isSystem: false, playerId: 1 },
      payload: { answerType: AnswerResultType.WRONG },
      resources: { savedShowingTimer: saved }
    });
    expect(saved.resumedAt).not.toBeNull();
    expect(result.timerMutations).toContainEqual({
      op: "delete",
      key: timerKey(game.id, QuestionState.SHOWING)
    });
    expect(result.timerMutations).toContainEqual({
      op: "set",
      key: timerKey(game.id),
      value: JSON.stringify(saved),
      pxTtl: MIN_TIMER_TTL_MS
    });
  });
});
