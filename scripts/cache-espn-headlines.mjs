#!/usr/bin/env node
/**
 * Snapshot ESPN's rolling news endpoints and retain every observed headline
 * for 14 days. ESPN caps each league response at 50 and does not expose
 * working pagination/date parameters, so frequent snapshots are required.
 *
 * Also publishes data/current-events/sports.json from that archive so the
 * live Sports tab updates every three hours (no Google News).
 *
 *   node scripts/cache-espn-headlines.mjs
 */

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, "data", "current-events");
const OUT_FILE = path.join(OUT_DIR, "espn-headlines.json");
const SPORTS_FEED = path.join(OUT_DIR, "sports.json");
const RETENTION_DAYS = 14;
const now = new Date();
const nowIso = now.toISOString();
const cutoff = new Date(now.getTime() - RETENTION_DAYS * 86400000);

/** Filler that isn't a notable story — kept out of the user-facing feed. */
const SPORTS_JUNK_RE =
  /\bfantasy\b|forecaster|lineup advice|game highlights|\bpodcast\b|betting odds|how to watch|where to watch|\bodds\b|\bpicks\b|\brankings?\b|\bbuzz:|latest intel|intel, updates|new threads|experts? grad|grades for\b|mock (draft|trade)|some thoughts|\bhoping to\b|fight night|news roundup|trade grades|\bgrades:/i;

// ESPN returns at most 50 articles even when a larger limit is requested.
// Keep all of them in the archive; display-time filters decide what's notable.
const ESPN_LEAGUES = [
  ["football/nfl", "NFL"],
  ["football/college-football", "College football"],
  ["baseball/mlb", "MLB"],
  ["basketball/nba", "NBA"],
  ["basketball/wnba", "WNBA"],
  ["basketball/mens-college-basketball", "College basketball"],
  ["basketball/womens-college-basketball", "Women's college basketball"],
  ["hockey/nhl", "NHL"],
  ["golf/pga", "Golf"],
  ["soccer/eng.1", "Soccer"],
  ["soccer/usa.1", "Soccer"],
  ["soccer/fifa.world", "Soccer"],
  ["racing/nascar-premier", "NASCAR"],
  ["racing/f1", "F1"],
  ["tennis/atp", "Tennis"],
  ["tennis/wta", "Tennis"],
  ["mma/ufc", "MMA"],
];

async function fetchJson(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const response = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "User-Agent":
          "TriviaHelper/1.0 (https://github.com/DSdev901/trivia)",
        Accept: "application/json",
        "Cache-Control": "no-cache",
      },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

function articleKey(article) {
  const url = article.links?.web?.href || "";
  return String(article.id || url || article.headline || "")
    .trim()
    .toLowerCase();
}

function isRetained(item) {
  const published = new Date(item.published);
  return !Number.isNaN(published.getTime()) && published >= cutoff;
}

async function readExisting() {
  try {
    const payload = JSON.parse(await readFile(OUT_FILE, "utf8"));
    return Array.isArray(payload.items) ? payload.items : [];
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.warn(`Could not read existing ESPN cache: ${error.message}`);
    }
    return [];
  }
}

async function main() {
  const existing = (await readExisting()).filter(isRetained);
  const byKey = new Map(existing.map((item) => [item.key, item]));
  let observed = 0;
  let failed = 0;

  await Promise.all(
    ESPN_LEAGUES.map(async ([endpoint, sport]) => {
      const url =
        `https://site.api.espn.com/apis/site/v2/sports/${endpoint}/news` +
        "?limit=100";
      try {
        const data = await fetchJson(url);
        for (const [index, article] of (data.articles || []).entries()) {
          const key = articleKey(article);
          const published = new Date(article.published || "");
          if (!key || Number.isNaN(published.getTime()) || published < cutoff) {
            continue;
          }
          observed += 1;
          const previous = byKey.get(key);
          const url = article.links?.web?.href || previous?.url || "";
          const summary = (article.description || "").trim();
          byKey.set(key, {
            key,
            id: String(article.id || previous?.id || ""),
            headline: (article.headline || previous?.headline || "").trim(),
            summary:
              summary.length >= (previous?.summary || "").length
                ? summary
                : previous.summary,
            url,
            sport,
            published: published.toISOString(),
            firstSeen: previous?.firstSeen || nowIso,
            bestRank: Math.min(previous?.bestRank ?? Infinity, index + 1),
          });
        }
      } catch (error) {
        failed += 1;
        console.warn(`  [espn] ${endpoint}: ${error.message}`);
      }
    })
  );

  const items = [...byKey.values()]
    .filter(isRetained)
    .map(({ lastSeen, appearances, latestRank, ...item }) => item)
    .sort(
      (a, b) =>
        b.published.localeCompare(a.published) ||
        a.bestRank - b.bestRank
    );
  const payload = {
    source: "ESPN",
    generatedAt: nowIso,
    retentionDays: RETENTION_DAYS,
    windowStart: cutoff.toISOString(),
    windowEnd: nowIso,
    snapshotIntervalHours: 3,
    configuredLeagues: [...new Set(ESPN_LEAGUES.map(([, sport]) => sport))],
    count: items.length,
    items,
  };
  await writeFile(OUT_FILE, `${JSON.stringify(payload, null, 2)}\n`);

  // User-facing Sports tab: ESPN only, full 14-day window, newest first.
  const feedItems = items
    .filter((i) => (i.headline || "").trim() && !SPORTS_JUNK_RE.test(i.headline))
    .map((i) => {
      const card = {
        headline: i.headline.trim(),
        date: i.published.slice(0, 10),
        sport: i.sport || "Sports",
        summary: (i.summary || "").trim(),
        url: i.url || "",
      };
      // Stories that hit the top of a league feed at some point.
      if (i.bestRank <= 5) card.top = true;
      return card;
    });
  const feed = {
    section: "sports",
    source: "ESPN",
    generatedAt: nowIso,
    windowStart: cutoff.toISOString().slice(0, 10),
    windowEnd: nowIso.slice(0, 10),
    items: feedItems,
  };
  await writeFile(SPORTS_FEED, `${JSON.stringify(feed, null, 2)}\n`);

  console.log(
    `ESPN cache: ${items.length} retained; ${observed} observed; ` +
      `${failed}/${ESPN_LEAGUES.length} endpoints failed; ` +
      `sports feed: ${feedItems.length} stories.`
  );
  if (failed === ESPN_LEAGUES.length) process.exitCode = 1;
}

await main();
