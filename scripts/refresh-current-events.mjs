#!/usr/bin/env node
/**
 * Refresh data/current-events/*.json with live data.
 *
 *   node scripts/refresh-current-events.mjs
 *
 * Sources (no API keys, no dependencies):
 *   Sports        — ESPN public news JSON endpoints
 *   Entertainment — RSS feeds (Variety, Deadline, E! Online, People, TMZ)
 *   Netflix       — whats-on-netflix.com monthly "What's Coming" listings
 *
 * A section is only overwritten when its fetch produced enough items;
 * otherwise the existing file is kept.
 */

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, "data", "current-events");
const WINDOW_DAYS = 21;

const now = new Date();
const windowEnd = now.toISOString().slice(0, 10);
const windowStart = new Date(now.getTime() - WINDOW_DAYS * 86400000)
  .toISOString()
  .slice(0, 10);

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

async function fetchText(url, timeoutMs = 15000, ua = UA) {
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

function stripTags(html) {
  return String(html || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
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

function inWindow(dateStr) {
  return dateStr >= windowStart && dateStr <= windowEnd;
}

function isoFrom(dateLike) {
  const d = new Date(dateLike);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

/* ---------------- Sports: ESPN ---------------- */

const ESPN_LEAGUES = [
  ["football/nfl", "NFL", 10],
  ["baseball/mlb", "MLB", 8],
  ["basketball/nba", "NBA", 6],
  ["basketball/wnba", "WNBA", 5],
  ["hockey/nhl", "NHL", 5],
  ["golf/pga", "Golf", 6],
  ["soccer/eng.1", "Soccer", 6],
  ["soccer/fifa.world", "Soccer", 5],
  ["racing/nascar-premier", "NASCAR", 4],
  ["tennis/atp", "Tennis", 4],
];

/** ESPN filler that isn't a notable story: fantasy advice, previews-as-content, podcasts. */
const SPORTS_JUNK_RE =
  /\bfantasy\b|forecaster|lineup advice|game highlights|\bpodcast\b|betting odds|how to watch|where to watch|\bodds\b|\bpicks\b|\brankings?\b|\bbuzz:|latest intel|intel, updates|new threads|experts? grad|grades for\b|mock (draft|trade)|some thoughts|\bhoping to\b/i;

function guessSport(text, league) {
  if (league) return league.toUpperCase();
  const t = text.toLowerCase();
  if (/\bnfl\b|quarterback|super bowl/.test(t)) return "NFL";
  if (/\bnba\b|basketball/.test(t)) return "NBA";
  if (/\bmlb\b|baseball|world series/.test(t)) return "MLB";
  if (/\bnhl\b|hockey|stanley cup/.test(t)) return "NHL";
  if (/soccer|premier league|world cup|mls/.test(t)) return "Soccer";
  if (/tennis|wimbledon|us open/.test(t)) return "Tennis";
  if (/golf|pga|masters/.test(t)) return "Golf";
  if (/f1|formula 1|nascar|grand prix/.test(t)) return "Racing";
  return "Sports";
}

async function buildSports() {
  const seen = new Set();
  let items = [];
  await Promise.all(
    ESPN_LEAGUES.map(async ([league, label, limit]) => {
      try {
        const url = `https://site.api.espn.com/apis/site/v2/sports/${league}/news?limit=${limit}`;
        const data = JSON.parse(await fetchText(url));
        for (const a of data.articles || []) {
          const date = isoFrom(a.published);
          const headline = (a.headline || "").trim();
          if (
            !date ||
            !inWindow(date) ||
            !headline ||
            seen.has(headline) ||
            SPORTS_JUNK_RE.test(headline)
          )
            continue;
          seen.add(headline);
          items.push({
            headline,
            date,
            sport: label,
            summary: (a.description || "").trim(),
            url: a.links?.web?.href || "",
          });
        }
      } catch (err) {
        console.warn(`  [sports] ${league}: ${err.message}`);
      }
    })
  );
  items = fuzzyDedupe(items);
  items.sort((a, b) => b.date.localeCompare(a.date));
  // ESPN only covers the last few days — backfill each week's biggest
  // storylines (moves, records, titles) from GN search.
  await backfillWeekly(
    items,
    '(signs OR traded OR trade OR "world record" OR championship OR suspended) (NFL OR NBA OR MLB OR WNBA OR NHL OR F1)',
    {
      perWeek: 3,
      makeItem: (g) => ({
        headline: g.headline,
        date: g.date,
        sport: guessSport(g.headline),
        summary: g.source ? `Reported by ${g.source}.` : "",
        url: g.url,
      }),
      junkRe: new RegExp(
        `${SPORTS_JUNK_RE.source}|${BACKFILL_SKIP_RE.source}`,
        "i"
      ),
    }
  );
  items = fuzzyDedupe(items);
  items.sort((a, b) => b.date.localeCompare(a.date));
  const ranked = applyProminence(items, await googleNewsRanks(GN_SPORTS));
  return ranked.slice(0, 20).map((i) => {
    delete i._rank;
    return i;
  });
}

/* ------------- Google News: prominence signal -------------
 * GN topic feeds rank the biggest stories across all outlets, but only
 * cover the last ~48h and carry no summaries. So they are used purely as
 * a ranking layer: items from our full-window sources that match a GN top
 * story get `top: true` and sort first. If GN is unreachable, nothing
 * changes. */

const GN_SPORTS =
  "https://news.google.com/rss/headlines/section/topic/SPORTS?hl=en-US&gl=US&ceid=US:en";
const GN_ENTERTAINMENT =
  "https://news.google.com/rss/headlines/section/topic/ENTERTAINMENT?hl=en-US&gl=US&ceid=US:en";

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "with",
  "over", "after", "as", "at", "by", "from", "is", "are", "was", "were",
  "his", "her", "their", "its", "what", "why", "how", "into", "vs", "new",
  "says", "amid",
]);

function headlineTokens(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

async function googleNewsRanks(url) {
  try {
    const xml = await fetchText(url);
    return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)]
      .map((m, idx) => {
        const raw = (m[1].match(/<title>([\s\S]*?)<\/title>/) || [])[1] || "";
        const clean = stripTags(raw).replace(/ - [^-]{2,40}$/, ""); // " - Source"
        return { rank: idx, tokens: headlineTokens(clean) };
      })
      .filter((g) => g.tokens.length >= 3);
  } catch (err) {
    console.warn(`  [googlenews] ${err.message}`);
    return [];
  }
}

function tokensMatch(aTokens, bTokens, minScore = 0.3) {
  const a = new Set(aTokens);
  const shared = bTokens.filter((w) => a.has(w)).length;
  const union = new Set([...aTokens, ...bTokens]).size;
  return shared >= 4 && shared / union >= minScore;
}

/** Rank of the best-matching GN top story, or null when not matched. */
function gnRank(headline, gnList) {
  const toks = headlineTokens(headline);
  let best = null;
  for (const g of gnList) {
    if (tokensMatch(toks, g.tokens) && (best === null || g.rank < best))
      best = g.rank;
  }
  return best;
}

/** GN-matched stories first (by rank), the rest after (by date). */
function applyProminence(items, gnList) {
  for (const i of items) {
    const r = gnRank(i.headline, gnList);
    if (r !== null) {
      i.top = true;
      i._rank = r; // topic rank outranks backfill rank (100+)
    } else if (i._rank === undefined) i._rank = null;
  }
  items.sort(
    (a, b) => (a._rank ?? 1e9) - (b._rank ?? 1e9) || b.date.localeCompare(a.date)
  );
  return items;
}

/* --------- Google News search: backfill big stories the feeds dropped ----
 * Per-outlet RSS only carries each site's latest handful of posts, so a
 * huge story from 1-2 weeks ago scrolls off. GN search with after: covers
 * the whole window, relevance-ranked. Matched stories just mark the
 * existing card as top; unmatched ones are added as attributed cards. */

async function googleNewsSearch(query, limit = 12, range = null) {
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
        return {
          rank: idx + (range?.offset ?? 0),
          headline: full.replace(/ - [^-]{2,40}$/, "").trim(),
          source: stripTags(grab(/<source[^>]*>([\s\S]*?)<\/source>/)),
          url: grab(/<link>([\s\S]*?)<\/link>/).trim(),
          date: isoFrom(grab(/<pubDate>(.*?)<\/pubDate>/)),
        };
      })
      .filter((i) => i.headline && i.date && inWindow(i.date))
      .slice(0, limit);
  } catch (err) {
    console.warn(`  [gn-search] "${query}": ${err.message}`);
    return [];
  }
}

