#!/usr/bin/env node
/**
 * Refresh House of the Dragon weekly cliff-note recaps (and cast portraits)
 * while a season is still airing. Safe no-op once the season ends.
 *
 * Cast portraits populate on first run (and any later run with missing images)
 * via the public TMDB cast page — no API key required for that path.
 *
 *   TMDB_API_KEY=… node scripts/refresh-trending-hotd.mjs
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHOW_FILE = path.join(ROOT, "data", "trending", "house-of-the-dragon.json");
const POSTER_DIR = path.join(ROOT, "data", "trending", "posters");
const POSTER_URL_PREFIX = "data/trending/posters";
const TMDB_ID = 94997;
const TMDB_KEY = process.env.TMDB_API_KEY || "";
const UA = "GeneralTriviaHotD/1.0 (+https://github.com/DSdev901/trivia)";
const ACTIVE_DAYS = 21;

/** Map our character ids → cast-page matchers (adult cast preferred). */
const CAST_RULES = [
  { id: "rhaenyra", match: /Queen Rhaenyra|Princess Rhaenyra Targaryen/i, prefer: /Emma/i },
  { id: "daemon", match: /Prince Daemon Targaryen/i, prefer: /Matt Smith/i },
  { id: "jacaerys", match: /Jacaerys|Jace/i, prefer: /Harry Collett/i },
  { id: "baela", match: /Lady Baela|Baela Targaryen/i, prefer: /Bethany/i },
  { id: "addam", match: /Addam of Hull/i, prefer: /Clinton/i },
  { id: "corlys", match: /Corlys|Sea Snake/i, prefer: /Steve Toussaint/i },
  { id: "alicent", match: /Queen Alicent/i, prefer: /Olivia Cooke/i },
  { id: "aegon-ii", match: /King Aegon II|Prince Aegon Targaryen/i, prefer: /Tom Glynn/i },
  { id: "aemond", match: /Prince Aemond/i, prefer: /Ewan Mitchell/i },
  { id: "helaena", match: /Queen Helaena|Princess Helaena Targaryen/i, prefer: /Phia Saban/i },
  { id: "otto", match: /Otto Hightower/i, prefer: /Rhys Ifans/i },
  { id: "criston", match: /Criston Cole/i, prefer: /Fabien Frankel/i },
];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function daysBetween(a, b) {
  const ms = Date.parse(b) - Date.parse(a);
  if (!Number.isFinite(ms)) return Infinity;
  return Math.round(ms / 86400000);
}

async function tmdb(pathname, params = {}) {
  if (!TMDB_KEY) return null;
  const url = new URL(`https://api.themoviedb.org/3${pathname}`);
  const headers = { Accept: "application/json", "User-Agent": UA };
  if (TMDB_KEY.startsWith("eyJ") || TMDB_KEY.length > 48) {
    headers.Authorization = `Bearer ${TMDB_KEY}`;
  } else {
    url.searchParams.set("api_key", TMDB_KEY);
  }
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== "") url.searchParams.set(k, String(v));
  }
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`TMDB ${pathname} → HTTP ${res.status}`);
  return res.json();
}

function tmdbImageUrl(filePath, size = "w185") {
  if (!filePath) return "";
  const file = String(filePath).startsWith("/")
    ? String(filePath)
    : `/${filePath}`;
  return `https://image.tmdb.org/t/p/${size}${file}`;
}

function trimRecap(text, max = 220) {
  const clean = String(text || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) return "";
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const at = cut.lastIndexOf(" ");
  return `${(at > 80 ? cut.slice(0, at) : cut).trim()}…`;
}

function slugify(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

async function cacheImage(url, hint) {
  if (!url || String(url).startsWith(POSTER_URL_PREFIX)) return url || "";
  await mkdir(POSTER_DIR, { recursive: true });
  const hash = createHash("sha1").update(url).digest("hex").slice(0, 10);
  const name = `${slugify(hint) || "img"}-${hash}.jpg`;
  const dest = path.join(POSTER_DIR, name);
  const local = `${POSTER_URL_PREFIX}/${name}`;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "image/*",
        Referer: "https://www.themoviedb.org/",
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 800) throw new Error("image too small");
    await writeFile(dest, buf);
    return local;
  } catch (err) {
    console.warn(`  [hotd] image "${hint}": ${err.message}`);
    return "";
  }
}

function mergeEpisodes(existing, incoming) {
  const byN = new Map();
  for (const ep of existing || []) byN.set(Number(ep.n), { ...ep });
  for (const ep of incoming) {
    const n = Number(ep.n);
    const prev = byN.get(n) || {};
    const recap =
      (prev.recap && prev.recap.length > 40 && !/Season Finale/i.test(prev.title || "")
        ? prev.recap
        : "") ||
      ep.recap ||
      prev.recap ||
      "";
    byN.set(n, {
      n,
      title: ep.title || prev.title || `Episode ${n}`,
      aired: ep.aired || prev.aired || "",
      recap: trimRecap(recap),
    });
  }
  return [...byN.values()].sort((a, b) => a.n - b.n);
}

