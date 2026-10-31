import { expect, test, type Page } from "@playwright/test";
import type * as Fixture from "./lobby-question.fixture";
import type * as Settings from "../src/features/settings/settingsStore";

async function open(page: Page) {
  await page.route("**/v1/**", (route) => route.fulfill({ status: 401, body: "{}" }));
  await page.goto("/");
}

for (const width of [375, 1440]) {
  test(`choosing offers random pick and keeps skip round in host tools at ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await open(page);
    await page.evaluate(async () => {
      const path = "/browser-tests/lobby-question.fixture.tsx";
      ((await import(path)) as typeof Fixture).mountLayoutLimits("board", 1);
    });
    const dock = page.getByTestId("dock");
    await expect(dock.getByTestId("skip-round")).toHaveCount(0);
    await dock.getByTestId("pick-random-question").click();
    const commands = await page.evaluate(async () => {
      const path = "/browser-tests/lobby-question.fixture.tsx";
      const f = (await import(path)) as typeof Fixture;
      const available = f.useGameStore
        .getState()
        .session!.state.currentRound!.themes.flatMap((theme) => theme.questions)
        .filter((question) => !question.isPlayed)
        .map((question) => question.id);
      return { sent: f.sent, available };
    });
    expect(commands.sent).toHaveLength(1);
    expect(commands.sent[0]).toEqual({
      action: "question-pick",
      args: [{ questionId: expect.any(Number) }],
    });
    expect(commands.available).toContain(
      (commands.sent[0]!.args[0] as { questionId: number }).questionId,
    );
    await page.getByTestId("host-tools").click();
    await page.getByTestId("host-panel").getByTestId("skip-round").click();
    await expect(page.getByRole("dialog", { name: "Skip to the next round?" })).toBeVisible();
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(page.getByTestId("skip-round-confirm")).toHaveCount(0);
  });
}

for (const myId of [2, 3, 1]) {
  test(`secret prices appear only on the stage, with controls only for receiver: ${myId}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await open(page);
    await page.evaluate(async (myId) => {
      const path = "/browser-tests/lobby-question.fixture.tsx";
      const f = (await import(path)) as typeof Fixture;
      f.mountLobbyQuestion("secret", myId);
      const game = f.useGameStore.getState().session!;
      f.useGameStore.setState({
        session: {
          ...game,
          state: {
            ...game.state,
            secretQuestionData: {
              questionId: 100,
              pickerPlayerId: 3,
              transferType: "any",
              transferDecisionPhase: false,
              priceSelection: { playerId: 2, allowedPrices: [1, 10000, 100000, 500000, 1000000] },
            },
          },
        },
      });
    }, myId);
    const stage = page.getByTestId("game-stage");
    await expect(page.locator(".player-card-hot")).toHaveCount(1);
    await expect(page.locator(".player-card-hot")).toHaveAttribute(
      "aria-label",
      /user2.*choosing price/,
    );
    await expect(page.getByTestId("dock").getByTestId("secret-price")).toHaveCount(0);
    if (myId !== 2) {
      await expect(stage.getByTestId("secret-price")).toHaveCount(0);
      await expect(stage.getByRole("list")).toContainText("1,000,000");
      await expect(stage.getByRole("list").getByRole("button")).toHaveCount(0);
      await expect(page.getByTestId("dock-status").locator(".text-warning")).not.toBeEmpty();
      return;
    }
    await expect(stage.getByTestId("secret-price")).toHaveCount(5);
    await expect(page.getByTestId("dock-info")).toHaveText("Choose the question price above");
    const first = stage.getByTestId("secret-price").first();
    for (const state of ["paused", "offline", "pending", "ready"]) {
      await page.evaluate(async (state) => {
        const path = "/browser-tests/lobby-question.fixture.tsx";
        const f = (await import(path)) as typeof Fixture;
        const game = f.useGameStore.getState().session!;
        f.useGameStore.setState({
          session: { ...game, state: { ...game.state, isPaused: state === "paused" } },
          connection: state === "offline" ? "reconnecting" : "connected",
          pending: state === "pending" ? { action: "secret-question-price", at: Date.now() } : null,
        });
      }, state);
      if (state === "ready") await expect(first).toBeEnabled();
      else await expect(first).toBeDisabled();
    }
    await first.focus();
    await page.keyboard.press("Enter");
    expect(
      await page.evaluate(async () => {
        const path = "/browser-tests/lobby-question.fixture.tsx";
        return ((await import(path)) as typeof Fixture).sent;
      }),
    ).toEqual([{ action: "secret-question-price", args: [{ price: 1 }] }]);
    expect(
      await stage.evaluate((el) => [
        el.scrollWidth - el.clientWidth,
        el.scrollHeight - el.clientHeight,
      ]),
    ).toEqual([0, 0]);
  });
}

