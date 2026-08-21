# General Trivia verification map

This directory is the maintained source for verifying user-facing behavior of General Trivia. Read the index before driving, then use the matching feature file.

## Baseline preconditions

- Launch with `node .cursor/skills/verify-trivia/scripts/run.mjs launch` from the repo root.
- Run `node .cursor/skills/verify-trivia/scripts/run.mjs doctor` and require `ok: true` for that pid and URL.
- Drive only that loopback origin. Never the GitHub Pages host for a local proof.
- Do not POST `/api/hits` to Railway.
- Restore nothing on disk. Static JSON is the fixture.
- Keep proof artifacts under `.cursor/skills/verify-trivia/artifacts/`.

## Driving conventions

- Start every recipe from home (`http://127.0.0.1:<port>/` with empty or `#/` hash) unless the feature says otherwise.
- Prefer accessible names from `browser_snapshot` over CSS and coordinates.
- Hash paths are user-visible: `#/movies`, `#/movies/quiz`, `#/geography`.
- After a mutation-free navigation, prove with a snapshot and a screenshot.

## Proof and skip reporting

- Capture the click (or hash change) and the resulting heading.
- UI proof includes an ARIA snapshot and a screenshot with the General mark or section title.
- Record feature ID and full URL including hash in `proof.txt`.
- An unreachable path is a failed path, not a skip credited to another feature.

## Features

- [Home](./home.md) covers the category menu, ticker, visitor chrome, and 90s badges.
- [Netflix](./netflix.md) covers the originals list, filters, and the Brevity toggle.
- [Movies quiz](./movies-quiz.md) covers hub, setup, and starting a round.
- [Geography](./geography.md) covers opening the geography category from home.
