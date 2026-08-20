Read the INPUT JSON at the end of this message.

Rewrite each title's synopsis into the shortest blurb that still tells someone what the show or film is.

Do not use tools. Do not write files. Do not run shell commands. Do not fetch URLs.

Reply with ONLY valid JSON (no markdown fences, no commentary) of this shape:

{
  "items": [
    {
      "title": "<exact title from INPUT>",
      "brief": "<one sentence>"
    }
  ]
}

Rules:

1. `items` must have the same length and the same order as INPUT.items. Copy `title` exactly.
2. `brief` is one sentence when that is enough. A second sentence is allowed only if the first would leave out who it is about or what the premise is.
3. Use only facts already in that item (title, type, synopsis, starring). Do not invent plot, awards, or tone.
4. Do not spoil endings, twists, or who dies.
5. Do not write marketing copy ("must-watch", "highly stylized", "candid and clever").
6. Name the lead or setting when the synopsis does. Skip a cast dump.
7. The output must parse as JSON. No trailing commentary.
