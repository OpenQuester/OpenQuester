import { describe, expect, it } from "@jest/globals";

import { SCORE_ABS_LIMIT } from "domain/constants/game";
import { AnswerSubmittedLogic } from "domain/logic/question/AnswerSubmittedLogic";
import { ShowingToShowingAnswerHandler } from "domain/state-machine/handlers/regular-round/ShowingToShowingAnswerHandler";
import { TransitionTrigger } from "domain/state-machine/types";
import { GameMapper } from "domain/mappers/GameMapper";
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
  it("persists the actual submitted text and does not reuse it after undo and a fresh oral answer", () => {
    const game = buildGame("ANSWER", null);
    game.gameState.answeringPlayer = 2;
    AnswerSubmittedLogic.recordSubmission(game, "first");
    AnswerSubmittedLogic.recordSubmission(game, "0");
    const rejoined = GameMapper.deserializeGameHash(GameMapper.serializeGameToHash(game));
    expect(rejoined.gameState.submittedAnswer).toBe("0");
    const wrong = rejoined.handleQuestionAnswer(0, AnswerResultType.WRONG, QuestionState.SHOWING);
    expect(wrong.answerText).toBe("0");
    expect(rejoined.gameState.submittedAnswer).toBeNull();
    ShowmanToolsLogic.undoLastRuling(rejoined);
    rejoined.gameState.answeringPlayer = 2;
    const oral = rejoined.handleQuestionAnswer(
      0,
      AnswerResultType.CORRECT,
      QuestionState.SHOWING_ANSWER
    );
    expect(oral.answerText).toBeNull();
    expect(rejoined.gameState.submittedAnswer).toBeNull();
  });

  it.each([AnswerResultType.CORRECT, AnswerResultType.WRONG, AnswerResultType.SKIP])(
    "keeps a submitted answer with a %s ruling and clears it from the current slot",
    (answerType) => {
      const game = buildGame("ANSWER", null);
      game.gameState.answeringPlayer = 2;
      AnswerSubmittedLogic.recordSubmission(game, "player's words");
      const result = game.handleQuestionAnswer(0, answerType, QuestionState.SHOWING_ANSWER);
      expect(result.answerText).toBe("player's words");
      expect(game.gameState.submittedAnswer).toBeNull();
    }
  );

  it("retains judged attempts on showing timeout until undo or reset", async () => {
    const game = buildGame("TIMEOUT", null);
    game.gameState.answeringPlayer = 2;
    AnswerSubmittedLogic.recordSubmission(game, "wrong but real");
    game.handleQuestionAnswer(-100, AnswerResultType.WRONG, QuestionState.SHOWING);
    const handler = new ShowingToShowingAnswerHandler();
    const ctx = { game, trigger: TransitionTrigger.TIMER_EXPIRED, triggeredBy: { isSystem: true } };
    expect(handler.canTransition(ctx)).toBe(true);
    await handler.execute(ctx);
    const rejoined = GameMapper.deserializeGameHash(GameMapper.serializeGameToHash(game));
    expect(rejoined.gameState.answeredPlayers?.at(-1)?.answerText).toBe("wrong but real");
    ShowmanToolsLogic.undoLastRuling(rejoined);
    expect(rejoined.gameState.answeredPlayers ?? []).toHaveLength(0);
    rejoined.resetToChoosingState();
    expect(rejoined.gameState.answeredPlayers).toBeNull();
    expect(rejoined.gameState.submittedAnswer).toBeNull();
  });

  it("keeps multiple judged attempts in order for repeated undo on a forced reveal", async () => {
    const game = buildGame("HISTORY", null);
    for (const [id, text] of [
      [2, "first"],
      [3, "second"]
    ] as const) {
      game.gameState.answeringPlayer = id;
      AnswerSubmittedLogic.recordSubmission(game, text);
      game.handleQuestionAnswer(-100, AnswerResultType.WRONG, QuestionState.SHOWING);
    }
    const handler = new ShowingToShowingAnswerHandler();
    await handler.execute({
      game,
      trigger: TransitionTrigger.USER_ACTION,
      triggeredBy: { isSystem: false, playerId: 1 }
    });
    expect(game.gameState.answeredPlayers?.map((attempt) => attempt.answerText)).toEqual([
      "first",
      "second"
    ]);
    expect(ShowmanToolsLogic.undoLastRuling(game).result.playerId).toBe(3);
    expect(ShowmanToolsLogic.undoLastRuling(game).result.playerId).toBe(2);
    expect(game.gameState.answeredPlayers ?? []).toHaveLength(0);
  });


});
