#!/usr/bin/env node
/**
 * Merge Copilot's rewritten summaries onto the clustered briefing, then
 * write data/current-events/briefing.json. Keeps ranking and metadata.
 *
 * Usage: node scripts/apply-briefing-rewrite.mjs <copilot-output> <input-briefing>
 */

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "data", "current-events", "briefing.json");
const SECTIONS = new Set(["sports", "entertainment"]);

function parseJsonValue(text) {
  const start = text.search(/[{\[]/);
  if (start < 0) throw new SyntaxError("No JSON value found");
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
      if (depth === 0) return JSON.parse(text.slice(start, i + 1));
    }
  }
  throw new SyntaxError("Unterminated JSON value");
}

function parsePayload(raw) {
  const trimmed = String(raw || "").trim();
  if (!trimmed) throw new Error("Copilot output was empty");
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const text = fenced ? fenced[1].trim() : trimmed;
  try {
    return JSON.parse(text);
  } catch {
    return parseJsonValue(text);
  }
}

function asPeople(value) {
  if (!Array.isArray(value)) return null;
  return value.map((n) => String(n || "").trim()).filter(Boolean).slice(0, 3);
}

const copilotPath = process.argv[2];
const inputPath = process.argv[3];
if (!copilotPath || !inputPath) {
  throw new Error(
    "Usage: node scripts/apply-briefing-rewrite.mjs <copilot-output> <input-briefing>"
  );
}

const original = JSON.parse(await readFile(inputPath, "utf8"));
const parsed = parsePayload(await readFile(copilotPath, "utf8"));
const rewritten = Array.isArray(parsed) ? parsed : parsed.items;
if (!Array.isArray(rewritten) || rewritten.length !== original.items.length) {
  throw new Error(
    `Copilot item count ${rewritten?.length ?? 0} != ${original.items.length}`
  );
}

const items = original.items.map((orig, i) => {
  const row = rewritten[i] || {};
  const people = asPeople(row.people);
  const summary = String(row.summary || row.synopsis || "").trim();
  const headline = String(row.headline || row.title || "").trim();
  const section = SECTIONS.has(row.section) ? row.section : orig.section;
  return {
    headline: headline || orig.headline,
    people: people && people.length ? people : orig.people || [],
    summary: summary || orig.summary,
    section,
    tag: String(row.tag || orig.tag || section).trim(),
    date: String(orig.date || row.date || "").slice(0, 10),
    url: String(orig.url || row.url || "").trim(),
    coverage: Math.max(1, Number(orig.coverage) || Number(row.coverage) || 1),
  };
});

const payload = {
  section: "briefing",
  source: "copilot-auto",
  model: process.env.COPILOT_MODEL || original.model || "claude-haiku-4.5",
  generatedAt: new Date().toISOString(),
  windowStart: original.windowStart || "",
  windowEnd: original.windowEnd || "",
  items,
};

await writeFile(OUT, `${JSON.stringify(payload, null, 2)}\n`);
console.log(`  [briefing] merged ${items.length} Copilot summaries`);