async function scrapeCastPage() {
  const res = await fetch(
    `https://www.themoviedb.org/tv/${TMDB_ID}-house-of-the-dragon/cast`,
    { headers: { "User-Agent": UA, Accept: "text/html" } }
  );
  if (!res.ok) throw new Error(`cast page HTTP ${res.status}`);
  const html = await res.text();
  const cast = [];
  const liRe = /<li data-order="\d+">([\s\S]*?)<\/li>/gi;
  let m;
  while ((m = liRe.exec(html))) {
    const block = m[1];
    const person = block.match(/href="\/person\/(\d+)(?:-[^"]*)?"/);
    const img = block.match(/src="(https:\/\/media\.themoviedb\.org\/t\/p\/[^"]+)"/);
    const name =
      block.match(/alt="([^"]+)"/) ||
      block.match(/<p><a[^>]*>([^<]+)<\/a><\/p>/);
    const character = block.match(/<p class="character">([\s\S]*?)<\/p>/);
    if (!person) continue;
    cast.push({
      id: Number(person[1]),
      name: String(name?.[1] || "")
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, "&")
        .trim(),
      character: String(character?.[1] || "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim(),
      image: String(img?.[1] || "").replace(/w\d+_and_h\d+_face/, "w185"),
    });
  }
  return cast;
}

function pickCastHit(cast, rule) {
  const hits = cast.filter((c) => rule.match.test(c.character));
  return hits.find((c) => rule.prefer.test(c.name)) || hits[0] || null;
}

async function refreshWeekly(payload) {
  const show = await tmdb(`/tv/${TMDB_ID}`);
  if (!show) {
    console.log("  [hotd] no TMDB key — skipping weekly refresh");
    return payload;
  }
  const seasonNum = Number(show.number_of_seasons) || Number(payload.weekly?.season) || 3;
  const season = await tmdb(`/tv/${TMDB_ID}/season/${seasonNum}`);
  const today = todayIsoDate();
  const aired = (season?.episodes || [])
    .filter((ep) => ep.air_date && ep.air_date <= today)
    .map((ep) => ({
      n: ep.episode_number,
      title: ep.name || `Episode ${ep.episode_number}`,
      aired: ep.air_date,
      recap: trimRecap(ep.overview),
    }));
  const lastAir = aired.length ? aired[aired.length - 1].aired : "";
  const upcoming = (season?.episodes || []).find(
    (ep) => ep.air_date && ep.air_date > today
  );
  const active =
    Boolean(upcoming) ||
    (lastAir && Math.abs(daysBetween(lastAir, today)) <= ACTIVE_DAYS);

  const weekly = {
    active,
    season: seasonNum,
    status: active
      ? `Season ${seasonNum} is airing — recaps refresh on Tuesdays.`
      : `Season ${seasonNum} is no longer airing weekly. Recaps stay until Season ${
          seasonNum + 1
        }.`,
    updatedAt: new Date().toISOString(),
    episodes: mergeEpisodes(payload.weekly?.episodes, aired),
  };

  console.log(
    `  [hotd] season ${seasonNum}: ${aired.length} aired, active=${active}`
  );
  return { ...payload, weekly, updatedAt: weekly.updatedAt };
}

/**
 * Fill missing cast portraits on first deploy / any later gap.
 * Prefers the public cast HTML page (no key); falls back to TMDB API when set.
 */
async function refreshPortraits(payload) {
  const next = { ...payload, characters: [...(payload.characters || [])] };
  const needsFill = next.characters.some(
    (c) => !c.image || !String(c.image).startsWith(POSTER_URL_PREFIX)
  );
  if (!needsFill) {
    console.log("  [hotd] cast portraits already cached");
    return next;
  }

  let cast = [];
  try {
    cast = await scrapeCastPage();
    console.log(`  [hotd] scraped ${cast.length} cast entries from TMDB HTML`);
  } catch (err) {
    console.warn(`  [hotd] cast scrape failed: ${err.message}`);
  }

  const byId = new Map(CAST_RULES.map((r) => [r.id, r]));
  let filled = 0;

  for (let i = 0; i < next.characters.length; i += 1) {
    const c = { ...next.characters[i] };
    if (c.image && String(c.image).startsWith(POSTER_URL_PREFIX)) {
      next.characters[i] = c;
      continue;
    }

    const rule = byId.get(c.id);
    let remote = "";
    let personId = c.tmdbPersonId || null;

    if (rule && cast.length) {
      const hit = pickCastHit(cast, rule);
      if (hit?.image) {
        remote = hit.image;
        personId = hit.id;
      }
    }

    if (!remote && TMDB_KEY && personId) {
      try {
        const person = await tmdb(`/person/${personId}`);
        remote = tmdbImageUrl(person?.profile_path, "w185");
      } catch (err) {
        console.warn(`  [hotd] portrait API ${c.name}: ${err.message}`);
      }
    }

    if (remote) {
      const local = await cacheImage(remote, c.id || c.name);
      if (local) {
        c.image = local;
        if (personId) c.tmdbPersonId = personId;
        filled += 1;
      }
      await sleep(150);
    }

    next.characters[i] = c;
  }

  console.log(`  [hotd] cast portraits filled: ${filled}`);
  return next;
}

async function main() {
  const raw = JSON.parse(await readFile(SHOW_FILE, "utf8"));
  let next = await refreshWeekly(raw);
  next = await refreshPortraits(next);
  next = { ...next, updatedAt: new Date().toISOString() };
  await writeFile(SHOW_FILE, `${JSON.stringify(next, null, 2)}\n`);
  console.log("  [hotd] wrote house-of-the-dragon.json");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
