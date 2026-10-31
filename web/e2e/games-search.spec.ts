import { expect, test, type Page, type Response } from "@playwright/test";

import {
  expectNoHorizontalScroll,
  hostGame,
  joinByLink,
  packageId,
  person,
  signInAsGuest,
} from "./support/game";

async function createGame(page: Page, title: string, created: string[]): Promise<string> {
  const response = await page.request.post("/v1/games", {
    data: {
      title,
      packageId: packageId(),
      isPrivate: false,
      ageRestriction: "NONE",
      maxPlayers: 6,
    },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  const game = (await response.json()) as { id: string };
  created.push(game.id);
  return game.id;
}

async function deleteGames(page: Page, ids: string[]): Promise<void> {
  for (const id of ids) {
    const response = await page.request.delete(`/v1/games/${id}`);
    // A lobby can also disappear when its last connected participant leaves.
    expect.soft([204, 404], `delete fixture ${id}`).toContain(response.status());
  }
}

function isSearchResponse(
  response: Response,
  prefix: string,
  status?: "lobby" | "playing",
): boolean {
  const url = new URL(response.url());
  const matchesPrefix = (url.searchParams.get("titlePrefix") ?? "") === prefix;
  const matchesStatus = url.searchParams.get("status") === (status ?? null);
  return url.pathname === "/v1/games" && matchesPrefix && matchesStatus;
}

test("search and selected status find a Ukrainian title beyond the first 50 games", async ({
  page,
  browser,
}) => {
  test.skip(test.info().project.name !== "desktop", "pagination is independent of the viewport");
  const created: string[] = [];
  const stamp = Date.now();
  // The Cyrillic continuation and colon exercise the real Redis title index.
  const title = `Пошук ${stamp}Київ: вечір`;
  const prefix = `пОшУк ${stamp}Київ`;
  const sharedPrefix = `пОшУк ${stamp}`;

  await signInAsGuest(page, "Search host");
  const player = await person(browser, "Search player", { viewport: { width: 1440, height: 900 } });
  try {
    const id = await hostGame(page, title);
    created.push(id);
    await joinByLink(player.page, id, "Search player", "player");
    await player.page.getByRole("button", { name: "I'm ready" }).click();
    await expect(page.getByTestId("dock-phase")).toHaveText("Choosing");
    // Newer matching lobbies hide the playing target in both unfiltered and title-only pages.
    for (let i = 0; i < 50; i++) {
      await createGame(page, `Пошук ${stamp} newer ${i}`, created);
    }
    const firstPage = await page.request.get("/v1/games", {
      params: { limit: 50, offset: 0, sortBy: "createdAt", order: "desc" },
    });
    expect(firstPage.ok()).toBeTruthy();
    const unfiltered = (await firstPage.json()) as { data: { id: string }[] };
    expect(unfiltered.data).toHaveLength(50);
    expect(unfiltered.data.map((game) => game.id)).not.toContain(id);
    const mixedCase = await page.request.get("/v1/games", {
      params: { limit: 50, offset: 0, titlePrefix: prefix },
    });
    expect(mixedCase.ok()).toBeTruthy();
    const matching = (await mixedCase.json()) as { data: { id: string }[] };
    expect(matching.data.map((game) => game.id)).toEqual([id]);

    const listPage = await page.context().newPage();
    await listPage.goto("/");
    const openGames = listPage.getByRole("region", { name: "Open games" });
    await expect(openGames.getByTestId("game-card")).toHaveCount(50);
    const searched = listPage.waitForResponse((response) =>
      isSearchResponse(response, prefix.toLowerCase()),
    );
    const search = openGames.getByRole("searchbox", { name: "Search games" });
    await search.fill(`  ${prefix}  `);
    const response = await searched;
    expect(response.ok()).toBeTruthy();
    const filtered = (await response.json()) as { data: { id: string }[] };
    expect(filtered.data.map((game) => game.id)).toEqual([id]);
    await expect(openGames.getByTestId("game-card")).toHaveCount(1);
    await expect(openGames.getByRole("heading", { name: title, exact: true })).toBeVisible();
    const shared = listPage.waitForResponse((response) =>
      isSearchResponse(response, sharedPrefix.toLowerCase()),
    );
    await search.fill(sharedPrefix);
    await search.press("Enter");
    expect((await shared).ok()).toBeTruthy();
    await expect(openGames.getByTestId("game-card")).toHaveCount(50);
    await expect(openGames.getByRole("heading", { name: title, exact: true })).toHaveCount(0);

    const playing = listPage.waitForResponse((response) =>
      isSearchResponse(response, sharedPrefix.toLowerCase(), "playing"),
    );
    const filters = openGames.getByRole("group", { name: "Filter games" });
    await filters.getByRole("button", { name: "In progress", exact: true }).click();
    const playingResponse = await playing;
    expect(playingResponse.ok()).toBeTruthy();
    expect((await playingResponse.json()).data.map((game: { id: string }) => game.id)).toEqual([
      id,
    ]);
    await expect(openGames.getByTestId("game-card")).toHaveCount(1);
    await expect(openGames.getByRole("heading", { name: title, exact: true })).toBeVisible();
    await expect(search).toHaveValue(sharedPrefix);
    await expectNoHorizontalScroll(listPage);
  } finally {
    try {
      await deleteGames(page, created);
    } finally {
      await player.context.close();
    }
  }
});

test("Enter search respects status filters and preserves the retained seat", async ({
  page: host,
}) => {
  const errors: string[] = [];
  host.on("pageerror", (error) => errors.push(error.message));
  const created: string[] = [];
  const stamp = Date.now();
  const retainedTitle = `Retained seat ${stamp}`;
  const title = `Searchable ${stamp} evening`;
  const prefix = `sEaRcHaBlE ${stamp}`;

  await signInAsGuest(host, "Search guest");
  try {
    const retainedId = await hostGame(host, retainedTitle);
    created.push(retainedId);
    await createGame(host, title, created);
    // Keep the host connected: empty unstarted lobbies are deleted on disconnect.
    const page = await host.context().newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/");
    const rejoin = page.getByRole("region", { name: "Game in progress" });
    await expect(rejoin).toContainText(retainedTitle);
    await expect(rejoin.getByRole("link", { name: "Rejoin" })).toHaveAttribute(
      "href",
      `/games/${retainedId}`,
    );

    const openGames = page.getByRole("region", { name: "Open games" });
    const search = openGames.getByRole("searchbox", { name: "Search games" });
    await expect(search).toBeVisible();
    await expect(search).toHaveAttribute("placeholder", "Search games");
    const clear = openGames.getByRole("button", { name: "Clear search" });
    await expect(clear).toHaveCount(0);
    await expectNoHorizontalScroll(page);
    const searched = page.waitForResponse((response) =>
      isSearchResponse(response, prefix.toLowerCase()),
    );
    await search.fill(prefix);
    await expect(clear).toBeVisible();
    await expect(clear).toHaveText("");
    await search.press("Enter");
    expect((await searched).ok()).toBeTruthy();
    await expect(openGames.getByTestId("game-card")).toHaveCount(1);
    await expect(openGames.getByRole("heading", { name: title, exact: true })).toBeVisible();
    await expect(rejoin).toContainText(retainedTitle);
    await page.screenshot({ path: test.info().outputPath("games-search.png"), fullPage: true });

    const filters = openGames.getByRole("group", { name: "Filter games" });
    const lobbyResponse = page.waitForResponse((response) =>
      isSearchResponse(response, prefix.toLowerCase(), "lobby"),
    );
    await filters.getByRole("button", { name: "In lobby", exact: true }).click();
    expect((await lobbyResponse).ok()).toBeTruthy();
    await expect(openGames.getByTestId("game-card")).toHaveCount(1);
    const playingResponse = page.waitForResponse((response) =>
      isSearchResponse(response, prefix.toLowerCase(), "playing"),
    );
    await filters.getByRole("button", { name: "In progress", exact: true }).click();
    expect((await playingResponse).ok()).toBeTruthy();
    await expect(openGames.getByTestId("game-card")).toHaveCount(0);
    await expect(openGames.getByText("No games match your search and filters.")).toBeVisible();
    await expect(search).toHaveValue(prefix);
    await expect(rejoin.getByRole("link", { name: "Rejoin" })).toBeVisible();

    await filters.getByRole("button", { name: "All", exact: true }).click();
    const missingPrefix = `Missing ${stamp}`;
    const missing = page.waitForResponse((response) =>
      isSearchResponse(response, missingPrefix.toLowerCase()),
    );
    await search.fill(missingPrefix);
    const missingResponse = await missing;
    expect(missingResponse.ok()).toBeTruthy();
    expect((await missingResponse.json()).data).toEqual([]);
    await expect(openGames.getByTestId("game-card")).toHaveCount(0);
    await expect(openGames.getByText("No games match your search and filters.")).toBeVisible();

    const selectedLobby = page.waitForResponse((response) =>
      isSearchResponse(response, missingPrefix.toLowerCase(), "lobby"),
    );
    await filters.getByRole("button", { name: "In lobby", exact: true }).click();
    expect((await selectedLobby).ok()).toBeTruthy();
    const cleared = page.waitForResponse((response) => isSearchResponse(response, "", "lobby"));
    await clear.click();
    expect((await cleared).ok()).toBeTruthy();
    await expect(search).toHaveValue("");
    await expect(search).toBeFocused();
    await expect(clear).toHaveCount(0);
    await expect(filters.getByRole("button", { name: "In lobby", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(openGames.getByRole("heading", { name: title, exact: true })).toBeVisible();
    await expect(
      openGames.getByRole("heading", { name: retainedTitle, exact: true }),
    ).toBeVisible();
    await expect(rejoin.getByRole("link", { name: "Rejoin" })).toBeVisible();
    await expectNoHorizontalScroll(page);
    expect(errors).toEqual([]);
  } finally {
    await deleteGames(host, created);
  }
});
