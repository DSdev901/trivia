#!/usr/bin/env node
/**
 * Refresh data/current-events/*.json with live data.
 *
 *   node scripts/refresh-current-events.mjs
 *
 * Sources (no API keys, no dependencies):
 *   Sports        — ESPN only (rolling 21-day archive, published every 3h)
 *   Entertainment — Google News + RSS (rolling 21-day archive, published every 3h)
 *   Netflix       — TVMaze web schedule first, then whats-on-netflix
 *                   listings, then Wikipedia originals lists. Cards are
 *                   merged field-wise (no duplicate titles); each keeps a
 *                   useful synopsis and main cast when sources provide them.
 *
 *   node scripts/refresh-current-events.mjs --netflix-images
 *     Backfill posters on the existing Netflix JSON without a full refresh.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { writeBriefingFile } from "./write-briefing.mjs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  enrichThinSummaries,
  isEspnVideoStub,
} from "./lib/summaries.mjs";
import {
  RETENTION_DAYS as ENT_DAYS,
  fetchLiveEntertainment,
  publishEntertainmentFeed,
  readArchive as readEntertainmentArchive,
  upsertStories,
} from "./lib/entertainment.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, "data", "current-events");
const POSTER_DIR = path.join(OUT_DIR, "posters");
const POSTER_URL_PREFIX = "data/current-events/posters";
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
  if (incoming.wikiTitle && !out.wikiTitle) out.wikiTitle = incoming.wikiTitle;
  if (incoming.image && !out.image) out.image = incoming.image;
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

function publicNetflixItem(item) {
  const out = {
    title: item.title,
    type: item.type,
    date: item.date,
    synopsis: String(item.synopsis || "").replace(/\s+/g, " ").trim(),
    starring: item.starring || [],
  };
  if (item.image) out.image = item.image;
  return out;
}

// Wikimedia asks API clients for a descriptive UA; browser UAs get throttled.
const WIKI_UA =
  "TriviaHelper/1.0 (https://github.com/DSdev901/trivia; trivia app data refresh)";
const TVMAZE_UA = "TriviaHelper/1.0 (https://github.com/DSdev901/trivia)";

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

async function wikiInfoboxStarring(pageTitle) {
  try {
    const data = await wikiJson({
      action: "parse",
      page: pageTitle,
      prop: "wikitext",
    });
    const wt = data?.parse?.wikitext?.["*"] || "";
    const m = wt.match(
      /\|\s*(?:starring|voices?|subject|narrator)\s*=\s*([\s\S]*?)(?=\n\s*\|\s*[a-zA-Z_]+\s*=)/
    );
    if (!m) return [];
    const block = m[1];
    const names = [];
    for (const w of block.matchAll(/\[\[([^|\]]+)(?:\|([^\]]+))?\]\]/g)) {
      names.push((w[2] || w[1]).replace(/\s*\([^)]*\)/g, "").trim());
    }
    for (const ill of block.matchAll(
      /\{\{[Ii]ll\|(?:lt=([^|}]+)\|)?([^|}]+)/g
    )) {
      names.push((ill[1] || ill[2]).replace(/\s*\([^)]*\)/g, "").trim());
    }
    if (names.length) return namesFromList(names.join(", "));
    const raw = block
      .replace(/\{\{[^}]*\}\}/g, " ")
      .replace(/\[\[([^|\]]*\|)?([^\]]+)\]\]/g, "$2")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/\*/g, "\n");
    return namesFromList(raw.replace(/\n/g, ", "));
  } catch {
    return [];
  }
}

