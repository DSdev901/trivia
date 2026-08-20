#!/usr/bin/env node
/**
 * Build the Copilot prompt with Netflix titles inlined so the model does
 * not need create/edit tools.
 */

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PROMPT = path.join(ROOT, "scripts", "netflix-brevity-prompt.md");
const FILE =
  process.env.NETFLIX_INPUT ||
  path.join(ROOT, "data", "current-events", "netflix.json");

const instructions = (await readFile(PROMPT, "utf8")).trim();
const data = JSON.parse(await readFile(FILE, "utf8"));
const all = (data.items || []).filter((item) =>
  String(item.synopsis || "").replace(/\s+/g, " ").trim()
);
const offset = Math.max(0, Number(process.env.NETFLIX_OFFSET || 0));
const limit = Math.max(0, Number(process.env.NETFLIX_LIMIT || 0));
const slice = limit > 0 ? all.slice(offset, offset + limit) : all.slice(offset);
const items = slice.map((item) => ({
  title: item.title,
  type: item.type,
  synopsis: String(item.synopsis || "").replace(/\s+/g, " ").trim(),
  starring: (item.starring || []).filter(Boolean).slice(0, 4),
}));
const batchNote =
  slice.length === all.length
    ? ""
    : `\nThis batch is items ${offset + 1}–${offset + slice.length} of ${all.length} titles that have a synopsis.\n`;
const input = {
  model: process.env.COPILOT_MODEL || "claude-haiku-4.5",
  windowStart: data.windowStart || "",
  windowEnd: data.windowEnd || "",
  offset,
  total: all.length,
  items,
};

process.stdout.write(
  `${instructions}${batchNote}\nINPUT:\n${JSON.stringify(input, null, 2)}\n`
);
