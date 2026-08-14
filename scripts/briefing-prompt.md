Read the INPUT JSON at the end of this message.

It is already clustered and ranked (highest coverage first). Rewrite every item's summary.

Do not use tools. Do not write files. Do not run shell commands. Do not fetch URLs.
Do not include Netflix titles.

Reply with ONLY valid JSON (no markdown fences, no commentary) of this shape:

{
  "items": [
    {
      "people": ["<full name of a person mainly involved>"],
      "summary": "<a short paragraph that is easy to remember; combine the important facts already in this item>"
    }
  ]
}

Rules:

1. `items` must have the same length and the same order as INPUT.items. Do not drop or add events.
2. Rewrite each `summary` as a short memorable paragraph from facts already in that item's headline and summary. Use as many sentences as you need, but keep it to a small paragraph. Do not invent facts. Do not paste near-duplicate ledes. Make it easy to remember: who, what happened, why it matters.
3. `people` is 0–3 real human names the event is mainly about.
4. The output must parse as JSON. No trailing commentary.
