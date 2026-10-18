// Renders the Discord Activity art assets (assets/discord-activity/*.png) from
// cover.html. Run from web/: node scripts/render-activity-assets.mjs
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { chromium } from "@playwright/test";

const dir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../assets/discord-activity",
);
const assets = [
  { id: "cover", file: "cover.png", width: 1920, height: 1080 },
  { id: "icon", file: "icon.png", width: 1024, height: 1024 },
];

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto(pathToFileURL(path.join(dir, "cover.html")).href, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  for (const { id, file, width, height } of assets) {
    const box = await page.locator(`#${id}`).boundingBox();
    if (!box || box.width !== width || box.height !== height) {
      throw new Error(`#${id} is ${box?.width}x${box?.height}, expected ${width}x${height}`);
    }
    await page.locator(`#${id}`).screenshot({ path: path.join(dir, file) });
    console.log(`${file} ${width}x${height}`);
  }
} finally {
  await browser.close();
}
