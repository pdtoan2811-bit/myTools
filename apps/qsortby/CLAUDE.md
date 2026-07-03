# qsortby (aka qsense / QSortby) — app map

One app, four parts. Workspace root map: [`../../CLAUDE.md`](../../CLAUDE.md).

| Part | Folder | Repo · branch | What it is |
| --- | --- | --- | --- |
| **app** | `app/` | `qdndigital/qsense` · `toanQsenseApp` | The product — Remix/turbo monorepo (`apps/{dashboard,admin,api,intelligence}`). |
| **website** | `website/` | `qdndigital/qsortby-web` · `toanWebsite` | Astro marketing site. |
| **guides** | `guides/` | `qdndigital/qsortby-guide` · `guide/quickstart` | Astro docs/guide hub — publish target of the user-guide tool. |
| **tools** | `tools/app-listing`, `tools/user-guide` | (synced copies) | This app's working copies of the shared tools. |

## Relationships

- The **website** describes the **app** — keep copy accurate to what `app/` actually does
  (read `app/`, never edit it from the website).
- The **user-guide** tool captures the running **app** and publishes `.mdx` into **guides/**
  (see the tool's `guide` skill + `apps.config.mjs`).
- The **app-listing** tool renders Shopify App Store graphics for this app.
- Personal fork of the app: `~/qdnQsense` (`pdtoan2811-bit/qsortby`) — separate checkout.

## Rule

Stay within the part you're asked to work on. Cross-part reads are fine; cross-part edits
are not without asking.
