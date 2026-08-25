#!/usr/bin/env node
/**
 * Refresh data/current-events/*.json with live data.
 *
 *   node scripts/refresh-current-events.mjs
 *
 * Sources (no dependencies; TMDB_API_KEY optional):
 *   Sports        — ESPN only (rolling 21-day archive, published every 3h)
 *   Entertainment — Google News + RSS (rolling 21-day archive, published every 3h)
 *   World         — Google News World + BBC/NPR (rolling 21-day archive, 3h)
 *   Netflix       — TVMaze web schedule (series that actually aired),
 *                   whats-on-netflix + Wikipedia originals lists for titles
 *                   and dates only, TMDB for plot / cast / poster.
 *                   Rolling 28-day (4-week) window.
 *                   US vs outside-the-US chips match Netflix Tudum's
 *                   US "New on Netflix" calendar (unknowns stay in All).
 *
 *   node scripts/refresh-current-events.mjs --netflix-images
 *     Backfill posters on the existing Netflix JSON without a full refresh.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { writeBriefingFile } from "./write-briefing.mjs";
import {
  briefIsUsable,
  compressBrief,
  tidyBrief,
} from "./apply-netflix-briefs.mjs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  enrichThinSummaries,
  isEspnVideoStub,
} from "./lib/summaries.mjs";
import { writeNetflixStamp } from "./lib/netflix-stamp.mjs";
import {
  RETENTION_DAYS as ENT_DAYS,
  fetchLiveEntertainment,
  publishEntertainmentFeed,
  readArchive as readEntertainmentArchive,
  upsertStories,
} from "./lib/entertainment.mjs";
import {
  fetchLiveWorld,
  publishWorldFeed,
  readArchive as readWorldArchive,
  upsertStories as upsertWorldStories,
} from "./lib/world.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, "data", "current-events");
const POSTER_DIR = path.join(OUT_DIR, "posters");
const POSTER_URL_PREFIX = "data/current-events/posters";
const WINDOW_DAYS = 21;
const NETFLIX_WINDOW_DAYS = 28;

const now = new Date();
const windowEnd = now.toISOString().slice(0, 10);
const windowStart = new Date(now.getTime() - WINDOW_DAYS * 86400000)
  .toISOString()
  .slice(0, 10);
const netflixWindowStart = new Date(now.getTime() - NETFLIX_WINDOW_DAYS * 86400000)
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

function inNetflixWindow(dateStr) {
  return dateStr >= netflixWindowStart && dateStr <= windowEnd;
}

function isoFrom(dateLike) {
  const d = new Date(dateLike);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

/* ---------------- Sports: ESPN ---------------- */

// Fetch deep: ESPN floods its news endpoint with per-team "training camp:
// latest intel" boilerplate (SPORTS_JUNK_RE strips those), so a small limit
// can starve a league of real stories entirely.
const ESPN_LEAGUES = [
  ["football/nfl", "NFL", 25],
  ["baseball/mlb", "MLB", 18],
  ["basketball/nba", "NBA", 15],
  ["basketball/wnba", "WNBA", 10],
  ["hockey/nhl", "NHL", 10],
  ["golf/pga", "Golf", 10],
  ["soccer/eng.1", "Soccer", 12],
  ["soccer/fifa.world", "Soccer", 10],
  ["racing/nascar-premier", "NASCAR", 6],
  ["tennis/atp", "Tennis", 8],
];

/** ESPN filler that isn't a notable story: fantasy advice, previews-as-content, podcasts. */
const SPORTS_JUNK_RE =
  /\bfantasy\b|forecaster|lineup advice|game highlights?|\bpodcast\b|betting odds|how to watch|where to watch|\bodds\b|\bpicks\b|\brankings?\b|\bbuzz:|latest intel|intel, updates|new threads|experts? grad|grades for\b|mock (draft|trade)|some thoughts|\bhoping to\b|fight night|news roundup|trade grades|\bgrades:/i;

function guessSport(text, league) {
  if (league) return league.toUpperCase();
  const t = text.toLowerCase();
  if (/\bnfl\b|\bqb1?\b|quarterback|super bowl|touchdown|preseason|training camp/.test(t)) return "NFL";
  if (/\bwnba\b/.test(t)) return "WNBA";
  if (/\bnba\b|basketball/.test(t)) return "NBA";
  if (/\bmlb\b|baseball|world series|little league/.test(t)) return "MLB";
  if (/\bnhl\b|hockey|stanley cup/.test(t)) return "NHL";
  if (/\bufc\b|\bmma\b|boxing/.test(t)) return "MMA";
  if (/soccer|premier league|world cup|mls|\bfifa\b/.test(t)) return "Soccer";
  if (/tennis|wimbledon|us open/.test(t)) return "Tennis";
  if (/golf|\bpga\b|masters|fedex/.test(t)) return "Golf";
  if (/\bf1\b|formula 1|nascar|grand prix/.test(t)) return "Racing";
  return "Sports";
}

/**
 * Sports is ESPN-only. The three-hour cache job owns the live Sports tab
 * (espn-headlines.json → sports.json). This builder reads that archive so
 * the Tuesday full refresh doesn't wipe sports with Google News stories.
 * Window is 21 days to match the rolling cache.
 */
async function buildSports() {
  const sportsStart = new Date(now.getTime() - WINDOW_DAYS * 86400000)
    .toISOString()
    .slice(0, 10);
  const seen = new Set();
  let items = [];

  const push = (headline, date, sport, summary, url, top) => {
    if (
      !date ||
      date < sportsStart ||
      date > windowEnd ||
      !headline ||
      seen.has(headline) ||
      SPORTS_JUNK_RE.test(headline)
    ) {
      return;
    }
    const card = {
      headline,
      date,
      sport: sport || guessSport(headline),
      summary: (summary || "").trim(),
      url: url || "",
    };
    if (isEspnVideoStub(card)) return;
    seen.add(headline);
    if (top) card.top = true;
    items.push(card);
  };

  try {
    const archive = JSON.parse(
      await readFile(path.join(OUT_DIR, "espn-headlines.json"), "utf8")
    );
    for (const a of archive.items || []) {
      push(
        (a.headline || "").trim(),
        isoFrom(a.published),
        a.sport,
        a.summary,
        a.url,
        (a.bestRank ?? 99) <= 5
      );
    }
  } catch (err) {
    if (err.code !== "ENOENT") {
      console.warn(`  [sports] ESPN archive: ${err.message}`);
    }
  }

  // Live snap as a safety net if the archive is missing or stale.
  await Promise.all(
    ESPN_LEAGUES.map(async ([league, label, limit]) => {
      try {
        const url = `https://site.api.espn.com/apis/site/v2/sports/${league}/news?limit=${limit}`;
        const data = JSON.parse(await fetchText(url));
        for (const [idx, a] of (data.articles || []).entries()) {
          push(
            (a.headline || "").trim(),
            isoFrom(a.published),
            label,
            a.description,
            a.links?.web?.href || "",
            idx < 5
          );
        }
      } catch (err) {
        console.warn(`  [sports] ${league}: ${err.message}`);
      }
    })
  );

  items = fuzzyDedupe(items);
  items.sort((a, b) => b.date.localeCompare(a.date));
  const n = await enrichThinSummaries(items, {
    minLen: 80,
    espn: true,
    page: true,
    wiki: false,
  });
  if (n) console.log(`  [sports] enriched ${n} thin summaries`);
  return items;
}

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

