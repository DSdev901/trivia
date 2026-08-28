#!/usr/bin/env node
/**
 * Build data/current-events/briefing.json from the three feed files.
 * Used as the ranked list until Copilot overwrites it on the Tuesday job.
 */

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { buildBriefing } from "../briefing.js";
import { writeBriefingStamp } from "./lib/briefing-stamp.mjs";
import { enrichThinSummaries } from "./lib/summaries.mjs";

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
  const sports = await readFeed("sports");
  const entertainment = await readFeed("entertainment");
  const world = await readFeed("world");
  const sourceItems = [
    ...(sports?.items || []),
    ...(entertainment?.items || []),
    ...(world?.items || []),
  ];
  const filled = await enrichThinSummaries(sourceItems, {
    minLen: 80,
    espn: true,
    page: true,
    wiki: false,
    missingOnly: true,
  });
  if (filled) {
    console.log(`  [briefing] filled missing names/figures on ${filled} source stories`);
  }
  const built = buildBriefing({ sports, entertainment, world });
  const payload = {
    section: "briefing",
    source,
    model,
    generatedAt: new Date().toISOString(),
    windowStart: built.windowStart,
    windowEnd: built.windowEnd,
    items: built.items.map((item) => {
      const row = {
        headline: item.headline,
        people: item.people || [],
        summary: item.summary,
        section: item.section,
        tag: item.tag,
        date: item.date,
        url: item.url || "",
        coverage: item.coverage || 1,
      };
      if (item.hooks && Object.keys(item.hooks).length) {
        row.hooks = item.hooks;
      }
      if (Array.isArray(item.angles) && item.angles.length) {
        row.angles = item.angles;
      }
      return row;
    }),
  };
  await writeFile(OUT, `${JSON.stringify(payload, null, 2)}\n`);
  await writeBriefingStamp(payload.generatedAt);
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
