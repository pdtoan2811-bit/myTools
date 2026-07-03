---
name: applisting-design
description: >-
  Design and export QSortby's Shopify App Store listing graphics (feature image
  + screenshots) using this standalone "Listing Studio" — an Astro + Playwright
  slide editor that renders product-led, glassmorphic graphics to spec-exact
  PNGs, with AI product-photo generation. Use for ANY app-listing / app-store /
  marketplace graphic work: feature banners, listing screenshots, app icon,
  creating/editing/restyling slides, generating product images, running the
  studio, or exporting PNGs.
---

# QSortby — Listing Studio (standalone tool)

A **self-contained** slide editor for Shopify App Store graphics. This whole repo
(`/Users/thomas/appListingTools`) IS the tool — it has no dependency on the
marketing site or any monorepo. It renders each "slide" to a spec-exact PNG with
Playwright, in the QSortby "editorial-glass" style. Design tokens, brand icon,
and fonts are **baked in** (`src/styles/`, `public/brand/`, `public/fonts/`).

## Scope

Everything in this repo is in scope. There is no monorepo to protect — edit
freely. Two things are git-ignored and must never be committed:
- `.env` (the OpenAI key) — keep secrets there; commit `.env.example` only.
- Generated output: `exports/*.png` and `public/products/*.png`.

## First-run — assets are NOT included, generate them

This tool ships **code only**. The 7 exported PNGs and the AI product photos are
NOT in the repo; regenerate them before the slides look complete:

```bash
npm run setup                          # once: npm install + playwright chromium
cp .env.example .env                   # then paste a real OPENAI_API_KEY
node scripts/gen-products.mjs          # generate the product photos → public/products/
npm run dev                            # http://localhost:4321 — studio (nav + live preview + export)
npm run export                         # render every slide → exports/*.png
```

## Everyday commands

```bash
npm run dev                                  # the studio, live preview + per-slide export
npm run export                               # render every slide → exports/*.png
npm run export -- screenshot-02-realtime     # one slide by id (note the `--`)
SS=3 npm run export                          # crisper supersample (default 2×, downscaled to exact size)
```

This tool uses **npm** (own lockfile). The export script is location-independent —
from elsewhere: `npm --prefix /Users/thomas/appListingTools run export -- <id>`.

## Current asset set (7 PNGs, all 1600×900)

`feature-image` (light) · `feature-image-dark` · `screenshot-01-auto-sort` ·
`screenshot-02-realtime` · `screenshot-03-soldout` · `screenshot-04-manual` ·
`screenshot-05-segments`. Registry: `src/lib/slides.ts` (one entry per slide;
`id` must equal `src/slides/<id>.astro`).

## How to add / edit a slide

1. Add/adjust the entry in `src/lib/slides.ts` (`id`, `title`, `group`, `note`,
   `width`, `height`).
2. Create/edit `src/slides/<id>.astro`. Compose with the components + CSS classes
   below. Screenshots wrap content in `<Frame>` (caption header); the feature
   banners are full-custom.
3. Preview in the studio (`npm run dev`) and export. Iterate on positions
   visually — Read the exported PNG and nudge coordinates.

## Building blocks

**Components** (`src/components/`):
- `Frame.astro` — screenshot caption header (eyebrow + headline + sub + step
  counter); app window/content goes in the default slot. Slots: `head`, `sub`.
- `Logo.astro` — brand lockup (mark + "QSortby" wordmark). `dark` prop flips it
  for dark grounds.
- `Mark.astro` — the official QSortby icon (from `public/brand/qs-icon.svg`).
  `tone`: `dark` (dark outline on light) / `light` (white outline on dark). Used
  by Logo, AppTag, and the sort pill — keep all marks going through this.
- `AppTag.astro` — slim "QSortby · <status> · live" tag (the LOW-WEIGHT nod to the
  app). `dark` prop for dark grounds.
- `Metric.astro` — glass stat card (label, value, up-delta, sub, sparkline).
  `dark` for dark grounds; `spark={false}` to hide the sparkline.
- (`Phone.astro`, `ProductCard.astro`, `Window.astro` exist but are **legacy /
  unused** by the current slides — ignore or repurpose.)

