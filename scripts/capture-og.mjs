// One-off helper: capture a 1200×630 PNG screenshot of the landing page
// for use as the site's og:image. Re-run this whenever the landing page
// design changes meaningfully.
//
// Usage:
//   1. start dev server:   npm run dev
//   2. in another shell:   node scripts/capture-og.mjs
//
// Output: static/og.png

import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '..', 'static', 'og.png');
const URL_TO_CAPTURE = process.env.OG_URL || 'http://localhost:5173/';

const browser = await chromium.launch();
const ctx = await browser.newContext({
	viewport: { width: 1200, height: 630 },
	deviceScaleFactor: 2 // crisper PNG; many social previews show >600px wide
});
const page = await ctx.newPage();
console.log(`Capturing ${URL_TO_CAPTURE}…`);
await page.goto(URL_TO_CAPTURE, { waitUntil: 'networkidle', timeout: 30_000 });

// Give the widget a beat to render its first paint after bundle load.
await page.waitForTimeout(1500);

await page.screenshot({ path: OUT, type: 'png', fullPage: false });
await browser.close();
console.log(`Wrote ${OUT}`);
