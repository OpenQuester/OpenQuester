import { EnvType } from "shared/config/Environment";
import { getSessionCookiePolicy } from "presentation/controllers/middleware/MiddlewareController";

describe("session cookie policy", () => {
  it.each(["localhost", "app.localhost", "127.0.0.1", "0.0.0.0", "::1", ""])(
    "keeps local development cookies available over HTTP for %s",
    (domain) => {
      expect(getSessionCookiePolicy(EnvType.DEV, domain)).toEqual({
        secure: false,
        sameSite: "lax"
      });
    }
  );

  it("allows credentialed cross-site sessions on hosted development APIs", () => {
    expect(getSessionCookiePolicy(EnvType.DEV, "dev-api.openquester.app")).toEqual({
      secure: true,
      sameSite: "none"
    });
  });

  it("always secures production cookies", () => {
    expect(getSessionCookiePolicy(EnvType.PROD, "localhost")).toEqual({
      secure: true,
      sameSite: "none"
    });
  });
});
