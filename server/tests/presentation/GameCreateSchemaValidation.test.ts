import { describe, expect, it } from "@jest/globals";

import { AgeRestriction } from "domain/enums/game/AgeRestriction";
import { GameCreateDTO } from "domain/types/dto/game/GameCreateDTO";
import { createGameScheme } from "presentation/schemes/game/gameSchemes";

describe("Game Creation Schema Validation", () => {
  describe("createGameScheme", () => {
    it("should accept valid game creation data without password", () => {
      const validData: GameCreateDTO = {
        title: "Test Game",
        packageId: 1,
        isPrivate: false,
        ageRestriction: AgeRestriction.NONE,
        maxPlayers: 10,
      };

      const { error } = createGameScheme().validate(validData);
      expect(error).toBeUndefined();
    });

    it("should accept valid game creation data with valid password", () => {
      const validData: GameCreateDTO = {
        title: "Test Game",
        packageId: 1,
        isPrivate: true,
        ageRestriction: AgeRestriction.NONE,
        maxPlayers: 10,
        password: "ValidPass",
      };

      const { error } = createGameScheme().validate(validData);
      expect(error).toBeUndefined();
    });

    it("should reject password with numbers", () => {
      const invalidData = {
        title: "Test Game",
        packageId: 1,
        isPrivate: true,
        ageRestriction: AgeRestriction.NONE,
        maxPlayers: 10,
        password: "Pass123",
      };

      const { error } = createGameScheme().validate(invalidData);
      expect(error).toBeDefined();
      expect(error?.message).toContain("password");
    });

    it("should reject password with special characters", () => {
      const invalidData = {
        title: "Test Game",
        packageId: 1,
        isPrivate: true,
        ageRestriction: AgeRestriction.NONE,
        maxPlayers: 10,
        password: "Pass@123",
      };

      const { error } = createGameScheme().validate(invalidData);
      expect(error).toBeDefined();
      expect(error?.message).toContain("password");
    });

    it("should reject password longer than 16 characters", () => {
      const invalidData = {
        title: "Test Game",
        packageId: 1,
        isPrivate: true,
        ageRestriction: AgeRestriction.NONE,
        maxPlayers: 10,
        password: "ThisPasswordIsTooLongForTheValidation",
      };

      const { error } = createGameScheme().validate(invalidData);
      expect(error).toBeDefined();
      expect(error?.message).toContain("password");
    });

    it("should accept password with exactly 16 characters", () => {
      const validData: GameCreateDTO = {
        title: "Test Game",
        packageId: 1,
        isPrivate: true,
        ageRestriction: AgeRestriction.NONE,
        maxPlayers: 10,
        password: "SixteenCharsPass",
      };

      const { error } = createGameScheme().validate(validData);
      expect(error).toBeUndefined();
    });

    it("should accept password with mixed case letters", () => {
      const validData: GameCreateDTO = {
        title: "Test Game",
        packageId: 1,
        isPrivate: true,
        ageRestriction: AgeRestriction.NONE,
        maxPlayers: 10,
        password: "AbCdEfGh",
      };

      const { error } = createGameScheme().validate(validData);
      expect(error).toBeUndefined();
    });

    it("should accept game without password field", () => {
      const validData = {
        title: "Test Game",
        packageId: 1,
        isPrivate: true,
        ageRestriction: AgeRestriction.NONE,
        maxPlayers: 10,
      };

      const { error } = createGameScheme().validate(validData);
      expect(error).toBeUndefined();
    });
  });
});
