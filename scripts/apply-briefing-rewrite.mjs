#!/usr/bin/env node
/**
 * Merge Copilot's rewritten summaries onto the clustered briefing, then
 * write data/current-events/briefing.json. Keeps ranking and metadata.
 *
 * Usage: node scripts/apply-briefing-rewrite.mjs <copilot-output> <input-briefing>
 *
 * BRIEFING_OFFSET / BRIEFING_LIMIT apply a slice (for chunked Haiku runs).
 * Truncated Copilot JSON is salvaged: complete items are kept, the rest
 * stay heuristic.
 */

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { writeBriefingStamp } from "./lib/briefing-stamp.mjs";
import { attachHooks } from "../briefing.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "data", "current-events", "briefing.json");
const SECTIONS = new Set(["sports", "entertainment", "world"]);

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
      if (depth === 0) return { value: JSON.parse(text.slice(start, i + 1)), end: i + 1 };
    }
  }
  return null;
}

function salvageItems(text) {
  const key = text.search(/"items"\s*:/);
  if (key < 0) return null;
  const bracket = text.indexOf("[", key);
  if (bracket < 0) return null;
  const items = [];
  let i = bracket + 1;
  while (i < text.length) {
    while (i < text.length && (text[i] === "," || /\s/.test(text[i]))) i += 1;
    if (i >= text.length || text[i] === "]") break;
    if (text[i] !== "{") break;
    const scanned = scanJsonValue(text, i);
    if (!scanned) break;
    items.push(scanned.value);
    i = scanned.end;
  }
  return items.length ? { items } : null;
}

function parseJsonValue(text) {
  const start = text.search(/[{\[]/);
  if (start < 0) throw new SyntaxError("No JSON value found");
  const scanned = scanJsonValue(text, start);
  if (scanned) return scanned.value;
  const salvaged = salvageItems(text);
  if (salvaged) return salvaged;
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

function briefingTitle(raw, fallback) {
  const t = String(raw || "").replace(/\s+/g, " ").trim();
  if (t.length < 8) return fallback;
  if (t.length > 110) return `${t.slice(0, 107).replace(/\s+\S*$/, "")}…`;
  return t;
}

function mergeRow(orig, row) {
  const people = asPeople(row.people);
  const summary = String(row.summary || row.synopsis || "").trim();
  const headline = briefingTitle(row.headline || row.title || "", orig.headline);
  const section = SECTIONS.has(row.section) ? row.section : orig.section;
  return attachHooks({
    headline: headline || orig.headline,
    people: people && people.length ? people : orig.people || [],
    summary: summary || orig.summary,
    section,
    tag: String(row.tag || orig.tag || section).trim(),
    date: String(orig.date || row.date || "").slice(0, 10),
    url: String(orig.url || row.url || "").trim(),
    coverage: Math.max(1, Number(orig.coverage) || Number(row.coverage) || 1),
  });
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
if (!Array.isArray(rewritten) || !rewritten.length) {
  throw new Error("Copilot output had no items");
}

const offset = Math.max(0, Number(process.env.BRIEFING_OFFSET || 0));
const limitEnv = Number(process.env.BRIEFING_LIMIT || 0);
const remaining = Math.max(0, original.items.length - offset);
const expected = limitEnv > 0 ? Math.min(limitEnv, remaining) : remaining;
const used = Math.min(rewritten.length, expected);
if (used < 1) {
  throw new Error("Copilot output did not overlap this briefing slice");
}

let current;
try {
  current = JSON.parse(await readFile(OUT, "utf8"));
} catch {
  current = null;
}
if (
  !current ||
  !Array.isArray(current.items) ||
  current.items.length !== original.items.length
) {
  current = original;
}

const items = current.items.map((row, i) => {
  const src = original.items[i] || row;
  const local = i - offset;
  if (local < 0 || local >= used) return src;
  return mergeRow(src, rewritten[local] || {});
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
await writeBriefingStamp(payload.generatedAt);
const short =
  used < expected ? ` (salvaged ${used} of ${expected})` : "";
console.log(
  `  [briefing] merged ${used} Copilot summaries at offset ${offset}${short}`
);