test("target and result dots pulse together, retain geometry and respect reduced motion", async ({
  page,
}) => {
  await open(page);
  await page.evaluate(async () => {
    const path = "/browser-tests/lobby-question.fixture.tsx";
    ((await import(path)) as typeof Fixture).mountPointResults(1);
    const settings = "/src/features/settings/settingsStore.ts";
    ((await import(settings)) as typeof Settings).useSettings
      .getState()
      .update({ reduceMotion: false });
  });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const target = page.getByTestId("point-target"),
    dot = page.getByTestId("point-answer-dot");
  await expect(target).toHaveCSS("animation-duration", "2s");
  await expect(dot).toHaveCSS("animation-duration", "2s");
  expect(await target.evaluate((el) => getComputedStyle(el).boxShadow)).not.toBe("none");
  await page
    .locator(".oq-pop")
    .evaluateAll((elements) =>
      elements.forEach((el) => el.getAnimations().forEach((a) => a.finish())),
    );
  const before = await target.boundingBox();
  for (const marker of [target, dot])
    await marker.evaluate((el) =>
      el.getAnimations().forEach((a) => {
        a.pause();
        a.currentTime = 1000;
      }),
    );
  await expect(target).toHaveCSS("opacity", "0.5");
  await expect(dot).toHaveCSS("opacity", "0.5");
  expect(await target.boundingBox()).toEqual(before);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(target).toHaveCSS("animation-name", "none");
});

for (const mode of ["final", "allplay"] as const) {
  test(`${mode}: submission feedback stays in the header, changes to blue and has no duplicate badges`, async ({
    page,
  }) => {
    await open(page);
    await page.evaluate(async (mode) => {
      const path = "/browser-tests/lobby-question.fixture.tsx";
      const f = (await import(path)) as typeof Fixture;
      f.mountLobbyQuestion("text");
      const g = f.useGameStore.getState().session!;
      const q = g.state.currentQuestion!;
      const state = {
        ...g.state,
        questionState: mode === "final" ? ("answering" as const) : ("showing" as const),
        answeringPlayer: null,
        skippedPlayers: [],
      };
      if (mode === "final") {
        state.currentRound = { ...state.currentRound!, type: "final" };
        state.finalRoundData = {
          phase: "answering",
          bids: { 2: 100, 3: 100 },
          answers: [],
          turnOrder: [2, 3],
          eliminatedThemes: [],
          questionData: { themeId: 10, themeName: "Final", question: q },
        };
      } else {
        state.allPlay = {
          mode: "noRisk",
          questionId: 100,
          price: 100,
          maxStake: null,
          priceMultiplier: 1,
          entries: [2, 3].map((id) => ({
            playerId: id,
            stake: null,
            answer: null,
            submitted: false,
            isCorrect: null,
            scoreChange: null,
          })),
        };
      }
      f.useGameStore.setState({
        session: {
          ...g,
          state,
          content: null,
          questionFeedback: { current: {}, previous: {}, expiresAt: null },
        },
      });
    }, mode);
    const card = page.locator(".player-card-own");
    await expect(card).toHaveClass(/player-card-hot/);
    await expect(page.getByTestId("game-stage")).not.toContainText(
      /user2.*answering|You · answering/,
    );
    await page.evaluate(async (mode) => {
      const path = "/browser-tests/lobby-question.fixture.tsx";
      const f = (await import(path)) as typeof Fixture;
      f.useGameStore.getState().dispatch({
        type: mode === "final" ? "final-answer-submit" : "all-play-answer",
        payload: { playerId: 2 },
      });
    }, mode);
    await expect(card).toHaveAttribute("data-submitted", "true");
    await expect(card).not.toHaveClass(/player-card-hot/);
    await expect(card).toHaveAttribute("aria-label", /answered/);
    expect(
      await card.evaluate((el) => {
        const c = getComputedStyle(el);
        return c.boxShadow.includes(c.borderColor);
      }),
    ).toBe(true);
  });
}

