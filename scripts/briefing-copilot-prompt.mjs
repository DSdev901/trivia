#!/usr/bin/env node
/**
 * Build the Copilot prompt with the clustered briefing inlined so the model
 * does not need create/edit tools (those calls were dropping path/file_text).
 */

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { extractHooks } from "../briefing.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MERGE = process.env.BRIEFING_MERGE === "1";
const PROMPT = path.join(
  ROOT,
  "scripts",
  MERGE ? "briefing-merge-prompt.md" : "briefing-prompt.md"
);
const FILE =
  process.env.BRIEFING_INPUT ||
  path.join(ROOT, "data", "current-events", "briefing.json");

const instructions = (await readFile(PROMPT, "utf8")).trim();
const data = JSON.parse(await readFile(FILE, "utf8"));
const all = data.items || [];
const offset = Math.max(0, Number(process.env.BRIEFING_OFFSET || 0));
const limit = Math.max(0, Number(process.env.BRIEFING_LIMIT || 0));
const slice = limit > 0 ? all.slice(offset, offset + limit) : all.slice(offset);
const clip = (s, n = 220) => {
  const t = String(s || "").replace(/\s+/g, " ").trim();
  return t.length <= n ? t : `${t.slice(0, n - 1).replace(/\s+\S*$/, "")}…`;
};
const items = MERGE
  ? slice.map((item, i) => ({
      i,
      headline: item.headline,
      people: item.people || [],
      summary: clip(item.summary),
      section: item.section,
      tag: item.tag,
      date: item.date,
      coverage: item.coverage || 1,
    }))
  : slice.map((item) => {
      const row = {
        headline: item.headline,
        people: item.people || [],
        summary: item.summary,
        section: item.section,
        tag: item.tag,
        coverage: item.coverage || 1,
      };
      const hooks = item.hooks && Object.keys(item.hooks).length
        ? item.hooks
        : extractHooks(item);
      if (hooks.who?.length || hooks.what?.length || hooks.number?.length || hooks.where?.length) {
        row.hooks = {};
        if (hooks.who?.length) row.hooks.who = hooks.who;
        if (hooks.what?.length) row.hooks.what = hooks.what;
        if (hooks.number?.length) row.hooks.number = hooks.number;
        if (hooks.where?.length) row.hooks.where = hooks.where;
      }
      if (Array.isArray(item.angles) && item.angles.length) {
        row.angles = item.angles;
      }
      return row;
    });
const batchNote = MERGE
  ? `\nIndexes are 0–${Math.max(0, items.length - 1)} in this list.\n`
  : slice.length === all.length
    ? ""
    : `\nThis batch is items ${offset + 1}–${offset + slice.length} of ${all.length}. Rewrite only these items.\n`;
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
