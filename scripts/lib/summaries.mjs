/**
 * Shared summary enrichment for Current Events sports / entertainment cards.
 * Prefer publisher meta descriptions; fall back to Wikipedia intros.
 */

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
  const brief =
    briefMeta.length >= briefOg.length ? briefMeta : briefOg;
  // Google News / site-wide boilerplate
  if (/up-to-date news coverage|aggregated from sources/i.test(brief))
    return "";
  if (brief.length < 40) return "";
  return clipBrief(brief);
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
  if (h.description && h.description.length >= 80 && h.description !== h.title)
    return clipBrief(h.description);
  const story = stripTags(h.story || "");
  if (story.length < 60) return "";
  // First 1–2 sentences.
  const sentences = story.match(/[^.!?]+[.!?]+/g) || [story];
  return clipBrief(sentences.slice(0, 2).join(" ").trim());
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
 * Enrich items whose summary is thin. Mutates in place.
 * @param {Array} items
 * @param {{ minLen?: number, espn?: boolean, wiki?: boolean, page?: boolean }} opts
 */
export async function enrichThinSummaries(items, opts = {}) {
  const minLen = opts.minLen ?? 80;
  const useEspn = opts.espn !== false;
  const usePage = opts.page !== false;
  const useWiki = opts.wiki !== false;
  let enriched = 0;

  for (const item of items) {
    if (!isThinSummary(item.summary, item.headline, minLen)) continue;
    let brief = "";
    try {
      if (useEspn && /espn\.com/i.test(item.url || "")) {
        brief = await fetchEspnStoryBrief(item.url);
      }
      if (!brief && usePage && item.url) {
        brief = await fetchPageBrief(item.url);
      }
      if (!brief && useWiki && item.headline) {
        brief = await fetchWikiBrief(item.headline);
      }
      if (!brief) {
        const source = /^Reported by\s+(.+)\.?$/i.exec(
          String(item.summary || "").trim()
        )?.[1];
        brief = briefFromHeadline(item.headline, source);
      }
    } catch {
      // keep existing thin summary
    }
    if (brief && brief.length > String(item.summary || "").trim().length) {
      item.summary = brief;
      enriched += 1;
    }
    await sleep(350);
  }
  return enriched;
}
