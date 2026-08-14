#!/usr/bin/env node
/**
 * Build the Copilot prompt with the slimmed briefing inlined so the model
 * does not need create/edit tools (those calls were dropping path/file_text).
 */

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PROMPT = path.join(ROOT, "scripts", "briefing-prompt.md");
const FILE = path.join(ROOT, "data", "current-events", "briefing.json");

const instructions = (await readFile(PROMPT, "utf8")).trim();
const data = JSON.parse(await readFile(FILE, "utf8"));
const input = {
  model: process.env.COPILOT_MODEL || "claude-haiku-4.5",
  windowStart: data.windowStart || "",
  windowEnd: data.windowEnd || "",
  items: (data.items || []).map((item) => ({
    headline: item.headline,
    people: item.people || [],
    summary: item.summary,
    section: item.section,
    tag: item.tag,
  })),
};

process.stdout.write(
  `${instructions}\n\nINPUT:\n${JSON.stringify(input, null, 2)}\n`
);
