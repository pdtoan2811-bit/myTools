#!/usr/bin/env node
/* =====================================================================
   userGuideSnap — production export.
   Renders a guide JSON into pixel-perfect PNGs using headless Chromium,
   driving the SAME editor.html / tokens.css the editor uses — so the
   export is byte-for-byte what you see, with the glass `backdrop-filter`
   blur fully intact (impossible with in-browser SVG rasterization).

   Usage:
     node scripts/render.mjs [guide.json] [--out dir] [--scale 2] [--composite]
   Examples:
     node scripts/render.mjs samples/example-guide.json --composite
     node scripts/render.mjs my-guide.json --out exports --scale 3

   Playwright resolves from local node_modules after `npm install`.
   (Override for dev with PW=/abs/path/to/playwright.)
   ===================================================================== */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = __dir;   // this file lives at the package root (packages/userguidesnap)
const EDITOR = pathToFileURL(join(ROOT, 'src', 'editor.html')).href;

// ---- args ----------------------------------------------------------
const argv = process.argv.slice(2);
const flags = {};
const positional = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--composite') flags.composite = true;
  else if (a === '--out') flags.out = argv[++i];
  else if (a === '--scale') flags.scale = +argv[++i];
  else positional.push(a);
}
const input = positional[0] || join(ROOT, 'samples', 'example-guide.json');
const outDir = resolve(ROOT, flags.out || 'exports');
const scale = flags.scale || 2;

const guide = JSON.parse(readFileSync(input, 'utf8'));
const slug = (guide.slug || guide.title || 'guide').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

// ---- playwright (local install, or PW=/abs override for dev) --------
const pwSpec = process.env.PW || 'playwright';
const pw = await import(pwSpec).then((m) => m.default || m);

const browser = await pw.chromium.launch();
const page = await browser.newPage({ viewport: { width: 1360, height: 880 }, deviceScaleFactor: scale });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

// seed the guide before any script runs, then load the real editor
await page.addInitScript((g) => localStorage.setItem('ugs_guide', JSON.stringify(g)), guide);
await page.goto(EDITOR, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts && document.fonts.ready);
await page.evaluate(() => window.__ugs.renderMode());

const n = await page.evaluate(() => window.__ugs.slideCount());
const files = [];
for (let i = 0; i < n; i++) {
  await page.evaluate((idx) => window.__ugs.gotoSlide(idx), i);
  await page.evaluate(() => window.__ugs.renderMode());
  await page.waitForTimeout(120);
  const name = `${slug}-step-${String(i + 1).padStart(2, '0')}.png`;
  const file = join(outDir, name);
  await (await page.$('#stage')).screenshot({ path: file });
  files.push(file);
  console.log(`  ✓ ${name}`);
}

// ---- optional stacked contact sheet --------------------------------
if (flags.composite && files.length) {
  const imgs = files.map((f) => 'data:image/png;base64,' + readFileSync(f).toString('base64'));
  const gap = 28, W = 1280;
  await page.setViewportSize({ width: W, height: (800 * files.length) + gap * (files.length + 1) });
  await page.setContent(
    `<body style="margin:0;background:#eceae6;display:flex;flex-direction:column;gap:${gap}px;padding:${gap}px">
       ${imgs.map((s) => `<img src="${s}" style="width:${W}px;display:block;border-radius:10px;box-shadow:0 20px 50px -24px rgba(16,24,40,.5)">`).join('')}
     </body>`,
    { waitUntil: 'networkidle' },
  );
  const composite = join(outDir, `${slug}-all.png`);
  await page.screenshot({ path: composite, fullPage: true });
  console.log(`  ✓ ${slug}-all.png (stacked composite)`);
}

await browser.close();
console.log(`\nRendered ${files.length} slide(s) → ${outDir}`);
if (errors.length) { console.error('page errors:', errors); process.exit(1); }
