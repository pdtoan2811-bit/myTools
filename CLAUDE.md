# QDN workspace — master map

This is the root of all QDN / QSortby work. It groups **by app**, with shared tooling at
the top. The machine-readable source of truth is [`workspace.json`](workspace.json); this
file is the human/AI-readable projection of it. **If they disagree, `workspace.json` wins —
update both.**

> 📦 **This workspace root IS the `myTools` repo** (`pdtoan2811-bit/myTools`, branch `main`).
> It tracks the canonical `tools/` and workspace glue only. App **content**
> (`apps/*/{app,website,guides}`) is git-ignored here — each lives in its own repo on its own
> `toan*` branch. Per-app tool copies (`apps/*/tools`) are ignored too (regenerate with
> `sync-tools.mjs`). See [`.gitignore`](.gitignore).

> ⚠️ Folder names here (and in the old `~/` layout) have historically misled — e.g. the old
> `~/QSortby-website` was actually the *app*, not the site. Trust the `CLAUDE.md` identity
> header inside each repo, not the folder name.

## Layout

```
~/qdn/
  tools/                     # CANONICAL shared tools — edit these
    app-listing/             # Listing Studio (Shopify listing graphics) · skill: applisting-design
    user-guide/              # userGuideSnap guide factory · skill: guide
    sync-tools.mjs           # push canonical tools → each app's working copy
    scaffold-app.mjs         # create a new app skeleton (app/website/guides/tools + CLAUDE.md)
    _template-app/           # the skeleton scaffold-app copies
  apps/
    qsortby/                 # one app = one folder (see its CLAUDE.md)
      app/                   # the product
      website/               # the marketing site
      guides/                # the docs/guide hub
      tools/                 # per-app working copies of the shared tools (synced)
  workspace.json             # registry (source of truth for scripts)
```

## Apps

| App | Part | Folder | Repo · branch |
| --- | --- | --- | --- |
| **qsortby** (aka qsense/QSortby) | app | `apps/qsortby/app` | `qdndigital/qsense` · `toanQsenseApp` |
| | website | `apps/qsortby/website` | `qdndigital/qsortby-web` · `toanWebsite` |
| | guides | `apps/qsortby/guides` | `qdndigital/qsortby-guide` · `toanGuide` |

_Personal app fork: `~/qdnQsense` (`pdtoan2811-bit/qsortby`) — not under `~/qdn`._

## Slash commands (routing)

Run from the workspace root. Each takes an optional `[app]` (defaults to `qsortby`) and drops
you into the right repo/tool with its skill + scope guardrail loaded. Defined in
[`.claude/commands/`](.claude/commands).

| Command | Opens | Path | Branch |
| --- | --- | --- | --- |
| `/app [app]`        | product app (Remix monorepo)      | `apps/<app>/app`               | `toanQsenseApp` |
| `/website [app]`    | marketing website (Astro)         | `apps/<app>/website`           | `toanWebsite` |
| `/guide [app]`      | user-guide tool (userGuideSnap)   | `apps/<app>/tools/user-guide`  | publishes → `apps/<app>/guides` (`toanGuide`) |
| `/applisting [app]` | app-listing tool (Listing Studio) | `apps/<app>/tools/app-listing` | — |
| `/qdn`              | prints this routing map           | —                              | — |

## Tool model (canonical → per-app copies)

You improve a tool **once** in `tools/<tool>`, then run `node tools/sync-tools.mjs` to push
it into every app's `apps/<app>/tools/<tool>` working copy. Apps stay self-contained and
runnable on their own; fixes don't silently drift. Never hand-edit a per-app copy expecting
it to be canonical — it will be overwritten on the next sync.

## Adding a new app

`node tools/scaffold-app.mjs <app-name>` creates `apps/<app>/{app,website,guides,tools}` with
CLAUDE.md stubs and synced tool copies, and adds a `workspace.json` entry. Then clone/copy the
app's real repos into `app/`, `website/`, `guides/` and fill in each identity header.

## Conventions

- **Scope:** work stays inside the repo you're asked to touch. The website never edits the
  app; a tool never edits the app it documents. Each repo's `CLAUDE.md` states its guardrail.
- **Secrets:** `.env` files are git-ignored per repo; never copy or commit them.
- **Skills** carry the deep how-to (`website`, `website-design-system`, `applisting-design`,
  `guide`); `CLAUDE.md` carries only identity + scope + run so it's cheap to always load.
