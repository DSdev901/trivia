# General Trivia — DESIGN.md

Canonical brand spec for the **trivia page** (`index.html` + `styles.css`). The guidelines site in this folder renders this document. If they disagree, this file wins.

**Status:** `PROPOSED` — extracted from the live site on 2026-08-19. Correct anything that is wrong; then lock.

| | |
|---|---|
| Brand | General Trivia |
| Surface | The public trivia site (GitHub Pages), not Radiant Art Room |
| Version | 0.1-proposed |
| Date | 2026-08-19 |
| Provenance | Mostly `context` (repo + live CSS). Gaps marked `invented` or `PLACEHOLDER`. |

---

## 00 · Cover

- Title: Brand Guidelines
- Wordmark: the General badge (`trivia-general-logo-alt.png`)
- Tagline (context): Flying Saucer Trivia Tuesdays — a home-night quiz club on the web
- Version: 0.1-proposed

## 01 · Brand Overview

**Story (context):** General Trivia is a single-page quiz club: study or play movies, presidents, geography, a current-events briefing, the periodic table, and nights at the Flying Saucer. The home page still keeps a hit counter, a guestbook, and Netscape-era badges. The joke in the name is the smiling general with a beer — not a military brand.

**Mission (invented, from product):** Get people into a round quickly, with facts that can be studied and quizzed until they clear.

**Vision (invented):** A Tuesday-night trivia table that happens to live in a browser.

**Personality**

| Word | Meaning |
|---|---|
| Jovial | The General is laughing. Copy can wink; questions stay fair. |
| Clubhouse | Paper, gold, serif display — a room you return to, not a startup dashboard. |
| Webmaster-sincere | Hit counters and guestbooks are garnish. They are not irony that eats the quiz. |
| Brisk | Start quiz / Quiz again are ink, not teal. Get to the question. |
| Specific | Themed nights have dates. “New Briefing today” is a real stamp, not a sticker. |

**Audience (context):** People playing on a phone or a laptop — Flying Saucer Tuesday players, friends, and whoever found the GitHub Pages URL. Not a classroom LMS. Not Radiant Art Room customers.

**Principles (must be visible in the book)**

1. Paper first; Memphis lives in the gutters.
2. Quiz actions are ink. Teal is structure, not the “go” button.
3. 90s chrome is garnish. The quiz is the meal.
4. One General. The mark is a badge, not wallpaper.
5. Motion that can sit still. Tickers pause; reduced motion is respected.

## 02 · Logo System

**Primary (context):** `trivia-general-logo-alt.png` — square comic illustration, black field, arched “GENERAL”, the laughing general with beer, flat red “TRIVIA”. Used on the home header as a badge (`border-radius: 0`, `object-fit: contain`).

**Inner-page crop (context):** same file, circular (`border-radius: 50%`, ~4.35rem) when you leave home.

**Secondary file (context):** `trivia-general-logo.png` exists; alt is the live home mark. Do not invent a third drawing.

**Clear space:** one “star” on the epaulette as a unit — keep at least that much quiet paper around the badge.

**Minimum size:** 96×96 CSS px for the home badge; never below 64px if the type in the PNG must read.

**Backgrounds:** paper (`--brand-paper`) or the Memphis gutter. Not on busy posters. The PNG already has a black field — do not put that field on a black page without a paper mat.

**Misuse:** do not stretch; do not recolor the uniform teal to match `--brand-teal`; do not put a drop shadow on the PNG; do not set it as a repeating background; do not cover the eye (home glint is a CSS overlay, not a new drawing).

**Partner lockups:** none. `PLACEHOLDER` if a Flying Saucer lockup is ever needed.

**Monogram / avatar:** none besides the circular crop. `PLACEHOLDER` for a true 1:1 social avatar export.

## 03 · Color

Named from live `:root` in `styles.css` plus Memphis ornaments.

