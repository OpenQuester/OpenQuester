import { expect, test, type Page } from "@playwright/test";
import type * as Fixture from "./round-transition.fixture";

async function mount(page: Page, order = 0, reducedMotion = false) {
  await page.evaluate(
    async ({ order, reducedMotion }) => {
      const path = "/browser-tests/round-transition.fixture.tsx";
      const fixture = (await import(path)) as typeof Fixture;
      fixture.mountGame(order, reducedMotion);
    },
    { order, reducedMotion },
  );
  await expect(page.getByTestId("round-name")).toBeVisible();
}

async function advance(page: Page) {
  await page.evaluate(async () => {
    const path = "/browser-tests/round-transition.fixture.tsx";
    const fixture = (await import(path)) as typeof Fixture;
    fixture.nextRound("Music, films and a very long round title ".repeat(4));
  });
  await expect(page.getByTestId("round-transition")).toHaveAttribute("open", "");
}

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 375, height: 812 },
]) {
  test(`round interlude blocks input and survives live updates at ${viewport.width}px`, async ({
    page,
    context,
  }, testInfo) => {
    await page.setViewportSize(viewport);
    await context.route("**/v1/**", (route) => route.fulfill({ status: 401, body: "{}" }));
    await page.goto("/");
    await mount(page);
    await page.clock.install();
    await page.clock.pauseAt(new Date());
    const overlay = page.getByTestId("round-transition");
    await expect(overlay).toHaveCount(0);
    await advance(page);
    // Inspect the very start: the new board must already be blurred and dimmed.
    await page.evaluate(() => {
      for (const animation of document.getAnimations()) {
        if (
          animation instanceof CSSAnimation &&
          animation.animationName.startsWith("oq-round-transition")
        ) {
          animation.pause();
          animation.currentTime = 0;
        }
      }
    });
    expect(
      await overlay.evaluate((el) => {
        const backdrop = getComputedStyle(el, "::backdrop");
        return { opacity: backdrop.opacity, blur: backdrop.backdropFilter };
      }),
    ).toEqual({ opacity: "1", blur: "blur(12px)" });
    // Freeze only the visual animation for deterministic screenshots and hit testing.
    await page.evaluate(() => {
      for (const animation of document.getAnimations()) {
        if (
          animation instanceof CSSAnimation &&
          animation.animationName.startsWith("oq-round-transition")
        ) {
          animation.currentTime = 1000;
        }
      }
    });
    await expect(overlay).toBeVisible();
    expect(await overlay.evaluate((el) => el.matches(":modal"))).toBe(true);
    expect(await overlay.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    await expect(overlay.locator("p")).toBeInViewport();
    await page.screenshot({ path: testInfo.outputPath("round-transition.png") });

    await page.keyboard.press("Escape");
    await page.mouse.click(viewport.width - 10, 10);
    await expect(overlay).toBeVisible();
    await page.evaluate(async () => {
      const path = "/browser-tests/round-transition.fixture.tsx";
      ((await import(path)) as typeof Fixture).showQuestion();
    });
    await expect(page.locator("[data-phase=showing]")).toHaveCount(1);
    await page.keyboard.press("Space");
    await page.keyboard.press("Tab");
    const chatButton = page.getByTestId("open-chat");
    const buttonBox = (await chatButton.boundingBox())!;
    await page.mouse.click(buttonBox.x + buttonBox.width / 2, buttonBox.y + buttonBox.height / 2);
    expect(
      await page.evaluate(async () => {
        const path = "/browser-tests/round-transition.fixture.tsx";
        return ((await import(path)) as typeof Fixture).sent;
      }),
    ).toEqual([]);
    expect(
      await page.evaluate(
        () =>
          document.activeElement?.closest("dialog") != null ||
          document.activeElement === document.body,
      ),
    ).toBe(true);

    await page.clock.runFor(3499);
    await expect(overlay).toBeVisible();
    await page.clock.runFor(1);
    await expect(overlay).toHaveCount(0);
    await page.keyboard.press("Space");
    expect(
      await page.evaluate(async () => {
        const path = "/browser-tests/round-transition.fixture.tsx";
        return ((await import(path)) as typeof Fixture).sent;
      }),
    ).toEqual(["question-answer"]);
    await chatButton.click();
    await expect(chatButton).toHaveAttribute(
      "aria-expanded",
      viewport.width >= 1024 ? "false" : "true",
    );

    await advance(page);
    await page.reload();
    await mount(page, 2);
    await expect(overlay).toHaveCount(0);
  });
}

for (const mode of ["system", "setting"] as const) {
  test(`reduced motion from ${mode} keeps the static interlude for 3.5 seconds`, async ({
    page,
    context,
  }) => {
    await context.route("**/v1/**", (route) => route.fulfill({ status: 401, body: "{}" }));
    if (mode === "system") await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await mount(page, 0, mode === "setting");
    await page.clock.install();
    await page.clock.pauseAt(new Date());
    await advance(page);
    const overlay = page.getByTestId("round-transition");
    for (const pseudo of [null, "::backdrop"]) {
      const style = await overlay.evaluate((el, pseudo) => {
        const css = getComputedStyle(el, pseudo);
        return { animation: css.animationName, opacity: css.opacity };
      }, pseudo);
      expect(style).toEqual({ animation: "none", opacity: "1" });
    }
    await page.clock.runFor(3499);
    await expect(overlay).toBeVisible();
    await page.clock.runFor(1);
    await expect(overlay).toHaveCount(0);
  });
}

test("interlude stays accessible above an already open mobile chat sheet", async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await context.route("**/v1/**", (route) => route.fulfill({ status: 401, body: "{}" }));
  await page.goto("/");
  await mount(page);
  await page.getByTestId("open-chat").click();
  await expect(page.getByRole("dialog", { name: "Chat" })).toBeVisible();
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await advance(page);
  const overlay = page.getByRole("dialog", { name: "Next round" });
  await expect(overlay).toBeVisible();
  expect(await overlay.evaluate((el) => el.closest('[aria-hidden="true"]') == null)).toBe(true);
  await page.keyboard.press("Tab");
  await page.keyboard.press("Escape");
  await page.mouse.click(10, 10);
  await expect(overlay).toBeVisible();
  await page.clock.runFor(3500);
  await expect(page.getByTestId("round-transition")).toHaveCount(0);
  await page
    .getByRole("dialog", { name: "Chat" })
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
