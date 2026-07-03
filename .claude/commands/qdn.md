---
description: Show the QDN workspace routing — which slash command opens which repo/tool, for which app.
---

Read `workspace.json` and `CLAUDE.md` at the workspace root, then show the user this routing
map (fill in the real app list from `workspace.json` → `apps`):

**Per-app slash commands** (all take an optional `[app]`, default `qsortby`):

| Command | Opens | Repo / path | Branch |
| --- | --- | --- | --- |
| `/app [app]`        | product app (Remix monorepo)      | `apps/<app>/app`               | `toanQsenseApp` |
| `/website [app]`    | marketing website (Astro)         | `apps/<app>/website`           | `toanWebsite` |
| `/guide [app]`      | user-guide tool (userGuideSnap)   | `apps/<app>/tools/user-guide`  | publishes → `apps/<app>/guides` (`toanGuide`) |
| `/applisting [app]` | app-listing tool (Listing Studio) | `apps/<app>/tools/app-listing` | — |

Notes:
- Tools have a **canonical** source in `tools/<tool>` (edit there for tool fixes, then
  `node tools/sync-tools.mjs`) and a **per-app working copy** in `apps/<app>/tools/<tool>`
  (run there for real work).
- Then briefly ask which one the user wants to start.
