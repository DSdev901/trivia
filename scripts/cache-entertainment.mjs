#!/usr/bin/env node
/**
 * Snapshot Google News + entertainment RSS and retain every observed story
 * for 21 days. Live feeds only carry a few days of posts, so frequent
 * snapshots are required to keep a three-week window without repeats.
 *
 * Also publishes data/current-events/entertainment.json so the live tab
 * updates every three hours.
 *
 *   node scripts/cache-entertainment.mjs
 */

import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  RETENTION_DAYS,
  fetchLiveEntertainment,
  publishEntertainmentFeed,
  readArchive,
  upsertStories,
} from "./lib/entertainment.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, "data", "current-events");
const ARCHIVE_FILE = path.join(OUT_DIR, "entertainment-headlines.json");
const FEED_FILE = path.join(OUT_DIR, "entertainment.json");

const now = new Date();
const nowIso = now.toISOString();
const windowEnd = nowIso.slice(0, 10);
const windowStart = new Date(now.getTime() - RETENTION_DAYS * 86400000)
  .toISOString()
  .slice(0, 10);

async function main() {
  const existing = (await readArchive(ARCHIVE_FILE)).filter(
    (i) => i.date >= windowStart && i.date <= windowEnd
  );
  const byKey = new Map();
  upsertStories(byKey, existing);

  const live = await fetchLiveEntertainment(windowStart, windowEnd);
  upsertStories(
    byKey,
    live.map((i) => ({ ...i, firstSeen: nowIso }))
  );

  const items = [...byKey.values()]
    .filter((i) => i.date >= windowStart && i.date <= windowEnd)
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) ||
        (a.bestRank ?? 1e9) - (b.bestRank ?? 1e9)
    );

  const result = await publishEntertainmentFeed({
    archiveFile: ARCHIVE_FILE,
    feedFile: FEED_FILE,
    items,
    nowIso,
    windowStart,
    windowEnd,
  });
  console.log(
    `Entertainment cache: ${result.archived} retained; ` +
      `${live.length} observed this run; ` +
      `feed: ${result.published} stories (${result.enriched} summaries enriched).`
  );
}

await main();
