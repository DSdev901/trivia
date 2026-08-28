Read the INPUT JSON at the end of this message.

It is already clustered and ranked. Rewrite every item's headline and summary for a Tuesday pub-trivia briefing.

These are news stories from INPUT.windowStart to INPUT.windowEnd. Use only facts already in that item (headline, summary, angles, and hooks). Do not invent career histories, Hall of Fame bios, extra hit songs, or anything not in the item.

If an item has `angles`, those are the other distinct write-ups of the same story (up to a dozen). `coverage` is how many times it was reported. Read all of them, then write ONE briefing. Fold in distinct facts (names, numbers, titles, places). Ignore duplicate ledes. Do not list outlets or recap every version.

If an item has `hooks` (`who`, `what`, `number`, `where`), treat those as the quiz answers to keep: people, titled works, figures, and places already found in the item.

Do not use tools. Do not write files. Do not run shell commands. Do not fetch URLs.
Do not include Netflix titles.

Reply with ONLY valid JSON (no markdown fences, no commentary) of this shape:

{
  "items": [
    {
      "headline": "<short event title: who + what happened>",
      "people": ["<full name of a person mainly involved>"],
      "summary": "<1–2 short sentences a quiz host could ask from>"
    }
  ]
}

Rules:

1. `items` must have the same length and the same order as INPUT.items. Do not drop or add events.
2. Rewrite `headline` as a short event title (about 6–12 words). No listicles ("N things you need to know"), no EXCL/EXCLUSIVE, no clickbait questions, and do not write the summary as a trivia question ("Who died at 80?"). Keep names and numbers from the item. If the item names the person, use that name — do not write "a rock star", "an actress", or "a quarterback".
3. Rewrite each `summary` as 1–2 short sentences of sticky quiz facts already in that item. Lead with the answer a stranger could remember: who, what happened, and the best number, titled work, or place. Keep at most one extra detail that a host would actually ask (age, city, song, sale price, championship). Drop process and filler: settlement talks, canceled talks, bonds, "acting in bad faith", career laundry lists, box-office splits unless that split is the quiz fact, rumor/tracker wording. If several angles cover the same story, combine the important details rather than repeating the same lede. If the item includes a concrete figure (sale price, box office, contract value, age, score, vote count, prison term), put that number in the summary. A "record price" or sale headline is incomplete without the amount. Never invent a number, title, or place that is not in the item.
4. `people` is 0–3 real human names the event is mainly about.
5. The output must parse as JSON. No trailing commentary.
