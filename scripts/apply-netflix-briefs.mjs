#!/usr/bin/env node
/**
 * Merge Copilot (or bootstrap) one-line blurbs onto netflix.json by title.
 *
 *   node scripts/apply-netflix-briefs.mjs <copilot-output> [netflix.json]
 *   node scripts/apply-netflix-briefs.mjs --bootstrap [--rebuild] [netflix.json]
 */

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_FILE = path.join(ROOT, "data", "current-events", "netflix.json");

export function normTitle(s) {
  return String(s || "").replace(/\s+/g, " ").trim().toLowerCase();
}

export function tidyBrief(raw) {
  return String(raw || "").replace(/\s+/g, " ").trim();
}

export function firstSentence(s) {
  const t = String(s || "").replace(/\s+/g, " ").trim();
  if (!t) return "";
  const parts = t.match(/[^.!?]+[.!?]+(?:\s|$)/g);
  if (!parts) return t;
  let out = parts[0].trim();
  let i = 1;
  while (out.length < 72 && parts[i]) {
    out = `${out} ${parts[i].trim()}`;
    i += 1;
  }
  return out;
}

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

export function parsePayload(raw) {
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

export function briefMapFromCopilot(parsed) {
  const rows = Array.isArray(parsed) ? parsed : parsed.items;
  const map = new Map();
  if (!Array.isArray(rows)) return map;
  for (const row of rows) {
    const title = normTitle(row?.title);
    const brief = tidyBrief(row?.brief || row?.summary || row?.synopsis);
    if (title && brief) map.set(title, brief);
  }
  return map;
}

export function applyBriefs(payload, briefs, { fillMissing = false, rebuild = false } = {}) {
  let applied = 0;
  const items = (payload.items || []).map((item) => {
    const key = normTitle(item.title);
    const fromCopilot = briefs.get(key) || "";
    let brief = fromCopilot;
    if (!brief && fillMissing && (rebuild || !item.brief)) {
      brief = firstSentence(item.synopsis);
    }
    if (!brief) return item;
    applied += 1;
    return { ...item, brief };
  });
  return { ...payload, items, applied };
}

const entry = process.argv[1];
const isMain = Boolean(entry) && import.meta.url === pathToFileURL(entry).href;
if (isMain) {
  const bootstrap = process.argv.includes("--bootstrap");
  const rebuild = process.argv.includes("--rebuild");
  const args = process.argv
    .slice(2)
    .filter((a) => a !== "--bootstrap" && a !== "--rebuild");
  const filePath = bootstrap ? args[0] || DEFAULT_FILE : args[1] || DEFAULT_FILE;

  if (!bootstrap && !args[0]) {
    throw new Error(
      "Usage: node scripts/apply-netflix-briefs.mjs <copilot-output> [netflix.json]\n" +
        "       node scripts/apply-netflix-briefs.mjs --bootstrap [--rebuild] [netflix.json]"
    );
  }

  const payload = JSON.parse(await readFile(filePath, "utf8"));
  const briefs = bootstrap
    ? new Map()
    : briefMapFromCopilot(parsePayload(await readFile(args[0], "utf8")));
  const next = applyBriefs(payload, briefs, { fillMissing: bootstrap, rebuild });
  if (!next.applied) {
    const have = (payload.items || []).some((i) => String(i.brief || "").trim());
    if (bootstrap && have) {
      console.log("  [netflix] briefs already present");
    } else {
      throw new Error("No Netflix briefs applied");
    }
  } else {
    const { applied, ...out } = next;
    await writeFile(filePath, `${JSON.stringify(out, null, 2)}\n`);
    console.log(
      bootstrap
        ? `  [netflix] bootstrapped ${applied} briefs from first sentences`
        : `  [netflix] merged ${applied} Copilot briefs`
    );
  }
}
