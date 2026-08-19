# Movies quiz

Movies quiz lets a user open Film & Movies, choose Quiz, pick rounds, and start a multiple-choice round.

## Sub-features

- `movies-hub` opens Study and Quiz from the category hub.
- `movies-setup` shows Quiz setup with round checkboxes.
- `movies-start` starts a quiz from `Start quiz`.

## How to get to it (user POV)

- From home, choose the `Film & Movies` card.
- From the hub, choose the `Quiz` card.
- Direct hash `#/movies/quiz`.

## Driving it with Cursor browser MCP

Preconditions:

- Doctor is green.
- Start from home unless proving the hash entry alone.

- **Open category.** Click the link named `Film & Movies`. The heading `Film & Movies` appears with cards `Study` and `Quiz`.
- **Open quiz.** Click the link named `Quiz`. The heading `Quiz setup` appears and `Start quiz` is enabled.
- **Start.** Click `Start quiz`. A quiz question view appears (not setup). `#start-quiz` is gone.
- **Hash entry.** Navigate to `<url>#/movies/quiz`. The same Quiz setup heading appears.
- **Proof.** Snapshot and screenshot `artifacts/movies-quiz/` at setup (action) and after start (result). `proof.txt` records both hashes `#/movies` and `#/movies/quiz`.

## Gotchas

- `Start quiz` is ink (`quiz-cta`), not teal. Color is not the proof; the view change is.
- Select none then Start quiz shows a setup error. Leave at least one round checked.
- Flag-for-replacement exists only on localhost and is not this feature.
