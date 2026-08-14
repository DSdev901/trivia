/** Current Events and Netflix category views. */

import {
  getDefaultBrowserVoiceUri,
  getSavedRate,
  getSavedVoiceUri,
  listEnglishVoices,
  prepareSpokenLine,
  saveRate,
  saveVoiceUri,
  speakLines,
  speechSupported,
  stopSpeech,
  unlockSpeech,
  voiceQualityTip,
} from "./speech.js";
import { isLocalHost } from "./env.js";
import { buildBriefing, highlightPeople, BRIEFING_FEATURED } from "./briefing.js";

const NEWS_SECTIONS = [
  { id: "sports", label: "Sports", path: "data/current-events/sports.json" },
  { id: "entertainment", label: "Entertainment", path: "data/current-events/entertainment.json" },
];
const NETFLIX_SECTION = {
  id: "netflix",
  label: "Netflix",
  path: "data/current-events/netflix.json",
};

function visibleTabs() {
  if (ce.mode === "netflix") return [];
  return [{ id: "briefing", label: "Briefing" }, ...NEWS_SECTIONS];
}
const BRIEFING_FILTERS = [
  { id: "all", label: "All" },
  { id: "sports", label: "Sports" },
  { id: "entertainment", label: "Entertainment" },
];

const ce = {
  data: {}, // sectionId -> payload
  briefing: null,
  mode: "news", // "news" | "netflix"
  tab: "briefing",
  briefingFilter: "all", // "all" | "sports" | "entertainment"
  briefingSportFilter: "all", // "all" | sport tag e.g. "NFL"
  briefingShowAll: false,
  netflixFilter: "all", // "all" | "shows" | "movies"
  sportFilter: "all", // "all" | sport label e.g. "NFL"
  refreshing: false,
  notice: "",
  root: null,
  voices: [],
  canSpeak: false,
  playing: false,
};

// Episodic types count as shows; one-off releases count as movies.
const SHOW_TYPES = new Set([
  "Series",
  "Docuseries",
  "Documentary",
  "Reality",
  "Special",
  "Stand-up special",
  "Live event",
  "Talk Show",
]);
const NETFLIX_FILTERS = [
  { id: "all", label: "All" },
  { id: "shows", label: "Shows" },
  { id: "movies", label: "Movies" },
];

