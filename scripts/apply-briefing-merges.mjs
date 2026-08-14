#!/usr/bin/env node
/**
 * Apply Haiku's same-story merge groups to the ranked briefing.
 *
 * Usage: node scripts/apply-briefing-merges.mjs <copilot-output> <input-briefing>
 */

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { applyMergeGroups } from "../briefing.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "data", "current-events", "briefing.json");

function scanJsonValue(text, start) {
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === "{" || c === "[") depth += 1;
    else if (c === "}" || c === "]") {
      depth -= 1;
      if (depth === 0) {
        return { value: JSON.parse(text.slice(start, i + 1)), end: i + 1 };
      }
    }
  }
  return null;
}

function parsePayload(raw) {
  const trimmed = String(raw || "").trim();
  if (!trimmed) throw new Error("Copilot merge output was empty");
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const text = fenced ? fenced[1].trim() : trimmed;
  try {
    return JSON.parse(text);
  } catch {
    const start = text.search(/[{\[]/);
    if (start < 0) throw new SyntaxError("No JSON value found");
    const scanned = scanJsonValue(text, start);
    if (!scanned) throw new SyntaxError("Unterminated JSON value");
    return scanned.value;
  }
}

const copilotPath = process.argv[2];
const inputPath = process.argv[3];
if (!copilotPath || !inputPath) {
  throw new Error(
    "Usage: node scripts/apply-briefing-merges.mjs <copilot-output> <input-briefing>"
  );
}

const original = JSON.parse(await readFile(inputPath, "utf8"));
const parsed = parsePayload(await readFile(copilotPath, "utf8"));
const groups = Array.isArray(parsed)
  ? parsed
  : Array.isArray(parsed?.merges)
    ? parsed.merges
    : [];
const topN = Math.max(10, Number(process.env.BRIEFING_TOP_N || 40));
const head = original.items.slice(0, topN);
const tail = original.items.slice(topN);
const before = original.items.length;
const items = [...applyMergeGroups(head, groups), ...tail];
const merged = before - items.length;
if (merged < 1) {
  console.log("  [briefing] Haiku combover found no extra merges");
  process.exit(0);
}

const payload = {
  ...original,
  items,
  generatedAt: new Date().toISOString(),
};
const json = `${JSON.stringify(payload, null, 2)}\n`;
await writeFile(inputPath, json);
await writeFile(OUT, json);
console.log(
  `  [briefing] Haiku combover merged ${merged} extra card(s) (${before} → ${items.length})`
);
