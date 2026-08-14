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
      "headline": "<one clear headline for the event>",
      "people": ["<full name of a person mainly involved>"],
      "summary": "<2-3 short sentences that are easy to remember; combine the important facts from every related article>",
      "section": "sports" | "entertainment",
      "tag": "<sport or entertainment tag>",
      "date": "<YYYY-MM-DD of the latest related story>",
      "url": "<best source url or empty string>",
      "coverage": 3
    }
  ]
}

Rules:

1. Cluster the same or closely related stories into ONE item. Example: several Lakers-sale headlines become one card. Do not list the same event twice.
2. `coverage` is how many source articles were about that event. Rank `items` by coverage first (mentioned most), then by news weight.
3. For each cluster, write a short memorable summary (2–3 sentences) that folds in the important facts from all related pieces. Do not invent facts. Do not paste three near-duplicate ledes. Make it easy to remember: who, what happened, why it matters.
4. `people` is the person or people the event is mainly about — real human names only. Use 0–3 names.
5. Keep recaps and rumor roundups, but merge obvious duplicates and put thin recaps last.
6. Different games are different events — even same league, same day. Do not combine a Nationals recap with a Brewers recap. Same game from multiple write-ups may merge. Same celebrity in unrelated stories (two people who share a last name, or two fashion items about different stars) must stay separate.
7. Cover the full three-week window in the source files (windowStart / windowEnd).
