import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import type * as Fixture from "./judge-wait.fixture";

test("showman waits for structured answers and can only skip after submission", async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 1366, height: 884 });
  await context.route("**/v1/**", (route) => route.fulfill({ status: 401, body: "{}" }));
  await page.goto("/");
  const dir = process.env.OQ_JUDGE_SCREENSHOTS;
  if (dir) mkdirSync(dir, { recursive: true });
  for (const kind of ["point", "number", "choice"] as const) {
    await page.evaluate(async (k) => {
      const path = "/browser-tests/judge-wait.fixture.tsx";
      ((await import(path)) as typeof Fixture).mountJudge(k);
    }, kind);
    const fixture = page.getByTestId("judge-fixture");
    await expect(
      page
        .getByTestId("showman-panel")
        .getByText("The player must select, enter, or mark an answer."),
    ).toBeVisible();
    await expect(page.getByText("Answering out loud")).toHaveCount(0);
    await expect(page.getByTestId("judge-correct")).toHaveCount(0);
    await expect(page.getByTestId("judge-wrong")).toHaveCount(0);
    await fixture.focus();
    await page.keyboard.press("c");
    await page.keyboard.press("w");
    const emitted = () =>
      page.evaluate(async () => {
        const path = "/browser-tests/judge-wait.fixture.tsx";
        return ((await import(path)) as typeof Fixture).actions();
      });
    expect(await emitted()).toEqual([]);
    if (dir) await page.screenshot({ path: join(dir, `${kind}-waiting.png`) });
    await page.getByTestId("judge-skip").click();
    expect(await emitted()).toEqual([
      { name: "answer-result", payload: { answerType: "skip", scoreResult: 0 } },
    ]);
  }
  await page.evaluate(async () => {
    const path = "/browser-tests/judge-wait.fixture.tsx";
    ((await import(path)) as typeof Fixture).submitUnrecognized();
  });
  await expect(page.getByTestId("judge-correct")).toHaveCount(0);
  await expect(page.getByTestId("judge-wrong")).toHaveCount(0);
  await expect(
    page.getByText("The answer was sent. Wait for the result or skip without points."),
  ).toBeVisible();
  if (dir) await page.screenshot({ path: join(dir, "choice-submitted.png") });
  await page.getByTestId("judge-fixture").focus();
  await page.keyboard.press("w");
  const actions = await page.evaluate(async () => {
    const path = "/browser-tests/judge-wait.fixture.tsx";
    return ((await import(path)) as typeof Fixture).actions();
  });
  expect(actions).toEqual([
    { name: "answer-result", payload: { answerType: "skip", scoreResult: 0 } },
  ]);
});
