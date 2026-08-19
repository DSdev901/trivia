# Geography

Geography is the map-quiz category. Opening it from home must land on the geography hub, not a blank view.

## Sub-features

- `geo-open` opens Geography from the home card.
- `geo-hash` opens the same view at `#/geography`.

## How to get to it (user POV)

- From home, choose `Geography`.
- Direct hash `#/geography`.

## Driving it with Cursor browser MCP

Preconditions:

- Doctor is green.
- `data/categories.json` includes `geography`.

- **Card entry.** Click `Geography`. A geography view heading or map chrome is visible (not the home category grid).
- **Hash entry.** Navigate to `<url>#/geography`. The same geography view appears.
- **Proof.** Snapshot and screenshot `artifacts/geography/`. `proof.txt` includes `#/geography`.

## Gotchas

- Geography is a large module. Proof is “user reached the category,” not a completed pin-the-country round.
- Do not wait for every map SVG to idle; wait for the geography view to replace home.
