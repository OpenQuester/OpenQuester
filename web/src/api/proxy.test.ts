// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { proxy } from "../../functions/_proxy";
import { onRequest as socketProxy } from "../../functions/socket.io/[[path]]";
import { onRequest as apiProxy } from "../../functions/v1/[[path]]";

const site = "https://openquester.pages.dev";
const env = { API_ORIGIN: "https://api.openquester.app" };
const upstreamFetch = vi.fn<typeof fetch>();

beforeEach(() => {
  upstreamFetch.mockReset().mockResolvedValue(new Response("upstream"));
  vi.stubGlobal("fetch", upstreamFetch);
});

afterEach(() => vi.unstubAllGlobals());

describe("Pages proxy origin boundary", () => {
  it.each([
    ["session authentication", apiProxy, "/v1/auth/socket", "POST"],
    ["socket upgrade", socketProxy, "/socket.io/?EIO=4&transport=websocket", "GET"],
  ] as const)(
    "rejects cross-origin %s before forwarding cookies",
    async (_, handler, path, method) => {
      const response = await handler({
        env,
        request: new Request(site + path, {
          method,
          headers: {
            Origin: "https://attacker.example",
            Cookie: "session=victim",
            "Content-Type": "application/x-www-form-urlencoded",
            ...(method === "GET" ? { Upgrade: "websocket" } : {}),
          },
        }),
      });

      expect(response.status).toBe(403);
      expect(upstreamFetch).not.toHaveBeenCalled();
    },
  );

  it.each([
    "",
    "null",
    "not-an-origin",
    "http://openquester.pages.dev",
    "https://openquester.pages.dev:444",
    "https://openquester.pages.dev.attacker.example",
    `${site}, https://attacker.example`,
    `${site} https://attacker.example`,
    "https://user@openquester.pages.dev",
    `${site}/path`,
    `${site}?query`,
    `${site}#fragment`,
    `${site}\\path`,
    "https://%6fpenquester.pages.dev",
  ])("rejects untrusted or malformed Origin %j", async (origin) => {
    const response = await proxy({
      env,
      request: new Request(`${site}/v1/auth/socket`, {
        method: "POST",
        headers: { Origin: origin },
      }),
    });

    expect(response.status).toBe(403);
    expect(upstreamFetch).not.toHaveBeenCalled();
  });

  it("does not trust a forged host when deciding whether an origin is allowed", async () => {
    const response = await proxy({
      env,
      request: new Request(`${site}/v1/auth/socket`, {
        method: "POST",
        headers: {
          Origin: "https://attacker.example",
          Host: "attacker.example",
          "X-Forwarded-Host": "attacker.example",
        },
      }),
    });

    expect(response.status).toBe(403);
    expect(upstreamFetch).not.toHaveBeenCalled();
  });

  it.each([site, "https://branch-123.openquester.pages.dev"])(
    "forwards same-origin sessions on %s",
    async (origin) => {
      const response = await proxy({
        env,
        request: new Request(`${origin}/v1/auth/socket?source=web`, {
          method: "POST",
          headers: { Origin: origin, Cookie: "session=legitimate" },
        }),
      });

      expect(response.status).toBe(200);
      const forwarded = upstreamFetch.mock.calls[0]?.[0] as Request;
      expect(forwarded.url).toBe(`${env.API_ORIGIN}/v1/auth/socket?source=web`);
      expect(forwarded.method).toBe("POST");
      expect(forwarded.headers.get("Origin")).toBeNull();
      expect(forwarded.headers.get("Cookie")).toBe("session=legitimate");
      expect(forwarded.headers.get("X-Forwarded-Host")).toBe(new URL(origin).host);
      expect(forwarded.headers.get("X-Forwarded-Proto")).toBe("https");
      expect(forwarded.redirect).toBe("manual");
    },
  );

  it("preserves requests without an Origin and scopes response cookies to the Pages host", async () => {
    upstreamFetch.mockResolvedValueOnce(
      new Response("denied", {
        status: 401,
        headers: {
          "Set-Cookie":
            "session=renewed; Domain=api.openquester.app; Secure; HttpOnly; SameSite=None",
        },
      }),
    );
    const response = await proxy({
      env,
      request: new Request(`${site}/v1/me`, { headers: { Cookie: "session=legitimate" } }),
    });

    expect(response.status).toBe(401);
    expect(await response.text()).toBe("denied");
    expect(response.headers.getSetCookie()).toEqual([
      "session=renewed; Secure; HttpOnly; SameSite=None",
    ]);
    expect(upstreamFetch).toHaveBeenCalledOnce();
  });

  it("passes a same-origin WebSocket upgrade response through unchanged", async () => {
    // Cloudflare supports status 101; Node's Response constructor does not.
    const upgrade = { status: 101, webSocket: {} } as unknown as Response;
    upstreamFetch.mockResolvedValueOnce(upgrade);
    const response = await socketProxy({
      env,
      request: new Request(`${site}/socket.io/?EIO=4&transport=websocket`, {
        headers: { Origin: site, Upgrade: "websocket" },
      }),
    });

    expect(response).toBe(upgrade);
    expect(upstreamFetch).toHaveBeenCalledOnce();
  });
});
