#!/usr/bin/env node
/* =====================================================================
   guide-jobs — the runner Claude Code drives to build a full guide.

   Given a job folder (jobs/<slug>/job.json authored by Claude), it:
     1. drives Playwright to navigate the running localhost app and
        CAPTURE each step's screenshot,
     2. assembles a userGuideSnap project (guide.json) with the captures
        + Claude's proposed annotations,
     3. RENDERS pixel-perfect annotated PNGs via the userGuideSnap engine,
     4. ASSEMBLES guide.md (prose + embedded images) for review.

   Usage:  node workers/guide-jobs/run.mjs jobs/<slug>            (full)
           node workers/guide-jobs/run.mjs jobs/<slug> --no-capture  (re-render/assemble only)
   Dev:    PW=/abs/path/to/playwright  (override Playwright resolution)
   ===================================================================== */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { dirname, resolve, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dir, '..', '..');
const ENGINE = join(ROOT, 'packages', 'userguidesnap');
const EDITOR = pathToFileURL(join(ENGINE, 'src', 'editor.html')).href;
const PW = process.env.PW || 'playwright';

const argv = process.argv.slice(2);
const jobArg = argv.find((a) => !a.startsWith('--'));
const noCapture = argv.includes('--no-capture');
const fromGuide = argv.includes('--from-guide');   // re-render an image-editor-edited guide.json (don't rebuild from job.json)
if (!jobArg) { console.error('usage: run.mjs jobs/<slug> [--no-capture]'); process.exit(1); }
const jobDir = resolve(ROOT, jobArg);
const job = JSON.parse(readFileSync(join(jobDir, 'job.json'), 'utf8'));
const assetsDir = join(jobDir, 'assets');
const capturesDir = join(jobDir, 'captures');
mkdirSync(assetsDir, { recursive: true }); mkdirSync(capturesDir, { recursive: true });

const slug = (job.slug || job.title || 'guide').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const pngSize = (buf) => ({ w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) });
const status = (state, extra = {}) => writeFileSync(join(jobDir, 'status.json'), JSON.stringify({ state, slug, updatedAt: new Date().toISOString(), ...extra }, null, 2));

// ---- 1. capture -----------------------------------------------------------
async function capture() {
  const pw = await import(PW).then((m) => m.default || m);
  const vp = job.viewport || { width: 1280, height: 800 };
  const browser = await pw.chromium.launch();
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 2, storageState: job.storageState ? join(jobDir, job.storageState) : undefined });
  const page = await ctx.newPage();
  for (const step of job.steps) {
    if (!step.capture) continue;
    const url = (job.baseUrl || '') + (step.capture.path || '');
    status('capturing', { step: step.n, url });
    await page.goto(url, { waitUntil: step.capture.wait || 'networkidle' });
    for (const a of step.capture.actions || []) {            // optional pre-shot interactions
      if (a.click) await page.click(a.click).catch(() => {});
      if (a.fill) await page.fill(a.fill.selector, a.fill.value).catch(() => {});
      if (a.wait) await page.waitForTimeout(a.wait);
    }
    // record the coordinate space of the capture + the live box of every selector-bound annotation,
    // so annotations land EXACTLY on the real UI element instead of guessed coordinates
    await page.evaluate(() => window.scrollTo(0, 0));
    const clipEl = step.capture.selector ? await page.$(step.capture.selector) : null;
    if (clipEl) { const b = await clipEl.boundingBox(); step.__space = { x: b.x, y: b.y, w: b.width, h: b.height }; }
    else if (step.capture.fullPage) { const h = await page.evaluate(() => document.documentElement.scrollHeight); step.__space = { x: 0, y: 0, w: vp.width, h }; }
    else step.__space = { x: 0, y: 0, w: vp.width, h: vp.height };
    for (const el of step.els || []) {
      if (!el.at) continue;
      const h = await page.$(el.at);
      const bb = h && await h.boundingBox();
      if (bb) el.__box = { x: bb.x, y: bb.y, w: bb.width, h: bb.height };
      else console.warn(`  ⚠ step ${step.n}: selector "${el.at}" not found — annotation will use fallback coords`);
    }
    const buf = clipEl ? await clipEl.screenshot() : await page.screenshot({ fullPage: !!step.capture.fullPage });
    writeFileSync(join(capturesDir, `step-${String(step.n).padStart(2, '0')}.png`), buf);
  }
  await browser.close();
}

