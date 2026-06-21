import { expect } from "@jest/globals";

import { SocketIOGameEvents } from "domain/enums/SocketIOEvents";
import { type GameQuestionDataEventPayload } from "domain/types/socket/events/game/GameQuestionDataEventPayload";

import { type GameClientSocket, type SocketGameTestUtils } from "./SocketIOGameTestUtils";

export async function pickMediaQuestionAndWaitForGate(
  utils: SocketGameTestUtils,
  showmanSocket: GameClientSocket,
  observerSocket: GameClientSocket,
  questionId: number
): Promise<void> {
  const questionDataPromise = utils.waitForEvent<GameQuestionDataEventPayload>(
    observerSocket,
    SocketIOGameEvents.QUESTION_DATA,
    2000
  );

  showmanSocket.emit(SocketIOGameEvents.QUESTION_PICK, { questionId });

  const questionData = await questionDataPromise;
  expect(questionData.data.id).toBe(questionId);
  expect(questionData.data.questionFiles).not.toHaveLength(0);
}