function netflixKind(item) {
  return SHOW_TYPES.has(item.type) ? "shows" : "movies";
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function fmtDate(iso) {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function fmtRange(a, b) {
  return `${fmtDate(a)} – ${fmtDate(b)}`;
}

function timeAgo(iso) {
  const then = new Date(iso).getTime();
  if (!then) return "unknown";
  const mins = Math.max(1, Math.round((Date.now() - then) / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

/* ---------------- speech text ---------------- */

const DAY_ORDINALS = [
  "", "first", "second", "third", "fourth", "fifth", "sixth", "seventh",
  "eighth", "ninth", "tenth", "eleventh", "twelfth", "thirteenth",
  "fourteenth", "fifteenth", "sixteenth", "seventeenth", "eighteenth",
  "nineteenth", "twentieth", "twenty-first", "twenty-second",
  "twenty-third", "twenty-fourth", "twenty-fifth", "twenty-sixth",
  "twenty-seventh", "twenty-eighth", "twenty-ninth", "thirtieth",
  "thirty-first",
];

function spokenDate(iso) {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  const month = d.toLocaleDateString(undefined, { month: "long" });
  return `${month} ${DAY_ORDINALS[d.getDate()] || d.getDate()}`;
}

function joinNames(names) {
  if (names.length <= 1) return names[0] || "";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

/** Money + abbreviations the generic speech prep doesn't know about. */
function newsSpeakCleanup(text) {
  return String(text || "")
    .replace(/\$(\d+(?:\.\d+)?)\s*B\b/g, "$1 billion dollars")
    .replace(/\$(\d+(?:\.\d+)?)\s*M\b/g, "$1 million dollars")
    .replace(/£(\d+(?:\.\d+)?)\s*M\b/g, "$1 million pounds")
    .replace(/£(\d+(?:\.\d+)?)\b/g, "$1 pounds")
    .replace(/\$(\d+(?:\.\d+)?)\b/g, "$1 dollars")
    .replace(/\bNo\.\s*(\d+)/g, "number $1")
    .replace(/\bvs\.\b/g, "versus")
    .replace(/\bWNBA\b/g, "W N B A")
    .replace(/\bNFL\b/g, "N F L")
    .replace(/\bNBA\b/g, "N B A")
    .replace(/\bNHL\b/g, "N H L")
    .replace(/\bPGA\b/g, "P G A")
    .replace(/\bUFC\b/g, "U F C")
    .replace(/\bWWE\b/g, "W W E")
    .replace(/\bFIFA\b/g, "F E E F A")
    .replace(/\bGIGN\b/g, "G I G N")
    .replace(/\bQB\b/g, "quarterback")
    .replace(/\bCB\b/g, "cornerback")
    .replace(/\bPTBNL\b/g, "player to be named later")
    .replace(/\bIMAX\b/g, "I MAX");
}

function netflixSpeechLine(item) {
  // Labels like "Docuseries" / "Film" stay visual-only — not read aloud.
  const parts = [
    `${item.title}.`,
    `Released ${spokenDate(item.date)}.`,
    item.synopsis,
  ];
  const stars = (item.starring || []).filter(Boolean);
  if (stars.length) parts.push(`Starring ${joinNames(stars)}.`);
  return prepareSpokenLine(newsSpeakCleanup(parts.join(" ")));
}

function storySpeechLine(item) {
  // Sport/tag badges ("NFL", "Celebrity", "Milestone") stay visual-only.
  return prepareSpokenLine(
    newsSpeakCleanup(
      [`${item.headline}.`, `${spokenDate(item.date)}.`, item.summary].join(" ")
    )
  );
}

function speechLineFor(item) {
  return ce.tab === "netflix" ? netflixSpeechLine(item) : storySpeechLine(item);
}

/* ---------------- data ---------------- */

async function fetchSection(section, bust) {
  const url = bust ? `${section.path}?t=${Date.now()}` : section.path;
  const res = await fetch(url, bust ? { cache: "no-store" } : {});
  if (!res.ok) throw new Error(`Failed to load ${section.path}`);
  return res.json();
}

async function loadForMode(bust = false) {
  if (ce.mode === "netflix") {
    ce.data.netflix = await fetchSection(NETFLIX_SECTION, bust);
    return;
  }
  const entries = await Promise.all(
    NEWS_SECTIONS.map(async (s) => [s.id, await fetchSection(s, bust)])
  );
  Object.assign(ce.data, Object.fromEntries(entries));
  try {
    const briefingSection = {
      id: "briefing",
      path: "data/current-events/briefing.json",
    };
    ce.briefing = await fetchSection(briefingSection, bust);
  } catch {
    ce.briefing = null;
  }
}

function latestGeneratedAt() {
  if (ce.mode === "netflix") return ce.data.netflix?.generatedAt || "";
  return [ce.briefing?.generatedAt, ce.data.sports?.generatedAt, ce.data.entertainment?.generatedAt]
    .filter(Boolean)
    .sort()
    .pop();
}

function briefingPayload() {
  if (ce.briefing?.items?.length) return ce.briefing;
  return { ...buildBriefing(ce.data), source: "heuristic", model: null };
}

function briefingIsNew() {
  const gen = ce.briefing?.generatedAt;
  if (!gen) return false;
  const ageH = (Date.now() - new Date(gen).getTime()) / 3600000;
  return Number.isFinite(ageH) && ageH >= 0 && ageH <= 36;
}

function sportTag(item) {
  return item.sport || item.tag || "Sports";
}

function briefingItems() {
  const items = briefingPayload().items || [];
  if (ce.briefingFilter === "all") return items;
  const sectioned = items.filter((i) => i.section === ce.briefingFilter);
  if (
    ce.briefingFilter === "sports" &&
    ce.briefingSportFilter !== "all"
  ) {
    return sectioned.filter((i) => sportTag(i) === ce.briefingSportFilter);
  }
  return sectioned;
}

function activeItems() {
  if (ce.tab === "briefing") return briefingItems();
  const payload = ce.data[ce.tab];
  const items = [...(payload?.items || [])].sort((a, b) =>
    (b.date || "").localeCompare(a.date || "")
  );
  if (ce.tab === "netflix" && ce.netflixFilter !== "all") {
    return items.filter((i) => netflixKind(i) === ce.netflixFilter);
  }
  if (ce.tab === "sports" && ce.sportFilter !== "all") {
    return items.filter((i) => (i.sport || "Sports") === ce.sportFilter);
  }
  return items;
}

/* ---------------- rendering ---------------- */

function netflixCard(item, idx) {
  const stars = (item.starring || []).filter(Boolean);
  const poster = item.image
    ? `<img class="ce-poster" src="${escapeHtml(item.image)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" />`
    : `<div class="ce-poster ce-poster-empty" aria-hidden="true"></div>`;
  return `
    <article class="ce-card ce-netflix-card" data-idx="${idx}">
      ${poster}
      <div class="ce-netflix-copy">
      <div class="ce-meta">
        <span class="ce-badge">${escapeHtml(item.type)}</span>
        <span class="ce-date">${fmtDate(item.date)}</span>
        ${
          ce.canSpeak
            ? `<button type="button" class="ce-speak" data-speak="${idx}" aria-label="Read this entry aloud" title="Read aloud">▶</button>`
            : ""
        }
      </div>
      <h3>${escapeHtml(item.title)}</h3>
      <p>${escapeHtml(item.synopsis)}</p>
      ${
        stars.length
          ? `<div class="ce-stars"><span class="ce-stars-label">Starring</span>${stars
              .map((s) => `<span class="ce-chip">${escapeHtml(s)}</span>`)
              .join("")}</div>`
          : ""
      }
      </div>
    </article>`;
}

function storyCard(item, idx) {
  return `
    <article class="ce-card ce-story-card" data-idx="${idx}">
      <div class="ce-meta">
        <span class="ce-badge ce-badge-alt">${escapeHtml(item.sport || item.tag || "News")}</span>
        ${item.top ? `<span class="ce-badge ce-badge-top">Top story</span>` : ""}
        <span class="ce-date">${fmtDate(item.date)}</span>
        ${
          ce.canSpeak
            ? `<button type="button" class="ce-speak" data-speak="${idx}" aria-label="Read this story aloud" title="Read aloud">▶</button>`
            : ""
        }
      </div>
      <h3>${escapeHtml(item.headline)}</h3>
      <p>${escapeHtml(item.summary)}</p>
      ${
        item.url
          ? `<a class="ce-link" href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">Read the full story →</a>`
          : ""
      }
    </article>`;
}

function sectionLabel(id) {
  if (id === "sports") return "Sports";
  if (id === "entertainment") return "Entertainment";
  if (id === "briefing") return "Briefing";
  if (id === "netflix") return "Netflix";
  return id;
}

function briefingCard(item, idx) {
  const people = item.people || [];
  const coverage = Number(item.coverage) || 1;
  return `
    <article class="ce-card ce-story-card" data-idx="${idx}">
      <div class="ce-meta">
        <span class="ce-rank" aria-label="Rank ${idx + 1}">${idx + 1}</span>
        <span class="ce-badge">${escapeHtml(sectionLabel(item.section))}</span>
        <span class="ce-badge ce-badge-alt">${escapeHtml(item.tag || "News")}</span>
        ${
          coverage > 1
            ? `<span class="ce-badge ce-badge-top">Mentioned ${coverage}×</span>`
            : ""
        }
        <span class="ce-date">${fmtDate(item.date)}</span>
        ${
          ce.canSpeak
            ? `<button type="button" class="ce-speak" data-speak="${idx}" aria-label="Read this story aloud" title="Read aloud">▶</button>`
            : ""
        }
      </div>
      <h3>${highlightPeople(item.headline, people)}</h3>
      <p>${highlightPeople(item.summary, people)}</p>
      ${
        item.url
          ? `<a class="ce-link" href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">Read the full story →</a>`
          : ""
      }
    </article>`;
}

function briefingFilterBar(allItems) {
  const counts = { all: allItems.length, sports: 0, entertainment: 0 };
  for (const i of allItems) {
    if (counts[i.section] != null) counts[i.section] += 1;
  }
  return `
    <div class="ce-filter" role="group" aria-label="Filter briefing">
      ${BRIEFING_FILTERS.map(
        (f) => `
        <button type="button" class="ce-filter-chip ${
          ce.briefingFilter === f.id ? "is-on" : ""
        }" data-bfilter="${f.id}">${f.label} <span class="ce-filter-count">${
          counts[f.id]
        }</span></button>`
      ).join("")}
    </div>`;
}

function briefingSportFilterBar(allItems) {
  const sportsItems = allItems.filter((i) => i.section === "sports");
  const counts = new Map();
  for (const i of sportsItems) {
    const sport = sportTag(i);
    counts.set(sport, (counts.get(sport) || 0) + 1);
  }
  const sports = [...counts.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0])
  );
  if (!sports.length) return "";
  if (ce.briefingSportFilter !== "all" && !counts.has(ce.briefingSportFilter)) {
    ce.briefingSportFilter = "all";
  }
  const chips = [
    { id: "all", label: "All sports", count: sportsItems.length },
    ...sports.map(([id, count]) => ({ id, label: id, count })),
  ];
  return `
    <div class="ce-filter" role="group" aria-label="Filter briefing by sport">
      ${chips
        .map(
          (f) => `
        <button type="button" class="ce-filter-chip ${
          ce.briefingSportFilter === f.id ? "is-on" : ""
        }" data-bsfilter="${escapeHtml(f.id)}">${escapeHtml(
            f.label
          )} <span class="ce-filter-count">${f.count}</span></button>`
        )
        .join("")}
    </div>`;
}

function briefingListHtml(items, startIdx = 0) {
  if (
    ce.briefingFilter === "sports" &&
    ce.briefingSportFilter === "all"
  ) {
    const groups = new Map();
    for (const item of items) {
      const key = sportTag(item);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    }
    const ordered = [...groups.entries()].sort((a, b) => {
      const cov = (list) =>
        list.reduce((n, i) => n + (Number(i.coverage) || 1), 0);
      return cov(b[1]) - cov(a[1]) || b[1].length - a[1].length || a[0].localeCompare(b[0]);
    });
    let idx = startIdx;
    return ordered
      .map(
        ([sport, list]) => `
      <section class="ce-group">
        <h3 class="ce-group-title">${escapeHtml(sport)}</h3>
        <div class="ce-list">${list
          .map((item) => briefingCard(item, idx++))
          .join("")}</div>
      </section>`
      )
      .join("");
  }
  return `<div class="ce-list">${items
    .map((item, i) => briefingCard(item, startIdx + i))
    .join("")}</div>`;
}

function netflixFilterBar(allItems) {
  const counts = { all: allItems.length, shows: 0, movies: 0 };
  for (const i of allItems) counts[netflixKind(i)] += 1;
  return `
    <div class="ce-filter" role="group" aria-label="Filter Netflix releases">
      ${NETFLIX_FILTERS.map(
        (f) => `
        <button type="button" class="ce-filter-chip ${
          ce.netflixFilter === f.id ? "is-on" : ""
        }" data-nfilter="${f.id}">${f.label} <span class="ce-filter-count">${
          counts[f.id]
        }</span></button>`
      ).join("")}
    </div>`;
}

function sportFilterBar(allItems) {
  const counts = new Map();
  for (const i of allItems) {
    const sport = i.sport || "Sports";
    counts.set(sport, (counts.get(sport) || 0) + 1);
  }
  const sports = [...counts.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0])
  );
  if (!sports.length) return "";
  // Reset stale filter if that sport vanished after a refresh.
  if (ce.sportFilter !== "all" && !counts.has(ce.sportFilter)) {
    ce.sportFilter = "all";
  }
  const chips = [
    { id: "all", label: "All", count: allItems.length },
    ...sports.map(([id, count]) => ({ id, label: id, count })),
  ];
  return `
    <div class="ce-filter" role="group" aria-label="Filter by sport">
      ${chips
        .map(
          (f) => `
        <button type="button" class="ce-filter-chip ${
          ce.sportFilter === f.id ? "is-on" : ""
        }" data-sfilter="${escapeHtml(f.id)}">${escapeHtml(
            f.label
          )} <span class="ce-filter-count">${f.count}</span></button>`
        )
        .join("")}
    </div>`;
}

function renderBody() {
  if (ce.tab === "briefing") {
    const payload = briefingPayload();
    const allItems = payload.items || [];
    const items = briefingItems();
    const rankedBy =
      payload.source === "copilot-auto"
        ? "Ranked by coverage, story weight, and recency. Top stories rewritten by Copilot (Claude Haiku)."
        : "Ranked by coverage, story weight, and recency. Copilot rewrites the top stories on Tuesday.";
    const freshNote = briefingIsNew()
      ? `<p class="ce-briefing-new">New Tuesday briefing — last three weeks of sports and entertainment.</p>`
      : "";
    const sportBar =
      ce.briefingFilter === "sports" ? briefingSportFilterBar(allItems) : "";
    const filters = `<div class="ce-filters">${briefingFilterBar(allItems)}${sportBar}</div>`;
    if (!items.length) {
      return `${freshNote}${filters}<p class="lede">Nothing found for this filter in the current window.</p>`;
    }
    const featured = items.slice(0, BRIEFING_FEATURED);
    const rest = items.slice(BRIEFING_FEATURED);
    const archive = rest.length
      ? ce.briefingShowAll
        ? `<section class="ce-archive">
        <div class="ce-archive-head">
          <h3 class="ce-archive-title">More ranked stories</h3>
          <button type="button" class="text-btn" id="ce-briefing-toggle">Hide extra stories</button>
        </div>
        ${briefingListHtml(rest, featured.length)}
      </section>`
        : `<p class="ce-archive-more">
        <button type="button" class="secondary-btn" id="ce-briefing-toggle">Show all ranked stories (${items.length})</button>
      </p>`
      : "";
    return `
    ${freshNote}
    <p class="ce-window">Covering ${fmtRange(payload.windowStart, payload.windowEnd)} · Top ${
      featured.length
    } of ${items.length} stories · ${rankedBy} Main people are in <strong>bold</strong>.</p>
    ${filters}
    ${briefingListHtml(featured, 0)}
    ${archive}`;
  }
  const payload = ce.data[ce.tab];
  if (!payload) return `<p class="error">No data for this section yet.</p>`;
  const items = activeItems();
  const filterBar =
    ce.tab === "netflix"
      ? netflixFilterBar([...(payload.items || [])])
      : ce.tab === "sports"
        ? sportFilterBar([...(payload.items || [])])
        : "";
  if (!items.length) {
    return `${filterBar}<p class="lede">Nothing found for this filter in the current window.</p>`;
  }
  const cards =
    ce.tab === "netflix"
      ? items.map(netflixCard).join("")
      : items.map(storyCard).join("");
  return `
    <p class="ce-window">Covering ${fmtRange(payload.windowStart, payload.windowEnd)} · ${
      items.length
    } ${ce.tab === "netflix" ? "releases" : "stories"}</p>
    ${filterBar}
    <div class="${ce.tab === "netflix" ? "ce-grid" : "ce-list"}">${cards}</div>`;
}

function speechPanelHtml() {
  if (!ce.canSpeak) {
    return `
      <section class="speech-panel ce-speech" aria-label="Read aloud">
        <p class="speech-status">Read-aloud needs a browser with speech synthesis (Chrome/Edge/Brave/Safari) and sound allowed.</p>
      </section>`;
  }
  const savedRate = getSavedRate();
  const savedUri = getSavedVoiceUri();
  const tabLabel =
    ce.mode === "netflix"
      ? "Netflix"
      : visibleTabs().find((s) => s.id === ce.tab)?.label || "";
  const listenHint =
    ce.mode === "netflix"
      ? "Hear upcoming Netflix originals, newest first."
      : ce.tab === "briefing"
      ? "Hear the top briefing stories, heaviest coverage first."
      : `Hear the ${tabLabel} feed like a news brief, newest first.`;
  return `
    <section class="speech-panel ce-speech" aria-label="Read aloud">
      <input type="checkbox" class="speech-fold" id="speech-fold-ce" aria-label="Show read-aloud options" />
      <div class="speech-panel-head">
        <label class="speech-fold-label" for="speech-fold-ce">Read aloud</label>
        <div class="speech-copy">
          <p class="speech-kicker speech-kicker-wide">Read aloud</p>
          <p class="speech-lede speech-lede-wide">${escapeHtml(listenHint)}</p>
        </div>
        <div class="speech-actions" role="group" aria-label="Playback">
          <button type="button" class="speech-btn speech-btn-primary" id="ce-listen">Listen</button>
          <button type="button" class="speech-btn speech-btn-quiet" id="ce-stop">Stop</button>
        </div>
      </div>
      <div class="speech-panel-body">
        <p class="speech-lede speech-lede-mobile">${escapeHtml(listenHint)}</p>
        <div class="speech-settings">
        <label class="voice-field">
          <span>Voice</span>
          <select id="ce-voice-select" ${ce.voices.length ? "" : "disabled"}>
            ${
              ce.voices.length
                ? ce.voices
                    .map(
                      (v) =>
                        `<option value="${escapeHtml(v.uri)}" ${
                          v.uri === savedUri ? "selected" : ""
                        }>${escapeHtml(v.name)}${
                          /\bdaniel\b/i.test(v.name) ? " (default)" : ""
                        }</option>`
                    )
                    .join("")
                : `<option>No voices found</option>`
            }
          </select>
        </label>
        <label class="voice-field">
          <span>Speed</span>
          <select id="ce-rate-select">
            <option value="0.8" ${savedRate === 0.8 ? "selected" : ""}>Slower</option>
            <option value="0.9" ${savedRate === 0.9 ? "selected" : ""}>Natural</option>
            <option value="1" ${savedRate === 1 ? "selected" : ""}>Faster</option>
          </select>
        </label>
      </div>
      <p class="speech-status" id="ce-speech-status">${escapeHtml(
        voiceQualityTip(ce.voices)
      )}</p>
      </div>
    </section>`;
}

function render() {
  if (!ce.root) return;
  const updated = latestGeneratedAt();
  const canRefresh = isLocalHost();
  ce.root.innerHTML = `
    <div class="ce-head">
      <div>
        <h2 class="section-title">${ce.mode === "netflix" ? "Netflix" : "Current Events"}</h2>
        <p class="lede">${
          ce.mode === "netflix"
            ? "Upcoming Netflix originals. Filter by shows or movies."
            : "Sports and entertainment headlines update every few hours. On Tuesday, the last three weeks are clustered into a briefing; Copilot rewrites the top stories."
        }</p>
      </div>
      <div class="ce-refresh-wrap">
        ${updated ? `<span class="ce-updated">Updated ${timeAgo(updated)}</span>` : ""}
        ${
          canRefresh
            ? `<button type="button" class="ce-refresh" id="ce-refresh" ${ce.refreshing ? "disabled" : ""}>
          <span class="ce-refresh-icon ${ce.refreshing ? "is-spinning" : ""}">⟳</span>
          ${ce.refreshing ? "Refreshing…" : "Refresh"}
        </button>`
            : ""
        }
      </div>
    </div>
    ${ce.notice ? `<p class="ce-notice">${escapeHtml(ce.notice)}</p>` : ""}
    ${speechPanelHtml()}
    ${
      ce.mode === "netflix"
        ? ""
        : `<div class="ce-tabs" role="tablist">
      ${visibleTabs()
        .map(
          (s) => `
        <button type="button" role="tab" class="ce-tab ${s.id === ce.tab ? "is-active" : ""}"
          data-tab="${s.id}" aria-selected="${s.id === ce.tab}">${s.label}${
            s.id === "briefing" && briefingIsNew()
              ? `<span class="ce-tab-new">New</span>`
              : ""
          }</button>`
        )
        .join("")}
    </div>`
    }
    <div class="ce-body">${renderBody()}</div>
  `;

  ce.root.querySelectorAll(".ce-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      stopPlayback();
      ce.tab = btn.dataset.tab;
      ce.notice = "";
      render();
    });
  });

  ce.root.querySelectorAll(".ce-filter-chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      stopPlayback();
      if (btn.dataset.nfilter) ce.netflixFilter = btn.dataset.nfilter;
      if (btn.dataset.sfilter) ce.sportFilter = btn.dataset.sfilter;
      if (btn.dataset.bfilter) {
        ce.briefingFilter = btn.dataset.bfilter;
        ce.briefingSportFilter = "all";
        ce.briefingShowAll = false;
      }
      if (btn.dataset.bsfilter) {
        ce.briefingFilter = "sports";
        ce.briefingSportFilter = btn.dataset.bsfilter;
        ce.briefingShowAll = false;
      }
      render();
    });
  });

  document.getElementById("ce-briefing-toggle")?.addEventListener("click", () => {
    stopPlayback();
    ce.briefingShowAll = !ce.briefingShowAll;
    render();
  });

  document.getElementById("ce-refresh")?.addEventListener("click", refreshData);

  ce.root.querySelectorAll(".ce-speak").forEach((btn) => {
    btn.addEventListener("click", () => {
      unlockSpeech();
      playItems([Number(btn.dataset.speak)]);
    });
  });

  ce.root.querySelectorAll("img.ce-poster").forEach((img) => {
    img.addEventListener("error", () => {
      const ph = document.createElement("div");
      ph.className = "ce-poster ce-poster-empty";
      ph.setAttribute("aria-hidden", "true");
      img.replaceWith(ph);
    });
  });

  if (ce.canSpeak) bindSpeechControls();
}

/* ---------------- playback ---------------- */

function statusEl() {
  return document.getElementById("ce-speech-status");
}

function setSpeakingUI(active, message = "") {
  ce.playing = active;
  const listenBtn = document.getElementById("ce-listen");
  const stopBtn = document.getElementById("ce-stop");
  if (listenBtn) {
    listenBtn.disabled = active;
    listenBtn.classList.toggle("is-playing", active);
  }
  if (stopBtn) {
    stopBtn.disabled = !active;
    stopBtn.classList.toggle("is-active-stop", active);
  }
  ce.root?.querySelector(".ce-speech")?.classList.toggle("is-live", active);
  const status = statusEl();
  if (status) {
    status.textContent =
      message || (ce.canSpeak ? voiceQualityTip(ce.voices) : "");
  }
  if (!active) {
    ce.root?.querySelectorAll(".ce-card.is-speaking").forEach((c) => {
      c.classList.remove("is-speaking");
    });
  }
}

function highlightCard(index) {
  ce.root?.querySelectorAll(".ce-card").forEach((c) => {
    c.classList.toggle("is-speaking", Number(c.dataset.idx) === index);
  });
  ce.root
    ?.querySelector(`.ce-card[data-idx="${index}"]`)
    ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

async function playItems(indices) {
  if (!ce.canSpeak) return;
  const items = activeItems();
  const lines = indices
    .filter((i) => items[i])
    .map((i) => speechLineFor(items[i]));
  if (!lines.length) return;
  setSpeakingUI(true, "Starting…");
  try {
    await speakLines(lines, {
      voiceUri: document.getElementById("ce-voice-select")?.value || getSavedVoiceUri(),
      rate: Number(document.getElementById("ce-rate-select")?.value || getSavedRate()),
      onStartLine: (lineIndex) => highlightCard(indices[lineIndex]),
      onStatus: (msg) => {
        const status = statusEl();
        if (status) status.textContent = msg;
      },
      onEnd: () => setSpeakingUI(false, ""),
    });
    setSpeakingUI(false, "");
  } catch (err) {
    setSpeakingUI(false, err.message);
  }
}

function stopPlayback() {
  stopSpeech();
  setSpeakingUI(false, "");
}

function bindSpeechControls() {
  document.getElementById("ce-listen")?.addEventListener("click", () => {
    unlockSpeech();
    const items = activeItems();
    const n =
      ce.tab === "briefing" && !ce.briefingShowAll
        ? Math.min(BRIEFING_FEATURED, items.length)
        : items.length;
    playItems(items.slice(0, n).map((_, i) => i));
  });
  document.getElementById("ce-stop")?.addEventListener("click", stopPlayback);
  document.getElementById("ce-voice-select")?.addEventListener("change", (e) => {
    saveVoiceUri(e.target.value);
    stopPlayback();
    const status = statusEl();
    if (status) {
      status.textContent = `Voice set to “${e.target.selectedOptions[0]?.text || "selected"}”.`;
    }
  });
  document.getElementById("ce-rate-select")?.addEventListener("change", (e) => {
    saveRate(Number(e.target.value));
  });
}

/* ---------------- refresh ---------------- */

async function refreshData() {
  // Local-only: the live static site has no refresh endpoint to call.
  if (ce.refreshing || !isLocalHost()) return;
  stopPlayback();
  ce.refreshing = true;
  ce.notice = "";
  render();
  try {
    // One-click live refresh is available when the app is served by
    // scripts/serve.mjs; static servers (python http.server) 404 here.
    const res = await fetch("/api/refresh-current-events", { method: "POST" });
    if (!res.ok) throw new Error("no live endpoint");
    const payload = await res.json();
    ce.data = {
      ...ce.data,
      netflix: payload.netflix ?? ce.data.netflix,
      sports: payload.sports ?? ce.data.sports,
      entertainment: payload.entertainment ?? ce.data.entertainment,
    };
    ce.briefing = payload.briefing || ce.briefing;
    ce.notice = "Live data pulled just now.";
  } catch {
    await loadForMode(true);
    ce.notice =
      "Showing the latest saved data. For a live refresh, serve the app with: node scripts/serve.mjs (or run ./refresh-current-events.command first).";
  } finally {
    ce.refreshing = false;
    render();
  }
}

/* ---------------- entry ---------------- */

export async function renderCurrentEvents({ els, mode = "news" }) {
  ce.root = els.currentEvents;
  ce.mode = mode === "netflix" ? "netflix" : "news";
  ce.tab = ce.mode === "netflix" ? "netflix" : "briefing";
  ce.notice = "";
  ce.canSpeak = speechSupported();
  const needsLoad =
    ce.mode === "netflix" ? !ce.data.netflix : !ce.data.sports || !ce.data.entertainment;
  if (needsLoad) {
    ce.root.innerHTML = `<p class="lede">${
      ce.mode === "netflix" ? "Loading Netflix…" : "Loading current events…"
    }</p>`;
    try {
      await loadForMode();
    } catch (err) {
      ce.root.innerHTML = `<p class="error">${escapeHtml(err.message)}</p>`;
      return;
    }
  }
  if (ce.canSpeak && !ce.voices.length) {
    ce.voices = await listEnglishVoices();
    const savedUri = getSavedVoiceUri();
    if (!savedUri) {
      const defaultUri = await getDefaultBrowserVoiceUri();
      if (defaultUri) saveVoiceUri(defaultUri);
    }
  }
  render();
}
