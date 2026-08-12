#!/usr/bin/env node
/**
 * Refresh data/current-events/*.json with live data.
 *
 *   node scripts/refresh-current-events.mjs
 *
 * Sources (no API keys, no dependencies):
 *   Sports        — ESPN only (rolling 14-day archive, published every 3h)
 *   Entertainment — Google News + RSS (rolling 14-day archive, published every 3h)
 *   Netflix       — whats-on-netflix.com monthly "What's Coming" listings
 *
 * A section is only overwritten when its fetch produced enough items;
 * otherwise the existing file is kept.
 */

import { readFile, writeFile } from "node:fs/promises";
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
 * Window is 14 days to match the rolling cache.
 */
async function buildSports() {
  const sportsStart = new Date(now.getTime() - 14 * 86400000)
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
 * never wipes accumulated 14-day coverage.
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
      const cast = JSON.parse(
        await fetchText(
          `https://api.tvmaze.com/shows/${item.tvmazeId}/cast`,
          15000,
          "TriviaHelper/1.0 (https://github.com/DSdev901/trivia)"
        )
      );
      item.starring = (cast || [])
        .map((c) => c.person?.name)
        .filter(Boolean)
        .slice(0, 6);
    } catch (err) {
      console.warn(`  [netflix] tvmaze cast "${item.title}": ${err.message}`);
    }
    delete item.tvmazeId;
    delete item.season;
    await sleep(250);
  }
  return items;
}

async function enrichNetflix(items) {
  for (const item of items) {
    const hasBody =
      (item.starring || []).length >= 2 && (item.synopsis || "").length >= 80;
    if (hasBody) continue;
    try {
      const hit = await wikiIntroWithRetry(item.title, item.date);
      if (hit) {
        const { extract, exact } = hit;
        const stars = starringFromExtract(extract);
        const syn = synopsisFromExtract(extract);
        if (exact && stars.length && !(item.starring || []).length)
          item.starring = stars;
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
  // Same title can appear in multiple sources with different dates — keep
  // the richer card. Titles also vary in length across sources ("Operation
  // Safed Sagar: The Untold Story…" vs "Operation Safed Sagar: The Highest
  // Air Force Mission…"), so collapse keys that contain one another.
  // Dedupe before enrichment so we don't look a title up twice.
  const score = (x) =>
    (x.synopsis || "").length + (x.starring || []).length * 50;
  const titleCore = (s) =>
    normTitle(s)
      .replace(/\bseason \d+\b/g, " ")
      .replace(/\bpart \d+\b/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  const sameTitle = (a, b) => {
    const ca = titleCore(a);
    const cb = titleCore(b);
    if (!ca || !cb) return false;
    if (ca === cb) return true;
    if (ca.includes(cb) || cb.includes(ca)) return true;
    const ta = ca.split(" ");
    const tb = cb.split(" ");
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
  return items;
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
    // Entertainment is published by buildEntertainment() into the 14-day archive.
    Promise.resolve(entertainment.length >= 5),
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