test("result borders expire after 15 seconds with a 1.5-second fade and matching own highlight", async ({
  page,
}) => {
  await open(page);
  await page.clock.install();
  await page.evaluate(async () => {
    const path = "/browser-tests/lobby-question.fixture.tsx";
    const f = (await import(path)) as typeof Fixture;
    f.mountLobbyQuestion("caption");
    const settings = "/src/features/settings/settingsStore.ts";
    ((await import(settings)) as typeof Settings).useSettings
      .getState()
      .update({ reduceMotion: false });
  });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now() + 100)));
  await page.evaluate(async () => {
    const path = "/browser-tests/lobby-question.fixture.tsx";
    const f = (await import(path)) as typeof Fixture;
    const dispatch = f.useGameStore.getState().dispatch;
    dispatch({
      type: "answer-result",
      payload: {
        answerResult: { player: 2, answerType: "correct", result: 1200, score: 1200 },
        timer: null,
      },
    });
    dispatch({
      type: "question-finish",
      payload: { answerText: "Tokyo", answerFiles: null, nextTurnPlayerId: 2 },
    });
    dispatch({ type: "answer-show-end", payload: {} });
  });
  const own = page.locator('.player-card-own[data-outcome="correct"]');
  await expect(own).toHaveCount(1);
  await own.evaluate((el) => el.getAnimations().forEach((a) => a.finish()));
  expect(
    await own.evaluate((el) => {
      const c = getComputedStyle(el);
      return c.boxShadow.includes(c.outlineColor);
    }),
  ).toBe(true);
  await page.clock.runFor(14999);
  await expect(own).toHaveCount(1);
  await page.clock.runFor(1);
  await expect(own).toHaveCount(0);
  const card = page.locator(".player-card-own");
  const transition = await card.evaluate((el) => {
    const a = el
      .getAnimations()
      .find((a) => a instanceof CSSTransition && a.transitionProperty === "outline-color")!;
    a.pause();
    a.currentTime = 750;
    return { duration: a.effect!.getTiming().duration, colour: getComputedStyle(el).outlineColor };
  });
  expect(transition.duration).toBe(1500);
  expect(transition.colour).toMatch(/rgba/);
  await card.evaluate((el) => el.getAnimations().forEach((a) => a.finish()));
  await expect(card).toHaveCSS("outline-color", "rgba(0, 0, 0, 0)");
});

