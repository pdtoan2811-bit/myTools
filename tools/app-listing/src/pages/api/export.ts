import type { APIRoute } from 'astro';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { SLIDES } from '../../lib/slides';

export const prerender = false;

/**
 * POST /api/export  { id?: string | 'all', supersample?: number }
 * Screenshots each slide's #canvas at `supersample`× then downscales with sharp
 * to the exact registry dimensions — crisp + spec-exact. Returns written paths.
 */
export const POST: APIRoute = async ({ request, url }) => {
  const body = await request.json().catch(() => ({} as any));
  const ss = Number(body.supersample) || 2;
  const ids =
    !body.id || body.id === 'all' ? SLIDES.map((s) => s.id) : [String(body.id)];

  const { chromium } = await import('playwright');
  const sharp = (await import('sharp')).default;

  const outDir = path.resolve(process.cwd(), 'exports');
  await mkdir(outDir, { recursive: true });

  const browser = await chromium.launch();
  const results: { id: string; file: string; w: number; h: number }[] = [];
  try {
    for (const id of ids) {
      const meta = SLIDES.find((s) => s.id === id);
      if (!meta) continue;
      const page = await browser.newPage({
        viewport: { width: meta.width, height: meta.height },
        deviceScaleFactor: ss,
      });
      await page.goto(`${url.origin}/render/${id}`, { waitUntil: 'networkidle' });
      await page.evaluate(() => (document as any).fonts.ready);
      const buf = await page.locator('#canvas').screenshot();
      const file = path.join(outDir, `${id}.png`);
      await sharp(buf).resize(meta.width, meta.height).png().toFile(file);
      await page.close();
      results.push({ id, file, w: meta.width, h: meta.height });
    }
  } finally {
    await browser.close();
  }

  return new Response(JSON.stringify({ ok: true, dir: outDir, results }), {
    headers: { 'content-type': 'application/json' },
  });
};
