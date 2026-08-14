#!/usr/bin/env node
/**
 * Build data/current-events/briefing.json from the three feed files.
 * Used as the ranked list until Copilot overwrites it on the Tuesday job.
 */

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { buildBriefing } from "../briefing.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR = path.join(ROOT, "data", "current-events");
const OUT = path.join(DIR, "briefing.json");

async function readFeed(name) {
  try {
    return JSON.parse(await readFile(path.join(DIR, `${name}.json`), "utf8"));
  } catch {
    return null;
  }
}

export async function writeBriefingFile({
  source = "heuristic",
  model = null,
} = {}) {
  const data = {
    sports: await readFeed("sports"),
    entertainment: await readFeed("entertainment"),
  };
  const built = buildBriefing(data);
  const payload = {
    section: "briefing",
    source,
    model,
    generatedAt: new Date().toISOString(),
    windowStart: built.windowStart,
    windowEnd: built.windowEnd,
    items: built.items.map((item) => ({
      headline: item.headline,
      people: item.people || [],
      summary: item.summary,
      section: item.section,
      tag: item.tag,
      date: item.date,
      url: item.url || "",
      coverage: item.coverage || 1,
    })),
  };
  await writeFile(OUT, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(
    `  [briefing] wrote ${payload.items.length} ranked stories (${source})`
  );
  return payload;
}

const isMain =
  process.argv[1] &&
  path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1]);

if (isMain) {
  writeBriefingFile().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
