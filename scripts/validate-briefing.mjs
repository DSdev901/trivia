#!/usr/bin/env node
/**
 * Confirm Copilot wrote a usable briefing.json. Stamps source/model on success.
 */

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FILE = path.join(ROOT, "data", "current-events", "briefing.json");
const SECTIONS = new Set(["sports", "entertainment", "world"]);

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
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const text = fenced ? fenced[1].trim() : trimmed;
  try {
    return JSON.parse(text);
  } catch {
    return parseJsonValue(text);
  }
}

function asPeople(value) {
  if (!Array.isArray(value)) return [];
  return value.map((n) => String(n || "").trim()).filter(Boolean).slice(0, 4);
}

const raw = await readFile(FILE, "utf8");
const data = parsePayload(raw);
if (!data || !Array.isArray(data.items) || data.items.length < 10) {
  throw new Error(
    `briefing.json needs at least 10 items (got ${data?.items?.length ?? 0})`
  );
}

const items = [];
for (const row of data.items) {
  const headline = String(row?.headline || row?.title || "").trim();
  if (!headline) continue;
  const section = SECTIONS.has(row.section) ? row.section : "entertainment";
  items.push({
    headline,
    people: asPeople(row.people),
    summary: String(row.summary || row.synopsis || "").trim(),
    section,
    tag: String(row.tag || row.sport || row.type || section).trim(),
    date: String(row.date || "").slice(0, 10),
    url: String(row.url || "").trim(),
    coverage: Math.max(1, Number(row.coverage) || 1),
  });
}

if (items.length < 10) {
  throw new Error(`briefing.json had too few valid headlines (${items.length})`);
}

const payload = {
  section: "briefing",
  source: "copilot-auto",
  model: process.env.COPILOT_MODEL || data.model || "claude-haiku-4.5",
  generatedAt: data.generatedAt || new Date().toISOString(),
  windowStart: data.windowStart || "",
  windowEnd: data.windowEnd || "",
  items,
};

await writeFile(FILE, `${JSON.stringify(payload, null, 2)}\n`);
console.log(`  [briefing] validated ${items.length} stories`);
