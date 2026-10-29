import { describe, expect, it } from "@jest/globals";
import { PackageQuestionType } from "domain/enums/package/QuestionType";
import { PackageFileType } from "domain/enums/package/PackageFileType";
import { ChoiceSelectionLogic } from "domain/logic/question/ChoiceSelectionLogic";
import { AnswerSubmittedLogic } from "domain/logic/question/AnswerSubmittedLogic";
import { GameMapper } from "domain/mappers/GameMapper";
import { ShowmanToolsLogic } from "domain/logic/game/ShowmanToolsLogic";
import { QuestionState } from "domain/types/dto/game/state/QuestionState";
import { AnswerResultType } from "domain/types/socket/game/AnswerResultData";
import { buildGame } from "tests/integration/recovery/SingleInstanceRestartRecoveryFixtures";

function gameWithChoices() {
  const game = buildGame("CHOICE", null);
  game.gameState.currentQuestion = {
    ...game.gameState.currentQuestion!,
    type: PackageQuestionType.CHOICE,
    answers: [
      { order: 0, text: "Wrong", file: null },
      { order: 2.5, text: "Correct", file: null },
      { order: 7, text: null, file: null }
    ]
  };
  return game;
}

describe("choice selection identity", () => {
  it("retains zero-order wrong attempts across reconnect, rejects repeats, and restores them on undo", () => {
    const game = gameWithChoices();
    game.gameState.answeringPlayer = 2;
    expect(ChoiceSelectionLogic.resolve(game, "Wrong", 0)).toBe(0);
    AnswerSubmittedLogic.recordSubmission(game, "Wrong", 0);
    expect(
      game.handleQuestionAnswer(0, AnswerResultType.WRONG, QuestionState.SHOWING).choiceOrder
    ).toBe(0);
    const rejoined = GameMapper.deserializeGameHash(GameMapper.serializeGameToHash(game));
    expect(() => ChoiceSelectionLogic.resolve(rejoined, "Wrong", 0)).toThrow();
    expect(() => ChoiceSelectionLogic.resolve(rejoined, "Wrong")).toThrow();
    expect(ChoiceSelectionLogic.resolve(rejoined, "Correct", 2.5)).toBe(2.5);
    ShowmanToolsLogic.undoLastRuling(rejoined);
    expect(ChoiceSelectionLogic.resolve(rejoined, "Wrong", 0)).toBe(0);
  });

  it("keeps skip neutral and validates explicit order and text, including image placeholders", () => {
    const game = gameWithChoices();
    game.gameState.answeringPlayer = 2;
    AnswerSubmittedLogic.recordSubmission(game, "Wrong", 0);
    game.handleQuestionAnswer(0, AnswerResultType.SKIP, QuestionState.SHOWING);
    expect(ChoiceSelectionLogic.resolve(game, "Wrong", 0)).toBe(0);
    expect(ChoiceSelectionLogic.resolve(game, "3", 7)).toBe(7);
    expect(() => ChoiceSelectionLogic.resolve(game, "Correct", 0)).toThrow();
    expect(() => ChoiceSelectionLogic.resolve(game, "3", 999)).toThrow();
  });

  it("preserves ambiguous legacy answers without inventing identity", () => {
    const game = gameWithChoices();
    game.gameState.currentQuestion!.answers![1].text = "Wrong";
    expect(ChoiceSelectionLogic.resolve(game, "Wrong")).toBeNull();
    expect(ChoiceSelectionLogic.resolve(game, "3")).toBeNull();
    game.gameState.currentQuestion!.answers![1].order = 0;
    expect(() => ChoiceSelectionLogic.resolve(game, "Wrong", 0)).toThrow();
    expect(ChoiceSelectionLogic.resolve(game, "Wrong")).toBeNull();
  });

  it("does not attach a text option identity to a legacy image-placeholder collision", () => {
    const game = gameWithChoices();
    game.gameState.currentQuestion!.answers = [
      { order: 0, text: null, file: { md5: "image", type: PackageFileType.IMAGE } },
      { order: 1, text: "1", file: null },
      { order: 2, text: "42", file: null }
    ];
    game.gameState.answeringPlayer = 2;
    const order = ChoiceSelectionLogic.resolve(game, "1");
    expect(order).toBeNull();
    AnswerSubmittedLogic.recordSubmission(game, "1", order);
    const result = game.handleQuestionAnswer(0, AnswerResultType.WRONG, QuestionState.SHOWING);
    expect(result.choiceOrder).toBeUndefined();
    expect(ChoiceSelectionLogic.resolve(game, "1", 1)).toBe(1);
  });
});
