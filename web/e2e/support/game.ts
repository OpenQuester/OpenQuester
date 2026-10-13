import { expect, type Browser, type BrowserContext, type Page } from "@playwright/test";

export function packageId(): number {
  const id = Number(process.env.OQ_E2E_PACKAGE_ID);
  if (!id) throw new Error("OQ_E2E_PACKAGE_ID missing: global setup did not seed a package");
  return id;
}

/** A browser context per person, so each has their own session cookie. */
export async function person(
  browser: Browser,
  name: string,
  device: {
    viewport: { width: number; height: number };
    isMobile?: boolean;
    hasTouch?: boolean;
    userAgent?: string;
    deviceScaleFactor?: number;
  },
): Promise<Person> {
  const context = await browser.newContext({
    ...device,
    baseURL: process.env.OQ_WEB_URL ?? "http://localhost:4173",
  });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(`[${name}] ${err.message}`));
  return { page, context, name, errors };
}

export interface Person {
  page: Page;
  context: BrowserContext;
  name: string;
  /** Uncaught exceptions from the page; tests assert this stays empty. */
  errors: string[];
}

export async function signInAsGuest(page: Page, name: string, redirect = "/"): Promise<void> {
  await page.goto(`/login?redirect=${encodeURIComponent(redirect)}`);
  await page.getByLabel("Your name").fill(name);
  await page.getByRole("button", { name: "Continue as guest" }).click();
  await expect(page).not.toHaveURL(/\/login/);
  await expect(page.getByRole("link", { name: "Profile and settings" })).toBeVisible();
}

/** Creates a game from the seeded package and returns its room code. */
export async function hostGame(
  page: Page,
  title: string,
  options: { maxPlayers?: number } = {},
): Promise<string> {
  await page.goto(`/games/new?packageId=${packageId()}`);
  await page.getByLabel("Game name").fill(title);
  if (options.maxPlayers) await page.getByLabel("Players").selectOption(String(options.maxPlayers));
  await page.getByRole("button", { name: "Create & open lobby" }).click();
  await expect(page).toHaveURL(/\/games\/[A-Z0-9]+$/);
  await expect(page.getByText("You are")).toContainText("Showman");
  return (await page.getByTestId("room-code").innerText()).trim();
}

/** Opens an invite link as a visitor and joins with a guest name. */
export async function joinByLink(
  page: Page,
  code: string,
  name: string,
  as: "player" | "spectator",
): Promise<void> {
  await page.goto(`/games/${code}`);
  await page.getByLabel("Your name").fill(name);
  await page.getByRole("button", { name: as === "player" ? "Join as player" : "Watch" }).click();
  await expect(page.getByText("You are")).toContainText(as === "player" ? "Player" : "Spectator");
}

export function dockStatus(page: Page) {
  return page.getByTestId("dock-status");
}

export function dockPhase(page: Page) {
  return page.getByTestId("dock-phase");
}

export async function expectPhase(pages: Page[], phase: string | RegExp): Promise<void> {
  for (const p of pages) await expect(dockPhase(p)).toHaveText(phase);
}

export function cell(page: Page, theme: string, price: number) {
  return page.getByRole("button", { name: `${theme}, ${price}`, exact: true });
}

export async function chipScore(page: Page, player: string): Promise<string> {
  return (
    await page
      .locator(`[data-testid=player-chip][data-player="${player}"] [data-testid=chip-score]`)
      .innerText()
  ).trim();
}

/** Fails if the page scrolls sideways: every layout must fit its viewport. */
export async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, "page should not scroll horizontally").toBeLessThanOrEqual(1);
}

/** With OQ_SCREENSHOTS=1, saves a full-page screenshot for design review. */
export async function shot(page: Page, name: string): Promise<void> {
  if (!process.env.OQ_SCREENSHOTS) return;
  await page.waitForTimeout(250);
  await page.screenshot({ path: `screenshots/${name}.png`, fullPage: false });
}
