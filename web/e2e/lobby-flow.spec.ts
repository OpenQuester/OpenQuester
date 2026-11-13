import { expect, test } from "@playwright/test";

import {
  expectNoHorizontalScroll,
  hostGame,
  joinByLink,
  person,
  signInAsGuest,
} from "./support/game";

test("resizes the lobby and clears the kicked player's return banner", async ({ browser }) => {
  test.skip(test.info().project.name !== "desktop", "two-client flow");
  const device = { viewport: { width: 1440, height: 900 } };
  const host = await person(browser, "Host", device);
  const player = await person(browser, "Player", device);
  const title = `Lobby seats ${Date.now()}`;
  await signInAsGuest(host.page, host.name);
  const code = await hostGame(host.page, title, { maxPlayers: 2 });
  const emptySeats = host.page.getByRole("button", { name: /^Take seat / });
  await expect(emptySeats).toHaveCount(2);
  await expectNoHorizontalScroll(host.page);
  await host.page.getByRole("button", { name: "Add slot" }).click();
  await expect(emptySeats).toHaveCount(3);
  await joinByLink(player.page, code, player.name, "player");
  const last = player.page.getByRole("button", { name: "Take seat 3" });
  await last.click();
  await expect(player.page.getByRole("heading", { name: /seat 3/i })).toBeVisible();
  await host.page.getByRole("button", { name: "Remove slot" }).click();
  await expect(emptySeats).toHaveCount(1);
  await expect(last).toHaveCount(0);
  await expect(player.page.getByRole("heading", { name: /seat [12]/i })).toBeVisible();
  await host.page.getByRole("button", { name: `Remove ${player.name} from the game` }).click();
  await expect(player.page.getByTestId("home-notice")).toContainText(
    `You were kicked from “${title}”.`,
  );
  await expect(player.page.getByText(/You're still in/)).toHaveCount(0);
  await host.context.close();
  await player.context.close();
});

/**
 * Leaving, joining another game, changing role and deleting a lobby — the
 * paths playtesters tripped over.
 */
test("leave, join another game first time, spectate and see the lobby deleted", async ({
  browser,
}) => {
  test.skip(test.info().project.name !== "desktop", "flow test; layout is covered elsewhere");
  const hostA = await person(browser, "Hana", { viewport: { width: 1280, height: 800 } });
  const hostB = await person(browser, "Ivan", { viewport: { width: 1280, height: 800 } });
  const pat = await person(browser, "Pat", { viewport: { width: 1280, height: 800 } });

  await signInAsGuest(hostA.page, "Hana");
  const codeA = await hostGame(hostA.page, "Game A");
  await signInAsGuest(hostB.page, "Ivan");
  const codeB = await hostGame(hostB.page, "Game B");

  // Leave game A: home must not offer to rejoin it.
  await joinByLink(pat.page, codeA, "Pat", "player");
  await pat.page.getByRole("button", { name: "Leave lobby" }).click();
  await expect(pat.page).toHaveURL(/\/$/);
  await expect(pat.page.getByRole("heading", { name: "Join a game in seconds" })).toBeVisible();
  await expect(pat.page.getByText(/You're still in/)).toHaveCount(0);

  // Joining another game works on the first click.
  await pat.page.goto(`/games/${codeB}`);
  await pat.page.getByRole("button", { name: "Join as player" }).click();
  await expect(pat.page.getByTestId("my-role").or(pat.page.getByText("You are"))).toContainText(
    "Player",
  );
  await expect(pat.page).toHaveURL(new RegExp(`/games/${codeB}$`));

  // Players can switch themselves to spectators.
  await pat.page.getByRole("button", { name: "Become a spectator" }).click();
  await expect(pat.page.getByText("You are")).toContainText("Spectator");

  // The showman deletes the lobby; everyone is told and sent home.
  await hostB.page.getByTestId("delete-game").click();
  await hostB.page.getByTestId("delete-game-confirm").click();
  await expect(hostB.page).toHaveURL(/\/\?notice=deleted|\/$/);
  await expect(pat.page.getByText("The showman deleted the game.")).toBeVisible();

  for (const p of [hostA, hostB, pat]) {
    expect(p.errors).toEqual([]);
    await p.context.close();
  }
});
