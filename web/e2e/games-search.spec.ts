import { expect, test, type Page, type Response } from "@playwright/test";

import { expectNoHorizontalScroll, hostGame, packageId, signInAsGuest } from "./support/game";

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

function isSearchResponse(response: Response, prefix: string): boolean {
  const url = new URL(response.url());
  return url.pathname === "/v1/games" && url.searchParams.get("titlePrefix") === prefix;
}

test("search finds a case-insensitive Ukrainian prefix beyond the first 50 games", async ({
  page,
}) => {
  test.skip(test.info().project.name !== "desktop", "pagination is independent of the viewport");
  const created: string[] = [];
  const stamp = Date.now();
  // The Cyrillic continuation and colon exercise the real Redis title index.
  const title = `Пошук ${stamp}Київ: вечір`;
  const prefix = `пОшУк ${stamp}`;

  await signInAsGuest(page, "Search host");
  try {
    const id = await createGame(page, title, created);
    // Exactly 50 newer fixtures put the target beyond Home's unfiltered page.
    for (let i = 0; i < 50; i++) {
      await createGame(page, `Newer ${stamp} ${i}`, created);
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

    await page.reload();
    const openGames = page.getByRole("region", { name: "Open games" });
    await expect(openGames.getByTestId("game-card")).toHaveCount(50);
    const searched = page.waitForResponse((response) =>
      isSearchResponse(response, prefix.toLowerCase()),
    );
    await openGames.getByRole("searchbox", { name: "Search games" }).fill(`  ${prefix}  `);
    const response = await searched;
    expect(response.ok()).toBeTruthy();
    const filtered = (await response.json()) as { data: { id: string }[] };
    expect(filtered.data.map((game) => game.id)).toEqual([id]);
    await expect(openGames.getByTestId("game-card")).toHaveCount(1);
    await expect(openGames.getByRole("heading", { name: title, exact: true })).toBeVisible();
    await expectNoHorizontalScroll(page);
  } finally {
    await deleteGames(page, created);
  }
});

test("search combines with status filters, clears and preserves the retained seat", async ({
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
    await expectNoHorizontalScroll(page);
    const searched = page.waitForResponse((response) =>
      isSearchResponse(response, prefix.toLowerCase()),
    );
    await search.fill(prefix);
    expect((await searched).ok()).toBeTruthy();
    await expect(openGames.getByTestId("game-card")).toHaveCount(1);
    await expect(openGames.getByRole("heading", { name: title, exact: true })).toBeVisible();
    await expect(rejoin).toContainText(retainedTitle);
    await page.screenshot({ path: test.info().outputPath("games-search.png"), fullPage: true });

    const filters = openGames.getByRole("group", { name: "Filter games" });
    await filters.getByRole("button", { name: "In lobby", exact: true }).click();
    await expect(openGames.getByTestId("game-card")).toHaveCount(1);
    await filters.getByRole("button", { name: "In progress", exact: true }).click();
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

    await openGames.getByRole("button", { name: "Clear search" }).click();
    await expect(search).toHaveValue("");
    await expect(search).toBeFocused();
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
