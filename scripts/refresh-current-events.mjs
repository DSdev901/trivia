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

async function buildSports() {
  const seen = new Set();
  const items = [];
  await Promise.all(
    ESPN_LEAGUES.map(async ([league, label, limit]) => {
      try {
        const url = `https://site.api.espn.com/apis/site/v2/sports/${league}/news?limit=${limit}`;
        const data = JSON.parse(await fetchText(url));
        for (const a of data.articles || []) {
          const date = isoFrom(a.published);
          const headline = (a.headline || "").trim();
          if (!date || !inWindow(date) || !headline || seen.has(headline)) continue;
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
  items.sort((a, b) => b.date.localeCompare(a.date));
  return items.slice(0, 16);
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
  /\b(loafers|sneakers|sandals|leggings|lipstick|mascara|faves|gift guide|deals|under \$\d+|where to buy|shop now|amazon arrivals)\b|\bon sale\b|\bsale (is|alert)\b|^\d+\s+(best|top)\b/i;

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
      tag,
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
  items.sort((a, b) => b.date.localeCompare(a.date));
  // Variety/Deadline publish far more per day than the celebrity feeds —
  // without a per-tag cap they push every celebrity item past the cutoff.
  const movies = items.filter((i) => i.tag === "Movies/TV").slice(0, 9);
  const celeb = items.filter((i) => i.tag === "Celebrity").slice(0, 9);
  return [...movies, ...celeb]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 18);
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
  if (t.includes("live event")) return "Live event";
  if (t.includes("special")) return "Special";
  return "Film";
}

function parseNetflixMonthly(html, year) {
  const items = [];
  // Date headers look like: "What's Coming to Netflix on August 7th"
  const headerRe =
    /<h[2-4][^>]*>([\s\S]*?on ([A-Z][a-z]+) (\d{1,2})(?:st|nd|rd|th)[\s\S]*?)<\/h[2-4]>/gi;
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
        .replace(/\(Season[^)]*\)/i, "")
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
      items.push(...parseNetflixMonthly(await fetchText(url), year));
    } catch (err) {
      console.warn(`  [netflix] ${url}: ${err.message}`);
    }
  }
  // Fallback / supplement: Wikipedia film list (whats-on-netflix sometimes 403s).
  // That list is originals-only by definition.
  try {
    items.push(...(await fetchWikipediaFilms()));
  } catch (err) {
    console.warn(`  [netflix] wikipedia: ${err.message}`);
  }
  // Same title can appear in both sources with different dates — keep the
  // richer card. Dedupe before enrichment so we don't look a title up twice.
  const byTitle = new Map();
  for (const i of items) {
    const key = normTitle(i.title);
    const score = (x) =>
      (x.synopsis || "").length + (x.starring || []).length * 50;
    if (!byTitle.has(key) || score(i) > score(byTitle.get(key)))
      byTitle.set(key, i);
  }
  items = await enrichNetflix([...byTitle.values()]);
  items.sort((a, b) => b.date.localeCompare(a.date));
  // Drop stub cards whose "synopsis" is just a genre/runtime descriptor
  // ("36 min film.", "Stand-up special.") — only if enough real ones remain.
  const STUB_RE =
    /(film|series|special|documentary|release|drama|comedy|thriller|reality|mystery|romance)\.?$/i;
  const isStub = (i) =>
    (i.synopsis || "").trim().length < 60 && STUB_RE.test((i.synopsis || "").trim());
  const detailed = items.filter((i) => !isStub(i));
  return (detailed.length >= 5 ? detailed : items).slice(0, 40);
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
