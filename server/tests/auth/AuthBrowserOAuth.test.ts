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
});