function wikiPagePlausible(page, item) {
  const extract = page?.extract || "";
  if (!extract || /^List of /i.test(page.title || "")) return false;
  if (/netflix/i.test(extract)) return true;
  const year = (item.date || "").slice(0, 4);
  if (
    year &&
    extract.includes(year) &&
    /(film|television|series|special|documentary)/i.test(extract)
  )
    return true;
  return false;
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

async function wikiDetailsFor(item) {
  const year = (item.date || "").slice(0, 4);
  const bare = String(item.title || "")
    .replace(/\s*\((?:Season|Part)\s+\d+\)/i, "")
    .trim();
  const want = isStandup(item) ? comedianFromTitle(item.title) || bare : bare;
  const queries = isStandup(item)
    ? [want, `${item.title} Netflix`]
    : [
        want,
        `${bare} ${year} Netflix`,
        `${bare} (${year} film)`,
        `${bare} Netflix`,
      ];

  let hit = await wikiExactPage(want);
  if (hit && !wikiPagePlausible(hit, item)) hit = null;

  for (const q of queries.filter(Boolean)) {
    if (hit) break;
    const pages = await wikiSearchPages(q);
    hit =
      pages.find(
        (p) => namesSimilar(p.title, want) && /netflix/i.test(p.extract || "")
      ) ||
      pages.find(
        (p) =>
          namesSimilar(p.title, want) && new RegExp(year).test(p.extract || "")
      ) ||
      pages.find(
        (p) => titleCore(p.title) === titleCore(want) && wikiPagePlausible(p, item)
      ) ||
      (isStandup(item) && pages.find((p) => namesSimilar(p.title, want))) ||
      null;
    if (hit && !wikiPagePlausible(hit, item) && !isStandup(item)) hit = null;
    if (hit) break;
    await sleep(150);
  }
  if (!hit) return null;
  let starring = starringFromExtract(hit.extract || "");
  if (starring.length < 2) {
    starring = mergeStarring(starring, await wikiInfoboxStarring(hit.title));
  }
  return {
    pageTitle: hit.title,
    synopsis: synopsisFromExtract(hit.extract || ""),
    starring,
    exact: namesSimilar(hit.title, item.title) || namesSimilar(hit.title, want),
    image: hit.thumbnail?.source || "",
  };
}

async function wikiDetailsWithRetry(item) {
  try {
    return await wikiDetailsFor(item);
  } catch (err) {
    if (!/429/.test(err.message)) throw err;
    await sleep(4000);
    return wikiDetailsFor(item);
  }
}

/** Keep plot sentences; skip "directed by…" boilerplate and cast-list sentences. */
function synopsisFromExtract(extract) {
  const raw = extract.match(/[^.!?]+[.!?]+/g) || [];
  const sentences = [];
  let buf = "";
  for (const s of raw) {
    buf += s;
    if (buf.trim().length >= 40) {
      sentences.push(buf);
      buf = "";
    }
  }
  if (buf.trim()) sentences.push(buf);
  const isListLike = (s) => (s.match(/,/g) || []).length >= 3;
  const isCastOrCrew = (s) =>
    /directed by|created by|premiered|released on/i.test(s) ||
    /\bstarring\b|\bstars\b/i.test(s);
  const plot = sentences.filter((s) => !isCastOrCrew(s) && !isListLike(s));
  const fallback = sentences.filter((s) => !isListLike(s));
  let chosen = (plot.length ? plot : fallback).slice(0, 2).join(" ").trim();
  if (chosen.length < 80)
    chosen = sentences.slice(0, 2).join(" ").trim() || chosen;
  return chosen.length > 320 ? `${chosen.slice(0, 317).trim()}…` : chosen;
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
  const start = new Date(`${windowStart}T12:00:00Z`);
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
        if (!air || !inWindow(air)) continue;
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
    list.find((r) => namesSimilar(r.show.name, title) && r.score >= 1.2);
  if (named && isNetflixShow(named.show)) return tvmazeShowDetails(named.show);

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

    try {
      const hit = await wikiDetailsWithRetry(item);
      if (hit) {
        item.wikiTitle = hit.pageTitle;
        if (hit.image && !item.image) item.image = hit.image;
        if (hit.starring.length)
          item.starring = mergeStarring(item.starring, hit.starring);
        if (isStandup(item) && isThinSynopsis(item.synopsis) && hit.synopsis) {
          const name = comedianFromTitle(item.title);
          const extra = item.title.includes(":")
            ? item.title.split(":").slice(1).join(":").trim()
            : "";
          const lead = extra
            ? `${name}'s Netflix stand-up special, ${extra}.`
            : `${name}'s Netflix stand-up comedy special.`;
          item.synopsis = `${lead} ${hit.synopsis}`.trim();
          if (item.synopsis.length > 320)
            item.synopsis = `${item.synopsis.slice(0, 317).trim()}…`;
        } else {
          item.synopsis = pickSynopsis(item.synopsis, hit.synopsis);
          if (
            isThinSynopsis(item.synopsis) &&
            (hit.synopsis || "").length > (item.synopsis || "").length
          )
            item.synopsis = hit.synopsis;
        }
        if (hit.exact) item.confirmedOriginal = true;
      }
    } catch (err) {
      console.warn(`  [netflix] wiki "${item.title}": ${err.message}`);
    }
    applyFeaturedNames(item);
    await sleep(200);
  }
  return items;
}

async function buildNetflix() {
  let items = [];
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
  // Fallback / supplement: Wikipedia lists (whats-on-netflix sometimes 403s).
  // All three lists are originals-only by definition.
  try {
    items.push(...(await fetchWikipediaFilms()));
  } catch (err) {
    console.warn(`  [netflix] wikipedia films: ${err.message}`);
  }
  items.push(...(await fetchWikipediaProgramming()));
  // TVMaze first, then listings, then Wikipedia. Merge field-wise so a
  // later source fills synopsis/cast without replacing the TVMaze card.
  let merged = dedupeNetflix(items, false);
  merged = await enrichNetflix(merged);
  merged = dedupeNetflix(merged, true);
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
  if (page?.thumbnail?.source) return page.thumbnail.source;
  const pages = await wikiSearchPages(`${want} Netflix`);
  const hit =
    pages.find((p) => namesSimilar(p.title, want)) ||
    pages.find((p) => /netflix/i.test(p.extract || "")) ||
    pages[0];
  return hit?.thumbnail?.source || "";
}

async function fillMissingNetflixImages(items) {
  let filled = 0;
  for (const item of items) {
    if (item.image) continue;
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
        Referer: "https://www.tvmaze.com/",
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
  console.log(`  [netflix] wrote ${raw.items.length} items with posters`);
  return true;
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
  const onlyNetflix = process.argv.includes("--netflix");
  const onlyImages = process.argv.includes("--netflix-images");
  console.log(
    `Refreshing current events (${windowStart} → ${windowEnd})…`
  );
  if (onlyImages) {
    await backfillNetflixImages();
    console.log("Done — netflix posters updated.");
    return;
  }
  if (onlyNetflix) {
    const netflix = await buildNetflix();
    const ok = await writeSection("netflix", netflix, 5);
    console.log(`Done — netflix ${ok ? "updated" : "kept"}.`);
    if (!ok) process.exitCode = 1;
    else await writeBriefingFile();
    return;
  }
  const [sports, entertainment, netflix] = await Promise.all([
    buildSports(),
    buildEntertainment(),
    buildNetflix(),
  ]);
  const results = await Promise.all([
    writeSection("sports", sports, 5),
    // Entertainment is published by buildEntertainment() into the 21-day archive.
    Promise.resolve(entertainment.length >= 5),
    writeSection("netflix", netflix, 5),
  ]);
  const ok = results.filter(Boolean).length;
  console.log(`Done — ${ok}/3 sections updated.`);
  if (ok === 0) process.exitCode = 1;
  else await writeBriefingFile();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
