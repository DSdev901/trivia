/**
 * Shared entertainment fetch + merge helpers.
 * Used by the 3-hour cache and the Tuesday full refresh.
 */

import { readFile, writeFile } from "node:fs/promises";
import { enrichThinSummaries, clusterHeadlinesFromRss, pickNamedHeadline } from "./summaries.mjs";

export const RETENTION_DAYS = 21;

export const GN_ENTERTAINMENT =
  "https://news.google.com/rss/headlines/section/topic/ENTERTAINMENT?hl=en-US&gl=US&ceid=US:en";

export const RSS_FEEDS = [
  ["https://variety.com/feed/", "Movies/TV"],
  ["https://deadline.com/feed/", "Movies/TV"],
  [
    "https://www.eonline.com/syndication/feeds/rssfeeds/topstories.xml",
    "Celebrity",
  ],
  ["https://pagesix.com/feed/", "Celebrity"],
  ["https://www.usmagazine.com/feed/", "Celebrity"],
  ["https://www.tmz.com/rss.xml", "Celebrity"],
];

export const JUNK_RE =
  /\b(loafers|sneakers|sandals|leggings|lipstick|mascara|faves|gift guide|deals|under \$\d+|where to buy|shop now|amazon arrivals)\b|\bon sale\b|\bsale (is|alert)\b|^\d+\s+(best|top|celebrit)\b|\bhoroscope\b/i;

export const MILESTONE_RE =
  /box office|highest-grossing|opening weekend|biggest (opening|debut|weekend|premiere)|most[- ]watched|billion|surpass(?:es|ed)?|overtake(?:s|n)?|crosses \$|breaks? (?:the )?record|record-breaking|record high|shatters?|milestone|\b\d+(?:th|st|nd|rd) anniversary\b/i;

