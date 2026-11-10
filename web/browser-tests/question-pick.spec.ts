import { expect, test, type Page } from "@playwright/test";
import type * as Fixture from "./question-pick.fixture";

type Options = Parameters<typeof Fixture.mount>;
async function mount(page: Page, options: Options = []) {
  await page.route("**/v1/**", (route) => route.fulfill({ status: 401, body: "{}" }));
  await page.goto("/");
  await page.evaluate(async (options) => {
    const path = "/browser-tests/question-pick.fixture.tsx";
    ((await import(path)) as typeof Fixture).mount(...options);
  }, options);
}
async function pick(page: Page) {
  await page.evaluate(async () => {
    const path = "/browser-tests/question-pick.fixture.tsx";
    ((await import(path)) as typeof Fixture).pick();
  });
}

test("a real board click fades the whole overlay and replay gets a new natural fade", async ({
  page,
}) => {
  await mount(page);
  await page.evaluate(() => {
    const samples: { node: Element; values: number[] }[] = [];
    (window as unknown as { openingSamples: typeof samples }).openingSamples = samples;
    new MutationObserver(() => {
      const el = document.querySelector('[data-testid="question-pick-transition"]');
      if (!el || samples.some((s) => s.node === el)) return;
      const record = { node: el, values: [Number(getComputedStyle(el).opacity)] };
      samples.push(record);
      const started = performance.now();
      const sample = () => {
        record.values.push(Number(getComputedStyle(el).opacity));
        if (performance.now() - started < 260) requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    }).observe(document.body, { childList: true, subtree: true });
  });
  await page.getByTestId("board-cell").first().click();
  const opening = page.getByTestId("question-pick-transition");
  await expect(opening).toHaveCount(1);
  const samples = await opening.evaluate(async (el) => {
    (window as unknown as { oldOpening: Element }).oldOpening = el;
    const samples: number[] = [];
    for (let i = 0; i < 16; i++) {
      await new Promise(requestAnimationFrame);
      samples.push(Number(getComputedStyle(el).opacity));
    }
    return (window as unknown as { openingSamples: { values: number[] }[] }).openingSamples[0]!
      .values;
  });
  expect(samples.some((value) => value < 0.05)).toBe(true);
  expect(samples.some((value) => value > 0.05 && value < 0.95)).toBe(true);
  expect(samples.at(-1)).toBeCloseTo(1, 1);
  await page.evaluate(async () => {
    const path = "/browser-tests/question-pick.fixture.tsx";
    ((await import(path)) as typeof Fixture).repick();
  });
  await expect(opening).toHaveAttribute("data-attempt", "2");
  expect(
    await opening.evaluate(
      (el) => el === (window as unknown as { oldOpening: Element }).oldOpening,
    ),
  ).toBe(false);
  const repeated = await opening.evaluate(async (el) => {
    const values = [Number(getComputedStyle(el).opacity)];
    for (let i = 0; i < 10; i++) {
      await new Promise(requestAnimationFrame);
      values.push(Number(getComputedStyle(el).opacity));
    }
    return (window as unknown as { openingSamples: { values: number[] }[] }).openingSamples[1]!
      .values;
  });
  expect(repeated.some((value) => value < 0.05)).toBe(true);
  expect(repeated.some((value) => value > 0.05 && value < 0.95)).toBe(true);
  await expect(opening).toHaveCount(0);
});

test("slow media uses the exact delayed hint, a natural two-second pulse and a 300ms exit", async ({
  page,
}) => {
  await mount(page, ["player", 10000]);
  await pick(page);
  const opening = page.getByTestId("question-pick-transition");
  await expect(opening).toHaveAttribute("data-started", "true");
  await expect(page.getByTestId("question-pick-waiting")).toHaveCount(0);
  const hint = page.getByTestId("question-pick-waiting");
  await expect(hint).toHaveText("Waiting for all players to download media...");
  const cycle = await hint.evaluate(async (el) => {
    const values: number[] = [];
    const start = performance.now();
    while (performance.now() - start < 2400) {
      await new Promise(requestAnimationFrame);
      values.push(Number(getComputedStyle(el).opacity));
    }
    return values;
  });
  expect(Math.max(...cycle)).toBeGreaterThan(0.98);
  expect(cycle.some((v) => v >= 0.49 && v < 0.54)).toBe(true);
  expect(
    await opening.evaluate((el) => ({
      border: getComputedStyle(el).borderWidth,
      shadow: getComputedStyle(el).boxShadow,
    })),
  ).toEqual({ border: "0px", shadow: "none" });
  await page.evaluate(async () => {
    const path = "/browser-tests/question-pick.fixture.tsx";
    ((await import(path)) as typeof Fixture).ready();
  });
  await expect(opening).toHaveAttribute("data-exiting", "true");
  expect(await opening.evaluate((el) => getComputedStyle(el).animationDuration)).toBe("0.3s");
  await expect(opening).toHaveCount(0);
});

test("keeps the question mounted and fully visible through the overlay exit", async ({ page }) => {
  await mount(page);
  const samples = await page.evaluate(async () => {
    const path = "/browser-tests/question-pick.fixture.tsx";
    ((await import(path)) as typeof Fixture).pick();
    const samples: { opening: boolean; stable: boolean; opacity: string; transform: string }[] = [];
    let question: Element | null = null;
    let step: Element | null = null;
    let uncoveredAt: number | null = null;
    const deadline = performance.now() + 4000;
    while (performance.now() < deadline) {
      await new Promise(requestAnimationFrame);
      const stage = document.querySelector(".question-pick-stage")!;
      const content = stage.querySelector(".question-content");
      const currentStep = content?.querySelector(".question-step");
      if (!content || !currentStep) continue;
      question ??= content;
      step ??= currentStep;
      const opening = stage.hasAttribute("data-opening");
      for (const element of [content, currentStep]) {
        const style = getComputedStyle(element);
        samples.push({
          opening,
          stable: question === content && step === currentStep,
          opacity: style.opacity,
          transform: style.transform,
        });
      }
      if (!opening) {
        uncoveredAt ??= performance.now();
        if (performance.now() - uncoveredAt > 350) break;
      }
    }
    return samples;
  });
  expect(samples.some((sample) => sample.opening)).toBe(true);
  expect(samples.some((sample) => !sample.opening)).toBe(true);
  expect(samples.every((sample) => sample.stable)).toBe(true);
  expect(samples.every((sample) => sample.opacity === "1")).toBe(true);
  expect(samples.every((sample) => sample.transform === "none")).toBe(true);
});

for (const role of ["player", "showman", "spectator"] as const) {
  test("starts real video at zero after opening for " + role, async ({ page }) => {
    await mount(page, [role, 0, "simple", true]);
    await pick(page);
    const opening = page.getByTestId("question-pick-transition");
    await expect(opening).toHaveAttribute("data-exiting", "true");
    const video = page.getByTestId("media-video");
    await expect(video).toHaveCount(1);
    expect(
      await video.evaluate((el: HTMLVideoElement) => ({ paused: el.paused, time: el.currentTime })),
    ).toEqual({ paused: true, time: 0 });
    await page.keyboard.press("Space");
    const sent = await page.evaluate(async () => {
      const path = "/browser-tests/question-pick.fixture.tsx";
      return ((await import(path)) as typeof Fixture).sent;
    });
    expect(sent).not.toContain("question-answer");
    await expect(opening).toHaveCount(0);
    await expect.poll(() => video.evaluate((el: HTMLVideoElement) => el.paused)).toBe(false);
    expect(await video.evaluate((el: HTMLVideoElement) => el.currentTime)).toBeLessThan(1);
  });
}

for (const viewport of [
  { width: 375, height: 812 },
  { width: 820, height: 1180 },
]) {
  test("keeps native layout and reduced-motion timing at " + viewport.width, async ({ page }) => {
    await page.setViewportSize(viewport);
    await mount(page, ["player", 0, "simple", false, true, "daylight"]);
    await pick(page);
    const opening = page.getByTestId("question-pick-transition");
    await expect(opening).toHaveAttribute("data-started", "true");
    expect(await opening.evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
    await expect(opening).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}

for (const kind of ["secret", "stake"] as const) {
  test("opens the existing special scene for " + kind, async ({ page }) => {
    await mount(page, ["player", 0, kind]);
    await pick(page);
    const opening = page.getByTestId("question-pick-transition");
    await expect(opening).toHaveCount(1);
    await expect(opening).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: kind === "secret" ? /secret/i : "Capitals" }),
    ).toBeVisible();
  });
}

for (const role of ["player", "showman", "spectator"] as const) {
  for (const [kind, label] of [
    ["simple", "Simple"],
    ["secret", "Secret"],
    ["stake", "Stake"],
    ["noRisk", "No risk"],
    ["hidden", "Hidden"],
    ["choice", "Choice"],
  ] as const) {
    test(`places the ${kind} badge correctly for ${role}`, async ({ page }) => {
      await mount(page, [role, 0, kind]);
      await pick(page);
      const opening = page.getByTestId("question-pick-transition");
      const badge = opening.getByTestId("question-type-badge");
      if (kind === "simple") await expect(badge).toHaveCount(0);
      else {
        await expect(badge).toBeVisible();
        await expect(badge).toHaveText(label);
        expect((await badge.boundingBox())!.y).toBeLessThan(
          (await opening.getByRole("heading").boundingBox())!.y,
        );
        expect(
          await badge
            .locator("span")
            .evaluate((node) => parseFloat(getComputedStyle(node).fontSize)),
        ).toBeLessThan(20);
      }
      await expect(opening).toHaveCount(0);
      if (kind === "secret" || kind === "stake")
        await page.evaluate(async () => {
          const path = "/browser-tests/question-pick.fixture.tsx";
          ((await import(path)) as typeof Fixture).confirmSpecialQuestion();
        });
      const heading = page.locator(".question-main > div").first();
      const type = heading.getByTestId("question-type-badge");
      if (kind === "simple") await expect(type).toHaveCount(0);
      else {
        await expect(type).toHaveText(label);
        const price = (await heading.getByText("100", { exact: true }).boundingBox())!;
        const box = (await type.boundingBox())!;
        expect(box.x).toBeGreaterThan(price.x + price.width);
        expect(Math.abs(box.y + box.height / 2 - price.y - price.height / 2)).toBeLessThan(1);
        const tooltip = page.getByRole("tooltip");
        await expect(tooltip).toHaveCount(0);
        await type.hover();
        await expect(tooltip).toBeVisible();
        await expect(tooltip).not.toBeEmpty();
        if (kind === "noRisk") await expect(tooltip).toHaveText("A wrong answer costs nothing");
        await heading.getByText("Capitals", { exact: true }).hover();
        await expect(tooltip).toHaveCount(0);
        await type.focus();
        await expect(tooltip).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(tooltip).toHaveCount(0);
      }
    });
  }
}

test("type badge has the default cursor and no click or touch action", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 375, height: 812 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    await mount(page, ["player", 0, "noRisk"]);
    await pick(page);
    await expect(page.getByTestId("question-pick-transition")).toHaveCount(0);
    const badge = page.locator(".question-heading").getByTestId("question-type-badge");
    await expect(page.getByRole("tooltip")).toHaveCount(0);
    expect(await badge.evaluate((node) => getComputedStyle(node).cursor)).toBe("default");
    await expect(
      page.locator(".question-heading").getByRole("button", { name: "No risk", exact: true }),
    ).toHaveCount(0);
    await badge.tap();
    await expect(badge).not.toBeFocused();
    await expect(page.getByRole("tooltip")).toHaveCount(0);
    await badge.focus();
    await expect(page.getByRole("tooltip")).toHaveText("A wrong answer costs nothing");
    await expect(page.getByRole("tooltip")).toBeInViewport({ ratio: 1 });
    await page
      .getByRole("tooltip")
      .evaluate((node) => Promise.all(node.getAnimations().map((animation) => animation.finished)));
    const help = (await page.getByRole("tooltip").locator(":scope > span").boundingBox())!;
    expect((await badge.boundingBox())!.y - help.y - help.height).toBeCloseTo(6, 0);
    await page.screenshot({ path: test.info().outputPath("type-help-mobile.png") });
    await page.locator(".question-heading").getByText("Capitals", { exact: true }).tap();
    await expect(page.getByRole("tooltip")).toHaveCount(0);
  } finally {
    await context.close();
  }
});

