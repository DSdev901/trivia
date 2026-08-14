#!/usr/bin/env node
/**
 * Shrink briefing.json to the top N clustered stories so Copilot can
 * rewrite summaries in one pass without burning credits on a 900-item file.
 */

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FILE = path.join(ROOT, "data", "current-events", "briefing.json");
const KEEP = Math.max(10, Number(process.argv[2] || 50));

const data = JSON.parse(await readFile(FILE, "utf8"));
const before = Array.isArray(data.items) ? data.items.length : 0;
data.items = (data.items || []).slice(0, KEEP);
await writeFile(FILE, `${JSON.stringify(data, null, 2)}\n`);
console.log(`  [briefing] slimmed ${before} → ${data.items.length} stories for Copilot`);