// ---- 2. assemble the userGuideSnap project (guide.json) -------------------
function buildGuide() {
  // logical canvas-area size (stage 1280x800 minus padding, no header)
  const CW = 1128, CH = 660;
  const slides = job.steps.map((step) => {
    const capPath = join(capturesDir, `step-${String(step.n).padStart(2, '0')}.png`);
    let frameEl = null;
    if (existsSync(capPath)) {
      const buf = readFileSync(capPath); const { w: nw, h: nh } = pngSize(buf);
      const fit = Math.min((CW * 0.96) / nw, (CH * 0.96) / nh);
      const w = Math.round(nw * fit), h = Math.round(nh * fit);
      const f = step.frame || {};
      frameEl = {
        id: 'f' + step.n, type: 'frame',
        x: f.x ?? Math.round((CW - w) / 2), y: f.y ?? Math.round((CH - h) / 2),
        w: f.w ?? w, h: f.h ?? h, src: 'data:image/png;base64,' + buf.toString('base64'),
        chrome: f.chrome || 'none', url: f.url || '', zoom: f.zoom || 1, panX: f.panX || 0, panY: f.panY || 0, natW: 0, natH: 0,
      };
    }
    const els = (step.els || []).map((e, i) => {
      const el = { id: e.id || `e${step.n}_${i}`, ...e };
      // place selector-bound annotations exactly on the real element (mapped capture-space → canvas)
      if (el.at && el.__box && frameEl && step.__space) {
        const sp = step.__space, b = el.__box;
        const r = {
          x: frameEl.x + ((b.x - sp.x) / sp.w) * frameEl.w,
          y: frameEl.y + ((b.y - sp.y) / sp.h) * frameEl.h,
          w: (b.w / sp.w) * frameEl.w, h: (b.h / sp.h) * frameEl.h,
        };
        const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
        if (el.type === 'anchor') { const s = el.w || 30; el.x = Math.round(cx - s / 2); el.y = Math.round(cy - s / 2); el.w = s; el.h = el.h || s; }
        else if (el.type === 'highlight' || el.type === 'blur') { const p = el.pad ?? 6; el.x = Math.round(r.x - p); el.y = Math.round(r.y - p); el.w = Math.round(r.w + 2 * p); el.h = Math.round(r.h + 2 * p); }
        else if (el.type === 'magnifier') { const sz = el.w || Math.round(Math.max(140, Math.min(240, Math.max(r.w, r.h) * 1.8))); el.x = Math.round(cx - sz / 2); el.y = Math.round(cy - sz / 2); el.w = sz; el.h = sz; }
        else if (el.type === 'badge') { el.x = Math.round(r.x - 12); el.y = Math.round(r.y - 12); }
        else { el.x = Math.round(cx); el.y = Math.round(cy); }
      }
      if (el.x == null) el.x = 480; if (el.y == null) el.y = 240;
      delete el.at; delete el.__box;
      return el;
    });
    return {
      id: 's' + step.n, caption: !!step.caption,
      eyebrow: step.eyebrow || job.eyebrow || 'Getting started',
      head: step.heading || '', sub: step.sub || '',
      els: [frameEl, ...els].filter(Boolean),
    };
  });
  const guide = { title: job.title, slug, bg: job.bg || 'light', activeId: slides[0]?.id, slides };
  writeFileSync(join(jobDir, 'guide.json'), JSON.stringify(guide, null, 2));
  return guide;
}

// ---- 3. render annotated PNGs via the engine ------------------------------
function render() {
  status('rendering');
  const r = spawnSync('node', [join(ENGINE, 'render.mjs'), join(jobDir, 'guide.json'), '--out', assetsDir, '--scale', '2'],
    { stdio: 'inherit', env: process.env });
  if (r.status !== 0) throw new Error('render failed');
}

// ---- 4. assemble guide.md -------------------------------------------------
function assemble() {
  status('assembling');
  const lines = [];
  lines.push('---', `title: ${JSON.stringify(job.title)}`, `slug: ${slug}`, `generated: ${new Date().toISOString()}`, 'status: draft', '---', '');
  lines.push(`# ${job.title}`, '');
  if (job.intro) lines.push(job.intro, '');
  for (const step of job.steps) {
    const img = `${slug}-step-${String(job.steps.indexOf(step) + 1).padStart(2, '0')}.png`;
    lines.push(`## ${step.n}. ${step.heading || ''}`.trim(), '');
    if (existsSync(join(assetsDir, img))) lines.push(`![${(step.heading || 'step').replace(/[[\]]/g, '')}](assets/${img})`, '');
    if (step.body) lines.push(step.body.trim(), '');
    for (const note of step.notes || []) lines.push(`> **${note.kind || 'Note'}:** ${note.text}`, '');
  }
  if (job.outro) lines.push(job.outro, '');
  writeFileSync(join(jobDir, 'guide.md'), lines.join('\n'));
}

// ---- run ------------------------------------------------------------------
(async () => {
  try {
    if (!noCapture && !fromGuide) await capture();
    if (!fromGuide) buildGuide();   // --from-guide keeps the (image-editor-edited) guide.json as-is
    render();
    assemble();
    status('ready', { md: 'guide.md', project: 'guide.json', images: readdirSync(assetsDir).filter((f) => f.endsWith('.png')).length });
    console.log(`\n✅ ${slug}: draft ready → ${relative(ROOT, join(jobDir, 'guide.md'))}  (open guide.json in the editor to refine)`);
  } catch (e) {
    status('error', { error: String(e && e.message || e) });
    console.error('❌ job failed:', e); process.exit(1);
  }
})();