function tokensMatch(aTokens, bTokens, minScore = 0.3) {
  const a = new Set(aTokens);
  const shared = bTokens.filter((w) => a.has(w)).length;
  const union = new Set([...aTokens, ...bTokens]).size;
  return shared >= 4 && shared / union >= minScore;
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

/**
 * Entertainment is owned by the 3-hour cache (archive + published feed).
 * The Tuesday refresh merges a fresh snapshot into that archive so it
 * never wipes accumulated 21-day coverage.
 */
async function buildEntertainment() {
  const archiveFile = path.join(OUT_DIR, "entertainment-headlines.json");
  const feedFile = path.join(OUT_DIR, "entertainment.json");
  const entStart = new Date(now.getTime() - ENT_DAYS * 86400000)
    .toISOString()
    .slice(0, 10);
  const existing = (await readEntertainmentArchive(archiveFile)).filter(
    (i) => i.date >= entStart && i.date <= windowEnd
  );
  const byKey = new Map();
  upsertStories(byKey, existing);
  const live = await fetchLiveEntertainment(entStart, windowEnd);
  upsertStories(
    byKey,
    live.map((i) => ({ ...i, firstSeen: now.toISOString() }))
  );
  const items = [...byKey.values()]
    .filter((i) => i.date >= entStart && i.date <= windowEnd)
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) ||
        (a.bestRank ?? 1e9) - (b.bestRank ?? 1e9)
    );
  const result = await publishEntertainmentFeed({
    archiveFile,
    feedFile,
    items,
    nowIso: now.toISOString(),
    windowStart: entStart,
    windowEnd,
  });
  console.log(
    `  [entertainment] archive ${result.archived}; feed ${result.published} ` +
      `(${result.enriched} summaries enriched)`
  );
  return items.map((i) => ({
    headline: i.headline,
    date: i.date,
    tag: i.bucket,
    summary: i.summary,
    url: i.url,
  }));
}

/**
 * World is owned by the 3-hour cache (archive + published feed).
 * The Tuesday refresh merges a fresh snapshot so the 21-day window stays.
 */
async function buildWorld() {
  const archiveFile = path.join(OUT_DIR, "world-headlines.json");
  const feedFile = path.join(OUT_DIR, "world.json");
  const worldStart = new Date(now.getTime() - ENT_DAYS * 86400000)
    .toISOString()
    .slice(0, 10);
  const existing = (await readWorldArchive(archiveFile)).filter(
    (i) => i.date >= worldStart && i.date <= windowEnd
  );
  const byKey = new Map();
  upsertWorldStories(byKey, existing);
  const live = await fetchLiveWorld(worldStart, windowEnd);
  upsertWorldStories(
    byKey,
    live.map((i) => ({ ...i, firstSeen: now.toISOString() }))
  );
  const items = [...byKey.values()]
    .filter((i) => i.date >= worldStart && i.date <= windowEnd)
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) ||
        (a.bestRank ?? 1e9) - (b.bestRank ?? 1e9)
    );
  const result = await publishWorldFeed({
    archiveFile,
    feedFile,
    items,
    nowIso: now.toISOString(),
    windowStart: worldStart,
    windowEnd,
  });
  console.log(
    `  [world] archive ${result.archived}; feed ${result.published} ` +
      `(${result.enriched} summaries enriched)`
  );
  return items.map((i) => ({
    headline: i.headline,
    date: i.date,
    tag: i.bucket,
    summary: i.summary,
    url: i.url,
  }));
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
    if (!inNetflixWindow(date)) continue;
    const end = i + 1 < headers.length ? headers[i + 1].pos : html.length;
    const chunk = html.slice(pos, end);
    for (const li of chunk.matchAll(/<li>([\s\S]*?)<\/li>/g)) {
      const text = stripTags(li[1]);
      if (!/netflix original/i.test(text)) continue;
      const [left] = text.split(/\s+[–—-]\s+/);
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
        synopsis: "",
        starring: [],
      });
    }
  }
  return items;
}

const TUDUM_SKIP_TITLE =
  /^(coming soon|popular now|popular releases|remind me|new on netflix|latest news|adventure|date|genre|tv shows|movies|view by|more on\b|shop\b)/i;

function parseTudumTitles(html) {
  const titles = [];
  const months = new Set();
  const dateHeads = [];
  for (const m of html.matchAll(/<h2[^>]*>([\s\S]{0,160}?)<\/h2>/gi)) {
    const text = stripTags(m[1]).replace(/\s+/g, " ").trim();
    const dm = text.match(
      /^(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})$/i
    );
    if (!dm) continue;
    const parsed = parseEnglishDate(`${dm[1]} ${dm[2]}, ${now.getFullYear()}`);
    if (parsed) {
      dateHeads.push(parsed);
      months.add(parsed.slice(0, 7));
    }
  }
  for (const m of html.matchAll(/<h3[^>]*>([\s\S]{0,200}?)<\/h3>/gi)) {
    const title = stripTags(m[1]).replace(/\s+/g, " ").trim();
    if (!title || title.length < 2 || title.length > 80) continue;
    if (TUDUM_SKIP_TITLE.test(title)) continue;
    titles.push(title);
  }
  return { titles, months, dateCount: dateHeads.length };
}

function usTitleMatch(itemTitle, listTitle) {
  const a = titleCore(itemTitle);
  const b = titleCore(listTitle);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.length >= 10 && b.length >= 10 && (a.startsWith(b) || b.startsWith(a)))
    return true;
  return namesSimilar(itemTitle, listTitle);
}

function itemMatchesUsList(item, usTitles) {
  const names = [item.title, ...(item.akas || [])].filter(Boolean);
  for (const name of names) {
    for (const listed of usTitles) {
      if (usTitleMatch(name, listed)) return true;
    }
  }
  return false;
}

async function fetchTudumHtml(url) {
  return fetchText(url, 30000, UA);
}

async function fetchUsNetflixCatalog() {
  const titles = [];
  const coveredMonths = new Set();
  const seen = new Set();
  const addTitles = (list) => {
    for (const raw of list || []) {
      const t = String(raw || "").replace(/\s+/g, " ").trim();
      const k = titleCore(t);
      if (!k || seen.has(k)) continue;
      seen.add(k);
      titles.push(t);
    }
  };

  try {
    const html = await fetchTudumHtml(
      "https://www.netflix.com/tudum/articles/new-on-netflix"
    );
    const parsed = parseTudumTitles(html);
    addTitles(parsed.titles);
    if (parsed.dateCount >= 8) {
      for (const month of parsed.months) coveredMonths.add(month);
    }
    console.log(
      `  [netflix] tudum monthly: ${parsed.titles.length} US titles` +
        (parsed.dateCount >= 8 ? ` (covers ${[...parsed.months].join(", ")})` : "")
    );
  } catch (err) {
    console.warn(`  [netflix] tudum monthly: ${err.message}`);
  }

  try {
    const topics = await fetchTudumHtml(
      "https://www.netflix.com/tudum/topics/new-on-netflix"
    );
    const links = [
      ...new Set(
        [
          ...topics.matchAll(
            /href="(\/tudum\/articles\/what-to-watch-on-netflix-[^"]+)"/gi
          ),
        ].map((m) => m[1])
      ),
    ];
    const start = new Date(`${netflixWindowStart}T12:00:00Z`).getTime() - 8 * 86400000;
    const end = new Date(`${windowEnd}T12:00:00Z`).getTime();
    const weekUrls = [];
    for (const href of links) {
      const m = href.match(
        /what-to-watch-on-netflix-([a-z]+)-(\d{1,2})-(\d{4})/i
      );
      if (!m) continue;
      const month = MONTHS.indexOf(m[1].toLowerCase());
      if (month < 0) continue;
      const date = `${m[3]}-${String(month + 1).padStart(2, "0")}-${String(Number(m[2])).padStart(2, "0")}`;
      const ts = Date.parse(`${date}T12:00:00Z`);
      if (!Number.isFinite(ts) || ts < start || ts > end) continue;
      weekUrls.push(`https://www.netflix.com${href.split("?")[0]}`);
    }
    for (const url of weekUrls.slice(0, 8)) {
      try {
        const html = await fetchTudumHtml(url);
        addTitles(parseTudumTitles(html).titles);
      } catch (err) {
        console.warn(`  [netflix] tudum weekly ${url}: ${err.message}`);
      }
      await sleep(400);
    }
  } catch (err) {
    console.warn(`  [netflix] tudum topics: ${err.message}`);
  }

  return { titles, coveredMonths };
}

