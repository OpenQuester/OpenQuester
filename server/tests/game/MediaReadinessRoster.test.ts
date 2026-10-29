import { describe, expect, it } from "@jest/globals";
import { GameMapper } from "domain/mappers/GameMapper";
import { MediaDownloadLogic } from "domain/logic/question/MediaDownloadLogic";
import { GameRedisValidator } from "domain/validators/GameRedisValidator";
import { buildGame } from "tests/integration/recovery/SingleInstanceRestartRecoveryFixtures";

function restore(game: ReturnType<typeof buildGame>) {
  const hash = GameMapper.serializeGameToHash(game);
  return GameMapper.deserializeGameHash(
    GameRedisValidator.validateRedisData(hash as unknown as Record<string, string>)
  );
}

describe("media readiness roster", () => {
  it("survives Redis validation and remains distinct from no-risk answer eligibility", () => {
    const game = buildGame("ROST", null);
    game.captureQuestionEligiblePlayers();
    game.gameState.questionEligiblePlayers = [2];
    const restored = restore(game);
    expect(restored.getMediaEligiblePlayerIds()).toEqual([2, 3]);
    expect(restored.isPlayerEligibleForMedia(3)).toBe(true);
    expect(restored.isPlayerEligibleToAnswer(3)).toBe(false);
    expect(restored.isPlayerEligibleForMedia(4)).toBe(false);
    expect(MediaDownloadLogic.getEligiblePlayers(restored).map((player) => player.meta.id)).toEqual(
      [2, 3]
    );
    restored.resetToChoosingState();
    expect(restored.getMediaEligiblePlayerIds()).toBeNull();
    restored.captureQuestionEligiblePlayers();
    restored.gameState = { ...restored.gameState };
    expect(restored.getMediaEligiblePlayerIds()).toBeNull();
  });

  it("distinguishes an empty roster from legacy Redis data without the field", () => {
    const game = buildGame("ROST", null);
    const hash = GameMapper.serializeGameToHash(game);
    delete hash.mediaEligiblePlayerIds;
    const legacy = GameMapper.deserializeGameHash(
      GameRedisValidator.validateRedisData(hash as unknown as Record<string, string>)
    );
    expect(legacy.isPlayerEligibleForMedia(2)).toBe(true);
    hash.mediaEligiblePlayerIds = "[]";
    const empty = GameMapper.deserializeGameHash(
      GameRedisValidator.validateRedisData(hash as unknown as Record<string, string>)
    );
    expect(empty.isPlayerEligibleForMedia(2)).toBe(false);
    expect(MediaDownloadLogic.getEligiblePlayers(empty)).toEqual([]);
  });
});