/**
 * Three week-sized slices of the window, newest first. GN search ranks by
 * relevance within a date range, so chunking beats the feed-wide recency
 * bias — each week contributes its own biggest stories. The offset keeps
 * newer weeks ahead of older ones in the final ordering.
 */
function weekChunks() {
  const chunks = [];
  const end = new Date(`${windowEnd}T12:00:00Z`);
  for (let w = 0; w < 3; w++) {
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

async function backfillWeekly(items, query, { perWeek, makeItem, junkRe }) {
  for (const range of weekChunks()) {
    const found = await googleNewsSearch(query, 8, range);
    backfill(items, found, makeItem, junkRe, perWeek);
    await sleep(400);
  }
}

function backfill(items, gnItems, makeItem, junkRe, maxAdd) {
  let added = 0;
  for (const g of gnItems) {
    if (junkRe && junkRe.test(g.headline)) continue;
    const toks = headlineTokens(g.headline);
    // 0.25 here (vs 0.3 for prominence): backfill adds cards, so the same
    // story from two outlets must collapse even when worded differently.
    const existing = items.find((i) =>
      tokensMatch(headlineTokens(i.headline), toks, 0.25)
    );
    if (existing) {
      if (g.rank < 10) {
        existing.top = true;
        existing._rank = existing._rank ?? 100 + g.rank;
      }
      continue;
    }
    if (added >= maxAdd) continue;
    items.push({ ...makeItem(g), top: true, _rank: 100 + g.rank });
    added += 1;
  }
  return items;
}

/** Same story, two outlets: collapse near-identical headlines (keep richer). */
function fuzzyDedupe(items) {
  const kept = [];
  for (const i of items) {
    const toks = headlineTokens(i.headline);
    const dup = kept.find((k) => tokensMatch(headlineTokens(k.headline), toks));
    if (dup) {
      if ((i.summary || "").length > (dup.summary || "").length)
        Object.assign(dup, i);
      continue;
    }
    kept.push(i);
  }
  return kept;
}

/* ---------------- Entertainment: RSS ---------------- */

// people.com/feed/ hard-blocks bots (Cloudflare 403); Page Six + Us Weekly
// cover the same celebrity beat.
const RSS_FEEDS = [
  ["https://variety.com/feed/", "Movies/TV"],
  ["https://deadline.com/feed/", "Movies/TV"],
  ["https://www.eonline.com/syndication/feeds/rssfeeds/topstories.xml", "Celebrity"],
  ["https://pagesix.com/feed/", "Celebrity"],
  ["https://www.usmagazine.com/feed/", "Celebrity"],
  ["https://www.tmz.com/rss.xml", "Celebrity"],
];

/** Commerce/listicle filler that slips into celebrity feeds. */
const JUNK_RE =
  /\b(loafers|sneakers|sandals|leggings|lipstick|mascara|faves|gift guide|deals|under \$\d+|where to buy|shop now|amazon arrivals)\b|\bon sale\b|\bsale (is|alert)\b|^\d+\s+(best|top|celebrit)\b/i;

/**
 * Display tag: milestone-type stories (records, box office, anniversaries)
 * get their own label regardless of which feed they came from. The source
 * bucket still drives the per-section balance caps below.
 */
const MILESTONE_RE =
  /box office|highest-grossing|opening weekend|biggest (opening|debut|weekend|premiere)|most[- ]watched|billion|surpass(?:es|ed)?|overtake(?:s|n)?|crosses \$|breaks? (?:the )?record|record-breaking|record high|shatters?|milestone|\b\d+(?:th|st|nd|rd) anniversary\b/i;

/**
 * Backfill headlines are attribution-only (no summary available), so they're
 * held to a higher bar — skip previews, reviews, questions, watch guides,
 * listicles, betting/promo content, and speculation.
 */
const BACKFILL_SKIP_RE =
  /\?|\bpreview(s)?\b|\breview(s)?\b|\bhow (many|to)\b|how to watch|where to watch|what to watch|\bcould\b|\bwould\b|\bpromo\b|promo code|bonus|sleeper|\bodds\b|\bdfs\b|prediction|\bpicks\b|jewelry|of all time|\bsale\b|best deal|subscription|\btracker\b|\brumors?\b|landing spots|destinations for|latest (intel|updates|news|buzz)|\bbuzz:|inside a week|week in review|wedding singer|\bevery\b.{0,24}?\b(deal|winner|loser|move)s?\b|all \d+ teams|\beach team'?s\b|^(the )?\d+ (best|top|highest|greatest|worst|most|celebrit|movies|films|shows|things|ways|times|moments|significant|biggest|takeaways|surprises)/i;

function tagFor(headline, summary, bucket) {
  return MILESTONE_RE.test(`${headline} ${summary}`) ? "Milestone" : bucket;
}

function parseRss(xml, tag) {
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
    if (!date || !inWindow(date) || !headline || JUNK_RE.test(headline))
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

async function buildEntertainment() {
  const seen = new Set();
  let items = [];
  await Promise.all(
    RSS_FEEDS.map(async ([url, tag]) => {
      try {
        items.push(...parseRss(await fetchText(url), tag));
      } catch (err) {
        console.warn(`  [entertainment] ${url}: ${err.message}`);
      }
    })
  );
  items = items.filter((i) => {
    const key = i.headline.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  items = fuzzyDedupe(items);
  items.sort((a, b) => b.date.localeCompare(a.date));
  // Per-outlet feeds only carry their latest posts, so each week's biggest
  // stories scroll off. Backfill from GN search, week by week: box-office
  // milestones and major celebrity moments. The queries' OR-groups do the
  // milestone filtering at the source; BACKFILL_SKIP_RE drops previews,
  // reviews, listicles and speculative/question headlines.
  const entJunk = new RegExp(
    `${JUNK_RE.source}|${BACKFILL_SKIP_RE.source}`,
    "i"
  );
  await backfillWeekly(
    items,
    '"box office" (record OR records OR billion OR milestone OR "highest grossing")',
    {
      perWeek: 3,
      makeItem: (g) => ({
        headline: g.headline,
        date: g.date,
        bucket: "Movies/TV",
        summary: g.source ? `Reported by ${g.source}.` : "",
        url: g.url,
      }),
      junkRe: entJunk,
    }
  );
  await backfillWeekly(
    items,
    '(marries OR weds OR "ties the knot" OR wedding) (actor OR actress OR singer OR rapper OR star)',
    {
      perWeek: 2,
      makeItem: (g) => ({
        headline: g.headline,
        date: g.date,
        bucket: "Celebrity",
        summary: g.source ? `Reported by ${g.source}.` : "",
        url: g.url,
      }),
      junkRe: entJunk,
    }
  );
  await backfillWeekly(
    items,
    "(actor OR actress OR singer OR rapper OR comedian) (dies OR dead OR death)",
    {
      perWeek: 2,
      makeItem: (g) => ({
        headline: g.headline,
        date: g.date,
        bucket: "Celebrity",
        summary: g.source ? `Reported by ${g.source}.` : "",
        url: g.url,
      }),
      junkRe: entJunk,
    }
  );
  items = fuzzyDedupe(items);
  items.sort((a, b) => b.date.localeCompare(a.date));
  const gn = await googleNewsRanks(GN_ENTERTAINMENT);
  // Variety/Deadline publish far more per day than the celebrity feeds —
  // without a per-bucket cap they push every celebrity item past the cutoff.
  // Prominence-sort before capping so big older stories survive.
  const movies = applyProminence(
    items.filter((i) => i.bucket === "Movies/TV"),
    gn
  ).slice(0, 10);
  const celeb = applyProminence(
    items.filter((i) => i.bucket === "Celebrity"),
    gn
  ).slice(0, 10);
  return [...movies, ...celeb]
    .sort(
      (a, b) =>
        (a._rank ?? 1e9) - (b._rank ?? 1e9) || b.date.localeCompare(a.date)
    )
    .slice(0, 20)
    .map((i) => {
      const { bucket, _rank, ...rest } = i;
      return { ...rest, tag: tagFor(i.headline, i.summary, bucket) };
    });
}

/* ---------------- Netflix: whats-on-netflix ---------------- */

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

function guessType(text) {
  const t = text.toLowerCase();
  if (t.includes("season") || t.includes("series")) return "Series";
  if (t.includes("docuseries")) return "Docuseries";
  if (t.includes("documentary")) return "Documentary";
  if (t.includes("stand-up")) return "Stand-up special";
  if (t.includes("anime film")) return "Anime film";
  if (t.includes("live event") || t.includes("(live)")) return "Live event";
  if (t.includes("special")) return "Special";
  return "Film";
}

/**
 * whats-on-netflix puts Cloudflare challenges on its high-traffic pages for
 * datacenter/bot-looking clients, and which page is challenged varies day to
 * day. Chain: direct → allorigins (live proxy) → Wayback (nearest snapshot,
 * can lag a few days). Callers treat a thrown error as "source unavailable".
 */
async function fetchListing(url) {
  try {
    return await fetchText(url);
  } catch (err) {
    console.warn(`  [netflix] direct: ${err.message} — trying proxy`);
  }
  try {
    return await fetchText(
      `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
      60000
    );
  } catch (err) {
    console.warn(`  [netflix] proxy: ${err.message} — trying second proxy`);
  }
  try {
    return await fetchText(
      `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
      60000
    );
  } catch (err) {
    console.warn(`  [netflix] proxy2: ${err.message} — trying wayback`);
  }
  const stamp = windowEnd.replace(/-/g, "");
  return fetchText(`https://web.archive.org/web/${stamp}id_/${url}`, 60000);
}

function parseNetflixMonthly(html, year) {
  const items = [];
  // Date headers: "What's Coming to Netflix on August 7th" (monthly pages)
  // or "Coming to Netflix on Monday, August 10th" (weekly pages).
  const headerRe =
    /<h[2-4][^>]*>([\s\S]*?on (?:[A-Z][a-z]+day,\s*)?([A-Z][a-z]+) (\d{1,2})(?:st|nd|rd|th)[\s\S]*?)<\/h[2-4]>/gi;
  const headers = [];
  for (const m of html.matchAll(headerRe)) {
    const month = MONTHS.indexOf(m[2].toLowerCase());
    if (month < 0) continue;
    headers.push({
      pos: m.index,
      date: `${year}-${String(month + 1).padStart(2, "0")}-${String(m[3]).padStart(2, "0")}`,
    });
  }
  for (let i = 0; i < headers.length; i += 1) {
    const { date, pos } = headers[i];
    if (!inWindow(date)) continue;
    const end = i + 1 < headers.length ? headers[i + 1].pos : html.length;
    const chunk = html.slice(pos, end);
    for (const li of chunk.matchAll(/<li>([\s\S]*?)<\/li>/g)) {
      const text = stripTags(li[1]);
      if (!/netflix original/i.test(text)) continue;
      const [left, ...rest] = text.split(/\s+[–—-]\s+/);
      const title = left
        .replace(/\(\d{4}\)/, "")
        .replace(/\(Limited Series\)/i, "")
        .replace(/Netflix Original/i, "")
        .replace(/\s+/g, " ")
        .trim();
      if (!title || title.length < 2) continue;
      items.push({
        title,
        type: guessType(text),
        date,
        synopsis: (rest.join(" — ") || "Netflix Original release.").trim(),
        starring: [],
      });
    }
  }
  return items;
}

function seriesTypeFromGenre(genre) {
  if (/docuseries/i.test(genre)) return "Docuseries";
  if (/documentary|true crime|sports/i.test(genre)) return "Documentary";
  return "Series";
}

/**
 * Wikipedia's original programming + stand-up lists — the series/specials
 * counterpart to the films list. These cover brand-new series premieres of
 * every genre (the Premiere column is the series debut); new *seasons* of
 * returning shows only come from whats-on-netflix when it isn't bot-blocking.
 */
async function fetchWikipediaProgramming() {
  const sources = [
    ["List of Netflix original programming", null],
    ["List of Netflix original stand-up comedy specials", "Stand-up special"],
  ];
  const items = [];
  for (const [page, fixedType] of sources) {
    try {
      const data = await wikiJson({ action: "parse", page, prop: "text" });
      const html = data?.parse?.text?.["*"] || "";
      for (const row of html.matchAll(/<tr>([\s\S]*?)<\/tr>/g)) {
        const cells = [...row[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map(
          (c) => stripTags(c[1])
        );
        if (cells.length < 2) continue;
        let date = null;
        let dateIdx = -1;
        for (let ci = 1; ci < Math.min(cells.length, 4); ci += 1) {
          date = isoFrom(cells[ci]);
          if (date) {
            dateIdx = ci;
            break;
          }
        }
        const title = cells[0];
        if (!date || !inWindow(date) || !title || title === "Title") continue;
        const genre = dateIdx > 1 ? cells[1] : "";
        items.push({
          title,
          type: fixedType || seriesTypeFromGenre(genre),
          date,
          synopsis: fixedType
            ? `${fixedType}.`
            : genre
              ? `${genre} series.`
              : "Netflix Original release.",
          starring: [],
        });
      }
    } catch (err) {
      console.warn(`  [netflix] wikipedia "${page}": ${err.message}`);
    }
  }
  return items;
}

/** Wikipedia's Netflix original films list — reliable fallback (dates + genres). */
async function fetchWikipediaFilms() {
  const url =
    "https://en.wikipedia.org/w/api.php?action=parse" +
    "&page=List_of_Netflix_original_films_(since_2026)&format=json&prop=text";
  const data = JSON.parse(await fetchText(url));
  const html = data?.parse?.text?.["*"] || "";
  const items = [];
  for (const row of html.matchAll(/<tr>([\s\S]*?)<\/tr>/g)) {
    const cells = [...row[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map(
      (c) => stripTags(c[1])
    );
    if (cells.length < 3) continue;
    const [title, dateRaw, genre] = cells;
    const date = isoFrom(dateRaw);
    if (!date || !inWindow(date) || !title || title === "Title") continue;
    items.push({
      title,
      type: /documentary/i.test(genre) ? "Documentary" : "Film",
      date,
      synopsis: `${genre || "Netflix Original"} film.`,
      starring: [],
    });
  }
  return items;
}

/* -------- Netflix enrichment: Wikipedia intros (no key required) -------- */

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const normTitle = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// Wikimedia asks API clients for a descriptive UA; browser UAs get throttled.
const WIKI_UA =
  "TriviaHelper/1.0 (https://github.com/DSdev901/trivia; trivia app data refresh)";

async function wikiJson(params) {
  const url =
    "https://en.wikipedia.org/w/api.php?" +
    new URLSearchParams({ format: "json", ...params });
  return JSON.parse(await fetchText(url, 15000, WIKI_UA));
}

/**
 * Find the best-matching Wikipedia page for a title and return its intro.
 * Single request via generator=search. The intro must mention Netflix —
 * this both confirms we landed on the right page and that the title is
 * a Netflix original release.
 */
async function wikiIntroFor(title, date) {
  const year = (date || "").slice(0, 4);
  const want = normTitle(title);
  if (!want) return "";
  const data = await wikiJson({
    action: "query",
    generator: "search",
    gsrsearch: `${title} ${year} Netflix`,
    gsrlimit: "4",
    prop: "extracts",
    exintro: "1",
    explaintext: "1",
    redirects: "1",
  });
  const hit = Object.values(data?.query?.pages || {}).find((p) => {
    const have = normTitle(p.title);
    return (
      (have.startsWith(want) || want.startsWith(have)) &&
      /netflix/i.test(p.extract || "")
    );
  });
  if (!hit) return null;
  return {
    extract: hit.extract.trim(),
    exact: normTitle(hit.title) === want,
  };
}

async function wikiIntroWithRetry(title, date) {
  try {
    return await wikiIntroFor(title, date);
  } catch (err) {
    if (!/429/.test(err.message)) throw err;
    await sleep(4000);
    return wikiIntroFor(title, date);
  }
}

function starringFromExtract(extract) {
  // (?<! [A-Z]) lets middle initials like "Patrick J. Adams" survive.
  const m = extract.match(/(?:starring|stars)\s+(.+?)(?<! [A-Z])\.(?=\s|$)/s);
  if (!m) return [];
  return m[1]
    .split(/,| and /i)
    .map((s) => s.replace(/\s+as\s+.+$/i, "").trim()) // drop "as Nick Nelson"
    .filter(
      (s) =>
        /^[A-Z][\p{L}.'()-]*( [\p{L}.'() -]{1,30}){0,3}$/u.test(s) &&
        !/\d/.test(s)
    )
    .slice(0, 6);
}

/** Keep plot sentences; skip "directed by…" boilerplate and cast-list sentences. */
function synopsisFromExtract(extract) {
  const sentences = extract.match(/[^.!?]+[.!?]+/g) || [];
  const isListLike = (s) => (s.match(/,/g) || []).length >= 3;
  const isCastOrCrew = (s) =>
    /directed by|created by|premiered|released on/i.test(s) ||
    /\bstarring\b|\bstars\b/i.test(s);
  const plot = sentences.filter((s) => !isCastOrCrew(s) && !isListLike(s));
  const fallback = sentences.filter((s) => !isListLike(s));
  const chosen = (plot.length ? plot : fallback).slice(0, 2).join(" ").trim();
  return chosen.length > 320 ? `${chosen.slice(0, 317).trim()}…` : chosen;
}

async function enrichNetflix(items) {
  for (const item of items.slice(0, 30)) {
    try {
      const hit = await wikiIntroWithRetry(item.title, item.date);
      if (hit) {
        const { extract, exact } = hit;
        const stars = starringFromExtract(extract);
        const syn = synopsisFromExtract(extract);
        // Non-exact page matches (e.g. a parent series for a companion
        // special) can describe a different production — only trust their
        // cast when the page is really about this title.
        if (exact && stars.length) item.starring = stars;
        if (syn.length > (item.synopsis || "").length) {
          if (exact || (item.synopsis || "").trim().length < 60)
            item.synopsis = syn;
        }
        if (exact) item.confirmedOriginal = true;
      }
    } catch (err) {
      console.warn(`  [netflix] wiki "${item.title}": ${err.message}`);
    }
    await sleep(1000);
  }
  return items;
}

async function buildNetflix() {
  let items = [];
  const monthsToTry = [now, new Date(now.getTime() - 32 * 86400000)];
  for (const d of monthsToTry) {
    const month = MONTHS[d.getMonth()];
    const year = d.getFullYear();
    const url = `https://www.whats-on-netflix.com/coming-soon/whats-coming-to-netflix-in-${month}-${year}/`;
    try {
      // Source already filters to items tagged "Netflix Original".
      items.push(...parseNetflixMonthly(await fetchListing(url), year));
    } catch (err) {
      console.warn(`  [netflix] ${url}: ${err.message}`);
    }
    await sleep(1500); // free proxies rate-limit rapid-fire requests
  }
  // Weekly roundups cover returning-season premieres too; discover them from
  // the RSS feed (which Cloudflare leaves unchallenged).
  try {
    const rss = await fetchText("https://www.whats-on-netflix.com/feed/");
    const weeklyUrls = [
      ...rss.matchAll(/<item>[\s\S]*?<title>([\s\S]*?)<\/title>[\s\S]*?<link>([\s\S]*?)<\/link>/g),
    ]
      .filter((m) => /coming to netflix this week/i.test(stripTags(m[1])))
      .map((m) => m[2].trim())
      .slice(0, 3);
    for (const url of weeklyUrls) {
      try {
        items.push(...parseNetflixMonthly(await fetchListing(url), now.getFullYear()));
      } catch (err) {
        console.warn(`  [netflix] weekly ${url}: ${err.message}`);
      }
      await sleep(1500);
    }
  } catch (err) {
    console.warn(`  [netflix] rss: ${err.message}`);
  }
  // Fallback / supplement: Wikipedia lists (whats-on-netflix sometimes 403s).
  // All three lists are originals-only by definition.
  try {
    items.push(...(await fetchWikipediaFilms()));
  } catch (err) {
    console.warn(`  [netflix] wikipedia films: ${err.message}`);
  }
  items.push(...(await fetchWikipediaProgramming()));
  // Same title can appear in multiple sources with different dates — keep
  // the richer card. Titles also vary in length across sources ("Operation
  // Safed Sagar: The Untold Story…" vs "Operation Safed Sagar: The Highest
  // Air Force Mission…"), so collapse keys that contain one another.
  // Dedupe before enrichment so we don't look a title up twice.
  const score = (x) =>
    (x.synopsis || "").length + (x.starring || []).length * 50;
  // Same show, differently-trimmed title across sources ("Operation Safed
  // Sagar: The Untold Story…" vs "…The Highest Air Force Mission…"): a
  // shared prefix of the first few tokens is the same title.
  const sameTitle = (a, b) => {
    const ta = normTitle(a).split(" ");
    const tb = normTitle(b).split(" ");
    const n = Math.min(4, ta.length, tb.length);
    for (let i = 0; i < n; i += 1) if (ta[i] !== tb[i]) return false;
    return n > 0;
  };
  const deduped = [];
  for (const i of items) {
    const other = deduped.find((d) => sameTitle(d.title, i.title));
    if (!other) {
      deduped.push(i);
    } else if (score(i) > score(other)) {
      deduped[deduped.indexOf(other)] = i;
    }
  }
  items = await enrichNetflix(deduped);
  items.sort((a, b) => b.date.localeCompare(a.date));
  // Completeness over polish: every item comes from an originals-only source
  // (the whats-on-netflix listing is Originals-tagged; the Wikipedia lists are
  // originals by definition), so a brand-new title stays even while its
  // synopsis is still a one-liner — Wikipedia lags a few days on fresh
  // releases, and enrichment fills details in on later refreshes.
  return items.slice(0, 40);
}

/* ---------------- write ---------------- */

async function writeSection(section, items, minItems) {
  const file = path.join(OUT_DIR, `${section}.json`);
  if (items.length < minItems) {
    console.warn(
      `  [${section}] only ${items.length} items found — keeping existing file.`
    );
    return false;
  }
  const payload = {
    section,
    generatedAt: now.toISOString(),
    windowStart,
    windowEnd,
    items,
  };
  await writeFile(file, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`  [${section}] wrote ${items.length} items`);
  return true;
}

async function main() {
  console.log(
    `Refreshing current events (${windowStart} → ${windowEnd})…`
  );
  const [sports, entertainment, netflix] = await Promise.all([
    buildSports(),
    buildEntertainment(),
    buildNetflix(),
  ]);
  const results = await Promise.all([
    writeSection("sports", sports, 5),
    writeSection("entertainment", entertainment, 5),
    writeSection("netflix", netflix, 5),
  ]);
  const ok = results.filter(Boolean).length;
  console.log(`Done — ${ok}/3 sections updated.`);
  if (ok === 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
