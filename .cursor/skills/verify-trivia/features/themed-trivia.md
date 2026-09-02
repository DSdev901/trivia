# Themed trivia

Themed Trivia is a home category for Tuesday night themes. Harrison Ford Movies is the first pack: 150 questions in fifteen rounds, with Study and Quiz.

## Sub-features

- `themed-hub` lists theme packs from the Themed Trivia card.
- `ford-hub` opens Study and Quiz for Harrison Ford Movies.
- `ford-study` shows round 1 (Han Solo) with ten expandable questions.
- `ford-quiz` starts a multiple-choice quiz from Quiz setup.

## How to get to it (user POV)

- From home, choose the `Themed Trivia` card.
- Choose `Harrison Ford Movies`.
- Direct hash `#/themed` for the pack list, `#/harrison-ford` for the Ford hub, `#/harrison-ford/quiz` for quiz setup.

## Driving it with Cursor browser MCP

Preconditions:

- Doctor is green.
- Start from home unless proving a hash entry.

- **Open themed.** Click the link named `Themed Trivia`. The heading `Themed Trivia` appears with a card `Harrison Ford Movies`.
- **Open Ford.** Click the link named `Harrison Ford Movies`. The heading `Harrison Ford Movies` appears with cards `Study` and `Quiz`.
- **Study.** Click `Study`, then `Han Solo` (round 1). The heading includes `Han Solo` and a `Listen` button.
- **Quiz.** From the Ford hub, click `Quiz`, then `Start quiz`. A quiz question view appears. `#start-quiz` is gone.
- **Proof.** Snapshot and screenshot `artifacts/themed-trivia/` at the pack list, Ford hub, and after quiz start. `proof.txt` records `#/themed`, `#/harrison-ford`, and `#/harrison-ford/quiz`.

## Gotchas

- Harrison Ford Movies is `home: false` in `categories.json`. It is not a home card. Reach it from Themed Trivia or `#/harrison-ford`.
- Study and quiz reuse the Film & Movies round UI (`type: "movies"`).
- Back from the Ford hub returns to Themed Trivia, not home.
