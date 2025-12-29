import { describe, expect, it } from "@jest/globals";

import { PasswordUtils } from "domain/utils/PasswordUtils";

describe("PasswordUtils", () => {
  describe("generatePassword", () => {
    it("should generate a 4-character password", () => {
      const password = PasswordUtils.generatePassword();
      expect(password).toHaveLength(4);
    });

    it("should only contain letters A-Z and a-z", () => {
      const password = PasswordUtils.generatePassword();
      expect(password).toMatch(/^[A-Za-z]{4}$/);
    });

    it("should generate different passwords on consecutive calls", () => {
      const passwords = new Set<string>();
      for (let i = 0; i < 20; i++) {
        passwords.add(PasswordUtils.generatePassword());
      }
      // With 52^4 possibilities, we should get some variety in 20 calls
      expect(passwords.size).toBeGreaterThan(1);
    });

    it("should not contain numbers or special characters", () => {
      for (let i = 0; i < 10; i++) {
        const password = PasswordUtils.generatePassword();
        expect(password).not.toMatch(/[0-9]/);
        expect(password).not.toMatch(/[^A-Za-z]/);
      }
    });
  });
});