export const BACKFILL_SKIP_RE =
  /\?|\bpreview(s)?\b|\breview(s)?\b|\bhow (many|to)\b|how to watch|where to watch|what to watch|\bcould\b|\bwould\b|\bpromo\b|promo code|bonus|sleeper|\bodds\b|\bdfs\b|prediction|\bpicks\b|jewelry|of all time|\bsale\b|best deal|subscription|\btracker\b|\brumors?\b|landing spots|destinations for|latest (intel|updates|news|buzz)|\bbuzz:|inside a week|week in review|wedding singer|\bevery\b.{0,24}?\b(deal|winner|loser|move)s?\b|all \d+ teams|\beach team'?s\b|^(the )?\d+ (best|top|highest|greatest|worst|most|celebrit|movies|films|shows|things|ways|times|moments|significant|biggest|takeaways|surprises)/i;

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "with",
  "over", "after", "as", "at", "by", "from", "is", "are", "was", "were",
  "his", "her", "their", "its", "what", "why", "how", "into", "vs", "new",
  "says", "amid",
]);

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function fetchText(url, timeoutMs = 15000, ua = UA) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "User-Agent": ua,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.8,*/*;q=0.7",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

export function stripTags(html) {
  return String(html || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) =>
      String.fromCodePoint(parseInt(n, 16))
    )
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&rsquo;|&lsquo;|&apos;/g, "'")
    .replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/&hellip;/g, "…")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isoFrom(dateLike) {
  const d = new Date(dateLike);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

export function headlineTokens(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

export function tokensMatch(aTokens, bTokens, minScore = 0.3) {
  const a = new Set(aTokens);
  const shared = bTokens.filter((w) => a.has(w)).length;
  const union = new Set([...aTokens, ...bTokens]).size;
  return shared >= 4 && shared / union >= minScore;
}

export function storyKey(headline) {
  return headlineTokens(headline).slice(0, 8).join(" ");
}

export function tagFor(headline, summary, bucket) {
  return MILESTONE_RE.test(`${headline} ${summary}`) ? "Milestone" : bucket;
}

export function guessBucket(headline) {
  return /box office|film|movie|series|\btv\b|show|trailer|netflix|premiere|sequel|remake|killed off|season \d|finale/i.test(
    headline
  )
    ? "Movies/TV"
    : "Celebrity";
}

export function parseRss(xml, tag, windowStart, windowEnd) {
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
    )
      continue;
    items.push({
      headline,
      date,
      bucket: tag,
      summary: pick("description").slice(0, 420),
      url: pick("link"),
    });
  }
  return items;
}

export async function googleNewsTopic(url, windowStart, windowEnd, limit = 15) {
  try {
    const xml = await fetchText(url);
    return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)]
      .map((m, idx) => {
        const block = m[1];
        const grab = (re) => (block.match(re) || [])[1] || "";
        const full = stripTags(grab(/<title>([\s\S]*?)<\/title>/));
        const cluster = clusterHeadlinesFromRss(
          grab(/<description>([\s\S]*?)<\/description>/)
        );
        const headline = pickNamedHeadline(
          full.replace(/ - [^-]{2,40}$/, "").trim(),
          cluster
        );
        return {
          rank: idx,
          headline,
          tokens: headlineTokens(headline),
          source: stripTags(grab(/<source[^>]*>([\s\S]*?)<\/source>/)),
          url: grab(/<link>([\s\S]*?)<\/link>/).trim(),
          date: isoFrom(grab(/<pubDate>(.*?)<\/pubDate>/)),
        };
      })
      .filter(
        (i) =>
          i.headline &&
          i.tokens.length >= 3 &&
          i.date &&
          i.date >= windowStart &&
          i.date <= windowEnd
      )
      .slice(0, limit);
  } catch (err) {
    console.warn(`  [googlenews] ${err.message}`);
    return [];
  }
}

export async function googleNewsSearch(
  query,
  windowStart,
  windowEnd,
  limit = 12,
  range = null
) {
  try {
    const when = range
      ? `after:${range.after} before:${range.before}`
      : `after:${windowStart}`;
    const url =
      "https://news.google.com/rss/search?q=" +
      encodeURIComponent(`${query} ${when}`) +
      "&hl=en-US&gl=US&ceid=US:en";
    const xml = await fetchText(url);
    return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)]
      .slice(0, limit * 3)
      .map((m, idx) => {
        const block = m[1];
        const grab = (re) => (block.match(re) || [])[1] || "";
        const full = stripTags(grab(/<title>([\s\S]*?)<\/title>/));
        const cluster = clusterHeadlinesFromRss(
          grab(/<description>([\s\S]*?)<\/description>/)
        );
        const headline = pickNamedHeadline(
          full.replace(/ - [^-]{2,40}$/, "").trim(),
          cluster
        );
        return {
          rank: idx + (range?.offset ?? 0),
          headline,
          source: stripTags(grab(/<source[^>]*>([\s\S]*?)<\/source>/)),
          url: grab(/<link>([\s\S]*?)<\/link>/).trim(),
          date: isoFrom(grab(/<pubDate>(.*?)<\/pubDate>/)),
        };
      })
      .filter(
        (i) =>
          i.headline &&
          i.date &&
          i.date >= windowStart &&
          i.date <= windowEnd
      )
      .slice(0, limit);
  } catch (err) {
    console.warn(`  [gn-search] "${query}": ${err.message}`);
    return [];
  }
}

export function weekChunks(windowEnd) {
  const chunks = [];
  const end = new Date(`${windowEnd}T12:00:00Z`);
  for (let w = 0; w < 2; w++) {
    const before = new Date(end.getTime() - w * 7 * 86400000);
    const after = new Date(before.getTime() - 7 * 86400000);
    chunks.push({
      after: after.toISOString().slice(0, 10),
      before: before.toISOString().slice(0, 10),
      offset: w * 25,
    });
  }
  return chunks;
}

export function mergeStory(existing, incoming) {
  if (!existing) return incoming;
  const richer =
    (incoming.summary || "").length > (existing.summary || "").length
      ? incoming
      : existing;
  return {
    ...richer,
    top: Boolean(existing.top || incoming.top),
    bestRank: Math.min(
      existing.bestRank ?? Infinity,
      incoming.bestRank ?? Infinity
    ),
    firstSeen: existing.firstSeen || incoming.firstSeen,
  };
}

export function upsertStories(byKey, incoming) {
  for (const item of incoming) {
    const key = storyKey(item.headline);
    if (!key) continue;
    const toks = headlineTokens(item.headline);
    let matchKey = key;
    for (const [k, existing] of byKey) {
      if (tokensMatch(headlineTokens(existing.headline), toks, 0.25)) {
        matchKey = k;
        break;
      }
    }
    byKey.set(matchKey, mergeStory(byKey.get(matchKey), item));
  }
  return byKey;
}

export async function fetchLiveEntertainment(windowStart, windowEnd) {
  const live = [];
  await Promise.all(
    RSS_FEEDS.map(async ([url, tag]) => {
      try {
        live.push(...parseRss(await fetchText(url), tag, windowStart, windowEnd));
      } catch (err) {
        console.warn(`  [entertainment] ${url}: ${err.message}`);
      }
    })
  );

  const gn = await googleNewsTopic(
    GN_ENTERTAINMENT,
    windowStart,
    windowEnd,
    20
  );
  for (const g of gn) {
    if (JUNK_RE.test(g.headline) || BACKFILL_SKIP_RE.test(g.headline)) continue;
    live.push({
      headline: g.headline,
      date: g.date,
      bucket: guessBucket(g.headline),
      summary: g.source ? `Reported by ${g.source}.` : "",
      url: g.url,
      top: true,
      bestRank: g.rank + 1,
    });
  }

  const junk = new RegExp(`${JUNK_RE.source}|${BACKFILL_SKIP_RE.source}`, "i");
  for (const range of weekChunks(windowEnd)) {
    const found = await googleNewsSearch(
      '"box office" (record OR records OR billion OR milestone OR "highest grossing")',
      windowStart,
      windowEnd,
      8,
      range
    );
    for (const g of found) {
      if (junk.test(g.headline)) continue;
      live.push({
        headline: g.headline,
        date: g.date,
        bucket: "Movies/TV",
        summary: g.source ? `Reported by ${g.source}.` : "",
        url: g.url,
        top: true,
        bestRank: 100 + g.rank,
      });
    }
    await sleep(400);
  }

  return live;
}

export async function readArchive(file) {
  try {
    const payload = JSON.parse(await readFile(file, "utf8"));
    return Array.isArray(payload.items) ? payload.items : [];
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.warn(`Could not read entertainment archive: ${error.message}`);
    }
    return [];
  }
}

export function toFeedItem(item) {
  const card = {
    headline: item.headline,
    date: item.date,
    tag: tagFor(item.headline, item.summary, item.bucket || "Celebrity"),
    summary: (item.summary || "").trim(),
    url: item.url || "",
  };
  if (item.top || (item.bestRank ?? 99) <= 8) card.top = true;
  return card;
}

export async function publishEntertainmentFeed({
  archiveFile,
  feedFile,
  items,
  nowIso,
  windowStart,
  windowEnd,
}) {
  const archive = {
    source: "Google News + RSS",
    generatedAt: nowIso,
    retentionDays: RETENTION_DAYS,
    windowStart,
    windowEnd,
    snapshotIntervalHours: 3,
    count: items.length,
    items,
  };
  await writeFile(archiveFile, `${JSON.stringify(archive, null, 2)}\n`);

  const feedItems = items.map(toFeedItem);
  const n = await enrichThinSummaries(feedItems, {
    minLen: 80,
    espn: false,
    page: true,
    wiki: true,
  });
  const feed = {
    section: "entertainment",
    source: "Google News + RSS",
    generatedAt: nowIso,
    windowStart,
    windowEnd,
    items: feedItems,
  };
  await writeFile(feedFile, `${JSON.stringify(feed, null, 2)}\n`);
  return { archived: items.length, published: feedItems.length, enriched: n };
}
