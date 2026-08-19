# Home

Home is the category menu for General Trivia. The user sees the General badge, a themed-trivia ticker, category cards, a visitor counter, and 90s badges.

## Sub-features

- `home-load` renders the menu from `data/categories.json`.
- `home-ticker` exposes region `Themed trivia`.
- `home-categories` lists Current Events, Netflix, Prior Saucer Trivia, Presidential Knowledge, Periodic Table, Geography, and Film & Movies.
- `home-badges` includes Netscape, Sign the guestbook, and Y2K.

## How to get to it (user POV)

- Open the site root with no hash or `#/`.
- Choose the `Home` button from an inner view.

## Driving it with Cursor browser MCP

Preconditions:

- Doctor is green for this run’s URL.
- The tab is on that origin, not GitHub Pages.

- **Open home.** Navigate to the recorded URL. Run `browser_navigate` with that URL. The page title is `General Trivia` and `body` has class `is-home` once categories render.
- **Wait for cards.** Snapshot until a link named `Film & Movies` exists. Category cards are injected by `app.js`; a snapshot taken too early only shows the empty `#view-categories`.
- **Ticker.** Confirm a region named `Themed trivia`.
- **Badges.** Confirm a link named `Sign the guestbook`.
- **Proof.** Save `browser_snapshot` YAML to `artifacts/home/home.aria.yml` and a screenshot to `artifacts/home/home.png`. Write `artifacts/home/proof.txt` with the URL. The snapshot must contain `Film & Movies` and `Themed trivia`.

## Gotchas

- Categories are client-rendered. Do not treat the first HTML parse as the menu.
- Localhost GET `/api/hits` reads production count and does not increment. A missing counter still allows home proof if cards rendered.
- `python3 -m http.server` also serves the app but lacks Current Events refresh. Launch still uses `scripts/serve.mjs`.
