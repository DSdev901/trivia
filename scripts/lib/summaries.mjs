/**
 * Shared summary enrichment for Current Events sports / entertainment cards.
 * Prefer publisher meta descriptions; fall back to Wikipedia intros.
 */

import { extractPeople } from "../../briefing.js";

const UA =
  "TriviaHelper/1.0 (https://github.com/DSdev901/trivia; trivia app data refresh)";

const WIKI_UA =
  "TriviaHelper/1.0 (https://github.com/DSdev901/trivia; trivia app data refresh)";

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
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
      },
      redirect: "follow",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

function clipBrief(text, max = 420) {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  if (!t) return "";
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const at = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("; "));
  return `${(at > 120 ? cut.slice(0, at + 1) : cut).trim()}…`;
}

function isThinSummary(summary, headline, minLen = 80) {
  const s = String(summary || "").trim();
  const h = String(headline || "").trim();
  if (!s) return true;
  if (/^Reported by\b/i.test(s)) return true;
  if (s.length < minLen) return true;
  if (s === h) return true;
  // Description is just the headline repeated (common for ESPN video clips).
  if (s.length <= h.length + 5 && (h.includes(s) || s.includes(h.slice(0, 40))))
    return true;
  return false;
}

function splitSentences(text) {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  if (!t) return [];
  return t
    .split(/(?<=[.!?])\s+(?=[A-Z("“])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 28);
}

function isBoilerplate(s) {
  return /subscribe|newsletter|cookie policy|sign in|log in|advertisement|your inbox|click here|read more/i.test(
    s
  );
}

function hasMoney(text) {
  return /\$[\d.,]+|\b\d[\d.]*\s*(?:million|billion|thousand)\b/i.test(text);
}

function hasAge(text) {
  return /\b(?:at|age[d]?)\s+\d{1,3}\b|\b\d{1,3}\s+years old\b/i.test(text);
}

function hasTerm(text) {
  return /\b\d+\s*(?:years?|months?|games?)\b/i.test(text);
}

function moneyBits(text) {
  return [
    ...String(text || "").matchAll(
      /\$[\d,.]+(?:\s*(?:million|billion|thousand))?|\b[\d.]+\s*(?:million|billion|thousand)\b/gi
    ),
  ].map((m) => m[0].toLowerCase().replace(/,/g, "").replace(/\s+/g, ""));
}

const MONEY_PROMISE =
  /\b(record price|most expensive|highest price|fetches?|fetching|sold for|sells for|selling for|auctioned|at auction|box office|grossed|raked in|payout|settlement|fined|fine of|valued at|sale price|hammer price)\b/i;
const AGE_PROMISE = /\b(dies at|died at|dead at|passes away at)\b/i;
const TERM_PROMISE = /\b(sentenced|banned for)\b/i;

/** Headline promises a price/age/term that the summary never states. */
export function missingPromisedFacts(headline, summary) {
  const h = String(headline || "");
  const s = String(summary || "");
  if (MONEY_PROMISE.test(`${h} ${s}`) && !hasMoney(h) && !hasMoney(s)) return true;
  if (AGE_PROMISE.test(h) && !hasAge(h) && !hasAge(s)) return true;
  if (TERM_PROMISE.test(h) && !hasTerm(h) && !hasTerm(s)) return true;
  return false;
}

const ROLE_TEASER =
  /\b(?:a |an |the )?(?:rock|pop|rap|movie|film|tv|reality(?:\s+tv)?)\s+stars?\b|\b(?:oscar|emmy|grammy) winners?\b|\b(?:nfl|nba|mlb) stars?\b|\b(?:famous )?(?:actress|actor|singer|rapper|drummer|guitarist|quarterback|billionaire)\b/i;

const QUERY_STOP = new Set([
  "the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "with",
  "over", "after", "as", "at", "by", "from", "is", "are", "was", "were",
  "his", "her", "him", "their", "its", "not", "go", "says", "said",
]);

const GN_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

function peopleIn(headline, summary = "") {
  return extractPeople({ headline: headline || "", summary: summary || "" });
}

/** Teaser uses "rock star" / "actress" and never names the person. */
export function missingPromisedWho(headline, summary) {
  const h = String(headline || "");
  const s = String(summary || "");
  if (!ROLE_TEASER.test(`${h} ${s}`)) return false;
  return peopleIn(h, s).length === 0;
}

export function clusterHeadlinesFromRss(description) {
  const html = String(description || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'");
  return [...html.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)]
    .map((m) => stripTags(m[1]))
    .filter((t) => t.length > 20);
}

function stripOutletSuffix(title) {
  return String(title || "")
    .replace(/\s+[-–—]\s+[^-–—]{2,40}$/, "")
    .trim();
}

/** Prefer a cluster/search headline that actually names the person. */
export function pickNamedHeadline(primary, cluster = []) {
  const seen = new Set();
  const candidates = [];
  for (const raw of [primary, ...cluster]) {
    const h = stripOutletSuffix(raw);
    const key = h.toLowerCase();
    if (!h || seen.has(key)) continue;
    seen.add(key);
    candidates.push(h);
  }
  const named = candidates.find(
    (h) => peopleIn(h).length > 0 && !missingPromisedWho(h, "")
  );
  return named || stripOutletSuffix(primary) || primary;
}

function teaserQuery(headline) {
  return stripOutletSuffix(headline)
    .replace(ROLE_TEASER, " ")
    .replace(/\b(says|said|reveals?|revealed|tells?|told)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenOverlap(a, b) {
  const ta = new Set(
    String(a)
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !QUERY_STOP.has(w))
  );
  const tb = String(b)
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !QUERY_STOP.has(w));
  return tb.filter((w) => ta.has(w)).length;
}

function shiftDate(iso, days) {
  const d = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return "";
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Google News search for a named headline of the same teaser story. */
export async function searchNamedHeadline(headline, date) {
  const q = teaserQuery(headline);
  if (q.split(/\s+/).filter((w) => w.length > 2).length < 4) return "";
  const after = date ? shiftDate(date, -5) : "";
  const url =
    "https://news.google.com/rss/search?q=" +
    encodeURIComponent(`${q}${after ? ` after:${after}` : ""}`) +
    "&hl=en-US&gl=US&ceid=US:en";
  const xml = await fetchText(url, 15000, GN_UA);
  const titles = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const block = m[1];
    const title = stripTags((block.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || "");
    const desc = (block.match(/<description>([\s\S]*?)<\/description>/) || [])[1] || "";
    titles.push(title, ...clusterHeadlinesFromRss(desc));
  }
  let best = { score: 0, title: "" };
  for (const raw of titles) {
    const title = stripOutletSuffix(raw);
    if (!title || peopleIn(title).length === 0 || missingPromisedWho(title, "")) {
      continue;
    }
    const score = tokenOverlap(q, title);
    if (score > best.score) best = { score, title };
  }
  return best.score >= 3 ? best.title : "";
}

/** Pull numbered facts from incoming copy that the current summary lacks. */
export function mergeFactSentences(existing, incoming) {
  const have = String(existing || "").replace(/\s+/g, " ").trim();
  const incomingText = String(incoming || "").replace(/\s+/g, " ").trim();
  if (!incomingText) return have;
  const extra = [];
  const seenMoney = new Set(moneyBits(have));
  const haveAge = hasAge(have);
  const haveTerm = hasTerm(have);
  for (const s of splitSentences(incomingText)) {
    if (isBoilerplate(s)) continue;
    const bits = moneyBits(s);
    const addsMoney = bits.some((b) => !seenMoney.has(b));
    const addsAge = !haveAge && hasAge(s);
    const addsTerm = !haveTerm && hasTerm(s);
    if (!addsMoney && !addsAge && !addsTerm) continue;
    extra.push(s);
    bits.forEach((b) => seenMoney.add(b));
  }
  if (!extra.length) return have || incomingText;
  const prefix = extra.join(" ");
  if (!have) return clipBrief(prefix, 520);
  const haveNorm = have.toLowerCase().replace(/[^a-z0-9$]+/g, " ");
  const prefixNorm = prefix.toLowerCase().replace(/[^a-z0-9$]+/g, " ");
  if (
    prefixNorm.includes(haveNorm.slice(0, 70)) ||
    haveNorm.includes(prefixNorm.slice(0, 70))
  ) {
    return clipBrief(prefix, 520);
  }
  return clipBrief(`${prefix} ${have}`, 520);
}

function firstHtmlParagraphs(html) {
  return [...String(html || "").matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((m) => stripTags(m[1]))
    .filter((t) => t.length >= 50 && !isBoilerplate(t))
    .slice(0, 4);
}

/** ESPN video / highlight stubs aren't articles — skip them in the feed. */
export function isEspnVideoStub(item) {
  const url = item.url || "";
  const head = item.headline || "";
  const sum = (item.summary || "").trim();
  if (/\/video\//i.test(url)) return true;
  if (/\bgame highlights?\b/i.test(head)) return true;
  if (/\bNBA Today\b/i.test(head) && sum.length < 80) return true;
  if (sum && sum === head.trim()) return true;
  return false;
}

/** Pull og:/meta description from a publisher page (skips Google News shells). */
export async function fetchPageBrief(url) {
  if (!url || /news\.google\.com/i.test(url)) return "";
  const html = await fetchText(url);
  if (/just a moment|cf-browser-verification/i.test(html)) return "";
  const og =
    (
      html.match(
        /property=["']og:description["'][^>]*content=["']([^"']+)/i
      ) ||
      html.match(
        /content=["']([^"']+)["'][^>]*property=["']og:description["']/i
      ) ||
      []
    )[1] || "";
  const meta =
    (
      html.match(/name=["']description["'][^>]*content=["']([^"']+)/i) ||
      html.match(/content=["']([^"']+)["'][^>]*name=["']description["']/i) ||
      []
    )[1] || "";
  const briefOg = stripTags(og);
  const briefMeta = stripTags(meta);
  let brief = briefMeta.length >= briefOg.length ? briefMeta : briefOg;
  // Google News / site-wide boilerplate
  if (/up-to-date news coverage|aggregated from sources/i.test(brief)) brief = "";
  const paras = firstHtmlParagraphs(html).join(" ");
  if (brief && paras) return clipBrief(mergeFactSentences(brief, paras), 520);
  if (paras.length >= 40) return clipBrief(paras, 520);
  if (brief.length >= 40) return clipBrief(brief);
  return "";
}

/** First usable paragraphs from ESPN's content API story body. */
export async function fetchEspnStoryBrief(url) {
  const id = (String(url).match(/\/id\/(\d+)/) || [])[1];
  if (!id) return "";
  const data = JSON.parse(
    await fetchText(
      `https://content.core.api.espn.com/v1/sports/news/${id}`,
      12000
    )
  );
  const h = data.headlines?.[0] || data;
  const desc = stripTags(h.description || "");
  const story = stripTags(h.story || "");
  const fromStory = splitSentences(story)
    .filter((s) => !isBoilerplate(s))
    .slice(0, 6)
    .join(" ");
  const merged = mergeFactSentences(desc, fromStory);
  if (merged.length >= 40) return clipBrief(merged, 520);
  if (fromStory.length >= 60) return clipBrief(fromStory, 520);
  if (desc.length >= 40 && desc !== stripTags(h.title || h.headline || "")) {
    return clipBrief(desc);
  }
  return "";
}

function headlineTokens(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

/** Wikipedia intro when the page title overlaps the headline. */
export async function fetchWikiBrief(headline) {
  const want = headlineTokens(headline).slice(0, 8);
  if (want.length < 2) return "";
  const q = want.slice(0, 6).join(" ");
  const data = JSON.parse(
    await fetchText(
      "https://en.wikipedia.org/w/api.php?" +
        new URLSearchParams({
          action: "query",
          generator: "search",
          gsrsearch: q,
          gsrlimit: "4",
          prop: "extracts",
          exintro: "1",
          explaintext: "1",
          redirects: "1",
          format: "json",
        }),
      15000,
      WIKI_UA
    )
  );
  const pages = Object.values(data?.query?.pages || {});
  const hit = pages.find((p) => {
    const titleToks = headlineTokens(p.title);
    const extractToks = headlineTokens((p.extract || "").slice(0, 200));
    const sharedTitle = titleToks.filter((t) => want.includes(t)).length;
    const sharedExtract = extractToks.filter((t) => want.includes(t)).length;
    return (
      (sharedTitle >= 2 || sharedExtract >= 3) &&
      (p.extract || "").length > 80
    );
  });
  if (!hit) return "";
  const sentences = (hit.extract.match(/[^.!?]+[.!?]+/g) || [hit.extract]).slice(
    0,
    2
  );
  return clipBrief(sentences.join(" ").trim());
}

/**
 * Last-resort brief from a headline when no publisher/wiki text is available.
 * Turns a headline into a one-sentence news blurb without inventing facts.
 */
export function briefFromHeadline(headline, source) {
  let h = String(headline || "").trim();
  if (!h) return "";
  // Drop trailing outlet names that sometimes leak into GN titles.
  h = h.replace(/\s+[-–—]\s+[^-–—]{2,40}$/, "").trim();
  if (!/[.!?]$/.test(h)) h = `${h}.`;
  if (source) return clipBrief(`${h} Reported by ${source}.`);
  return clipBrief(h);
}

/**
 * Enrich items whose summary is thin, whose headline promises a number
 * the blurb never states, or whose teaser never names the person.
 * Mutates in place.
 * @param {Array} items
 * @param {{ minLen?: number, espn?: boolean, wiki?: boolean, page?: boolean, missingOnly?: boolean }} opts
 */
export async function enrichThinSummaries(items, opts = {}) {
  const minLen = opts.minLen ?? 80;
  const useEspn = opts.espn !== false;
  const usePage = opts.page !== false;
  const useWiki = opts.wiki !== false;
  const missingOnly = opts.missingOnly === true;
  let enriched = 0;

  for (const item of items) {
    const thin = missingOnly
      ? false
      : isThinSummary(item.summary, item.headline, minLen);
    const missingFacts = missingPromisedFacts(item.headline, item.summary);
    const missingWho = missingPromisedWho(item.headline, item.summary);
    if (!thin && !missingFacts && !missingWho) continue;
    let brief = "";
    let fetched = false;
    try {
      if (missingWho) {
        const named = await searchNamedHeadline(item.headline, item.date);
        fetched = true;
        if (named && named !== item.headline) {
          const who = peopleIn(named)[0] || "";
          const last = who.split(/\s+/).pop();
          item.headline = named;
          const sum = String(item.summary || "");
          const lastRe = last
            ? new RegExp(
                `\\b${last.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
                "i"
              )
            : null;
          if (!lastRe || !lastRe.test(sum)) {
            const source = /^Reported by\s+(.+)\.?$/i.exec(sum.trim())?.[1];
            item.summary = briefFromHeadline(named, source);
          }
          enriched += 1;
        }
        if (!missingFacts && !thin) {
          if (fetched) await sleep(350);
          continue;
        }
      }
      if (useEspn && /espn\.com/i.test(item.url || "")) {
        brief = await fetchEspnStoryBrief(item.url);
        fetched = true;
      }
      if (!brief && usePage && item.url && !/news\.google\.com/i.test(item.url)) {
        brief = await fetchPageBrief(item.url);
        fetched = true;
      }
      if (!brief && useWiki && thin && !missingFacts && !missingWho && item.headline) {
        brief = await fetchWikiBrief(item.headline);
        fetched = true;
      }
      if (thin && !brief) {
        const source = /^Reported by\s+(.+)\.?$/i.exec(
          String(item.summary || "").trim()
        )?.[1];
        brief = briefFromHeadline(item.headline, source);
      }
    } catch {
      // keep existing summary
    }
    const current = String(item.summary || "").trim();
    const next = missingFacts ? mergeFactSentences(current, brief) : brief;
    if (next && next !== current && (missingFacts || next.length > current.length)) {
      item.summary = next;
      enriched += 1;
    }
    if (fetched) await sleep(350);
  }
  return enriched;
}
