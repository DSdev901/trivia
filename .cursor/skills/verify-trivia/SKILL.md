---
name: verify-trivia
description: Drive the General Trivia static web app locally (home, hash-routed categories, quiz) and prove user-visible behavior. Use after UI or routing changes, or when a trivia PR needs runtime evidence.
---

# Verify General Trivia

Agent-facing. Read this cold. The user plays a static site (GitHub Pages). Local proof uses `scripts/serve.mjs`, not Railway. Do not POST hits to production.

Primary surface: web UI at a loopback URL. Secondary: Railway API (`data/api.json`) for hits GET. Mutations against that API are out of scope unless a disposable local `server/` is running (Postgres + `UPLOAD_PIN`). This skill does not start Postgres.

Two instances can run on different ports. Do not drive a server you did not launch. Shared static files on disk are read-only; that is safe.

## Launch

From the trivia repo root:

```
node .cursor/skills/verify-trivia/scripts/run.mjs launch
```

Ready when stdout is a URL like `http://127.0.0.1:<port>/` and `GET` that URL returns 200. Record lives at `/tmp/trivia-verify/run.json` (override with `TRIVIA_VERIFY_DIR`). Optional `TRIVIA_VERIFY_PORT`.

Teardown is **Cleanup** below. Never `pkill -f serve.mjs`.

## Doctor

```
node .cursor/skills/verify-trivia/scripts/run.mjs doctor
```

Must print JSON with `ok: true`, the recorded `pid` still alive, home HTML containing the General Trivia mark, and `data/categories.json` including `movies`, `presidents`, `geography`, and `current-events`. If doctor fails, cleanup and launch again. Do not drive.

## Drive

Harness: Cursor browser MCP (`browser_navigate`, `browser_lock`, `browser_snapshot`, `browser_click`, `browser_take_screenshot`). Hash routes are real URLs: `http://127.0.0.1:<port>/#/movies`.

Stable handles:

- Home category cards are links whose accessible name includes the category heading (`News Feed`, `Film & Movies`, `Geography`, …).
- Quiz hub: link named `Quiz`.
- Quiz setup: button `Start quiz` (`#start-quiz`, class `quiz-cta`).
- Home: region `Themed trivia`.
- After leaving home: button `Home` (`#home-btn`).

Read `features/` before driving. Exercise the mapped entry points, not a shortcut into quiz state via localStorage.

Localhost uses GET for `/api/hits` (no increment).

## Evidence

Write under `.cursor/skills/verify-trivia/artifacts/<feature-id>/`. Keep artifacts after cleanup.

Proof standards:

- Real user path (click or hash the user would use).
- Capture the action and the resulting view (ARIA snapshot + screenshot with the General logo or a section title visible).
- Side effects: static routes 200; do not treat Railway POST as in-scope.
- Name the feature ID and URL (including hash) in a `proof.txt` next to the screenshot.

## Cleanup

```
node .cursor/skills/verify-trivia/scripts/run.mjs cleanup
```

Kills only the pid in `run.json`, then deletes `run.json`. Leaves `artifacts/` in place.

## Helpers

```
node .cursor/skills/verify-trivia/scripts/run.mjs launch
node .cursor/skills/verify-trivia/scripts/run.mjs doctor
node .cursor/skills/verify-trivia/scripts/run.mjs cleanup
```
