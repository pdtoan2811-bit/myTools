/**
 * Standalone exporter — `npm run export [slideId]`.
 * Boots a transient Astro dev server, screenshots every slide (or one) at
 * `SS`× supersample, downscales to exact spec dimensions with sharp, writes
 * to ./exports, then shuts the server down.
 *
 *   npm run export                  # all slides
 *   npm run export feature-image    # one slide
 *   SS=3 npm run export             # crisper supersample
 */
import { dev } from 'astro';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const only = process.argv[2];
const ss = Number(process.env.SS) || 2;

const server = await dev({ root, logLevel: 'error' });
const base = `http://localhost:${server.address.port}`;

const slides = await (await fetch(`${base}/api/slides`)).json();
const targets = only ? slides.filter((s) => s.id === only) : slides;
if (only && targets.length === 0) {
  console.error(`No slide with id "${only}". Known: ${slides.map((s) => s.id).join(', ')}`);
  await server.stop();
  process.exit(1);
}

const outDir = path.join(root, 'exports');
await mkdir(outDir, { recursive: true });

const browser = await chromium.launch();
for (const s of targets) {
  const page = await browser.newPage({
    viewport: { width: s.width, height: s.height },
    deviceScaleFactor: ss,
  });
  await page.goto(`${base}/render/${s.id}`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  const buf = await page.locator('#canvas').screenshot();
  const file = path.join(outDir, `${s.id}.png`);
  await sharp(buf).resize(s.width, s.height).png().toFile(file);
  await page.close();
  console.log(`✓ exports/${s.id}.png  ${s.width}×${s.height} (rendered @${ss}x)`);
}
await browser.close();
await server.stop();
console.log(`\nDone → ${outDir}`);
process.exit(0);
