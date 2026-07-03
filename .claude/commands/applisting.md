---
description: Work on the app-listing (Listing Studio) tool for a QSortby app — design/export Shopify App Store graphics.
argument-hint: "[app]  (default: qsortby)"
---

You are starting an **app-listing** session with the `app-listing` (Listing Studio) tool.

## 1. Resolve the app
- App name = `$ARGUMENTS` if provided, otherwise `qsortby`.
- Confirm it exists in `workspace.json` under `apps`. If not, read that file, list the
  available apps, and stop.
- **Work in the per-app copy:** `apps/<app>/tools/app-listing` — a self-contained Astro +
  Playwright slide editor that exports spec-exact PNGs for that app's App Store listing.
- Only touch canonical `tools/app-listing` if you're fixing the **tool itself**; after any
  canonical edit run `node tools/sync-tools.mjs`.

## 2. Load the deep how-to (read these, then follow the skill)
1. `apps/<app>/tools/app-listing/.claude/skills/applisting-design/SKILL.md` — the full
   slide/design/export workflow and the editorial-glass style spec. Follow it.
2. `apps/<app>/tools/app-listing/CLAUDE.md` — identity + scope.

## 3. Prereqs
- If `apps/<app>/tools/app-listing/node_modules` is missing, run `npm install && npm run setup`
  inside that directory.
- Run the studio with `npm run dev`; export PNGs with `npm run export`.

## 4. Then
Follow the `applisting-design` skill: pick/create the slides (feature image, screenshots, icon)
→ edit in the studio → render to spec-exact PNGs → export.

**Scope guardrail:** stay inside `apps/<app>/tools/app-listing`. This tool is standalone — do
not edit the app, website, or guide repos.
