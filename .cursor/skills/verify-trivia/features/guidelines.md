# Guidelines

Guidelines is the trivia-only brand book. It is a separate page from the game, linked from the home badge row.

## Sub-features

- `guidelines-open` opens `/guidelines/` from the home `Brand guidelines` link.
- `guidelines-cover` shows Brand guidelines and a TOC.

## How to get to it (user POV)

- From home, choose `Brand guidelines`.
- Open `/guidelines/` on the same origin.

## Driving it with Cursor browser MCP

Preconditions:

- Doctor reported `guidelines/` HTTP 200.
- Start from home to prove the badge, or hashless `/guidelines/` to prove the route.

- **Badge entry.** Click `Brand guidelines`. The document title is `General Trivia — Brand Guidelines`.
- **Cover.** Heading `Brand guidelines` is visible. A skip link `Skip to content` exists.
- **Proof.** Snapshot and screenshot `artifacts/guidelines/`. `proof.txt` URL ends with `/guidelines/` or `/guidelines/index.html`.

## Gotchas

- This is not Radiant Art Room. Copy that names another brand fails the proof.
- The page is static HTML. No hash router.
- Print/PDF in the sidebar is optional and not required for this feature.