**Key CSS classes** (`src/styles/applisting.css`):
- Grounds: `.world` / `.world.dark`; `.bloom.g/.m/.w` (blurred color blobs behind glass).
- Glass: `.glass` (+ `.on-dark`), `.insight` (analyst card body), `.gpill` (glass pill).
- Product tile: `.sp` (`.spim` image, `.spb` badge, `.spd`+`.dchip` rank-delta,
  `.spr` rank circle, `.spnum` "#N", `.spname`, `.sprow`/`.spp`/`.sprate`,
  `.sp.lead` = highlighted #1). `.on-dark-grid` recolors tile text on dark.
- Mini data-viz (inside insight cards): `.vbars` (comparison bars), `.vspark`
  (sparkline), `.vdonut` (% donut); `.echart` (standalone editorial area chart).
- Accents: `.sortpill`, `.spotlight`, `.stamp` (sold-out), `.segcol`, `.platform`/`.ground` (contact shadows).

## Art direction — the rules (don't relearn these)

- **Products are the hero, not the dashboard.** Real product photos lead. The app
  appears only as a slim `AppTag` / `.sortpill` — keep app-interface weight LOW.
  Each slide *explains* its idea with an aesthetic composition (ranked lineup,
  trend chart, sold-out demotion, pinned launch, per-segment panels).
- **Analyst overlay.** Glass `.insight` cards sit ON the product photos and
  explain *why* it ranks, with mini data-viz ("Converts 2.3× avg", "Demand ↑40%",
  "22% of revenue"). This is the signature look.
- **⚠️ Glass must stay 2D.** `backdrop-filter` blur is SILENTLY DROPPED in the PNG
  export when the element is inside a 3D context (`perspective`/`preserve-3d`/
  `translateZ`) — verified with a probe. Position glass with plain `absolute`
  left/top, no transform, no 3D ancestor. Get depth from soft shadows + 2D
  `rotate()` on non-glass elements. Seat glass over a `.bloom`, a photo, or a tile
  so the frost has something to refract (it's ~invisible over flat white).
- **Movement = deltas.** Show sorting in motion with `.dchip` rank-change chips
  (↑6 / ↓2) and velocity bars on tiles.
- **Metrics are representative**, not performance claims — realistic store-dashboard
  numbers, no "QSortby gave you +X%" causation. Swap real data before publishing;
  Shopify rejects misleading stats. Tone: premium / editorial-calm.
- Don't float a stat alone in an empty corner (reads awkward) — anchor it to a
  product or fold it into a card that ties the composition together.

## Generating product images (OpenAI)

Photoreal product photos are generated to match the studio style.

```bash
node scripts/gen-products.mjs                 # all missing catalog items
node scripts/gen-products.mjs fashion-tote    # specific slugs (force re-gen)
```

- Key + model live in **`.env`** (git-ignored): `OPENAI_API_KEY`,
  `OPENAI_IMAGE_MODEL` (currently `gpt-image-2-2026-04-21`; script falls back to
  `gpt-image-1`). **Security:** never print the key; if the user pastes a key in
  chat, tell them to rotate it.
- The catalog (`CATALOG` in the script) maps `slug → subject`. The shared `STYLE`
  string keeps every image consistent: *centered on a soft warm light-grey studio
  background, soft diffused lighting, photorealistic, square, no text/people*.
- Images save to `public/products/<slug>.png`. Slugs are category-prefixed
  (`fashion-*`, `beauty-*`, `home-*`, `tech-*`, `food-*`). To add a category, add
  entries to `CATALOG` with that prefix and run the script.
- The current store theme is **fashion** (`fashion-*` slugs). Generation can take
  ~30–60s per image; run a small batch in the background and check
  `public/products/` for the written files (Node buffers stdout to the task file
  until exit).

## Shopify App Store specs

- **App icon** — 1200×1200 (official mark wired from `public/brand/qs-icon.svg` via `Mark.astro`)
- **Feature image** — 1600×900 (top-of-listing banner)
- **Screenshots** — 1600×900, up to ~6

## Pipeline internals (rarely needed)

`src/layouts/Canvas.astro` wraps a slide in one exact-pixel `#canvas`;
`canvas.css` freezes animations + backfills `--mono`/`--d-bg`. `render/[id].astro`
renders one slide; `api/export.ts` + `scripts/export.mjs` screenshot `#canvas` at
`SS`× then `sharp`-downscale to exact size.

**Refreshing tokens from the marketing site** (optional — tokens are baked in, do
this only when the site restyles): copy the site's tokens into this tool, then
re-export.
```bash
cp /Users/thomas/qdnNewWebsite/src/styles/global.css ./src/styles/global.css
cp /Users/thomas/qdnNewWebsite/src/styles/fonts.css  ./src/styles/fonts.css
cp /Users/thomas/qdnNewWebsite/tailwind.config.mjs   ./tailwind.config.mjs
```