function tagNetflixUs(items, catalog) {
  const usTitles = catalog.titles || [];
  const covered = catalog.coveredMonths || new Set();
  let yes = 0;
  let no = 0;
  for (const item of items) {
    if (itemMatchesUsList(item, usTitles)) {
      item.inUS = true;
      yes += 1;
    } else if (covered.has(String(item.date || "").slice(0, 7))) {
      item.inUS = false;
      no += 1;
    }
  }
  console.log(
    `  [netflix] US catalog ${usTitles.length} titles; in US ${yes}, outside ${no}, unknown ${items.length - yes - no}`
  );
  return items;
}

function seriesTypeFromGenre(genre) {
  if (/docuseries/i.test(genre)) return "Docuseries";
  if (/documentary|true crime|sports/i.test(genre)) return "Documentary";
  return "Series";
}

/**
 * Wikipedia original-programming + stand-up lists — titles and premiere
 * dates only. Plot/cast/poster come from TMDB. New seasons of returning
 * shows still come from TVMaze (and whats-on-netflix when it isn't blocked).
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
        if (!date || !inNetflixWindow(date) || !title || title === "Title") continue;
        const genre = dateIdx > 1 ? cells[1] : "";
        items.push({
          title,
          type: fixedType || seriesTypeFromGenre(genre),
          date,
          synopsis: "",
          starring: [],
        });
      }
    } catch (err) {
      console.warn(`  [netflix] wikipedia "${page}": ${err.message}`);
    }
  }
  return items;
}

/** Wikipedia's Netflix original films list — titles and dates only. */
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
    if (!date || !inNetflixWindow(date) || !title || title === "Title") continue;
    items.push({
      title,
      type: /documentary/i.test(genre) ? "Documentary" : "Film",
      date,
      synopsis: "",
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

const TITLE_STOP = new Set([
  "the", "a", "an", "of", "and", "in", "to", "for", "on", "with",
]);

function titleCore(s) {
  return normTitle(s)
    .replace(/\bseason \d+\b/g, " ")
    .replace(/\bpart \d+\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function significantTokens(s) {
  return titleCore(s)
    .split(" ")
    .filter((t) => t && !TITLE_STOP.has(t) && t.length > 1);
}

function namesSimilar(a, b) {
  const ca = titleCore(a);
  const cb = titleCore(b);
  if (!ca || !cb) return false;
  if (ca === cb) return true;
  if (ca.length >= 8 && cb.length >= 8 && (ca.includes(cb) || cb.includes(ca)))
    return true;
  const ta = significantTokens(a);
  const tb = significantTokens(b);
  if (!ta.length || !tb.length) return false;
  let prefix = 0;
  while (prefix < ta.length && prefix < tb.length && ta[prefix] === tb[prefix])
    prefix += 1;
  if (prefix >= 3) return true;
  const setB = new Set(tb);
  const overlap = ta.filter((t) => setB.has(t)).length;
  const min = Math.min(ta.length, tb.length);
  if (overlap >= min && overlap >= 2) return true;
  if (min === 1 && ta[0] === tb[0] && ta[0].length >= 6) return true;
  return false;
}

function foldName(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function itemTitles(item) {
  return [item.title, ...(item.akas || [])].filter(Boolean);
}

function titlesOverlap(a, b) {
  if (a.tvmazeId && b.tvmazeId && a.tvmazeId === b.tvmazeId) return true;
  for (const x of itemTitles(a)) {
    for (const y of itemTitles(b)) {
      if (sameTitle(x, y)) return true;
    }
  }
  return false;
}

function sameTitle(a, b) {
  return namesSimilar(a, b);
}

function isThinSynopsis(s) {
  const t = String(s || "").replace(/\s+/g, " ").trim();
  if (!t) return true;
  if (t.length < 80) return true;
  if (/^Netflix Original/i.test(t)) return true;
  if (
    /^(Stand-up( comedy)? special|Drama series|Mexican teen drama|Japanese reality dating show|Kuwaiti romantic comedy|\d+ min film)\.?$/i.test(
      t
    )
  )
    return true;
  if (/^(Film|Series|Documentary|Reality|Docuseries|Special)\.?$/i.test(t))
    return true;
  if (/\b(series|film|special)\.?$/i.test(t) && t.length < 55) return true;
  if (/\bmay refer to\b/i.test(t)) return true;
  return false;
}

function isStandup(item) {
  return /stand-up/i.test(item?.type || "") || /stand-up/i.test(item?.title || "");
}

function comedianFromTitle(title) {
  const left = String(title || "").split(":")[0].trim();
  if (!left || left.length < 3 || left.split(/\s+/).length > 5) return "";
  return left;
}

function mergeStarring(a, b) {
  const seen = new Set();
  const out = [];
  for (const name of [...(a || []), ...(b || [])]) {
    const k = foldName(name);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(String(name).trim());
  }
  return out.slice(0, 6);
}

function pickSynopsis(preferred, other) {
  if (!isThinSynopsis(preferred)) return preferred;
  if (!isThinSynopsis(other)) return other;
  const x = String(preferred || "").trim();
  const y = String(other || "").trim();
  return y.length > x.length ? y : x;
}

function mergeNetflixCards(keep, incoming) {
  const out = { ...keep };
  out.synopsis = pickSynopsis(keep.synopsis, incoming.synopsis);
  out.starring = mergeStarring(keep.starring, incoming.starring);
  out.akas = [...new Set([...(keep.akas || []), ...(incoming.akas || [])])];
  if (incoming.tvmazeId && !out.tvmazeId) out.tvmazeId = incoming.tvmazeId;
  if (incoming.tmdbId && !out.tmdbId) out.tmdbId = incoming.tmdbId;
  if (incoming.wikiTitle && !out.wikiTitle) out.wikiTitle = incoming.wikiTitle;
  if (incoming.image && !out.image) out.image = incoming.image;
  if (incoming.brief && !out.brief) out.brief = incoming.brief;
  if (incoming.confirmedOriginal) out.confirmedOriginal = true;
  return out;
}

function likelySameShow(a, b) {
  if (a.tvmazeId && b.tvmazeId && a.tvmazeId === b.tvmazeId) return true;
  if (a.wikiTitle && b.wikiTitle && a.wikiTitle === b.wikiTitle) return true;
  if (sameTitle(a.title, b.title)) return true;
  if (titlesOverlap(a, b)) return true;
  const starsA = (a.starring || []).map(foldName);
  const starsB = (b.starring || []).map(foldName);
  if (starsA.length >= 2 && starsB.length >= 2) {
    const overlap = starsA.filter((s) => starsB.includes(s)).length;
    const days = Math.abs(Date.parse(a.date) - Date.parse(b.date)) / 86400000;
    if (overlap >= 2 && days <= 3) return true;
  }
  const na = titleCore(a.title);
  const nb = titleCore(b.title);
  const synA = (a.synopsis || "").toLowerCase();
  const synB = (b.synopsis || "").toLowerCase();
  if (na.length >= 8 && synB.includes(na)) return true;
  if (nb.length >= 8 && synA.includes(nb)) return true;
  if (/previously known as/i.test(synA) && nb.length >= 4 && synA.includes(nb))
    return true;
  if (/previously known as/i.test(synB) && na.length >= 4 && synB.includes(na))
    return true;
  return false;
}

function dedupeNetflix(items, loose) {
  const out = [];
  for (const item of items) {
    const other = out.find((d) =>
      loose
        ? likelySameShow(d, item)
        : titlesOverlap(d, item)
    );
    if (!other) out.push(item);
    else Object.assign(other, mergeNetflixCards(other, item));
  }
  return out;
}

function normNetflixTitle(s) {
  return String(s || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function publicNetflixItem(item) {
  const out = {
    title: item.title,
    type: item.type,
    date: item.date,
    synopsis: String(item.synopsis || "").replace(/\s+/g, " ").trim(),
    starring: item.starring || [],
  };
  const synopsis = out.synopsis;
  const brief = tidyBrief(item.brief);
  if (briefIsUsable(brief, synopsis)) out.brief = brief;
  else {
    const compressed = compressBrief(synopsis);
    if (compressed) out.brief = compressed;
  }
  if (item.image) out.image = item.image;
  if (item.inUS === true) out.inUS = true;
  else if (item.inUS === false) out.inUS = false;
  return out;
}

async function withPreservedNetflixBriefs(items) {
  let prev = [];
  try {
    prev =
      JSON.parse(await readFile(path.join(OUT_DIR, "netflix.json"), "utf8"))
        .items || [];
  } catch {
    prev = [];
  }
  const briefs = new Map();
  for (const row of prev) {
    const brief = String(row.brief || "").replace(/\s+/g, " ").trim();
    if (brief) briefs.set(normNetflixTitle(row.title), brief);
  }
  if (!briefs.size) {
    return items.map((item) => {
      if (briefIsUsable(item.brief, item.synopsis)) return item;
      const brief = compressBrief(item.synopsis);
      return brief ? { ...item, brief } : item;
    });
  }
  return items.map((item) => {
    const preserved = briefs.get(normNetflixTitle(item.title));
    if (briefIsUsable(item.brief, item.synopsis)) {
      return { ...item, brief: tidyBrief(item.brief) };
    }
    if (briefIsUsable(preserved, item.synopsis)) {
      return { ...item, brief: tidyBrief(preserved) };
    }
    const brief = compressBrief(item.synopsis);
    return brief ? { ...item, brief } : item;
  });
}

// Wikimedia asks API clients for a descriptive UA; browser UAs get throttled.
const WIKI_UA =
  "TriviaHelper/1.0 (https://github.com/DSdev901/trivia; trivia app data refresh)";
const TVMAZE_UA = "TriviaHelper/1.0 (https://github.com/DSdev901/trivia)";
const TMDB_UA = TVMAZE_UA;
const TMDB_KEY = process.env.TMDB_API_KEY || "";

function parseEnglishDate(raw) {
  const s = String(raw || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(
    /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s*(\d{4})\b/i
  );
  if (!m) return isoFrom(s);
  const month = MONTHS.indexOf(m[1].toLowerCase());
  if (month < 0) return isoFrom(s);
  return `${m[3]}-${String(month + 1).padStart(2, "0")}-${String(Number(m[2])).padStart(2, "0")}`;
}

function tmdbImageUrl(path) {
  const p = String(path || "").trim();
  if (!p) return "";
  if (/^https?:\/\//i.test(p)) {
    return p.replace(/\/t\/p\/w\d+(?:_and_h\d+)?(?:_[a-z]+)?\//, "/t/p/w500/");
  }
  const file = p.startsWith("/") ? p : `/${p}`;
  return `https://image.tmdb.org/t/p/w500${file}`;
}

function tmdbSearchKinds(item) {
  const t = String(item.type || "");
  if (/film|movie/i.test(t) && !/series/i.test(t)) return ["movie", "tv"];
  if (/stand-up|special|live event/i.test(t)) return ["tv", "movie"];
  if (/documentary/i.test(t) && !/series|docuseries/i.test(t))
    return ["movie", "tv"];
  return ["tv", "movie"];
}

function tmdbHitScore(item, hit) {
  const bare = String(item.title || "")
    .replace(/\s*\((?:Season|Part)\s+\d+\)/i, "")
    .trim();
  let titleScore = 0;
  for (const name of [hit.title, hit.originalTitle].filter(Boolean)) {
    const ca = titleCore(bare);
    const cb = titleCore(name);
    if (!ca || !cb) continue;
    if (ca === cb) titleScore = Math.max(titleScore, 10);
    else if (namesSimilar(bare, name)) titleScore = Math.max(titleScore, 4);
  }
  if (!titleScore) return 0;
  const idate = item.date || "";
  const hdate = hit.date || "";
  if (idate && hdate && idate === hdate) return titleScore + 6;
  if (idate && hdate) {
    const days =
      Math.abs(Date.parse(`${idate}T12:00:00Z`) - Date.parse(`${hdate}T12:00:00Z`)) /
      86400000;
    if (Number.isFinite(days) && days <= 3) return titleScore + 4;
    if (Number.isFinite(days) && days <= NETFLIX_WINDOW_DAYS) return titleScore + 2;
    if (idate.slice(0, 4) === hdate.slice(0, 4)) return titleScore + 1;
    // Returning seasons and delayed Netflix pickups often have a first-air
    // year years before the card date. Keep an exact/strong title match.
    return titleScore;
  }
  return titleScore;
}

async function tmdbApi(pathname, params = {}) {
  if (!TMDB_KEY) return null;
  const url = new URL(`https://api.themoviedb.org/3${pathname}`);
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== "") url.searchParams.set(k, String(v));
  }
  const headers = { Accept: "application/json", "User-Agent": TMDB_UA };
  if (TMDB_KEY.startsWith("eyJ") || TMDB_KEY.length > 48) {
    headers.Authorization = `Bearer ${TMDB_KEY}`;
  } else {
    url.searchParams.set("api_key", TMDB_KEY);
  }
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${pathname}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

function tmdbMapApiResult(kind, r) {
  return {
    kind,
    id: String(r.id),
    title: r.title || r.name || "",
    originalTitle: r.original_title || r.original_name || "",
    date: String(r.release_date || r.first_air_date || "").slice(0, 10),
    overview: r.overview || "",
    image: tmdbImageUrl(r.poster_path),
  };
}

async function tmdbApiSearch(kind, query, year) {
  const params = { query, include_adult: "false", language: "en-US" };
  if (year && kind === "movie") params.year = year;
  if (year && kind === "tv") params.first_air_date_year = year;
  const data = await tmdbApi(`/search/${kind}`, params);
  return (data?.results || []).map((r) => tmdbMapApiResult(kind, r));
}

async function tmdbApiDetails(kind, id) {
  const data = await tmdbApi(`/${kind}/${id}`, {
    append_to_response: "credits",
    language: "en-US",
  });
  if (!data) return null;
  const cast = (data.credits?.cast || [])
    .map((c) => c.name)
    .filter(Boolean)
    .slice(0, 6);
  return {
    kind,
    id: String(data.id || id),
    title: data.title || data.name || "",
    originalTitle: data.original_title || data.original_name || "",
    date: String(data.release_date || data.first_air_date || "").slice(0, 10),
    overview: data.overview || "",
    image: tmdbImageUrl(data.poster_path),
    starring: cast,
  };
}

function parseTmdbSearchHtml(html) {
  const hits = [];
  const seen = new Set();
  for (const m of html.matchAll(
    /data-media-type="(movie|tv)"[^>]*href="\/(?:movie|tv)\/(\d+)[^"]*"/gi
  )) {
    const kind = m[1];
    const id = m[2];
    const key = `${kind}:${id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const slice = html.slice(m.index, m.index + 2800);
    const titleM = slice.match(
      /<span>([^<]{1,160})<\/span>(?:<span class="font-light">\s*\(([^)]*)\)<\/span>)?/
    );
    const dateM = slice.match(/<span class="release_date[^"]*">([^<]+)<\/span>/);
    const plotM = slice.match(/<p>([\s\S]*?)<\/p>/);
    const imgM = slice.match(
      /src="(https:\/\/(?:media|image)\.themoviedb\.org\/[^"]+)"/
    );
    const title = stripTags(titleM?.[1] || "").trim();
    if (!title) continue;
    hits.push({
      kind,
      id,
      title,
      originalTitle: stripTags(titleM?.[2] || "").trim(),
      date: parseEnglishDate(dateM?.[1] || ""),
      overview: stripTags(plotM?.[1] || "").replace(/\s+/g, " ").trim(),
      image: tmdbImageUrl(imgM?.[1] || ""),
    });
  }
  return hits;
}

function parseTmdbJsonLd(html) {
  for (const m of html.matchAll(
    /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi
  )) {
    const raw = m[1].replace(/\/\*[\s\S]*?\*\//g, "").trim();
    if (!raw.startsWith("{") && !raw.startsWith("[")) continue;
    try {
      const json = JSON.parse(raw);
      const nodes = Array.isArray(json) ? json : [json];
      for (const node of nodes) {
        const type = String(node?.["@type"] || "");
        if (/Movie|TVSeries|TVEpisode/i.test(type)) return node;
      }
    } catch {
      /* ignore malformed ld+json */
    }
  }
  return null;
}

function parseTmdbCastHtml(html) {
  const chunk = html.match(/id="cast_scroller"[\s\S]*?<\/ol>/i)?.[0] || "";
  const names = [];
  const seen = new Set();
  for (const m of chunk.matchAll(
    /<p><a href="\/person\/\d+[^"]*">([^<]+)<\/a><\/p>/g
  )) {
    const name = stripTags(m[1]).trim();
    const k = foldName(name);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    names.push(name);
    if (names.length >= 6) break;
  }
  return names;
}

async function tmdbFetch(url) {
  let lastErr;
  for (let i = 0; i < 3; i += 1) {
    try {
      return await fetchText(url, 20000, TMDB_UA);
    } catch (err) {
      lastErr = err;
      if (!/429|503/.test(err.message) || i === 2) throw err;
      await sleep(4000 * (i + 1));
    }
  }
  throw lastErr;
}

async function tmdbHtmlSearch(kind, query) {
  const html = await tmdbFetch(
    `https://www.themoviedb.org/search/${kind}?query=${encodeURIComponent(query)}`
  );
  return parseTmdbSearchHtml(html).filter((h) => h.kind === kind);
}

async function tmdbHtmlDetails(kind, id) {
  const html = await tmdbFetch(`https://www.themoviedb.org/${kind}/${id}`);
  const ld = parseTmdbJsonLd(html);
  const ev = ld?.releasedEvent;
  const release = Array.isArray(ev) ? ev[0]?.startDate : ev?.startDate;
  return {
    kind,
    id: String(id),
    title: ld?.name || "",
    originalTitle: "",
    date: parseEnglishDate(release) || "",
    overview: ld?.description || "",
    image: tmdbImageUrl(ld?.image || ""),
    starring: parseTmdbCastHtml(html),
  };
}

async function tmdbSearchHits(item) {
  const bare = String(item.title || "")
    .replace(/\s*\((?:Season|Part)\s+\d+\)/i, "")
    .trim();
  const q = titleCore(bare) || bare;
  if (!q) return [];
  const year = (item.date || "").slice(0, 4);
  const hits = [];
  const seen = new Set();
  const pushAll = (list) => {
    for (const hit of list || []) {
      const key = `${hit.kind}:${hit.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      hits.push(hit);
    }
  };
  const hasExact = () => hits.some((h) => tmdbHitScore(item, h) >= 10);
  for (const kind of tmdbSearchKinds(item)) {
    if (TMDB_KEY && !hasExact()) {
      try {
        if (year) pushAll(await tmdbApiSearch(kind, q, year));
        if (!hasExact()) pushAll(await tmdbApiSearch(kind, q, ""));
      } catch (err) {
        console.warn(`  [netflix] tmdb api search "${bare}": ${err.message}`);
      }
    }
    if (!hasExact()) {
      try {
        if (year) pushAll(await tmdbHtmlSearch(kind, `${q} y:${year}`));
        if (!hasExact()) pushAll(await tmdbHtmlSearch(kind, q));
      } catch (err) {
        console.warn(`  [netflix] tmdb search "${bare}": ${err.message}`);
      }
    }
    await sleep(400);
    if (hasExact()) break;
  }
  return hits;
}

async function tmdbDetailsFor(hit) {
  if (TMDB_KEY) {
    try {
      const details = await tmdbApiDetails(hit.kind, hit.id);
      if (details) return details;
    } catch (err) {
      console.warn(`  [netflix] tmdb api details ${hit.kind}/${hit.id}: ${err.message}`);
    }
  }
  try {
    return await tmdbHtmlDetails(hit.kind, hit.id);
  } catch (err) {
    console.warn(`  [netflix] tmdb details ${hit.kind}/${hit.id}: ${err.message}`);
    return {
      ...hit,
      starring: hit.starring || [],
    };
  }
}

async function tmdbLookup(item) {
  const hits = (await tmdbSearchHits(item))
    .map((hit) => ({ hit, score: tmdbHitScore(item, hit) }))
    .filter((row) => row.score >= 6)
    .sort((a, b) => b.score - a.score);
  if (!hits.length) return null;
  const best = hits[0].hit;
  const details = await tmdbDetailsFor(best);
  const overview = String(details.overview || best.overview || "")
    .replace(/\s+/g, " ")
    .trim();
  const clipped =
    overview.length > 320
      ? `${overview.slice(0, 317).replace(/\s+\S*$/, "")}…`
      : overview;
  const image = details.image || best.image || "";
  const starring = details.starring || [];
  const akas = [details.title, details.originalTitle, best.title, best.originalTitle]
    .filter(Boolean)
    .filter((n) => !sameTitle(n, item.title));
  return {
    tmdbId: `${details.kind}:${details.id}`,
    synopsis: clipped,
    starring,
    image,
    akas,
  };
}

async function wikiJson(params) {
  const url =
    "https://en.wikipedia.org/w/api.php?" +
    new URLSearchParams({ format: "json", ...params });
  return JSON.parse(await fetchText(url, 15000, WIKI_UA));
}

async function wikiSearchPages(query) {
  const data = await wikiJson({
    action: "query",
    generator: "search",
    gsrsearch: query,
    gsrlimit: "5",
    prop: "extracts|pageimages",
    pithumbsize: "400",
    exintro: "1",
    explaintext: "1",
    redirects: "1",
  });
  return Object.values(data?.query?.pages || {}).filter(
    (p) => p.title && !/^List of /i.test(p.title)
  );
}

function namesFromList(raw) {
  return String(raw || "")
    .split(/,|;|\n| and /i)
    .map((s) =>
      s
        .replace(/\s+as\s+.+$/i, "")
        .replace(/^and\s+/i, "")
        .trim()
    )
    .filter(
      (s) =>
        /^[A-Z][\p{L}.'()-]*( [\p{L}.'() -]{1,30}){0,3}$/u.test(s) &&
        !/\d/.test(s) &&
        s.length < 50
    )
    .slice(0, 6);
}

function starringFromExtract(extract) {
  const text = String(extract || "");
  const patterns = [
    /\b(?:it )?stars\s+(.+?)(?:\.|;|,(?:\s+(?:this|the|a|an|who|which|in)\b))/is,
    /\bstarring\s+(.+?)(?:\.|;|,(?:\s+(?:this|the|a|an|who|which)\b))/is,
    /\bvoiced by\s+(.+?)(?:\.|;)/is,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (!m) continue;
    const names = namesFromList(m[1]);
    if (names.length) return names;
  }
  const m = text.match(/(?:starring|stars)\s+(.+?)(?<! [A-Z])\.(?=\s|$)/s);
  return m ? namesFromList(m[1]) : [];
}

async function wikiExactPage(title) {
  if (!title) return null;
  const data = await wikiJson({
    action: "query",
    titles: title,
    prop: "extracts|pageimages",
    pithumbsize: "400",
    exintro: "1",
    explaintext: "1",
    redirects: "1",
  });
  const page = Object.values(data?.query?.pages || {})[0];
  if (!page || page.missing != null || /^List of /i.test(page.title || ""))
    return null;
  return page;
}

function tvmazeType(show) {
  const t = String(show?.type || "").toLowerCase();
  if (t === "documentary") return "Documentary";
  if (t === "reality") return "Reality";
  if (t === "animation") return "Series";
  if (t === "award show") return "Special";
  if (t === "talk show") return "Series";
  if (t === "sports") return "Documentary";
  return "Series";
}

function tvmazeImage(show) {
  return show?.image?.medium || show?.image?.original || "";
}

function stripHtmlBrief(html) {
  return stripTags(html).replace(/\s+/g, " ").trim();
}

/**
 * TVMaze web schedule: every Netflix-original episode that aired in the
 * window, worldwide (Netflix's webChannel has no country). Grouped into
 * one card per show, dated to the first new episode in the window.
 * This is the only source that reliably catches returning seasons.
 */
async function fetchTvmazeNetflix() {
  const byShow = new Map();
  const start = new Date(`${netflixWindowStart}T12:00:00Z`);
  const end = new Date(`${windowEnd}T12:00:00Z`);
  for (let t = start.getTime(); t <= end.getTime(); t += 86400000) {
    const date = new Date(t).toISOString().slice(0, 10);
    try {
      const episodes = JSON.parse(
        await fetchText(
          `https://api.tvmaze.com/schedule/web?date=${date}`,
          20000,
          "TriviaHelper/1.0 (https://github.com/DSdev901/trivia)"
        )
      );
      for (const ep of episodes || []) {
        const show = ep._embedded?.show;
        if (show?.webChannel?.name !== "Netflix") continue;
        const air = isoFrom(ep.airdate || date);
        if (!air || !inNetflixWindow(air)) continue;
        const prev = byShow.get(show.id);
        if (!prev || air < prev.date) {
          byShow.set(show.id, {
            tvmazeId: show.id,
            title: show.name,
            type: tvmazeType(show),
            date: air,
            season: ep.season || 1,
            synopsis: stripHtmlBrief(show.summary) || "Netflix Original release.",
            starring: [],
            image: tvmazeImage(show),
          });
        }
      }
    } catch (err) {
      console.warn(`  [netflix] tvmaze ${date}: ${err.message}`);
    }
    await sleep(250);
  }

  const items = [...byShow.values()];
  for (const item of items) {
    if (item.season > 1) item.title = `${item.title} (Season ${item.season})`;
    try {
      const full = JSON.parse(
        await fetchText(
          `https://api.tvmaze.com/shows/${item.tvmazeId}?embed[]=cast&embed[]=akas`,
          15000,
          TVMAZE_UA
        )
      );
      const summary = stripHtmlBrief(full.summary);
      if (!isThinSynopsis(summary)) item.synopsis = summary;
      else if (summary) item.synopsis = pickSynopsis(item.synopsis, summary);
      if (tvmazeImage(full) && !item.image) item.image = tvmazeImage(full);
      item.starring = (full._embedded?.cast || [])
        .map((c) => c.person?.name)
        .filter(Boolean)
        .slice(0, 6);
      item.akas = (full._embedded?.akas || [])
        .map((a) => a.name)
        .filter(Boolean);
    } catch (err) {
      console.warn(`  [netflix] tvmaze cast "${item.title}": ${err.message}`);
    }
    delete item.season;
    await sleep(250);
  }
  return items;
}

function isNetflixShow(show) {
  return (
    show?.webChannel?.name === "Netflix" || show?.network?.name === "Netflix"
  );
}

async function tvmazeShowDetails(show) {
  const full = JSON.parse(
    await fetchText(
      `https://api.tvmaze.com/shows/${show.id}?embed[]=cast&embed[]=akas`,
      15000,
      TVMAZE_UA
    )
  );
  return {
    tvmazeId: show.id,
    title: full.name || show.name,
    type: tvmazeType(full),
    synopsis: stripHtmlBrief(full.summary) || stripHtmlBrief(show.summary),
    starring: (full._embedded?.cast || [])
      .map((c) => c.person?.name)
      .filter(Boolean)
      .slice(0, 6),
    akas: (full._embedded?.akas || []).map((a) => a.name).filter(Boolean),
    image: tvmazeImage(full) || tvmazeImage(show),
  };
}

async function tvmazeSearchShow(title) {
  const q = titleCore(title);
  if (!q) return null;
  const results = JSON.parse(
    await fetchText(
      `https://api.tvmaze.com/search/shows?q=${encodeURIComponent(q)}`,
      15000,
      TVMAZE_UA
    )
  );
  const list = results || [];
  const named =
    list.find((r) => isNetflixShow(r.show) && namesSimilar(r.show.name, title)) ||
    list.find((r) => titleCore(r.show.name) === q) ||
    list.find((r) => namesSimilar(r.show.name, title) && r.score >= 1.2);
  if (named) return tvmazeShowDetails(named.show);

  const netflixHits = list.filter((r) => isNetflixShow(r.show)).slice(0, 4);
  for (const r of netflixHits) {
    const details = await tvmazeShowDetails(r.show);
    await sleep(200);
    if (
      namesSimilar(details.title, title) ||
      details.akas.some((n) => namesSimilar(n, title))
    )
      return details;
  }
  return null;
}

function needsCast(item) {
  const n = (item.starring || []).length;
  if (isStandup(item) || /documentary|docuseries|reality/i.test(item.type))
    return n < 1;
  return n < 2;
}

function applyStarringFromText(item) {
  if ((item.starring || []).length >= 2) return;
  const fromText = starringFromExtract(item.synopsis || "");
  if (fromText.length) item.starring = mergeStarring(item.starring, fromText);
}

/** Docs/reality often name the subject in the title or synopsis, not a cast list. */
function applyFeaturedNames(item) {
  if ((item.starring || []).length) return;
  const syn = item.synopsis || "";
  const found = [];
  const host = syn.match(
    /\b(?:[Cc]omedian|[Hh]osted by|[Ff]eaturing)\s+([A-Z][\p{L}.'-]+(?:\s+[A-Z][\p{L}.'-]+){0,2})/u
  );
  if (host) found.push(host[1]);
  const guest = syn.match(
    /\bwith\s+([A-Z][\p{L}.'-]+(?:\s+[A-Z][\p{L}.'-]+)?)\b/u
  );
  if (guest && /special|documentary/i.test(item.type)) found.push(guest[1]);
  if (/kaulitz/i.test(item.title)) {
    found.push("Bill Kaulitz", "Tom Kaulitz");
  }
  const notName = /^(The|A|An|Season|Part|Netflix|College|University|Murders|Tapes|Scandal|Story|Nightmare|Conspiracy|Games|Street|Killer|Conversations|Between|Worlds)$/i;
  if (/documentary|docuseries/i.test(item.type)) {
    const words = item.title.match(/[A-Z][\p{L}.'-]+/gu) || [];
    for (let i = 0; i < words.length - 1; i += 1) {
      if (notName.test(words[i]) || notName.test(words[i + 1])) continue;
      const n = `${words[i]} ${words[i + 1]}`;
      if (new RegExp(n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(syn))
        found.push(n);
    }
  }
  const personTitle = String(item.title || "")
    .replace(/^.*:\s*/, "")
    .replace(/\s*\((?:Season|Part)\s+\d+\)/i, "")
    .trim();
  if (
    /documentary|docuseries|reality|stand-up/i.test(item.type) &&
    /^[A-Z][\p{L}.'-]+(?:\s+[A-Z][\p{L}.'-]+){0,2}$/u.test(personTitle) &&
    personTitle.split(/\s+/).length <= 3
  ) {
    const escaped = personTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const full = syn.match(
      new RegExp(
        `\\b([A-Z][\\p{L}.'-]+\\s+${escaped}|${escaped}(?:\\s+[A-Z][\\p{L}.'-]+)?)\\b`,
        "u"
      )
    );
    if (full) found.push(full[1]);
    else if (isStandup(item) || personTitle.split(/\s+/).length === 1)
      found.push(personTitle);
  }
  if (found.length) item.starring = mergeStarring(item.starring, found);
}

async function enrichNetflix(items) {
  let tmdbHits = 0;
  console.log(
    `  [netflix] tmdb via ${TMDB_KEY ? "api" : "public pages"} (${items.length} cards)`
  );
  for (const item of items) {
    applyStarringFromText(item);
    applyFeaturedNames(item);
    if (isStandup(item) && !(item.starring || []).length) {
      const name = comedianFromTitle(item.title);
      if (name) item.starring = [name];
    }

    if (!needsCast(item) && !isThinSynopsis(item.synopsis) && item.image) continue;

    if (!item.tvmazeId) {
      try {
        const tv = await tvmazeSearchShow(item.title);
        if (tv) {
          item.tvmazeId = tv.tvmazeId;
          item.synopsis = pickSynopsis(item.synopsis, tv.synopsis);
          item.starring = mergeStarring(tv.starring, item.starring);
          item.akas = [...new Set([...(item.akas || []), ...(tv.akas || [])])];
          if (tv.image && !item.image) item.image = tv.image;
        }
      } catch (err) {
        console.warn(`  [netflix] tvmaze search "${item.title}": ${err.message}`);
      }
      await sleep(250);
    }

    if (!needsCast(item) && !isThinSynopsis(item.synopsis) && item.image) continue;

    item._tmdbTried = true;
    try {
      const hit = await tmdbLookup(item);
      if (hit) {
        tmdbHits += 1;
        item.tmdbId = hit.tmdbId;
        item.synopsis = pickSynopsis(item.synopsis, hit.synopsis);
        item.starring = mergeStarring(item.starring, hit.starring);
        item.akas = [...new Set([...(item.akas || []), ...(hit.akas || [])])];
        if (hit.image && !item.image) item.image = hit.image;
      }
    } catch (err) {
      console.warn(`  [netflix] tmdb "${item.title}": ${err.message}`);
    }
    if (isThinSynopsis(item.synopsis)) {
      try {
        const wiki = await wikiSynopsisForTitle(item.title);
        if (wiki) {
          item.synopsis = pickSynopsis(item.synopsis, wiki.synopsis);
          item.starring = mergeStarring(item.starring, wiki.starring);
        }
      } catch (err) {
        console.warn(`  [netflix] wiki "${item.title}": ${err.message}`);
      }
      await sleep(150);
    }
    applyFeaturedNames(item);
    await sleep(200);
  }
  console.log(`  [netflix] tmdb filled ${tmdbHits} cards`);
  return items;
}

async function buildNetflix() {
  let items = [];
  const usCatalogPromise = fetchUsNetflixCatalog();
  // Primary: TVMaze episode schedule — every original that actually dropped
  // new episodes in the window, with synopsis + cast.
  try {
    items.push(...(await fetchTvmazeNetflix()));
    console.log(`  [netflix] tvmaze: ${items.length} titles with new episodes`);
  } catch (err) {
    console.warn(`  [netflix] tvmaze: ${err.message}`);
  }
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
  // Title/date lists only (whats-on-netflix sometimes 403s). Plot comes from TMDB.
  try {
    items.push(...(await fetchWikipediaFilms()));
  } catch (err) {
    console.warn(`  [netflix] wikipedia films: ${err.message}`);
  }
  items.push(...(await fetchWikipediaProgramming()));
  try {
    const prev = JSON.parse(
      await readFile(path.join(OUT_DIR, "netflix.json"), "utf8")
    );
    const seeded = (prev.items || [])
      .filter((i) => i?.title && i.date && inNetflixWindow(i.date))
      .map((i) => ({
        title: i.title,
        type: i.type || "Film",
        date: i.date,
        synopsis:
          isThinSynopsis(i.synopsis) || /\bmay refer to\b/i.test(i.synopsis || "")
            ? ""
            : i.synopsis,
        starring: Array.isArray(i.starring) ? i.starring : [],
        image:
          String(i.image || "").startsWith(`${POSTER_URL_PREFIX}/`)
            ? i.image
            : "",
        ...(String(i.brief || "").trim()
          ? { brief: String(i.brief).replace(/\s+/g, " ").trim() }
          : {}),
      }));
    items.push(...seeded);
    if (seeded.length)
      console.log(`  [netflix] kept ${seeded.length} in-window titles from last run`);
  } catch {
    /* first run or unreadable cache */
  }
  // TVMaze first, then title lists. Merge field-wise so a later source
  // cannot replace a TVMaze synopsis with an empty listing stub.
  let merged = dedupeNetflix(items, false);
  merged = await enrichNetflix(merged);
  merged = dedupeNetflix(merged, true);
  merged = tagNetflixUs(merged, await usCatalogPromise);
  const useful = merged.filter((i) => !isThinSynopsis(i.synopsis)).length;
  const withCast = merged.filter((i) => (i.starring || []).length > 0).length;
  console.log(
    `  [netflix] ${merged.length} titles after merge (${useful} with synopsis, ${withCast} with cast)`
  );
  merged.sort((a, b) => b.date.localeCompare(a.date));
  merged = await fillMissingNetflixImages(merged);
  merged = await cacheNetflixPosters(merged);
  return merged.map(publicNetflixItem);
}

async function tvmazePosterForTitle(title) {
  const q = titleCore(title);
  if (!q) return "";
  const results = JSON.parse(
    await fetchText(
      `https://api.tvmaze.com/search/shows?q=${encodeURIComponent(q)}`,
      15000,
      TVMAZE_UA
    )
  );
  const list = results || [];
  const named =
    list.find((r) => isNetflixShow(r.show) && namesSimilar(r.show.name, title)) ||
    list.find((r) => namesSimilar(r.show.name, title)) ||
    list[0];
  return tvmazeImage(named?.show);
}

async function wikiPosterForTitle(title) {
  const want = String(title || "")
    .replace(/\s*\((?:Season|Part)\s+\d+\)/i, "")
    .trim();
  if (!want) return "";
  const page = await wikiExactPage(want);
  if (page?.thumbnail?.source && !/\bmay refer to\b/i.test(page.extract || ""))
    return page.thumbnail.source;
  const pages = await wikiSearchPages(`${want} Netflix`);
  const hit =
    pages.find((p) => namesSimilar(p.title, want)) ||
    pages.find((p) => /netflix/i.test(p.extract || "")) ||
    pages[0];
  return hit?.thumbnail?.source || "";
}

function clipWikiExtract(text, max = 360) {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  if (!t) return "";
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const at = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("; "));
  return `${(at > 80 ? cut.slice(0, at + 1) : cut).trim()}…`;
}

async function wikiSynopsisForTitle(title) {
  const want = String(title || "")
    .replace(/\s*\((?:Season|Part)\s+\d+\)/i, "")
    .trim();
  if (!want) return null;
  const pages = [];
  const exact = await wikiExactPage(want);
  if (exact?.extract) pages.push(exact);
  const searched = await wikiSearchPages(`${want} Netflix`);
  pages.push(...(searched || []));
  const hit = pages.find(
    (p) =>
      p.extract &&
      !/\bmay refer to\b/i.test(p.extract) &&
      (namesSimilar(p.title, want) || /netflix/i.test(p.extract))
  );
  const extract = String(hit?.extract || "").trim();
  if (isThinSynopsis(extract)) return null;
  return {
    synopsis: clipWikiExtract(extract),
    starring: starringFromExtract(extract),
  };
}

async function fillMissingNetflixImages(items) {
  let filled = 0;
  for (const item of items) {
    if (item.image) continue;
    if (!item._tmdbTried) {
      try {
        const hit = await tmdbLookup(item);
        item._tmdbTried = true;
        if (hit?.image) {
          item.tmdbId = hit.tmdbId || item.tmdbId;
          item.image = hit.image;
          if (isThinSynopsis(item.synopsis) && hit.synopsis)
            item.synopsis = pickSynopsis(item.synopsis, hit.synopsis);
          if (hit.starring?.length)
            item.starring = mergeStarring(item.starring, hit.starring);
          filled += 1;
          await sleep(200);
          continue;
        }
      } catch (err) {
        console.warn(`  [netflix] poster tmdb "${item.title}": ${err.message}`);
      }
      await sleep(200);
    }
    try {
      const fromTv = await tvmazePosterForTitle(item.title);
      if (fromTv) {
        item.image = fromTv;
        filled += 1;
        await sleep(200);
        continue;
      }
    } catch (err) {
      console.warn(`  [netflix] poster tvmaze "${item.title}": ${err.message}`);
    }
    await sleep(200);
    try {
      const fromWiki = await wikiPosterForTitle(item.title);
      if (fromWiki) {
        item.image = fromWiki;
        filled += 1;
      }
    } catch (err) {
      console.warn(`  [netflix] poster wiki "${item.title}": ${err.message}`);
    }
    await sleep(150);
  }
  const withImg = items.filter((i) => i.image).length;
  console.log(`  [netflix] posters: ${withImg}/${items.length} (filled ${filled})`);
  return items;
}

function isLocalPoster(url) {
  return String(url || "").startsWith(`${POSTER_URL_PREFIX}/`);
}

function posterFileName(title, url) {
  const base =
    titleCore(title)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "poster";
  const hash = createHash("sha1").update(String(url)).digest("hex").slice(0, 8);
  const extMatch = String(url).match(/\.(jpe?g|png|webp|gif)(?:\?|$)/i);
  const ext = (extMatch?.[1] || "jpg").toLowerCase().replace("jpeg", "jpg");
  return `${base}-${hash}.${ext}`;
}

async function fetchBuffer(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "User-Agent": UA,
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        Referer: /tmdb\.org|themoviedb/.test(url)
          ? "https://www.themoviedb.org/"
          : "https://www.tvmaze.com/",
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  } finally {
    clearTimeout(t);
  }
}

/** Save remote posters next to the JSON so GitHub Pages / Brave Shields can load them. */
async function cacheNetflixPosters(items) {
  await mkdir(POSTER_DIR, { recursive: true });
  let saved = 0;
  for (const item of items) {
    if (!item.image || isLocalPoster(item.image)) continue;
    const name = posterFileName(item.title, item.image);
    const dest = path.join(POSTER_DIR, name);
    const localUrl = `${POSTER_URL_PREFIX}/${name}`;
    try {
      const buf = await fetchBuffer(item.image);
      if (buf.length < 800) throw new Error("image too small");
      await writeFile(dest, buf);
      item.image = localUrl;
      saved += 1;
    } catch (err) {
      console.warn(`  [netflix] cache poster "${item.title}": ${err.message}`);
    }
    await sleep(200);
  }
  console.log(`  [netflix] cached ${saved} posters locally`);
  return items;
}

async function backfillNetflixImages() {
  const file = path.join(OUT_DIR, "netflix.json");
  const raw = JSON.parse(await readFile(file, "utf8"));
  const items = await fillMissingNetflixImages(raw.items || []);
  const cached = await cacheNetflixPosters(items);
  raw.items = cached.map((item) =>
    publicNetflixItem({
      ...item,
      synopsis: item.synopsis,
      starring: item.starring || [],
    })
  );
  raw.generatedAt = now.toISOString();
  await writeFile(file, `${JSON.stringify(raw, null, 2)}\n`);
  await writeNetflixStamp(raw.generatedAt);
  console.log(`  [netflix] wrote ${raw.items.length} items with posters`);
  return true;
}

/* ---------------- write ---------------- */

async function writeSection(section, items, minItems, win = null) {
  const file = path.join(OUT_DIR, `${section}.json`);
  if (items.length < minItems) {
    console.warn(
      `  [${section}] only ${items.length} items found — keeping existing file.`
    );
    return false;
  }
  let outItems = items;
  if (section === "netflix") {
    outItems = await withPreservedNetflixBriefs(items);
  }
  const payload = {
    section,
    generatedAt: now.toISOString(),
    windowStart: win?.start || windowStart,
    windowEnd: win?.end || windowEnd,
    items: outItems,
  };
  await writeFile(file, `${JSON.stringify(payload, null, 2)}\n`);
  if (section === "netflix") await writeNetflixStamp(payload.generatedAt);
  console.log(`  [${section}] wrote ${items.length} items`);
  return true;
}

/** Keep the home-card stamp aligned with netflix.json (even when the list is kept). */
async function syncNetflixStamp() {
  try {
    const raw = JSON.parse(
      await readFile(path.join(OUT_DIR, "netflix.json"), "utf8")
    );
    await writeNetflixStamp(raw.generatedAt);
  } catch {
    /* no netflix file yet */
  }
}

async function main() {
  const onlyNetflix = process.argv.includes("--netflix");
  const onlyImages = process.argv.includes("--netflix-images");
  const netflixWin = { start: netflixWindowStart, end: windowEnd };
  console.log(
    onlyNetflix || onlyImages
      ? `Refreshing Netflix (${netflixWindowStart} → ${windowEnd})…`
      : `Refreshing current events (${windowStart} → ${windowEnd}; Netflix ${netflixWindowStart})…`
  );
  if (onlyImages) {
    await backfillNetflixImages();
    await syncNetflixStamp();
    console.log("Done — netflix posters updated.");
    return;
  }
  if (onlyNetflix) {
    const netflix = await buildNetflix();
    const ok = await writeSection("netflix", netflix, 5, netflixWin);
    await syncNetflixStamp();
    console.log(`Done — netflix ${ok ? "updated" : "kept"}.`);
    if (!ok) process.exitCode = 1;
    return;
  }
  const [sports, entertainment, world, netflix] = await Promise.all([
    buildSports(),
    buildEntertainment(),
    buildWorld(),
    buildNetflix(),
  ]);
  const results = await Promise.all([
    writeSection("sports", sports, 5),
    // Entertainment is published by buildEntertainment() into the 21-day archive.
    Promise.resolve(entertainment.length >= 5),
    Promise.resolve(world.length >= 5),
    writeSection("netflix", netflix, 5, netflixWin),
  ]);
  await syncNetflixStamp();
  const ok = results.filter(Boolean).length;
  console.log(`Done — ${ok}/4 sections updated.`);
  if (ok === 0) process.exitCode = 1;
  else await writeBriefingFile();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
