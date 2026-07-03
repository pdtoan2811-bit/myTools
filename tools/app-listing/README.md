# QSortby — Listing Studio

A **standalone, self-contained** slide editor for **Shopify App Store listing
graphics**. It renders each slide to a spec-exact PNG with Playwright in the
QSortby "editorial-glass" style. This whole repo *is* the tool — it has no
dependency on the marketing site or any monorepo; design tokens, brand icon, and
fonts are baked in.

> Driven by the `applisting-design` skill (`.claude/skills/applisting-design/`).
> Ask Claude Code: *"add a screenshot slide for the analytics view"*, *"make the
> feature image headline bolder"*, *"export all listing graphics"*.

## First run

This repo ships **code only** — the exported PNGs and the AI product photos are
git-ignored and regenerated locally:

```bash
npm run setup                    # once — installs deps + Playwright's chromium
cp .env.example .env             # then paste a real OPENAI_API_KEY
node scripts/gen-products.mjs    # generate product photos → public/products/
npm run dev                      # http://localhost:4321 → the studio
```

In the studio: pick a slide on the left, see it live, hit **Export PNG** (one) or
**Export all**. Files land in `exports/`.

Prefer the CLI?

```bash
npm run export                 # all slides → exports/*.png
npm run export feature-image   # one slide by id
SS=3 npm run export            # crisper (renders 3×, downscales to exact size)
```

## What's here

| Slide | id | Size |
| --- | --- | --- |
| Feature image (light) | `feature-image` | 1600×900 |
| Feature image (dark glass) | `feature-image-dark` | 1600×900 |
| 01 · Best sellers meet shoppers first | `screenshot-01-auto-sort` | 1600×900 |
| 02 · Catch every trend live | `screenshot-02-realtime` | 1600×900 |
| 03 · Never dead-end a shopper | `screenshot-03-soldout` | 1600×900 |
| 04 · Launches that land | `screenshot-04-manual` | 1600×900 |
| 05 · Right order for every audience | `screenshot-05-segments` | 1600×900 |

Edit the registry in `src/lib/slides.ts`; each `id` maps to `src/slides/<id>.astro`.

## Art direction — "product-led editorial"

The hero of every slide is the **real product + the narrative**, not the
dashboard. White (or dark) editorial ground with emerald **blooms** behind
frosted **glass** stats; the app shows up only as a slim `AppTag`. Each slide
*explains* its idea with an aesthetic composition — a product podium (auto-sort),
a trend chart with the hero product (real-time), a stamped sold-out demotion, a
spotlit pinned launch, per-segment columns. Classes live in `src/styles/applisting.css`.

> ⚠️ **Glass must stay 2D.** `backdrop-filter` blur is dropped in the PNG export
> if the element is inside a 3D context (`perspective`/`preserve-3d`/`translateZ`).
> Keep glass on plain `absolute` positioning; get depth from shadows + 2D rotate.

> ⚠️ Metric numbers are **representative** dashboard values, not performance
> claims — swap in real store data before publishing (Shopify bans misleading
> stats).

## Notes

- The official QSortby mark lives at `public/brand/qs-icon.svg` and is rendered by
  `Mark.astro` — used in the `Logo` lockup, the `AppTag`, and the sort pill.
- Design tokens & fonts are **baked in** (`src/styles/`, `public/fonts/`). They
  can be refreshed from the marketing site when it restyles — see the
  `applisting-design` skill.
- Uses **npm** (own lockfile) — `.env` and generated PNGs are git-ignored.