for (const reduced of [false, true]) {
  test(`type tooltip prefers above, bridges its gap and animates closing (reduced motion: ${reduced})`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: reduced ? "reduce" : "no-preference" });
    await mount(page, ["player", 0, "noRisk"]);
    await pick(page);
    await expect(page.getByTestId("question-pick-transition")).toHaveCount(0);
    const badge = page.locator(".question-heading").getByTestId("question-type-badge");
    const tooltip = page.getByRole("tooltip");
    await badge.hover();
    await expect(tooltip).toHaveAttribute("data-side", "above");
    await tooltip.evaluate((node) =>
      Promise.all(node.getAnimations().map((animation) => animation.finished)),
    );
    const button = (await badge.boundingBox())!;
    await page.mouse.move(button.x + button.width / 2, button.y - 3);
    await expect(tooltip).toBeVisible();
    await tooltip.hover();
    await expect(tooltip).toBeVisible();
    const exit = await tooltip.evaluate(async (node: HTMLElement) => {
      node.hidePopover();
      const animations = node.getAnimations();
      const opacity = animations.find(
        (animation) =>
          animation instanceof CSSTransition && animation.transitionProperty === "opacity",
      );
      if (opacity) {
        opacity.pause();
        opacity.currentTime = 90;
      }
      const middle = opacity ? Number(getComputedStyle(node).opacity) : null;
      const duration = opacity?.effect?.getTiming().duration;
      animations.forEach((animation) => animation.finish());
      await new Promise(requestAnimationFrame);
      return { middle, duration, display: getComputedStyle(node).display };
    });
    if (reduced) expect(exit.middle).toBeNull();
    else {
      expect(exit.duration).toBe(180);
      expect(exit.middle).toBeGreaterThan(0);
      expect(exit.middle).toBeLessThan(1);
    }
    expect(exit.display).toBe("none");
    await badge.evaluate((node) => {
      node.style.position = "fixed";
      node.style.top = "2px";
    });
    await badge.focus();
    await expect(tooltip).toHaveAttribute("data-side", "below");
    await expect(tooltip).toBeInViewport({ ratio: 1 });
  });
}

