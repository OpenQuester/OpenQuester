import { QuestionGuidanceUseCase } from "application/usecases/direct/QuestionGuidanceUseCase";
import { DataMutationType } from "domain/enums/DataMutationType";
import { SocketIOEvents } from "domain/enums/SocketIOEvents";
import { ClientError } from "domain/errors/ClientError";
import { type ActionExecutionContext } from "domain/types/action/ActionExecutionContext";
import { PlayerRole } from "domain/types/game/PlayerRole";

const context = (role: PlayerRole, message = "  Choice questions show multiple options.  ") =>
  ({
    action: { gameId: "AB12", payload: { message, questionId: 42 } },
    currentPlayer: { role }
  }) as unknown as ActionExecutionContext<{
    message: string;
    questionId?: number;
  }>;

describe("QuestionGuidanceUseCase", () => {
  it("broadcasts trimmed guidance without a game-state mutation", async () => {
    const result = await new QuestionGuidanceUseCase().execute(context(PlayerRole.SHOWMAN));

    expect(result.data).toEqual({
      message: "Choice questions show multiple options.",
      questionId: 42
    });
    expect(result.mutations).toHaveLength(1);
    expect(result.mutations?.[0]).toMatchObject({
      type: DataMutationType.BROADCAST,
      event: SocketIOEvents.QUESTION_GUIDANCE,
      gameId: "AB12"
    });
  });

  it("rejects player-authored guidance", async () => {
    await expect(
      new QuestionGuidanceUseCase().execute(context(PlayerRole.PLAYER))
    ).rejects.toBeInstanceOf(ClientError);
  });
});
