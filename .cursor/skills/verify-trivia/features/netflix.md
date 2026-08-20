# Netflix

Netflix is a hash-routed category of originals from the last four weeks. Cards come from `data/current-events/netflix.json`.

## Sub-features

- `netflix-load` shows posters, title, type, date, synopsis, and starring.
- `netflix-filter` chips All / Shows / Movies, plus US only when any title is tagged `inUS`.
- `netflix-brevity` is a Brevity toggle when any title has `brief`. On shows `brief`; off shows `synopsis`. Preference is stored in `localStorage` key `trivia-netflix-brevity`.

## How to get to it (user POV)

- Open home, then the Netflix card.
- Hash `#/netflix`.

## Driving it with Cursor browser MCP

Preconditions:

- Doctor is green for this run's URL.
- `data/current-events/netflix.json` includes at least one item with `brief`, or the Brevity toggle will not render.

- **Open Netflix.** From home, click the link whose name includes `Netflix`. Heading is `Netflix`.
- **Brevity.** Snapshot until a checkbox named `Brevity` exists. Click it. Card copy switches from `synopsis` to `brief` on every card that has copy, not only the first few (CDP on `.ce-netflix-copy p`). Click again to restore.

## Gotchas

- Netflix is `current-events.js` with `mode: "netflix"`, not a separate page.
- Every title with a synopsis should have a `brief` (local compress, then Tuesday Copilot rewrite). A refresh keeps a usable brief by title.
