# Guestbook

Guestbook lets a visitor read signatures and (on the live API) add one. Local verification only proves the view opens. Signing writes to Railway and is forbidden in this skill.

## Sub-features

- `gb-open` opens the guestbook from the home badge or `#/guestbook`.
- `gb-readonly` shows the book or an empty/error state without submitting.

## How to get to it (user POV)

- From home, choose `Sign the guestbook`.
- Direct hash `#/guestbook`.

## Driving it with Cursor browser MCP

Preconditions:

- Doctor is green.
- Do not fill or submit the sign form.

- **Badge entry.** Click `Sign the guestbook`. Hash is `#/guestbook`. A guestbook heading or sign form is visible.
- **Read.** If entries load, they appear as a list. If the API is down, the empty or error copy is enough. Either is a valid result for `gb-readonly`.
- **Proof.** Snapshot and screenshot `artifacts/guestbook/`. `proof.txt` notes whether the list or the error/empty copy was shown. Confirm no POST was sent.

## Gotchas

- `data/api.json` points at production. A GET of entries is allowed. A POST is not.
- Rate limits and vulgar filters are server behavior. Do not test them against production.
