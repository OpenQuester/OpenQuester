import { chromium } from "@playwright/test";
const b = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
const p = await b.newPage();
await p.goto("https://dev.openquester.app/packages/10/preview");
await p.waitForTimeout(3000);
await p.getByText("2 · Аниме").first().click();
await p.waitForTimeout(1000);
const cards = p.getByTestId("question-card");
console.log("cards", await cards.count());
await cards.first().click();
await p.waitForTimeout(3000);
await p.screenshot({ path: "/tmp/oq-probe2.png" });
console.log(await p.evaluate(async () => {
  const els = [...document.querySelectorAll("audio,video")];
  const out = [];
  for (const a of els) {
    const info = { tag: a.tagName, src: a.currentSrc, muted: a.muted, vol: a.volume, err: a.error?.code, ready: a.readyState, dur: a.duration, paused: a.paused };
    try {
      a.muted = false; a.volume = 1; a.currentTime = 0;
      await a.play();
      const ctx = new AudioContext();
      const src = ctx.createMediaStreamSource(a.captureStream());
      const an = ctx.createAnalyser(); src.connect(an);
      await new Promise((r) => setTimeout(r, 1500));
      const buf = new Float32Array(an.fftSize); an.getFloatTimeDomainData(buf);
      info.rms = Math.sqrt(buf.reduce((s, x) => s + x * x, 0) / buf.length);
      info.t = a.currentTime;
    } catch (e) { info.playErr = String(e); }
    out.push(info);
  }
  return out;
}));
await b.close();
