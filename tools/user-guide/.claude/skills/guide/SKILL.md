---
name: guide
description: Build a full user guide (markdown + branded annotated screenshots) from a prompt + a running localhost app. Use when the user wants to "create a user guide", "document this feature", "write a how-to with screenshots", or to regenerate a step. Drives the userGuideSnap engine — captures the app with Playwright, proposes annotations, renders pixel-perfect images, and assembles guide.md for review in Guide Studio.
---

# /guide — Claude-driven user-guide factory

You author a **job spec** from the user's request, run the **worker** (capture → annotate →
render → assemble), then hand the draft to the user to review/edit in **Guide Studio**.
You do the work; the user reviews and edits.

## Workflow

1. **Clarify the inputs** (only what's missing): the feature/topic, the running app URL
   (default `http://localhost:<port>`), and the rough steps/screens. Confirm the app is
   running locally — if not, ask the user to start it (or start it yourself if you know how).
2. **Plan the steps.** One step per screen/action. For each: the page path to capture, a short
   heading, the prose `body` (markdown), optional `notes`, and proposed **annotations**.
3. **Write `jobs/<slug>/job.json`** using the schema below. Pick a kebab-case `slug`.
4. **One-time setup** (if Playwright isn't installed): `npm install && npm run setup`.
5. **Run the worker:** `node workers/guide-jobs/run.mjs jobs/<slug>`
   (it writes `guide.json`, `assets/*.png`, `guide.md`, `status.json`).
6. **Review the result yourself** (read `guide.md`, look at `assets/*.png`). Fix obvious
   annotation placement by editing `job.json` and re-running.
7. **Hand off:** tell the user to open **Guide Studio** (`npm run studio`) to review/edit the
   markdown and fine-tune annotations in the image editor, or to approve.
8. **Publish** to the app's guide site — a confirmed two-step sync (see below): `publish.mjs
   jobs/<slug>` lands it **locally** (committed, not pushed); `publish.mjs jobs/<slug> --push`
   takes it **online**.

To **regenerate one step**, edit that step in `job.json` and re-run. Use `--no-capture` to
re-render/assemble without re-screenshotting (faster when only annotations/prose changed).

## Publish to the guide site  📤

Once the draft is approved, publish it into the app's guide repo (a `qsortby-guide`-style Astro
docs site). The bridge transforms the job's `guide.md` + `assets/*.png` into that repo's shape —
`.mdx` frontmatter (`title`/`description`/`updated`/`draft`), drops the duplicate H1, rewrites
image paths to `/assets/<file>/…`, and converts `> **Tip:**` blockquotes to `<Callout>`.

- **Where it goes** is a per-job `publish` block in `job.json` (author it when you write the job):

  ```jsonc
  "publish": {
    "app": "qsortby",              // key in apps.config.mjs (registry of apps → guide repos)
    "section": "1-getting-started",// docs folder (numeric prefix orders sidebar groups)
    "order": 30,                   // page order within the section (steps of 10)
    "file": "quickstart",          // url slug + filename (→ 30-quickstart.mdx)
    "description": "One-line summary shown under the title and on home cards.",
    "draft": false                 // optional; true = excluded from the built site
  }
  ```

- **Confirmed two-step sync** (`rendered → local → online`). The registry (`apps.config.mjs`)
  gives each app a `guideRepo` clone and a target `branch` (qsortby → `apps/qsortby/guides` on
  `toanGuide`). Nothing reaches GitHub without an explicit second command:

  1. **LOCAL** — `node workers/guide-jobs/publish.mjs jobs/<slug>`
     Writes the `.mdx` + images into the clone, checks out the target branch, and **commits**
     there (not pushed). Records `jobs/<slug>/publish.json` → `stage: "local"`. Idempotent: if
     the branch already carries the guide, it just confirms and writes state (no empty commit).
  2. **Review** — `cd <guideRepo> && npm run dev` → preview at http://localhost:4321.
  3. **ONLINE** — `node workers/guide-jobs/publish.mjs jobs/<slug> --push`
     Pushes the branch to `origin/<branch>`. Records `stage: "online"`.

  Check progress any time: `... publish.mjs jobs/<slug> --status`. Other flags: `--dry` (preview,
  write nothing), `--no-git` (write files on the current branch, no commit/branch switch).

- **Onboarding another app:** add one entry to `apps.config.mjs` (`preset`, `devUrl`, `guideRepo`,
  `branch`) once its guide repo clone exists. No other changes — the same pipeline publishes to it.
  Only `qsortby` is wired today.

## job.json schema

```jsonc
{
  "title": "Set up auto-sort",          // human title (guide H1)
  "slug": "auto-sort-setup",            // kebab-case; drives filenames
  "bg": "light",                        // light | dark slide ground
  "baseUrl": "http://localhost:4178",   // the running app
  "viewport": { "width": 1200, "height": 760 },
  "storageState": "auth.json",          // OPTIONAL Playwright storage-state (relative to job dir) for logged-in capture
  "intro": "One or two sentences.",
  "steps": [
    {
      "n": 1,
      "heading": "Open Sort rules",
      "capture": {
        "path": "/admin/sort-rules",     // appended to baseUrl
        "wait": "networkidle",           // load|domcontentloaded|networkidle
        "fullPage": false,               // true = scroll-capture the whole page
        "selector": ".main",             // OPTIONAL capture just this element
        "actions": [                     // OPTIONAL pre-shot interactions
          { "click": "button.open" }, { "fill": { "selector": "#q", "value": "shoes" } }, { "wait": 300 }
        ]
      },
      "frame": { "chrome": "none", "zoom": 1 },   // OPTIONAL; screenshot auto-fits & centers if omitted
      "body": "Markdown prose for this step. **Bold**, *italic*, `code`, links all fine.",
      "notes": [{ "kind": "Tip", "text": "..." }],
      "els": [ /* annotation elements — see below */ ]
    }
  ],
  "outro": "Optional closing markdown."
}
```

## Accuracy: bind to selectors, don't guess pixels  ⭐

Anything that points AT, frames, magnifies, or redacts a **specific UI control** must use
`"at": "<css selector>"` — NOT hand-guessed `x/y`. During capture the worker reads that
element's real bounding box and places the annotation exactly on it (mapped from the live page
into the rendered image). Guessed coordinates drift and look off; selectors are pixel-accurate.

- Use `at` on **anchor, highlight, blur, magnifier** (and optionally **badge**). The worker
  sets their position/size from the element: anchors center on it, highlights/blur wrap it
  (+`pad`), magnifiers center on it and size to it.
- **callout** stays hand-placed (`x/y`) in **empty space** so it doesn't cover the UI — then
  point at the control with a **connector → an `at`-bound anchor**.
- Prefer stable selectors (ids, `[data-test]`, ARIA/role, unique text). If the app lacks them,
  ask the user to add an id, or fall back to approximate `x/y` (and tell the user it's a guess).
- The selector must exist on the page at capture time (after any `capture.actions`).
- Recommended pattern per step: one `callout` (empty space, `step:true`) + an `anchor {at}` +
  a `connector` from the callout to that anchor. Add a `magnifier {at}` to zoom a small detail,
  or a `highlight {at}` to frame a region.

## Annotation elements (`els`) — userGuideSnap model

For non-`at` elements, coordinates are **logical px in the canvas area ≈ 1128 × 660**, origin
top-left; the captured screenshot frame is auto-centered. Use `at` whenever an element targets a
real control (see above) — then omit `x/y`.

- **callout** — the primary explainer (liquid glass). `{ "type":"callout", "x","y", "w":280, "text":"<b>…</b> html ok", "kicker":"Step 1", "size":"s|m|l", "accent":false, "step":true }`. `step:true` shows an auto-numbered badge.
- **badge** — standalone numbered step bead. `{ "type":"badge", "x","y" }`.
- **anchor** — invisible target a connector points at. Give it an `id`. Bind to the control: `{ "type":"anchor", "id":"t1", "at":"#sort-strategy" }` (or `"x","y"` if no selector).
- **connector** — auto-routing arrow. `{ "type":"connector", "from":{"ref":"<calloutId>"}, "to":{"ref":"t1"}, "caps":"end|start|both|none", "route":"elbow|curved", "thickness":5, "curve":0.18 }`. The `from`/`to` `ref` must match another element's `id` **in the same step**.
- **highlight** — box ring around a UI region. `{ "type":"highlight", "at":"#save-btn", "pad":4 }` (or `"x","y","w","h"`).
- **pill** — small label. `{ "type":"pill", "x","y", "text":"New", "green":true }`.
- **magnifier** — glass loupe over a spot. `{ "type":"magnifier", "at":"#top-product", "mag":2.2, "shape":"circle|rect" }` (or `"x","y","w","h"`). Auto-centers & sizes to the element.
- **blur** — redaction patch. `{ "type":"blur", "at":".customer-email", "pad":2 }` (or `"x","y","w","h"`).

**Element ids:** if you omit `id`, the worker assigns `e<step>_<index>` (e.g. the first el of
step 1 is `e1_0`). When wiring a connector, either give the callout an explicit `id` and
reference it, or reference the auto id. Anchors you point at should always have an explicit `id`.

## Style notes
- Default to a single callout + a connector pointing at the exact control, plus `step:true`.
- Use a magnifier to emphasize a small UI detail; a highlight to frame a larger region.
- Keep prose imperative and short. One screenshot per step.
- The output matches the QSortby editorial-glass look automatically — don't restyle.
