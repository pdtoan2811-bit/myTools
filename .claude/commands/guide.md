---
description: Work on the user-guide (userGuideSnap) tool for a QSortby app — author, regenerate, or publish a user guide.
argument-hint: "[app]  (default: qsortby)"
---

You are starting a **user-guide** session with the `user-guide` tool.

## 1. Resolve the app
- App name = `$ARGUMENTS` if provided, otherwise `qsortby`.
- Confirm it exists in `workspace.json` under `apps`. If not, read that file, list the
  available apps, and stop.
- **Work in the per-app copy:** `apps/<app>/tools/user-guide` — RUN it here; it captures the
  app and publishes `.mdx` into that app's guide repo (`apps/<app>/guides`).
- Only touch canonical `tools/user-guide` if you're fixing the **tool itself**; after any
  canonical edit run `node tools/sync-tools.mjs`.

## 2. Load the deep how-to (read these, then follow the skill)
1. `apps/<app>/tools/user-guide/.claude/skills/guide/SKILL.md` — the full capture → annotate →
   render → assemble → publish workflow. Follow it.
2. `apps/<app>/tools/user-guide/CLAUDE.md` — identity + scope.
3. `apps/<app>/tools/user-guide/apps.config.mjs` — the app's capture URL and publish target.

## 3. Prereqs
- If `apps/<app>/tools/user-guide/node_modules` is missing, run `npm install && npm run setup`
  inside that directory.
- The target app must be running locally at the URL from `apps.config.mjs` before you capture.
  If it isn't, ask the user to start it (or start it if you know how).

## 4. Then
Follow the `guide` skill: clarify the topic/steps → write `jobs/<slug>/job.json` →
`node workers/guide-jobs/run.mjs jobs/<slug>` → review `guide.md` + `assets/*.png` → hand off to
Guide Studio (`npm run studio`) → publish with `node workers/guide-jobs/publish.mjs jobs/<slug>`.

**Scope guardrail:** stay inside `apps/<app>/tools/user-guide` and the app's guide repo
(`apps/<app>/guides`, branch `toanGuide`). Do not edit the app or website code.
