import { afterEach, describe, expect, it } from "vitest";

import {
  detectDiscordActivity,
  isDiscordActivity,
  resetDiscordActivityForTests,
  routeDiscordLaunch,
} from "./launch";

const site = { hostname: "openquester.app", search: "" };

describe("detectDiscordActivity", () => {
  it.each([
    [
      "Discord's launch query",
      { ...site, search: "?frame_id=f1&instance_id=i-1&platform=desktop" },
    ],
    ["the discordsays.com host", { hostname: "123.discordsays.com", search: "" }],
  ])("recognises %s", (_, location) => {
    expect(detectDiscordActivity(location)).toBe(true);
  });

  it.each([
    ["the website", site],
    ["half a launch query", { ...site, search: "?frame_id=f1" }],
    ["a look-alike host", { hostname: "discordsays.com.example", search: "" }],
  ])("ignores %s", (_, location) => {
    expect(detectDiscordActivity(location)).toBe(false);
  });
});

describe("routeDiscordLaunch", () => {
  afterEach(() => {
    window.history.replaceState(null, "", "/");
    resetDiscordActivityForTests();
  });

  it("opens the Activity screen and keeps the query the SDK reads", () => {
    window.history.replaceState(null, "", "/?frame_id=f1&instance_id=i-1");

    routeDiscordLaunch();

    expect(isDiscordActivity()).toBe(true);
    expect(window.location.pathname).toBe("/discord");
    expect(window.location.search).toBe("?frame_id=f1&instance_id=i-1");
  });

  it("leaves the website alone", () => {
    window.history.replaceState(null, "", "/packages?q=x");

    routeDiscordLaunch();

    expect(isDiscordActivity()).toBe(false);
    expect(window.location.pathname).toBe("/packages");
  });
});
