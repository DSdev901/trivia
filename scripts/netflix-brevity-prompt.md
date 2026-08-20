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
2. `brief` is one short sentence. A second sentence is allowed only if the first would leave out who it is about or what the premise is.
3. Hard cap: 125 characters, including spaces. If the synopsis is longer than that, `brief` must be shorter. Complete the sentence. Do not stop on "the" or "and".
4. Use only facts already in that item (title, type, synopsis, starring). Do not invent plot, awards, or tone.
5. Do not spoil endings, twists, or who dies.
6. Do not write marketing copy. Ban: "In this…", "must-watch", "highly stylized", "candid and clever", "unrelenting", "raucous", "seminal", "unprecedented look".
7. Premise only: who and what the situation is. Drop rhetorical questions, awards boilerplate, and "streamed live on Netflix".
8. Name the lead or setting when the synopsis does. Skip a cast dump.
9. The output must parse as JSON. No trailing commentary.
