---
description: Work on the actual product APP for a QSortby app (Remix/turbo monorepo — dashboard/admin/api).
argument-hint: "[app]  (default: qsortby)"
---

You are starting a **product app** session.

## 1. Resolve the app
- App name = `$ARGUMENTS` if provided, otherwise `qsortby`.
- Confirm it exists in `workspace.json` under `apps`. If not, read that file, list the
  available apps, and stop.
- Repo: `apps/<app>/app` (branch `toanQsenseApp` for qsortby) — the real Remix/turbo monorepo.

## 2. Load the how-to
- Read `apps/<app>/app/CLAUDE.md` — this is the full identity, architecture, scope, and run
  guidance for the app (it is large and authoritative). Follow it.

**Scope guardrail:** stay inside `apps/<app>/app`. The app never edits the website, guide, or
tools.
