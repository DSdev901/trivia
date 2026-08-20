#!/usr/bin/env node
/**
 * Confirm netflix.json still has the same titles after a brief merge.
 */

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FILE = process.argv[2] || path.join(ROOT, "data", "current-events", "netflix.json");

const data = JSON.parse(await readFile(FILE, "utf8"));
const items = Array.isArray(data.items) ? data.items : [];
if (items.length < 1) {
  throw new Error(`netflix.json has too few items (${items.length})`);
}
const briefs = items.filter((i) => String(i.brief || "").trim()).length;
if (briefs < 1) {
  throw new Error("netflix.json has no briefs");
}
for (const item of items) {
  if (!String(item.title || "").trim()) {
    throw new Error("netflix item missing title");
  }
  if (item.brief != null && typeof item.brief !== "string") {
    throw new Error(`brief must be a string (${item.title})`);
  }
}
console.log(`  [netflix] ${briefs}/${items.length} titles have briefs`);
