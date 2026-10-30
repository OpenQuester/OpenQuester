import { expect, test, type Page } from "@playwright/test";
import type * as Fixture from "./lobby-question.fixture";

async function mount(page: Page, mode: "choice" | "board" | "finished", myId = 2) {
  await page.route("**/v1/**", (route) => route.fulfill({ status: 401, body: "{}" }));
  await page.goto("/");
  await page.evaluate(
    async ({ mode, myId }) => {
      const path = "/browser-tests/lobby-question.fixture.tsx";
      ((await import(path)) as typeof Fixture).mountLayoutLimits(mode, myId);
      await document.fonts.ready;
    },
    { mode, myId },
  );
  await expect(page.locator(".player-cards > li")).toHaveCount(16);
}

async function noFieldOverflow(page: Page) {
  expect(
    await page
      .locator("main")
      .last()
      .evaluate((el) => ({
        x: el.scrollWidth - el.clientWidth,
        y: el.scrollHeight - el.clientHeight,
      })),
  ).toEqual({ x: 0, y: 0 });
}

for (const viewport of [
  { width: 1920, height: 914 },
  { width: 1280, height: 600 },
  { width: 375, height: 812 },
]) {
  test(`eight options remain visible and inspecting one never submits at ${viewport.width}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await mount(page, "choice");
    const optionsTab = page.getByRole("tab", { name: "Answer options · 8" });
    if (await optionsTab.isVisible()) await optionsTab.click();
    await expect(page.locator("[data-option]")).toHaveCount(8);
    expect(
      await page.locator("[data-option]").evaluateAll((elements) =>
        elements.every((el) => {
          const r = el.getBoundingClientRect(),
            list = el.closest("ol")!.getBoundingClientRect();
          return r.top >= list.top - 1 && r.bottom <= list.bottom + 1 && r.height >= 44;
        }),
      ),
    ).toBe(true);
    await noFieldOverflow(page);
    await page.locator('[data-option="8"]').hover();
    await expect(page.locator(".choice-full-text:popover-open")).toContainText(
      "Complete answer details.",
    );
    await page.keyboard.press("Escape");
    await page.mouse.move(0, 0);
    await page.getByRole("button", { name: "Open option 7", exact: true }).click();
    await expect(page.getByRole("dialog").locator("img")).toBeVisible();
    await page.keyboard.press("8");
    expect(
      await page.evaluate(async () => {
        const path = "/browser-tests/lobby-question.fixture.tsx";
        return ((await import(path)) as typeof Fixture).sent;
      }),
    ).toEqual([]);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Open option 7", exact: true })).toBeFocused();
    await page.keyboard.press("8");
    expect(
      await page.evaluate(async () => {
        const path = "/browser-tests/lobby-question.fixture.tsx";
        return ((await import(path)) as typeof Fixture).sent.filter(
          (s) => s.action === "answer-submitted",
        );
      }),
    ).toEqual([
      { action: "answer-submitted", args: [expect.objectContaining({ choiceOrder: 7 })] },
    ]);
  });

  test(`fifteen mixed prices and all standings fit at ${viewport.width}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await mount(page, "board");
    await expect(page.getByTestId("board-cell")).toHaveCount(225);
    expect(
      await page.locator(".board-price").evaluateAll((prices) =>
        prices.every((el) => {
          const r = el.getBoundingClientRect(),
            p = el.closest("button")!.getBoundingClientRect();
          return r.left >= p.left - 1 && r.right <= p.right + 1;
        }),
      ),
    ).toBe(true);
    const fonts = await page
      .locator(".board-price")
      .evaluateAll((prices) =>
        prices.slice(0, 7).map((el) => parseFloat(getComputedStyle(el).fontSize)),
      );
    expect(fonts[6]).toBeLessThan(fonts[0]!);
    expect(fonts[6]).toBeGreaterThanOrEqual(12);
    await expect(page.getByRole("button", { name: "Next", exact: true })).toHaveCount(0);
    const title = page.getByRole("rowheader").getByRole("button").first();
    expect(await title.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
    await title.focus();
    await expect(page.locator("[popover]:popover-open")).toHaveText(
      (await title.textContent()) ?? "",
    );
    await page.keyboard.press("Escape");
    await expect(page.locator("[popover]:popover-open")).toHaveCount(0);
    await page.locator(".board-scroll").evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    await expect(page.getByRole("rowheader").last()).toBeInViewport();
    await noFieldOverflow(page);
    await page.evaluate(async () => {
      const path = "/browser-tests/lobby-question.fixture.tsx";
      const { useGameStore } = (await import(path)) as typeof Fixture;
      useGameStore.setState((st) => ({ session: { ...st.session!, finished: true } }));
    });
    await expect(page.getByTestId("podium")).toBeVisible();
    expect(
      await page
        .getByTestId("podium")
        .locator("b")
        .evaluateAll((scores) =>
          scores.every((el) => {
            const r = el.getBoundingClientRect(),
              p = el.closest("li")!.getBoundingClientRect();
            return r.left >= p.left - 1 && r.right <= p.right + 1;
          }),
        ),
    ).toBe(true);
    await noFieldOverflow(page);
  });
}

