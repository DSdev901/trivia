#!/usr/bin/env node
/**
 * Confirm Copilot wrote a usable briefing.json. Stamps source/model on success.
 */

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FILE = path.join(ROOT, "data", "current-events", "briefing.json");
const SECTIONS = new Set(["sports", "entertainment"]);

function parsePayload(raw) {
  const trimmed = String(raw || "").trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  return JSON.parse(fenced ? fenced[1] : trimmed);
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
  });
}

if (items.length < 10) {
  throw new Error(`briefing.json had too few valid headlines (${items.length})`);
}

const payload = {
  section: "briefing",
  source: "copilot-auto",
  model: "claude-haiku-4.5",
  generatedAt: data.generatedAt || new Date().toISOString(),
  windowStart: data.windowStart || "",
  windowEnd: data.windowEnd || "",
  items,
};

await writeFile(FILE, `${JSON.stringify(payload, null, 2)}\n`);
console.log(`  [briefing] validated ${items.length} Copilot-ranked stories`);
