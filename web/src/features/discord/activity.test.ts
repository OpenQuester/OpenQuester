import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthSettings } from "@/api/types";
import { mapUrl, setUrlMappings } from "@/lib/urlMappings";

vi.mock("@/api/config", () => ({ API_URL: "http://api.test" }));

const sdk = vi.hoisted(() => ({
  constructed: vi.fn(),
  ready: vi.fn(),
  authorize: vi.fn(),
  authenticate: vi.fn(),
  patchUrlMappings: vi.fn(),
}));

vi.mock("@discord/embedded-app-sdk", () => ({
  DiscordSDK: class {
    readonly instanceId = "i-123-gc-456";
    readonly commands = { authorize: sdk.authorize, authenticate: sdk.authenticate };
    constructor(clientId: string, options: unknown) {
      sdk.constructed(clientId, options);
    }
    ready() {
      return sdk.ready();
    }
  },
  patchUrlMappings: sdk.patchUrlMappings,
}));

const fetchMock = vi.hoisted(() => vi.fn<typeof fetch>());

import {
  ActivityError,
  activityUrlMappings,
  resetActivityForTests,
  startActivity,
  STEP_TIMEOUT_MS,
} from "./activity";

const user = { id: 5, username: "pilot" };
const settings: AuthSettings = {
  oauthProviders: [{ provider: "discord", clientId: "123" }],
  discordActivity: { urlMappings: [{ prefix: "/media", target: "s3.example.com" }] },
};

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  sdk.ready.mockResolvedValue(undefined);
  sdk.authorize.mockResolvedValue({ code: "the-code" });
  sdk.authenticate.mockResolvedValue({});
  fetchMock.mockResolvedValue(
    new Response(JSON.stringify({ user, accessToken: "discord-token" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  resetActivityForTests();
  setUrlMappings([]);
});

describe("startActivity", () => {
  it("swaps the SDK's code on the server and authenticates with the token it returns", async () => {
    const session = await startActivity(settings);

    expect(session).toEqual({ instanceId: "i-123-gc-456", user });
    expect(sdk.constructed).toHaveBeenCalledWith("123", undefined);
    expect(sdk.authorize).toHaveBeenCalledWith(
      expect.objectContaining({ client_id: "123", response_type: "code", scope: ["identify"] }),
    );
    const request = fetchMock.mock.calls[0]?.[0] as Request;
    expect(request.url).toBe("http://api.test/v1/auth/discord/activity");
    expect(await request.json()).toEqual({ code: "the-code" });
    expect(sdk.authenticate).toHaveBeenCalledWith({ access_token: "discord-token" });
  });

  it("routes media and the API host through Discord's proxy", async () => {
    await startActivity(settings);

    const mappings = [
      { prefix: "/media", target: "s3.example.com" },
      { prefix: "/api", target: "api.test" },
    ];
    expect(sdk.patchUrlMappings).toHaveBeenCalledWith(mappings, { patchSrcAttributes: true });
    expect(mapUrl("https://s3.example.com/f/a/ab/abc")).toBe(
      `${window.location.origin}/media/f/a/ab/abc`,
    );
  });

  it("signs in once per page", async () => {
    await Promise.all([startActivity(settings), startActivity(settings)]);

    expect(sdk.authorize).toHaveBeenCalledOnce();
  });

  it("names the step that failed and can be retried", async () => {
    sdk.authorize.mockRejectedValueOnce(new Error("closed"));

    const error = await startActivity(settings).catch((e: unknown) => e);
    expect(error).toMatchObject({ code: "auth_failed", step: "authorize", detail: "closed" });
    await expect(startActivity(settings)).resolves.toMatchObject({ user });
  });

  it("reports each step and gives up on a handshake that never comes", async () => {
    vi.useFakeTimers();
    sdk.ready.mockReturnValueOnce(new Promise(() => {}));
    const steps: string[] = [];

    const result = startActivity(settings, (s) => steps.push(s)).catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(STEP_TIMEOUT_MS.handshake);

    expect(await result).toMatchObject({ code: "timeout", step: "handshake" });
    expect(steps).toEqual(["handshake"]);
    vi.useRealTimers();
  });

  it("walks through every step on success", async () => {
    const steps: string[] = [];

    await startActivity(settings, (s) => steps.push(s));

    expect(steps).toEqual(["handshake", "authorize", "sign_in", "authenticate"]);
  });

  it("refuses to start when the server has no Activity set up", async () => {
    await expect(startActivity({ ...settings, discordActivity: null })).rejects.toEqual(
      new ActivityError("not_configured"),
    );
    expect(sdk.constructed).not.toHaveBeenCalled();
  });
});

describe("activityUrlMappings", () => {
  it("adds no API mapping when the app and the API share an origin", () => {
    expect(activityUrlMappings(settings, "")).toEqual([
      { prefix: "/media", target: "s3.example.com" },
    ]);
  });

  it("maps an API on another host, path included", () => {
    expect(
      activityUrlMappings(
        { ...settings, discordActivity: { urlMappings: [] } },
        "https://example.com/oq/",
      ),
    ).toEqual([{ prefix: "/api", target: "example.com/oq" }]);
  });
});
