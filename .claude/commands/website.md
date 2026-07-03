---
description: Work on the marketing WEBSITE for a QSortby app (Astro site) — pages, styling, design system.
argument-hint: "[app]  (default: qsortby)"
---

You are starting a **website** session.

## 1. Resolve the app
- App name = `$ARGUMENTS` if provided, otherwise `qsortby`.
- Confirm it exists in `workspace.json` under `apps`. If not, read that file, list the
  available apps, and stop.
- Repo: `apps/<app>/website` (branch `toanWebsite`) — the standalone Astro marketing site.

## 2. Load the how-to (read these, then follow the skills)
1. `apps/<app>/website/CLAUDE.md` — identity + scope + run command.
2. `apps/<app>/website/.claude/skills/website/SKILL.md` — building/editing pages.
3. `apps/<app>/website/.claude/skills/website-design-system/SKILL.md` — the brand/design tokens.

## 3. Run
- `pnpm install && pnpm dev` inside `apps/<app>/website` → http://localhost:4321.

**Scope guardrail:** stay inside `apps/<app>/website`. The website never edits the app, guide,
or tools.
