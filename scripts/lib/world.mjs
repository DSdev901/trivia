/**
 * Google News World topic + a couple of world RSS feeds.
 * Same 21-day rolling archive pattern as entertainment.
 */

import { writeFile } from "node:fs/promises";
import { enrichThinSummaries } from "./summaries.mjs";
import {
  RETENTION_DAYS,
  fetchText,
  googleNewsTopic,
  isoFrom,
  stripTags,
  upsertStories,
  readArchive,
} from "./entertainment.mjs";

export { RETENTION_DAYS, upsertStories, readArchive };

export const GN_WORLD =
  "https://news.google.com/rss/headlines/section/topic/WORLD?hl=en-US&gl=US&ceid=US:en";

const RSS_FEEDS = [
  ["https://feeds.bbci.co.uk/news/world/rss.xml", "World"],
  ["https://feeds.npr.org/1004/rss.xml", "World"],
];

const JUNK_RE =
  /\b(horoscope|crossword|recipe|your stars|poll:|quiz:|how to watch|where to watch)\b|^\s*opinion\b|\bop-ed\b/i;

export function guessWorldTag(headline, summary = "") {
  const t = `${headline} ${summary}`;
  if (
    /\b(war|warfare|missile|airstrike|ceasefire|invasion|troops|battlefield|bombing)\b/i.test(
      t
    )
  ) {
    return "Conflict";
  }
  if (
    /\b(earthquake|hurricane|typhoon|flood|wildfire|tsunami|volcano|famine|outbreak)\b/i.test(
      t
    )
  ) {
    return "Disaster";
  }
  if (
    /\b(re-?elect|elect(?:ion|ed)|vote|referendum|parliament|prime minister|coup|impeach|sanction)\b/i.test(
      t
    )
  ) {
    return "Politics";
  }
  if (
    /\b(tariff|inflation|gdp|recession|central bank|imf|world bank|trade war)\b/i.test(
      t
    )
  ) {
    return "Economy";
  }
  return "World";
}

function parseWorldRss(xml, windowStart, windowEnd) {
  const items = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const block = m[1];
    const pick = (name) => {
      const mm = block.match(
        new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`)
      );
      return mm ? stripTags(mm[1]) : "";
    };
    const date = isoFrom(pick("pubDate"));
    const headline = pick("title");
    if (
      !date ||
      date < windowStart ||
      date > windowEnd ||
      !headline ||
      JUNK_RE.test(headline)
    ) {
      continue;
    }
    items.push({
      headline,
      date,
      bucket: guessWorldTag(headline, pick("description")),
      summary: pick("description").slice(0, 420),
      url: pick("link"),
    });
  }
  return items;
}

export async function fetchLiveWorld(windowStart, windowEnd) {
  const live = [];
  await Promise.all(
    RSS_FEEDS.map(async ([url]) => {
      try {
        live.push(
          ...parseWorldRss(await fetchText(url), windowStart, windowEnd)
        );
      } catch (err) {
        console.warn(`  [world] ${url}: ${err.message}`);
      }
    })
  );

  const gn = await googleNewsTopic(GN_WORLD, windowStart, windowEnd, 40);
  for (const g of gn) {
    if (JUNK_RE.test(g.headline)) continue;
    live.push({
      headline: g.headline,
      date: g.date,
      bucket: guessWorldTag(g.headline),
      summary: g.source ? `Reported by ${g.source}.` : "",
      url: g.url,
      top: true,
      bestRank: g.rank + 1,
    });
  }
  return live;
}

function toFeedItem(item) {
  const card = {
    headline: item.headline,
    date: item.date,
    tag: item.bucket || guessWorldTag(item.headline, item.summary),
    summary: (item.summary || "").trim(),
    url: item.url || "",
  };
  if (item.top || (item.bestRank ?? 99) <= 12) card.top = true;
  return card;
}

export async function publishWorldFeed({
  archiveFile,
  feedFile,
  items,
  nowIso,
  windowStart,
  windowEnd,
}) {
  const archive = {
    source: "Google News World",
    generatedAt: nowIso,
    retentionDays: RETENTION_DAYS,
    windowStart,
    windowEnd,
    snapshotIntervalHours: 3,
    count: items.length,
    items,
  };
  await writeFile(archiveFile, `${JSON.stringify(archive, null, 2)}\n`);

  const feedItems = items
    .filter((i) => !JUNK_RE.test(i.headline))
    .map(toFeedItem);
  const n = await enrichThinSummaries(feedItems, {
    minLen: 80,
    espn: false,
    page: true,
    wiki: true,
  });
  const feed = {
    section: "world",
    source: "Google News World",
    generatedAt: nowIso,
    windowStart,
    windowEnd,
    items: feedItems,
  };
  await writeFile(feedFile, `${JSON.stringify(feed, null, 2)}\n`);
  return { archived: items.length, published: feedItems.length, enriched: n };
}
