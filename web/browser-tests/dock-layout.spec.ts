import { expect, test } from "@playwright/test";
import type * as Fixture from "./dock-layout.fixture";
import type * as Settings from "../src/features/settings/settingsStore";
import type * as Translations from "../src/i18n";

for (const viewport of [
  { width: 375, height: 812, pinned: false },
  { width: 768, height: 1024, pinned: false },
  { width: 1024, height: 768, pinned: false },
  { width: 1280, height: 600, pinned: false },
  { width: 1864, height: 884, pinned: false },
  { width: 844, height: 390, pinned: false },
  { width: 1280, height: 884, pinned: true },
  { width: 1024, height: 768, pinned: true },
]) {
  for (const role of ["showman", "player", "spectator"] as const) {
    test(`ordinary dock stays compact and stable for ${role} at ${viewport.width}x${viewport.height}${viewport.pinned ? " with pinned chat" : ""}`, async ({
      page,
    }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.setViewportSize(viewport);
      await page.route("**/v1/**", (route) => route.fulfill({ status: 401, body: "{}" }));
      await page.goto("/");
      await page.evaluate(async (role) => {
        const path = "/browser-tests/dock-layout.fixture.tsx";
        await ((await import(path)) as typeof Fixture).mount(role);
        await document.fonts.ready;
      }, role);
      const measurements = await page.evaluate(async (pinned) => {
        const path = "/browser-tests/dock-layout.fixture.tsx";
        const fixture = (await import(path)) as typeof Fixture;
        const settingsPath = "/src/features/settings/settingsStore.ts";
        const { useSettings } = (await import(settingsPath)) as typeof Settings;
        useSettings.getState().update({ pins: { chat: pinned } });
        const i18nPath = "/src/i18n/index.ts";
        const { i18n } = (await import(i18nPath)) as typeof Translations;
        const values = [];
        for (const language of ["uk", "en", "ru"] as const) {
          useSettings.getState().update({ language });
          await i18n.changeLanguage(language);
          for (const limits of [false, true]) {
            for (const name of limits ? fixture.scenarios : fixture.ordinaryScenarios) {
              fixture.setScenario(name, limits);
              await new Promise(requestAnimationFrame);
              await new Promise(requestAnimationFrame);
              // Include the longest value in the bid CTA, not just its initial minimum.
              const input = document.getElementById("bid-amount") as HTMLInputElement | null;
              if (input) {
                const setValue = Object.getOwnPropertyDescriptor(
                  HTMLInputElement.prototype,
                  "value",
                )!.set!;
                setValue.call(input, "2100000000");
                input.dispatchEvent(new Event("input", { bubbles: true }));
                await new Promise(requestAnimationFrame);
              }
              const dock = document.querySelector<HTMLElement>('[data-testid="dock"]')!;
              const box = dock.getBoundingClientRect();
              const content = dock.querySelector<HTMLElement>(".game-dock-content")!;
              const children = [
                ...content.querySelectorAll<HTMLElement>(
                  ".game-dock-action, .game-dock-status, .game-dock-next",
                ),
              ].filter((el) => el.getClientRects().length > 0);
              values.push({
                name,
                limits,
                width: box.width,
                ordinary: fixture.ordinaryScenarios.includes(name),
                language,
                height: box.height,
                top: box.top,
                bottom: box.bottom,
                horizontal: Math.max(
                  0,
                  document.documentElement.scrollWidth - innerWidth,
                  content.scrollWidth - content.clientWidth,
                ),
                contentOverflow: content.scrollHeight - content.clientHeight,
                clipped: children.some((el) => {
                  const r = el.getBoundingClientRect();
                  return r.top < box.top - 1 || r.bottom > box.bottom + 1;
                }),
                needsScroll: children.some((el) => el.scrollHeight > el.clientHeight + 1),
                scrolling: children
                  .filter((el) => el.scrollHeight > el.clientHeight + 1)
                  .map((el) => ({
                    class: el.className,
                    height: el.clientHeight,
                    content: el.scrollHeight,
                  })),
              });
            }
          }
        }
        return values;
      }, viewport.pinned);
      const first = measurements[0]!;
      expect(first.height).toBeLessThanOrEqual(first.width < 768 ? 178 : 130);
      for (const value of measurements) {
        expect(value, `${value.language}/${value.name}`).toMatchObject({
          bottom: first.bottom,
          horizontal: 0,
          clipped: false,
        });
        if (value.ordinary)
          expect(value, `${value.language}/${value.name}`).toMatchObject({
            height: first.height,
            top: first.top,
          });
        expect(value.contentOverflow, `${value.language}/${value.name}`).toBeLessThanOrEqual(1);
      }
      expect(measurements.filter((value) => value.ordinary && value.needsScroll)).toEqual([]);
      expect(errors).toEqual([]);
    });
  }
}

for (const width of [375, 768, 1280]) {
  test(`long names, help disclosure and answer controls stay readable at ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 812 });
    await page.route("**/v1/**", (route) => route.fulfill({ status: 401, body: "{}" }));
    await page.goto("/");
    await page.evaluate(async (width) => {
      const path = "/browser-tests/dock-layout.fixture.tsx";
      await ((await import(path)) as typeof Fixture).mount("player");
      const settingsPath = "/src/features/settings/settingsStore.ts";
      const { useSettings } = (await import(settingsPath)) as typeof Settings;
      useSettings.getState().update({ pins: { chat: width === 1280 } });
      await document.fonts.ready;
    }, width);
    const dock = page.getByTestId("dock");
    const name = dock.locator(".player-name");
    await expect(name).toHaveAttribute("title", "Ш".repeat(50));
    await expect(name).toHaveText("Ш".repeat(50));
    await name.hover();
    expect(
      await name.evaluate((el) => ({
        ellipsis: getComputedStyle(el).textOverflow,
        clipped: el.scrollWidth > el.clientWidth,
      })),
    ).toEqual({ ellipsis: "ellipsis", clipped: true });
    const before = await dock.boundingBox();
    await dock.locator("summary").click();
    const help = dock.locator("details p");
    await expect(help).toBeVisible();
    const box = (await help.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(await dock.boundingBox()).toEqual(before);
    await dock.locator("summary").click();
    await page.evaluate(async () => {
      const path = "/browser-tests/dock-layout.fixture.tsx";
      ((await import(path)) as typeof Fixture).setScenario("answer");
    });
    const send = dock.locator('button[type="submit"]');
    await expect(send).toBeVisible();
    expect(await send.evaluate((el) => getComputedStyle(el).whiteSpace)).toBe("nowrap");
    expect(await send.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    expect(await dock.boundingBox()).toEqual(before);
  });
}