for (const scenario of [
  { flow: "regular", award: 600 },
  { flow: "regular", award: 0 },
  { flow: "allplay", award: 400 },
  { flow: "allplay", award: 0 },
  { flow: "final", award: 400 },
]) {
  test(`${scenario.flow}: submission becomes a reviewed ${scenario.award} result without an active yellow background`, async ({
    page,
  }) => {
    await open(page);
    await page.evaluate(async ({ flow }) => {
      const path = "/browser-tests/lobby-question.fixture.tsx";
      const f = (await import(path)) as typeof Fixture;
      f.mountLobbyQuestion("text");
      const g = f.useGameStore.getState().session!;
      const state = { ...g.state, skippedPlayers: [], answeredPlayers: [] };
      if (flow === "allplay") {
        state.questionState = "showing";
        state.allPlay = {
          mode: "stake",
          questionId: 100,
          price: 600,
          maxStake: 1200,
          priceMultiplier: 1,
          entries: [2, 3].map((playerId) => ({
            playerId,
            stake: 400,
            submitted: false,
            answer: null,
            isCorrect: null,
            scoreChange: null,
          })),
        };
      }
      if (flow === "final") {
        state.currentRound = { ...state.currentRound!, type: "final" };
        state.questionState = "answering";
        state.finalRoundData = {
          phase: "answering",
          bids: { 2: 400, 3: 400 },
          answers: [],
          turnOrder: [2, 3],
          eliminatedThemes: [],
        };
      }
      f.useGameStore.setState({
        session: {
          ...g,
          state,
          finalSubmitted: [],
          questionFeedback: { current: {}, previous: {}, expiresAt: null },
        },
      });
      const dispatch = f.useGameStore.getState().dispatch;
      if (flow === "regular") {
        dispatch({
          type: "question-answer",
          payload: {
            userId: 2,
            timer: {
              startedAt: new Date().toISOString(),
              durationMs: 120000,
              elapsedMs: 0,
              resumedAt: null,
            },
          },
        });
        dispatch({ type: "answer-submitted", payload: { answerText: "Tokyo" } });
      } else if (flow === "allplay")
        dispatch({ type: "all-play-answer", payload: { playerId: 2 } });
      else dispatch({ type: "final-answer-submit", payload: { playerId: 2 } });
    }, scenario);
    const own = page.locator(".player-card-own");
    await expect(own).toHaveAttribute("data-submitted", "true");
    await expect(own).not.toHaveAttribute("data-outcome");
    await page.evaluate(async ({ flow, award }) => {
      const path = "/browser-tests/lobby-question.fixture.tsx";
      const f = (await import(path)) as typeof Fixture;
      const dispatch = f.useGameStore.getState().dispatch;
      if (flow === "regular") {
        const answerResult = {
          player: 2,
          answerType: "correct" as const,
          result: award,
          score: award,
        };
        dispatch({ type: "answer-result", payload: { answerResult, timer: null } });
        dispatch({
          type: "question-finish",
          payload: { answerText: "Tokyo", answerFiles: null, nextTurnPlayerId: 2, answerResult },
        });
      } else if (flow === "allplay") {
        const allPlay = f.useGameStore.getState().session!.state.allPlay!;
        dispatch({
          type: "all-play-reviewing",
          payload: {
            allPlay: {
              ...allPlay,
              entries: allPlay.entries.map((e) => ({ ...e, submitted: true, answer: "Tokyo" })),
            },
          },
        });
        dispatch({
          type: "all-play-review",
          payload: { playerId: 2, isCorrect: true, scoreChange: award, newScore: award },
        });
      } else {
        dispatch({
          type: "final-submit-end",
          payload: {
            phase: "answering",
            nextPhase: "reviewing",
            allReviews: [
              {
                playerId: 2,
                answerId: "a2",
                answerText: "Tokyo",
                answerType: "pending",
                isCorrect: null,
                scoreChange: 0,
              },
            ],
          },
        });
        dispatch({
          type: "final-answer-review",
          payload: { playerId: 2, answerId: "a2", isCorrect: true, scoreChange: award },
        });
      }
    }, scenario);
    await expect(own).toHaveAttribute("data-outcome", scenario.award ? "correct" : "neutral");
    await expect(own).not.toHaveAttribute("data-submitted");
    await expect(own).not.toHaveClass(/player-card-hot/);
    expect(
      await own.evaluate((el) => {
        const style = getComputedStyle(el);
        const host = getComputedStyle(document.querySelector(".player-card-host")!);
        return (
          style.boxShadow.includes(style.outlineColor) &&
          style.backgroundColor !== host.backgroundColor
        );
      }),
    ).toBe(true);
  });
}
