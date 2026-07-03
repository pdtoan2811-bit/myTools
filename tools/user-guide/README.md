# userGuideSnap — Claude-driven user-guide factory

A monorepo that turns **a prompt + a running localhost app** into a **full user guide**
(markdown + branded, annotated screenshots) — authored by **Claude Code**, reviewed and
edited by you. Guides match the QSortby "editorial-glass" style automatically.

```
packages/userguidesnap/   the engine — the image editor, the Chrome extension, and the
                          Playwright render pipeline (render.mjs). Guides render byte-for-byte.
apps/guide-studio/        review app — job board + markdown split editor (edit ⇆ live render)
                          + one-click "Edit images" (opens the editor on the job) + Re-render.
workers/guide-jobs/       the runner Claude drives: capture localhost → annotate → render → assemble.
jobs/<slug>/              one guide = one folder: job.json (spec) · guide.json (project) ·
                          guide.md (prose) · assets/*.png (final images) · status.json.
apps.config.mjs           app registry: each app → { preset, devUrl, guideRepo } for publishing.
workers/guide-jobs/publish.mjs  the bridge: a finished job → a page in the app's guide repo.
.claude/skills/guide/     the /guide skill — how Claude authors a job and runs the worker.
```

## The loop

1. **You:** in Claude Code, `/guide` — "document how to set up auto-sort, app on localhost:4178".
2. **Claude:** plans steps, writes `jobs/auto-sort-setup/job.json` (capture paths + prose +
   proposed annotations), runs the worker.
3. **Worker:** drives Playwright to **capture** each screen, builds a userGuideSnap project,
   **renders** pixel-perfect annotated PNGs, and **assembles** `guide.md`.
4. **You:** open **Guide Studio**, review the markdown (live preview), tweak prose, and click
   **Edit images** to fine-tune annotations in the visual editor → **Save to job** → **Re-render**.
5. **Publish:** `node workers/guide-jobs/publish.mjs jobs/<slug>` transforms the job into an
   `.mdx` page + images and lands it on a `guide/<file>` branch in the app's guide repo (staged,
   for you to review → commit → PR). Placement lives in a per-job `publish` block; targets live in
   `apps.config.mjs`. See **Publish to the guide site** in `.claude/skills/guide/SKILL.md`.

## Run it

```bash
npm install
npm run setup                 # installs the Chromium browser for Playwright (one-time)

# author + build a guide (Claude Code does this via /guide; manually:)
node workers/guide-jobs/fixtures/serve.mjs        # demo target app on :4178 (your real app instead)
node workers/guide-jobs/run.mjs jobs/auto-sort-setup

# review & edit
npm run studio                # Guide Studio at http://localhost:4319
```

Worker modes: full (default) · `--no-capture` (rebuild from `job.json`, keep screenshots) ·
`--from-guide` (re-render an image-editor-edited `guide.json`, used by Studio's Re-render).

## The engine (`packages/userguidesnap`)
The standalone editor + Chrome extension + renderer — see its own docs. Load the extension from
`packages/userguidesnap/` (`manifest.json`); render a guide with
`node packages/userguidesnap/render.mjs <guide.json>`. The QSortby glass style, components
(callout, connector, magnifier, badge, highlight, pill, blur, anchor), liquid glass, projects,
and optional headers all live here.

## Status
MVP backbone, verified end-to-end (localhost capture → annotated render → markdown assemble →
Studio review → image-editor round-trip → **publish to the guide site**). Next: per-step
"regenerate with note" UI, login/auth capture (`storageState`), and job-board live status.
