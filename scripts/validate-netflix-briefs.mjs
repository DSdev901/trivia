#!/usr/bin/env node
/**
 * Confirm netflix.json still has the same titles after a brief merge.
 */

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { BRIEF_MAX, briefIsUsable } from "./apply-netflix-briefs.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FILE = process.argv[2] || path.join(ROOT, "data", "current-events", "netflix.json");

const data = JSON.parse(await readFile(FILE, "utf8"));
const items = Array.isArray(data.items) ? data.items : [];
if (items.length < 1) {
  throw new Error(`netflix.json has too few items (${items.length})`);
}
let briefs = 0;
for (const item of items) {
  if (!String(item.title || "").trim()) {
    throw new Error("netflix item missing title");
  }
  if (item.brief != null && typeof item.brief !== "string") {
    throw new Error(`brief must be a string (${item.title})`);
  }
  const synopsis = String(item.synopsis || "").trim();
  const brief = String(item.brief || "").trim();
  if (!synopsis) continue;
  if (!brief) {
    throw new Error(`missing brief (${item.title})`);
  }
  if (!briefIsUsable(brief, synopsis)) {
    throw new Error(
      `brief too long or still the full synopsis (${item.title}, ${brief.length} chars, max ${BRIEF_MAX})`
    );
  }
  briefs += 1;
}
if (briefs < 1) {
  throw new Error("netflix.json has no briefs");
}
console.log(`  [netflix] ${briefs}/${items.length} titles have briefs`);