| Token | Hex | Role | Provenance |
|---|---|---|---|
| `--brand-paper` | `#f7f3eb` | Page surface | context |
| `--brand-paper-deep` | `#ebe4d6` | Warm band | context |
| `--brand-ink` | `#1a2332` | Text + quiz CTAs | context |
| `--brand-ink-soft` | `#3d4a5c` | Secondary text | context |
| `--brand-stripe` | `#d9cfc0` | Hairlines | context |
| `--brand-teal` | `#0b5f4b` | Structure, guestbook badge, selected states | context |
| `--brand-teal-deep` | `#084536` | Teal hover (non-quiz) | context |
| `--brand-teal-soft` | `#d8ebe4` | Selected fill | context |
| `--brand-gold` | `#b8860b` | Ornament, focus rings | context |
| `--brand-counter` | `#e4b12a` | Hit-counter LEDs | context |
| `--brand-wine` | `#8b2e2e` | Errors / danger | context |
| `--brand-pattern-blue` | `#3d6b9a` | Memphis only | context |
| `--brand-pattern-coral` | `#c45c4a` | Memphis only | context |

**Pairing / contrast (measured 2026-08-19)**

| Pair | Ratio | AA body | Notes |
|---|---|---|---|
| Ink on paper | 14.26 | Pass | Default prose |
| Paper on ink (quiz CTA) | 14.26 | Pass | Start quiz |
| White on teal | 7.63 | Pass | Primary non-quiz |
| Ink-soft on paper | 8.14 | Pass | Kickers |
| Counter gold on ink | 7.98 | Pass | LED digits |
| Gold on paper | 2.94 | Fail | Ornament only — never body text |
| Coral on paper | 3.81 | Fail for small text | Memphis only |

No print CMYK. `PLACEHOLDER` if a flyer is ever printed.

No gradients as brand surfaces (context).

## 04 · Typography

| Role | Face | License | Provenance |
|---|---|---|---|
| Display | Fraunces 500/700 | Google Fonts / OFL | context |
| Body | Source Sans 3 400/600/700 | Google Fonts / OFL | context |
| Retro badges | Tahoma / Geneva | System | context |
| Counter | ui-monospace / Courier | System | context |

**Hierarchy (context, fluid where the live site already clamps)**

- Hero / brand: Fraunces 700, `clamp(2rem, 5vw, 2.75rem)`, tracking `-0.02em`
- Section titles: Fraunces 700, ~1.45–1.85rem
- Body: Source Sans 3, ~1.05rem, line-height 1.5, measure ≤ 65ch on ledes
- Labels / hit-counter kicker: 0.72rem, uppercase, tracking `0.05em`, weight 700
- Do not faux-bold. Do not outline Fraunces. Do not set quiz questions in all-caps.

**Alternate (encoded, researched):** display = Source Sans 3 — closer to 90s webmaster, colder clubhouse. Toggle on the guidelines site (`data-alt-display="b"`). Default remains Fraunces.

## 05 · Iconography

Custom SVG in the product (home glyph, geography pins). Not Lucide/Material.

**Geometry (context):** 24×24 viewBoxes, `currentColor`, fill icons in chrome.

**Retro badges:** 132×47 CSS px, crispEdges pixel SVGs, three live marks (Netscape Site of the Day, Sign our Guestbook, Y2K Compliant).

**Color:** chrome icons inherit ink. Badges carry their own fills. Never put badge art on a quiz option.

**Do:** one home icon. **Don't:** icon+title+text card grids for categories (categories already have illustration marks).

## 06 · Photography & Illustration

**Qualities:** comic-bold (the General), editorial posters (current events / Netflix), diagram-clear (maps, periodic table).

**Rules**

- The General is illustration, not a photograph of a person.
- Briefing posters come from the feed as-is — do not recolor them teal.
- Geography uses the map SVGs in `data/geography/maps/`.
- Memphis ornaments (saucer, beer, 901) are gutter texture, opacity ~0.28–0.34, never competing with a question.

## 07 · Mascots & Characters

**The General** — unnamed in UI copy; the laughing three-star with a beer is the mascot. Role: greet on home, stay out of question stems.

No second character. Win95 “illegal operation” is an easter egg, not a mascot.

If a new character appears, it must survive at badge size next to the General without sharing his mustache.

## 08 · UI Components

From the live product:

| Component | Rule |
|---|---|
| Quiz CTA (`.quiz-cta`) | Ink fill, paper type, pill. Not teal. |
| Primary (non-quiz) | Teal fill, white type, pill |
| Secondary / nav | Paper glass, stripe border, pill |
| Hub card | Radius 14px, stripe border, `--sh-card`, hover lift -2px, border goes teal |
| Category card | Feature first card; current-events may sparkle when the briefing is same-day |
| Inputs | Visible focus (gold offset on badges; ink/teal on forms) |
| Hit counter | Six LED cells, `--brand-counter` on ink |
| Badges | 132×47, hard offset shadow |