test("spectator panel follows joins/leaves and host management remains accessible", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await mount(page, "board", 1);
  await expect(page.getByTestId("open-spectators")).toHaveCount(0);
  const watchers = (count: number) =>
    page.evaluate(async (count) => {
      const path = "/browser-tests/lobby-question.fixture.tsx";
      ((await import(path)) as typeof Fixture).setSpectatorCount(count);
    }, count);
  await watchers(3);
  await expect(page.getByTestId("open-spectators")).toHaveAccessibleName("Spectators · 3");
  await page.getByTestId("open-spectators").click();
  await expect(page.getByTestId("spectators-panel")).toBeVisible();
  await expect(
    page.getByTestId("spectators-panel").getByRole("button", { name: "Seat as player" }),
  ).toHaveCount(3);
  await watchers(0);
  await expect(page.getByTestId("open-spectators")).toHaveCount(0);
  await expect(page.getByTestId("side-panels")).toHaveCount(0);
  await page.locator(".player-card").nth(1).hover();
  await page.getByRole("button", { name: /^Manage / }).click();
  await expect(page.getByTestId("player-admin")).toBeVisible();
});

for (const input of ["mouse", "touch"] as const) {
  test.describe(`ordinary choice previews with ${input}`, () => {
    test.use({
      hasTouch: input === "touch",
      viewport: input === "touch" ? { width: 375, height: 812 } : { width: 1440, height: 900 },
    });

    for (const content of ["text", "images", "mixed"] as const) {
      test(`${content}: opening and inspecting a preview does not select an answer`, async ({
        page,
      }) => {
        await mount(page, "choice");
        await page.evaluate(async (content) => {
          const path = "/browser-tests/lobby-question.fixture.tsx";
          const { useGameStore } = (await import(path)) as typeof Fixture;
          const game = useGameStore.getState().session!;
          const q = game.state.currentQuestion!;
          const picture = q.answers![0]!.file!;
          useGameStore.setState({
            session: {
              ...game,
              players: game.players.slice(0, 5),
              state: {
                ...game.state,
                currentQuestion: {
                  ...q,
                  text: "Choose the matching picture.",
                  questionFiles: [],
                  answers: ["Japan", "France", "Italy", "Ukraine"].map((name, order) => ({
                    order,
                    text: content === "images" ? null : name,
                    file: content === "text" ? null : picture,
                  })),
                },
              },
            },
          });
        }, content);
        const optionsTab = page.getByRole("tab", { name: "Answer options · 4" });
        if (await optionsTab.isVisible()) await optionsTab.click();
        if (content === "text") {
          expect(
            (await page.locator('[data-option="1"]').boundingBox())!.height,
          ).toBeLessThanOrEqual(100);
        } else {
          const picture = (await page.locator(".choice-image").first().boundingBox())!;
          expect(picture.width).toBeGreaterThan(content === "mixed" && input === "touch" ? 40 : 80);
          expect(picture.height).toBeGreaterThan(80);
        }
        const sent = () =>
          page.evaluate(async () => {
            const path = "/browser-tests/lobby-question.fixture.tsx";
            return ((await import(path)) as typeof Fixture).sent;
          });
        if (content !== "text") {
          const preview = page.getByRole("button", { name: "Open option 1", exact: true });
          if (input === "touch") await preview.tap();
          else await preview.click();
          const dialog = page.getByRole("dialog");
          await expect(dialog.locator("img")).toBeVisible();
          await page.keyboard.press("1");
          expect(await sent()).toEqual([]);
          await dialog.getByRole("button", { name: "Close", exact: true }).click();
          await expect(dialog).toHaveCount(0);
        } else {
          await expect(page.locator(".choice-image-button")).toHaveCount(0);
        }
        expect(await sent()).toEqual([]);
        const answer = page.locator('[data-option="2"]');
        if (input === "touch") await answer.tap({ position: { x: 14, y: 14 } });
        else await answer.click({ position: { x: 14, y: 14 } });
        expect(await sent()).toEqual([
          { action: "answer-submitted", args: [expect.objectContaining({ choiceOrder: 1 })] },
        ]);
      });
    }
  });
}

for (const viewport of [
  { width: 844, height: 390 },
  { width: 375, height: 812 },
]) {
  test(`showman can inspect the last option in a small stage at ${viewport.width}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await mount(page, "choice", 1);
    const tab = page.getByRole("tab", { name: "Answer options · 8" });
    if (await tab.isVisible()) await tab.click();
    const last = page.getByRole("button", { name: "Open option 7", exact: true });
    await last.scrollIntoViewIfNeeded();
    await expect(last).toBeInViewport();
    await last.click();
    await expect(page.getByRole("dialog").locator("img")).toBeVisible();
    await page.keyboard.press("Escape");
    await noFieldOverflow(page);
    await expect(page.getByTestId("showman-panel")).toBeVisible();
    expect(
      await page.evaluate(async () => {
        const path = "/browser-tests/lobby-question.fixture.tsx";
        return ((await import(path)) as typeof Fixture).sent;
      }),
    ).toEqual([]);
  });
}
