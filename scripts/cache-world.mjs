#!/usr/bin/env node
/**
 * Snapshot Google News World (plus BBC/NPR world RSS) and retain stories
 * for 21 days. Publishes data/current-events/world.json for the live feed.
 *
 *   node scripts/cache-world.mjs
 */

import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  RETENTION_DAYS,
  fetchLiveWorld,
  publishWorldFeed,
  readArchive,
  upsertStories,
} from "./lib/world.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, "data", "current-events");
const ARCHIVE_FILE = path.join(OUT_DIR, "world-headlines.json");
const FEED_FILE = path.join(OUT_DIR, "world.json");

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

  const live = await fetchLiveWorld(windowStart, windowEnd);
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

  const result = await publishWorldFeed({
    archiveFile: ARCHIVE_FILE,
    feedFile: FEED_FILE,
    items,
    nowIso,
    windowStart,
    windowEnd,
  });
  console.log(
    `World cache: ${result.archived} retained; ` +
      `${live.length} observed this run; ` +
      `feed: ${result.published} stories (${result.enriched} summaries enriched).`
  );
}

await main();
