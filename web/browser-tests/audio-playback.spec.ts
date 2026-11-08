import { expect, test, type Page } from "@playwright/test";
import { createServer } from "node:http";
import type * as Fixture from "./content-replay.fixture";

const fixturePath = "/browser-tests/content-replay.fixture.tsx";
const local = "/tone.wav";
const remote = "http://audio.example.test/tone.wav";
const sampleRate = 48_000;

function toneWav(seconds: number) {
  const count = seconds * sampleRate;
  const wav = Buffer.alloc(44 + count * 2);
  wav.write("RIFF", 0);
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(sampleRate * 2, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(count * 2, 40);
  const tones = [55, 1300, 9000];
  for (let i = 0; i < count; i++) {
    const time = i / sampleRate;
    const tone = tones[Math.floor(time / 0.4) % tones.length]!;
    wav.writeInt16LE(Math.round(2400 * Math.sin(2 * Math.PI * tone * time)), 44 + i * 2);
  }
  return wav;
}

const wav = toneWav(20);

function wavResponse(range?: string) {
  const start = Number(/^bytes=(\d+)-/.exec(range ?? "")?.[1] ?? 0);
  return {
    status: range ? 206 : 200,
    body: wav.subarray(start),
    headers: {
      "Content-Type": "audio/wav",
      "Content-Length": String(wav.length - start),
      "Accept-Ranges": "bytes",
      ...(range ? { "Content-Range": `bytes ${start}-${wav.length - 1}/${wav.length}` } : {}),
    },
  };
}

// Use actual HTTP requests so Chromium applies CORS and media range semantics.
const corsModes: string[] = [];
const corsServer = createServer((req, res) => {
  corsModes.push(req.headers["sec-fetch-mode"] as string);
  if (req.url === "/missing.wav") {
    res.writeHead(404).end();
    return;
  }
  const { status, headers, body } = wavResponse(req.headers.range);
  if (req.url === "/cors.wav") res.setHeader("Access-Control-Allow-Origin", "*");
  res.writeHead(status, headers).end(body);
});

let corsOrigin: string;
test.beforeAll(async () => {
  await new Promise<void>((resolve) => corsServer.listen(0, "127.0.0.1", resolve));
  const address = corsServer.address();
  if (!address || typeof address === "string") throw new Error("CORS fixture did not start");
  corsOrigin = `http://127.0.0.1:${address.port}`;
});
test.afterAll(async () => {
  corsServer.closeAllConnections();
  await new Promise<void>((resolve) => corsServer.close(() => resolve()));
});

function mount(page: Page, src = local, positionMs?: number) {
  return page.evaluateHandle(
    async ({ path, src, positionMs }) =>
      ((await import(path)) as typeof Fixture).mountAudio(src, positionMs),
    { path: fixturePath, src, positionMs },
  );
}

function bars(page: Page) {
  return page.locator(".audio-spectrum span");
}

function peak(page: Page) {
  return bars(page).evaluateAll((nodes) =>
    Math.max(
      ...nodes.map((node) => {
        const transform = getComputedStyle(node).transform;
        return transform === "none" ? 0 : new DOMMatrix(transform).d;
      }),
    ),
  );
}

async function graphStats(page: Page) {
  return page.evaluateHandle(() => {
    const stats = { sources: 0, audible: 0, disconnects: 0, samples: 0 };
    AudioContext.prototype.createMediaElementSource = new Proxy(
      AudioContext.prototype.createMediaElementSource,
      {
        apply(fn, context, args) {
          stats.sources++;
          return Reflect.apply(fn, context, args);
        },
      },
    );
    AudioNode.prototype.connect = new Proxy(AudioNode.prototype.connect, {
      apply(fn, node, args) {
        if (node instanceof MediaElementAudioSourceNode && args[0] instanceof AudioDestinationNode)
          stats.audible++;
        return Reflect.apply(fn, node, args);
      },
    });
    AudioNode.prototype.disconnect = new Proxy(AudioNode.prototype.disconnect, {
      apply(fn, node, args) {
        if (node instanceof MediaElementAudioSourceNode) stats.disconnects++;
        return Reflect.apply(fn, node, args);
      },
    });
    AnalyserNode.prototype.getByteFrequencyData = new Proxy(
      AnalyserNode.prototype.getByteFrequencyData,
      {
        apply(fn, node, args) {
          stats.samples++;
          return Reflect.apply(fn, node, args);
        },
      },
    );
    return stats;
  });
}

test.beforeEach(async ({ page }) => {
  corsModes.length = 0;
  await page.route("**/v1/**", (route) => route.fulfill({ status: 401, body: "{}" }));
  await page.route("**/tone.wav", (route) =>
    route.fulfill(wavResponse(route.request().headers().range)),
  );
  await page.goto("/");
});

test("samples the real tone and cleans up when replacing and unmounting a StrictMode player", async ({
  page,
}) => {
  const errors: Error[] = [];
  page.on("pageerror", (error) => errors.push(error));
  const stats = await graphStats(page);
  const view = await mount(page);
  await page.getByRole("button", { name: "Unlock Web Audio" }).click();
  await expect(bars(page)).toHaveCount(48);
  await expect.poll(() => peak(page)).toBeGreaterThan(0.3);
  const peaks = await bars(page).evaluateAll(async (nodes) => {
    const bins = new Set<number>();
    const end = performance.now() + 1200;
    while (performance.now() < end) {
      await new Promise(requestAnimationFrame);
      const levels = nodes.map((node) => new DOMMatrix(getComputedStyle(node).transform).d);
      bins.add(levels.indexOf(Math.max(...levels)));
    }
    return [...bins];
  });
  expect(peaks.some((band) => band < 8)).toBe(true);
  expect(peaks.some((band) => band > 38)).toBe(true);
  expect(await stats.evaluate(({ sources, audible }) => [sources, audible])).toEqual([1, 1]);

  const audio = page.getByTestId("media-audio");
  const first = await audio.elementHandle();
  await view.evaluate(async (view) => {
    const blob = await fetch("/tone.wav").then((res) => res.blob());
    view.render(URL.createObjectURL(blob));
  });
  await expect(audio).toHaveAttribute("src", /^blob:/);
  expect(await audio.evaluate((el, first) => el === first, first)).toBe(false);
  expect(await first!.evaluate((el: HTMLAudioElement) => el.paused)).toBe(true);
  await expect.poll(() => peak(page)).toBeGreaterThan(0.3);
  expect(
    await stats.evaluate(({ sources, audible, disconnects }) => [sources, audible, disconnects]),
  ).toEqual([2, 2, 1]);
  await view.evaluate((view) => view.unmount());
  await expect(audio).toHaveCount(0);
  const after = await stats.jsonValue();
  expect(after.disconnects).toBe(2);
  await page.evaluate(() => new Promise(requestAnimationFrame));
  expect(await stats.jsonValue()).toEqual(after);
  expect(errors).toEqual([]);
});

test("rests on buffering, pause, mute, zero volume, hidden and reduced motion, then resumes", async ({
  page,
}) => {
  const stats = await graphStats(page);
  const view = await mount(page);
  const audio = page.getByTestId("media-audio");
  const card = page.getByTestId("media-frame");
  const status = card.getByRole("status");
  await page.getByRole("button", { name: "Unlock Web Audio" }).click();
  const first = await audio.elementHandle();
  const active = () => expect.poll(() => peak(page)).toBeGreaterThan(0.3);
  const resting = async () => {
    await expect.poll(() => peak(page)).toBeCloseTo(0.04, 3);
    const samples = await stats.evaluate((stats) => stats.samples);
    await page.evaluate(() => new Promise(requestAnimationFrame));
    expect(await stats.evaluate((stats) => stats.samples)).toBe(samples);
  };

  await active();
  await audio.evaluate((el) => {
    // React may batch both events, leaving the final playback state unchanged.
    el.dispatchEvent(new Event("waiting"));
    el.dispatchEvent(new Event("playing"));
  });
  await active();
  await audio.dispatchEvent("waiting");
  await expect(status).toHaveText("Buffering audio…");
  await resting();
  await audio.dispatchEvent("playing");
  await active();
  await view.evaluate((view) => view.render(undefined, false));
  await expect.poll(() => audio.evaluate((el: HTMLAudioElement) => el.paused)).toBe(true);
  await expect(status).toHaveCount(0);
  await resting();
  await view.evaluate((view) => view.render());
  await expect.poll(() => audio.evaluate((el: HTMLAudioElement) => el.paused)).toBe(false);
  await expect(status).toHaveCount(0);
  await active();

  await audio.evaluate((el: HTMLAudioElement) => {
    el.muted = true;
  });
  await resting();
  await audio.evaluate((el: HTMLAudioElement) => {
    el.muted = false;
  });
  await active();
  const slider = page.getByRole("slider");
  await slider.press("Home");
  await resting();
  await slider.press("End");
  await active();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await resting();
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await active();
  await page.evaluate(async () => {
    const path = "/src/features/settings/settingsStore.ts";
    (await import(path)).useSettings.getState().update({ reduceMotion: true });
  });
  await resting();
  await page.evaluate(async () => {
    const path = "/src/features/settings/settingsStore.ts";
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    document.dispatchEvent(new Event("visibilitychange"));
    (await import(path)).useSettings.getState().update({ reduceMotion: false });
  });
  await resting();
  await page.evaluate(() => {
    Reflect.deleteProperty(document, "hidden");
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await active();
  await audio.evaluate((el: HTMLAudioElement) => {
    el.currentTime = el.duration - 0.05;
  });
  await expect.poll(() => audio.evaluate((el: HTMLAudioElement) => el.ended)).toBe(true);
  await expect(status).toHaveCount(0);
  await resting();
  expect(await audio.evaluate((el, first) => el === first, first)).toBe(true);
  expect(await stats.evaluate((stats) => stats.sources)).toBe(1);
});

test("plays natively while the context is suspended and attaches after an unlock gesture", async ({
  page,
}) => {
  const stats = await graphStats(page);
  const context = await page.evaluateHandle(async () => {
    const path = "/src/lib/audioContext.ts";
    const context = (await import(path)).resumeAudioContext() as AudioContext;
    await context.suspend();
    return context;
  });
  await mount(page);
  const audio = page.getByTestId("media-audio");
  await expect
    .poll(() => audio.evaluate((el: HTMLAudioElement) => el.currentTime))
    .toBeGreaterThan(0);
  expect(await stats.evaluate((stats) => stats.sources)).toBe(0);
  expect(await peak(page)).toBeCloseTo(0.04, 3);
  await page.getByRole("button", { name: "Unlock Web Audio" }).click();
  await expect.poll(() => peak(page)).toBeGreaterThan(0.3);
  await audio.evaluate((el: HTMLAudioElement) => {
    el.currentTime = 2.5;
  });
  await expect
    .poll(() => audio.evaluate((el: HTMLAudioElement) => el.currentTime))
    .toBeGreaterThan(2.5);
  const first = await audio.elementHandle();
  const restored = await page.evaluateHandle((previous) => {
    const offset = { seconds: 0 };
    document.addEventListener(
      "seeking",
      (event) => {
        if (event.target instanceof HTMLAudioElement && event.target !== previous) {
          offset.seconds = event.target.currentTime;
        }
      },
      true,
    );
    return offset;
  }, first);
  await context.evaluate((context) => context.suspend());
  await expect.poll(() => audio.evaluate((el, first) => el === first, first)).toBe(false);
  await expect.poll(() => restored.evaluate((offset) => offset.seconds)).toBeGreaterThan(2.5);
  await expect
    .poll(() => audio.evaluate((el: HTMLAudioElement) => el.currentTime))
    .toBeGreaterThan(2.5);
  expect(await peak(page)).toBeCloseTo(0.04, 3);
  expect(await stats.evaluate((stats) => stats.sources)).toBe(1);
});

test("keeps native playback when Web Audio is unavailable", async ({ page }) => {
  await page.evaluate(() => Object.defineProperty(window, "AudioContext", { value: undefined }));
  await mount(page);
  await page.getByRole("button", { name: "Unlock Web Audio" }).click();
  await expect
    .poll(() => page.getByTestId("media-audio").evaluate((el: HTMLAudioElement) => el.paused))
    .toBe(false);
  await expect(page.getByTestId("media-frame").getByRole("status")).toHaveCount(0);
  expect(await peak(page)).toBeCloseTo(0.04, 3);
});

test("keeps the spectrum at rest on blocked autoplay and unlocks through Enable sound", async ({
  page,
}) => {
  await page.evaluate(() => {
    let blocked = true;
    document.addEventListener(
      "click",
      () => {
        blocked = false;
      },
      { capture: true, once: true },
    );
    HTMLMediaElement.prototype.play = new Proxy(HTMLMediaElement.prototype.play, {
      apply(fn, el, args) {
        if (blocked && !el.muted)
          return Promise.reject(new DOMException("Gesture required", "NotAllowedError"));
        return Reflect.apply(fn, el, args);
      },
    });
  });
  await mount(page);
  const audio = page.getByTestId("media-audio");
  const enable = page.getByTestId("enable-sound");
  await expect(enable).toBeVisible();
  await expect.poll(() => audio.evaluate((el: HTMLAudioElement) => el.muted)).toBe(true);
  expect(await peak(page)).toBeCloseTo(0.04, 3);
  await enable.click();
  await expect(enable).toHaveCount(0);
  await expect.poll(() => peak(page)).toBeGreaterThan(0.3);
});

test("uses a successful anonymous cross-origin request for the analyser", async ({ page }) => {
  await mount(page, `${corsOrigin}/cors.wav`);
  await page.getByRole("button", { name: "Unlock Web Audio" }).click();
  await expect(page.getByTestId("media-audio")).toHaveAttribute("crossorigin", "anonymous");
  await expect.poll(() => peak(page)).toBeGreaterThan(0.3);
  expect(corsModes[0]).toBe("cors");
});

test("retries rejected CORS natively once and seeks to the content clock", async ({ page }) => {
  const stats = await graphStats(page);
  const seeks = await page.evaluateHandle(() => {
    const times: number[] = [];
    document.addEventListener(
      "seeking",
      (event) => {
        if (event.target instanceof HTMLAudioElement) times.push(event.target.currentTime);
      },
      true,
    );
    return times;
  });
  await mount(page, `${corsOrigin}/plain.wav`, 900);
  await page.getByRole("button", { name: "Unlock Web Audio" }).click();
  const audio = page.getByTestId("media-audio");
  await expect
    .poll(() => audio.evaluate((el: HTMLAudioElement) => el.currentTime))
    .toBeGreaterThan(0.9);
  expect(await seeks.jsonValue()).toContain(0.9);
  expect(corsModes[0]).toBe("cors");
  expect(corsModes.filter((mode) => mode === "cors")).toHaveLength(1);
  expect(corsModes).toContain("no-cors");
  expect(await audio.getAttribute("crossorigin")).toBeNull();
  expect(await peak(page)).toBeCloseTo(0.04, 3);
  expect(await stats.evaluate((stats) => stats.sources)).toBe(0);
});

test("shows the existing error view when the native retry also fails", async ({ page }) => {
  const src = `${corsOrigin}/missing.wav`;
  await mount(page, src);
  const failed = page.getByTestId("media-failed");
  await expect(failed).toBeVisible();
  await expect(failed.getByRole("link")).toHaveAttribute("href", src);
  expect(corsModes).toEqual(["cors", "no-cors"]);
  await expect(page.getByTestId("media-audio")).toHaveCount(0);
});

test("keeps native sound when a same-origin URL redirects to a host without CORS", async ({
  page,
}) => {
  await page.route("**/redirect.wav", (route) =>
    route.fulfill({ status: 302, headers: { location: `${corsOrigin}/plain.wav` } }),
  );
  const stats = await graphStats(page);
  await mount(page, "/redirect.wav");
  await page.getByRole("button", { name: "Unlock Web Audio" }).click();
  const audio = page.getByTestId("media-audio");
  await expect
    .poll(() => audio.evaluate((el: HTMLAudioElement) => el.currentTime))
    .toBeGreaterThan(0);
  expect(await audio.getAttribute("crossorigin")).toBeNull();
  expect(await stats.evaluate((stats) => stats.sources)).toBe(0);
  expect(corsModes.slice(0, 2)).toEqual(["cors", "no-cors"]);
});

test("loads a Discord-mapped audio URL on the Activity origin", async ({ page }) => {
  await page.evaluate(async () => {
    const path = "/src/lib/urlMappings.ts";
    (await import(path)).setUrlMappings([{ prefix: "/mapped", target: "audio.example.test" }]);
  });
  await mount(page, remote);
  await page.getByRole("button", { name: "Unlock Web Audio" }).click();
  await expect(page.getByTestId("media-audio")).toHaveAttribute("src", /\/mapped\/tone\.wav$/);
  await expect.poll(() => peak(page)).toBeGreaterThan(0.3);
});

for (const [mode, role] of [
  ["audio", "spectator"],
  ["answer", "showman"],
  ["final", "player"],
  ["playtest", "player"],
] as const) {
  test(`shows the shared live spectrum during ${mode} as ${role}`, async ({ page }) => {
    await page.evaluate(
      async ({ path, mode, role, src }) => {
        ((await import(path)) as typeof Fixture).mount(mode, role, { src, durationMs: 20_000 });
      },
      { path: fixturePath, mode, role, src: local },
    );
    const card = page.getByTestId("media-frame");
    await expect
      .poll(() => page.getByTestId("media-audio").evaluate((el: HTMLAudioElement) => el.paused))
      .toBe(false);
    await expect(card.getByRole("status")).toHaveCount(0);
    await page.getByRole("slider", { name: "Media volume" }).press("End");
    await expect.poll(() => peak(page)).toBeGreaterThan(0.3);
  });
}
