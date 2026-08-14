Read ONLY this file:

- data/current-events/briefing.json

It is already clustered and ranked (highest coverage first). Rewrite every item in that file.

Overwrite ONLY this file:

- data/current-events/briefing.json

Do not modify any other path. Do not run shell commands. Do not fetch URLs.
Do not include Netflix titles.

Do this in ONE write of the complete file. Do not make a series of small edits. Do not leave any text before or after the JSON. Stop as soon as the file is valid JSON.

Write valid JSON (no markdown fences) with this shape:

{
  "section": "briefing",
  "source": "copilot-auto",
  "model": "<the model name you were started with>",
  "generatedAt": "<ISO timestamp>",
  "windowStart": "<YYYY-MM-DD from the input file>",
  "windowEnd": "<YYYY-MM-DD from the input file>",
  "items": [
    {
      "headline": "<one clear headline for the event>",
      "people": ["<full name of a person mainly involved>"],
      "summary": "<a short paragraph that is easy to remember; combine the important facts already in this item>",
      "section": "sports" | "entertainment",
      "tag": "<sport or entertainment tag>",
      "date": "<YYYY-MM-DD of the latest related story>",
      "url": "<best source url or empty string>",
      "coverage": 3
    }
  ]
}

Rules:

1. Keep every input item. Do not drop below the input count. Do not add new events.
2. Keep `coverage`, `section`, `tag`, `date`, `url`, and ranking as they are unless a headline is unclear — then you may clarify the headline.
3. Rewrite each `summary` as a short memorable paragraph from facts already in that item's headline and summary. Use as many sentences as you need, but keep it to a small paragraph. Do not invent facts. Do not paste near-duplicate ledes. Make it easy to remember: who, what happened, why it matters.
4. `people` is 0–3 real human names the event is mainly about.
5. For sports items, `tag` must stay the league or sport (MLB, NFL, NBA, WNBA, NHL, Soccer, College football, Tennis, Golf, F1, NASCAR, MMA, etc.). Entertainment keeps tags like Celebrity or Milestone.
6. The output must parse as JSON. No trailing commentary.