test("restores the server opening remainder after reconnect", async ({ page }) => {
  await mount(page, ["player", 0, "simple", true]);
  await pick(page);
  await expect(page.getByTestId("question-pick-transition")).toHaveAttribute(
    "data-started",
    "true",
  );
  await page.evaluate(async () => {
    const path = "/browser-tests/question-pick.fixture.tsx";
    const fixture = (await import(path)) as typeof Fixture;
    fixture.reconnect();
  });
  await expect(page.getByTestId("question-pick-transition")).toHaveCount(1);
  await expect(page.getByTestId("question-pick-transition")).toHaveCount(0);
  const state = await page.evaluate(async () => {
    const path = "/browser-tests/question-pick.fixture.tsx";
    return ((await import(path)) as typeof Fixture).snapshot();
  });
  expect(state.opening?.serverDriven).toBe(true);
  expect(state.opening?.complete).toBe(true);
});

test("two warm clients start the short first clip on the same shared schedule", async ({
  page,
  context,
}) => {
  const other = await context.newPage();
  try {
    for (const client of [page, other]) {
      await mount(client, ["player", 0, "simple", true]);
      await client.evaluate(async () => {
        await fetch("/e2e/fixtures/clip.webm");
        document.addEventListener(
          "playing",
          (event) => {
            if (event.target instanceof HTMLVideoElement)
              (window as unknown as { clipStart: { at: number; position: number } }).clipStart = {
                at: Date.now(),
                position: event.target.currentTime,
              };
          },
          { capture: true },
        );
      });
    }
    const selectedAt = Date.now();
    await Promise.all(
      [page, other].map((client) =>
        client.evaluate(async (at) => {
          const path = "/browser-tests/question-pick.fixture.tsx";
          ((await import(path)) as typeof Fixture).pick(100, at);
        }, selectedAt),
      ),
    );
    const starts = await Promise.all(
      [page, other].map(async (client) => {
        await expect
          .poll(() =>
            client.evaluate(() => (window as unknown as { clipStart?: unknown }).clipStart),
          )
          .toBeTruthy();
        return client.evaluate(
          () => (window as unknown as { clipStart: { at: number; position: number } }).clipStart,
        );
      }),
    );
    expect(starts.every((start) => start.at >= selectedAt + 1750 && start.position < 0.15)).toBe(
      true,
    );
    expect(Math.abs(starts[0]!.at - starts[1]!.at)).toBeLessThan(150);
  } finally {
    await other.close();
  }
});
