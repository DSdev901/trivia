Read these two files and nothing else:

- data/current-events/sports.json
- data/current-events/entertainment.json

Then overwrite ONLY this file:

- data/current-events/briefing.json

Do not modify any other path. Do not run shell commands. Do not fetch URLs.
Do not include Netflix titles.

Write valid JSON (no markdown fences) with this shape:

{
  "section": "briefing",
  "source": "copilot-auto",
  "model": "claude-haiku-4.5",
  "generatedAt": "<ISO timestamp>",
  "windowStart": "<YYYY-MM-DD>",
  "windowEnd": "<YYYY-MM-DD>",
  "items": [
    {
      "headline": "<exact headline from the source>",
      "people": ["<full name of a person mainly involved>"],
      "summary": "<one or two sentence synopsis; reuse the source summary when it is already good>",
      "section": "sports" | "entertainment",
      "tag": "<sport or entertainment tag>",
      "date": "<YYYY-MM-DD>",
      "url": "<source url or empty string>"
    }
  ]
}

Rules:

1. Include every sports and entertainment story. Do not drop recaps; put them last.
2. Sort `items` by news weight, heaviest first: deaths, huge money/mergers/sales, records, star trades/injuries/retirements, then other news, then game recaps, offseason previews, rumor roundups, and listicles.
3. `people` is the person or people the story is mainly about — real human names only (not teams, shows, cities, or orgs). Use 0–3 names. Empty array if none.
4. Keep headlines exact. Do not invent facts that are not in the headline or summary.
5. Cover the full three-week window in the source files (windowStart / windowEnd).
