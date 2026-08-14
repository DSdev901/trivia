Read the INPUT JSON at the end of this message.

It is already clustered and ranked. Rewrite every item's headline and summary.

These are news stories from INPUT.windowStart to INPUT.windowEnd. Use only facts already in that item. Do not invent career histories, Hall of Fame bios, or anything not in the item.

If an item has `angles`, those are other headlines and facts from the same cluster. Fold in distinct facts. Ignore duplicate ledes.

Do not use tools. Do not write files. Do not run shell commands. Do not fetch URLs.
Do not include Netflix titles.

Reply with ONLY valid JSON (no markdown fences, no commentary) of this shape:

{
  "items": [
    {
      "headline": "<short briefing title: who + what happened>",
      "people": ["<full name of a person mainly involved>"],
      "summary": "<1–3 short sentences that are easy to remember; combine the important facts already in this item>"
    }
  ]
}

Rules:

1. `items` must have the same length and the same order as INPUT.items. Do not drop or add events.
2. Rewrite `headline` as a short news title (about 6–12 words). No listicles ("N things you need to know"), no EXCL/EXCLUSIVE, no clickbait questions. Keep names and facts from the item.
3. Rewrite each `summary` as 1–3 short sentences from facts already in that item (headline, summary, and angles). Do not invent facts. Do not paste near-duplicate ledes. Make it easy to remember: who, what happened, why it matters.
4. `people` is 0–3 real human names the event is mainly about.
5. The output must parse as JSON. No trailing commentary.
