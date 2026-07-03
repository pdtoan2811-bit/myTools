/**
 * Generate photoreal product images via the OpenAI Images API, matched to the
 * existing studio style. Key is read from design-hub/.env (git-ignored).
 *
 *   node scripts/gen-products.mjs                 # all missing catalog items
 *   node scripts/gen-products.mjs fashion-tote    # just these slugs (force)
 *
 * Saves to public/products/<slug>.png.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

// --- load .env (no dependency) ---
for (const line of fs.readFileSync(path.join(root, '.env'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (m) process.env[m[1]] = m[2];
}
const KEY = process.env.OPENAI_API_KEY;
const PRIMARY = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1';
if (!KEY) { console.error('Missing OPENAI_API_KEY in .env'); process.exit(1); }

const STYLE =
  'centered on a soft seamless warm light-grey (#e9e6e0) studio background, soft even diffused studio lighting, ' +
  'gentle natural contact shadow, photorealistic, ultra sharp focus, high detail, premium e-commerce product photography, ' +
  'no text, no logos, no people, no extra props, square 1:1 composition.';

// Fashion catalog (slug → subject)
const CATALOG = {
  'fashion-tote':       'a single structured tan pebbled-leather tote bag with two top handles, standing upright',
  'fashion-sweater':    'a single neatly folded oatmeal ribbed-knit wool sweater',
  'fashion-trench':     'a single beige cotton trench coat, neatly buttoned, shown flat-lay from above',
  'fashion-loafer':     'a single brown leather penny loafer shoe, side profile view',
  'fashion-denim':      'a single pair of folded indigo selvedge denim jeans',
  'fashion-scarf':      'a single softly folded camel-coloured wool scarf',
  'fashion-cap':        'a single structured ecru cotton baseball cap, three-quarter view',
  'fashion-sunglasses': 'a single pair of tortoiseshell acetate sunglasses, folded, front view',
};

const argv = process.argv.slice(2);
const slugs = argv.length ? argv : Object.keys(CATALOG);
const outDir = path.join(root, 'public', 'products');

async function generate(model, prompt) {
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt, size: '1024x1024', quality: 'high', n: 1 }),
  });
  return res;
}

for (const slug of slugs) {
  const subject = CATALOG[slug];
  if (!subject) { console.error(`! no catalog entry for "${slug}"`); continue; }
  if (!argv.length && fs.existsSync(path.join(outDir, `${slug}.png`))) { console.log(`· skip ${slug} (exists)`); continue; }

  const prompt = `${subject}, ${STYLE}`;
  let res = await generate(PRIMARY, prompt);
  if (!res.ok && PRIMARY !== 'gpt-image-1') {
    const t = await res.text();
    console.error(`  ${slug}: ${PRIMARY} failed (${res.status}) → falling back to gpt-image-1. ${t.slice(0, 200)}`);
    res = await generate('gpt-image-1', prompt);
  }
  if (!res.ok) { console.error(`✗ ${slug}: ${res.status} ${(await res.text()).slice(0, 300)}`); continue; }

  const data = await res.json();
  const d = data.data?.[0] || {};
  let buf;
  if (d.b64_json) buf = Buffer.from(d.b64_json, 'base64');
  else if (d.url) buf = Buffer.from(await (await fetch(d.url)).arrayBuffer());
  else { console.error(`✗ ${slug}: no image in response`); continue; }
  fs.writeFileSync(path.join(outDir, `${slug}.png`), buf);
  console.log(`✓ ${slug}.png  (${(buf.length / 1024).toFixed(0)} KB, model ${data.model || PRIMARY})`);
}
console.log('done');
