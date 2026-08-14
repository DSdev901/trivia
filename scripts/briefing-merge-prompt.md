Read the INPUT JSON at the end of this message.

Mechanical clustering already ran. Cards that share a URL, a game, enough headline words, or the same named people plus extra tokens are already one item. What remains are leftovers: nearby cards whose headlines barely overlap.

Your job is only to judge those leftovers. Do not use tools. Do not write files. Do not fetch URLs. Do not rewrite headlines or summaries.

Reply with ONLY valid JSON (no markdown fences, no commentary):

{
  "merges": [
    [0, 3],
    [8, 9, 10]
  ]
}

Rules:

1. Each inner array is 2–4 indexes from INPUT.items that should become ONE card.
2. Merge when a reader would treat them as updates on one unfolding event, even if the headlines share few words — a union letter about a deal and the trial date in that same case; two box-office notes for the same film this week; two write-ups of the same sale.
3. Do not merge just because they share a person, studio, league, franchise, or the word "merger". A CEO selling stock is not the merger trial. Spider-Man box office is not The Odyssey. A congressional letter is not the same card as the court schedule unless both are clearly the same proceeding.
4. Do not merge sports with entertainment.
5. If nothing should merge, return {"merges": []}. Prefer too few merges over a mash-up.
6. Indexes are 0-based in INPUT.items. Do not invent indexes.