## 09 · Shadows & Borders

- Cards: `--sh-card` = `0 12px 40px rgba(26, 35, 50, 0.08)` — soft ambient, not hard offset
- Badges: hard 1px/2px webmaster offset
- Counter: inset well
- Radius: 4px (LED, checkboxes), 12–14px (cards), pill (buttons, nav)
- Border: 1px `--brand-stripe`; hover/selected may use teal

## 10 · Motion

Personality: unhurried garnish, snappy controls.

| Token | Value | Use |
|---|---|---|
| `--dur-fast` | 160ms | Nav / buttons |
| `--dur-normal` | 180ms | Cards |
| `--dur-slow` | 400ms | Reveals in this book |
| `--dur-glint` | 8.6s | Home eye glint, infinite |
| `--dur-ticker` | 40s | Themed-trivia marquee, linear |

Ticker pauses on hover/focus. `prefers-reduced-motion: reduce` stops the ticker duplicate, glint, and this book’s reveals (fail visible).

Konami → Win95 dialog is an easter egg, not a marketing pattern.

## 11 · Layout

- `--app-max: 1280px` with `--app-inset` gutters
- Memphis repeats in the leftover side gutters (`--memphis-size: 180px 230px`)
- Home menu is the category grid; first card may feature
- Section rhythm on the product: top bar, then view; this book: `--section-pad`
- Dividers: 1px stripe, not gradient glows

## 12 · Voice & Tone

**Character (context + guestbook copy):** a friendly webmaster who also hosts Tuesday trivia. Warm, specific, PG. Can clutch pearls in the guestbook. Does not say “unlock your potential.”

**By context**

| Surface | Tone |
|---|---|
| Home | Welcome, visitor count, themed nights |
| Quiz | Neutral stems, no teasing wrong answers |
| Guestbook reject | Wry, church-raffle PG (see `guestbook-filter.js`) |
| Errors | Plain. Win95 copy is Konami-only |
| This book | Documentary, same clubhouse |

**In:** trivia night, briefing, visitor, guestbook, quiz again, Flying Saucer.  
**Out:** gamify, crush it, unlock, “content experience,” Radiant Art Room voice, painting quiz buttons green.

**Samples (invented, in voice)**

- Headline: Tuesday’s board is up. Bring a pencil or don’t.
- Blurb: Study the presidents, then quiz until the round lets you go.
- Error: Could not open the guestbook just now.

## 13 · AI Policy

**Stance (context from server README + invented label):** **AI-assisted.** Photo parsing on the upload tool may call a vision model. The public quiz is human-edited JSON.

| Surface | Rule |
|---|---|
| Question banks | Human review before they ship |
| Briefing headlines | Cached from feeds; do not rewrite with a model into jokes |
| Guestbook | Human visitors; filter is a word list, not a model |
| Imagery of the General | Do not generate a replacement logo |
| Player data | Do not paste guestbook messages or IPs into third-party tools |

Disclosure: this book was drafted by an agent from the repo (`context`). It is proposed until a human locks it.

## 14 · Sub-brands & Ecosystem

Not a multi-brand company. **Hub-and-spoke categories** on one site: Current Events, Netflix, Prior Saucer Trivia, Presidential Knowledge, Periodic Table, Geography, Film & Movies, guestbook.

Shared core: paper, ink, Fraunces, the General, quiz CTAs in ink.  
Allowed deviation: a category illustration on its card; maps vs posters vs tables.  
Not a sub-brand: Radiant Art Room.

## 15 · Asset naming & governance

Pattern: `{surface}-{role}-{variant}.{ext}`

Examples: `trivia-general-logo-alt.png`, `favicon.png`, `guidelines/tokens.css`

| Type | Format |
|---|---|
| Logo | PNG (current); SVG `PLACEHOLDER` |
| Favicons | PNG |
| Maps | SVG in `data/geography/maps/` |
| Posters | JPG/PNG in `data/current-events/posters/` |
| Tokens | `guidelines/tokens.css` + `guidelines/tokens.json` |

**SSOT:** this `DESIGN.md`. Live page still inlines tokens in `/styles.css` `:root`. Propagate by editing this spec, then `tokens.css`, then the product `:root` — never the other way around once a section is locked.

Consumers: this repo only (GitHub Pages + Railway API). No other product should import these tokens.
