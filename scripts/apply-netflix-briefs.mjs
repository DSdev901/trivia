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

export const BRIEF_MAX = 125;
const BRIEF_MIN = 40;
const CLIP_FALLBACK = 110;
const HANGING_WORD =
  /(?:\s+(?:a|an|the|and|or|but|nor|while|as|to|of|for|with|from|by|in|on|at|into|about|than|most|against|his|her|their|its|she|he|they|who|that|this|these|those|intersecting|dangerous|unprecedented|ceaseless))+$/i;

export function tidyBrief(raw) {
  return String(raw || "").replace(/\s+/g, " ").trim();
}

function capitalizeLead(t) {
  return t.replace(/^[a-z]/, (c) => c.toUpperCase());
}

function ensureSentence(t) {
  let s = capitalizeLead(
    tidyBrief(t)
      .replace(/[\s,;:]+$/g, "")
      .replace(/[—–-]+$/g, "")
      .trim()
  );
  if (!s) return "";
  if (!/[.!?]$/.test(s)) s += ".";
  return s;
}

function stripFluff(s) {
  let t = tidyBrief(s);
  t = t.replace(/^In this [^,]{4,90},\s+/i, "");
  t = t.replace(/^In the coming of age show,\s+/i, "");
  t = t.replace(/^In never-before-heard [^,]+,\s+/i, "");
  t = t.replace(/\s+streamed live on Netflix\.?$/i, ".");
  t = t.replace(/\s+filmed at [^.]+\.?$/i, ".");
  t = t.replace(
    /\s+in this (?:raucous |witty |candid )?stand-up special\.?$/i,
    "."
  );
  t = t.replace(
    /\b(?:unrelenting laughs|highly stylized|candid and clever|must-watch)\b/gi,
    ""
  );
  t = t.replace(/\s+delivers\s*\.?$/i, ".");
  t = t.replace(/\s+/g, " ").trim().replace(/^[,;.\s]+/, "");
  const modifier = t.match(
    /^((?:[A-Z][\w']+(?:ed|ing)|Caught|Desperate|Tormented|Ready) [^,]{8,80}),\s+((?:[A-Z]|a |an |the ).+)$/i
  );
  if (modifier && modifier[2].length >= 36) t = modifier[2];
  return capitalizeLead(t);
}

function sentenceParts(t) {
  const protectedText = t.replace(/\b([A-Z])\./g, "$1\u0000");
  return (
    protectedText
      .match(/[^.!?]+[.!?]+(?:\s|$)/g)
      ?.map((p) => p.replace(/\u0000/g, ".").trim()) || []
  );
}

const BREAKS = [
  { mark: " — ", min: 48, strength: 3 },
  { mark: " – ", min: 48, strength: 3 },
  { mark: " (aka", min: 32, strength: 3 },
  { mark: " while ", min: 56, strength: 3 },
  { mark: " until ", min: 56, strength: 2 },
  { mark: " after ", min: 56, strength: 2 },
  { mark: " as they ", min: 64, strength: 2 },
  { mark: "; ", min: 56, strength: 2 },
  { mark: ", and ", min: 64, strength: 1 },
  { mark: ", but ", min: 64, strength: 1 },
  { mark: " and ", min: 88, strength: 1 },
  { mark: ", ", min: 72, strength: 0 },
];

function bestBreak(window, target = 100) {
  let best = null;
  for (const { mark, min, strength } of BREAKS) {
    let from = 0;
    while (from < window.length) {
      const idx = window.indexOf(mark, from);
      if (idx < 0) break;
      if (idx >= min) {
        const dist = Math.abs(idx - target);
        const next = { idx, strength, dist };
        if (
          !best ||
          next.strength > best.strength ||
          (next.strength === best.strength && next.dist < best.dist) ||
          (next.strength === best.strength &&
            next.dist === best.dist &&
            next.idx > best.idx)
        ) {
          best = next;
        }
      }
      from = idx + mark.length;
    }
  }
  return best?.idx ?? -1;
}

function clipBrief(t, max) {
  const s = tidyBrief(t);
  if (s.length <= max) return ensureSentence(s);
  const window = s.slice(0, max);
  const at = bestBreak(window, 100);
  let cut =
    at >= 48
      ? window.slice(0, at)
      : s.slice(0, CLIP_FALLBACK).replace(/\s+\S*$/, "");
  cut = cut.replace(HANGING_WORD, "").replace(/['']s$/i, "").replace(/[,;:]+$/, "").trim();
  if (cut.length < 32) {
    cut = s.slice(0, CLIP_FALLBACK).replace(/\s+\S*$/, "").replace(HANGING_WORD, "");
  }
  return ensureSentence(cut);
}

/** Short stand-in from the synopsis. Prefer a statement over a tagline. */
export function compressBrief(synopsis) {
  const t = stripFluff(synopsis);
  if (!t) return "";
  const parts = sentenceParts(t);
  if (!parts.length) return clipBrief(t, BRIEF_MAX);

  const statements = parts.filter((p) => !p.endsWith("?"));
  const pool = statements.length ? statements : parts;
  let out = pool[0];
  if (out.length < BRIEF_MIN && parts[0].endsWith("?") && parts[0] !== out) {
    out = `${parts[0]} ${out}`;
  }
  for (let i = 1; i < pool.length && out.length < BRIEF_MIN; i++) {
    if (pool[i].endsWith("?") && out.length >= 24) break;
    out = `${out} ${pool[i]}`;
  }
  return clipBrief(out, BRIEF_MAX);
}

export function firstSentence(s) {
  return compressBrief(s);
}

export function briefIsUsable(brief, synopsis) {
  const b = tidyBrief(brief);
  const s = tidyBrief(synopsis);
  if (!b) return false;
  if (b.length > BRIEF_MAX) return false;
  if (/^in this /i.test(b)) return false;
  if (
    /\b(candid and clever|highly stylized|unrelenting laughs|must-watch)\b/i.test(
      b
    )
  ) {
    return false;
  }
  if (s.length > BRIEF_MAX && b === s) return false;
  if (
    /\b(the|and|or|but|while|a|an|to|of|for|with|from|by|in|on|at|after|she|he|they|who|that|this)\.?$/i.test(
      b
    )
  ) {
    return false;
  }
  return true;
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
    const fromCopilot = tidyBrief(briefs.get(key) || "");
    const existing = tidyBrief(item.brief);
    let brief = "";
    if (fromCopilot && briefIsUsable(fromCopilot, item.synopsis)) {
      brief = fromCopilot;
    } else if (!rebuild && briefIsUsable(existing, item.synopsis)) {
      brief = existing;
    } else if (fillMissing || rebuild || fromCopilot) {
      brief = compressBrief(item.synopsis);
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
        ? `  [netflix] bootstrapped ${applied} briefs`
        : `  [netflix] merged ${applied} Copilot briefs`
    );
  }
}
