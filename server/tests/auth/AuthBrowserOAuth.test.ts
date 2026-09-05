import {
  oauthStateMatches,
  sanitizeOAuthReturnTo
} from "presentation/controllers/rest/AuthRestApiController";

describe("browser OAuth safety", () => {
  it("allows only local absolute return paths", () => {
    expect(sanitizeOAuthReturnTo("/packages?mine=true")).toBe("/packages?mine=true");
    expect(sanitizeOAuthReturnTo("https://evil.example/path")).toBe("/");
    expect(sanitizeOAuthReturnTo("//evil.example/path")).toBe("/");
    expect(sanitizeOAuthReturnTo(undefined)).toBe("/");
  });

  it("requires a non-empty exact OAuth state match", () => {
    expect(oauthStateMatches("known-state", "known-state")).toBe(true);
    expect(oauthStateMatches("wrong-state", "known-state")).toBe(false);
    expect(oauthStateMatches("", "")).toBe(false);
  });

  it("rejects a multi-byte state instead of throwing on unequal buffers", () => {
    // "éé" is 2 characters but 4 UTF-8 bytes; comparing on string length made
    // timingSafeEqual throw a RangeError, turning a 400 into a 500.
    expect(() => oauthStateMatches("éé", "abcd")).not.toThrow();
    expect(oauthStateMatches("éé", "abcd")).toBe(false);
    expect(oauthStateMatches("éé", "ab")).toBe(false);
  });
});
