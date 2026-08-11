/** Current Events section — browsable Netflix / Sports / Entertainment feeds. */

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
  voiceQualityTip,
} from "./speech.js";

const SECTIONS = [
  { id: "netflix", label: "Netflix", path: "data/current-events/netflix.json" },
  { id: "sports", label: "Sports", path: "data/current-events/sports.json" },
  { id: "entertainment", label: "Entertainment", path: "data/current-events/entertainment.json" },
];

const ce = {
  data: {}, // sectionId -> payload
  tab: "netflix",
  refreshing: false,
  notice: "",
  root: null,
  voices: [],
  canSpeak: false,
  playing: false,
};

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
  const parts = [
    `${item.title}.`,
    `${item.type}, released ${spokenDate(item.date)}.`,
    item.synopsis,
  ];
  const stars = (item.starring || []).filter(Boolean);
  if (stars.length) parts.push(`Starring ${joinNames(stars)}.`);
  return prepareSpokenLine(newsSpeakCleanup(parts.join(" ")));
}

function storySpeechLine(item) {
  return prepareSpokenLine(
    newsSpeakCleanup(
      [
        `${item.headline}.`,
        `${item.sport || item.tag || "News"}, ${spokenDate(item.date)}.`,
        item.summary,
      ].join(" ")
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

async function loadAll(bust = false) {
  const entries = await Promise.all(
    SECTIONS.map(async (s) => [s.id, await fetchSection(s, bust)])
  );
  ce.data = Object.fromEntries(entries);
}

function latestGeneratedAt() {
  return Object.values(ce.data)
    .map((d) => d?.generatedAt)
    .filter(Boolean)
    .sort()
    .pop();
}

function activeItems() {
  const payload = ce.data[ce.tab];
  return [...(payload?.items || [])].sort((a, b) =>
    (b.date || "").localeCompare(a.date || "")
  );
}

/* ---------------- rendering ---------------- */

function netflixCard(item, idx) {
  const stars = (item.starring || []).filter(Boolean);
  return `
    <article class="ce-card ce-netflix-card" data-idx="${idx}">
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
    </article>`;
}

function storyCard(item, idx) {
  return `
    <article class="ce-card ce-story-card" data-idx="${idx}">
      <div class="ce-meta">
        <span class="ce-badge ce-badge-alt">${escapeHtml(item.sport || item.tag || "News")}</span>
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

function renderBody() {
  const payload = ce.data[ce.tab];
  if (!payload) return `<p class="error">No data for this section yet.</p>`;
  const items = activeItems();
  if (!items.length) return `<p class="lede">Nothing found in this window.</p>`;
  const cards =
    ce.tab === "netflix"
      ? items.map(netflixCard).join("")
      : items.map(storyCard).join("");
  return `
    <p class="ce-window">Covering ${fmtRange(payload.windowStart, payload.windowEnd)} · ${
      items.length
    } ${ce.tab === "netflix" ? "releases" : "stories"}</p>
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
  const tabLabel = SECTIONS.find((s) => s.id === ce.tab)?.label || "";
  return `
    <section class="speech-panel ce-speech" aria-label="Read aloud">
      <div class="speech-panel-top">
        <div>
          <p class="speech-kicker">Read aloud</p>
          <p class="speech-lede">Hear the ${escapeHtml(tabLabel)} feed like a news brief, newest first.</p>
        </div>
        <div class="speech-actions" role="group" aria-label="Playback">
          <button type="button" class="speech-btn speech-btn-primary" id="ce-listen">Listen</button>
          <button type="button" class="speech-btn speech-btn-quiet" id="ce-stop">Stop</button>
        </div>
      </div>
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
    </section>`;
}

function render() {
  if (!ce.root) return;
  const updated = latestGeneratedAt();
  ce.root.innerHTML = `
    <div class="ce-head">
      <div>
        <h2 class="section-title">Current Events</h2>
        <p class="lede">The last three weeks, distilled for trivia — Netflix originals, the sports
        stories everyone's talking about, and entertainment headlines.</p>
      </div>
      <div class="ce-refresh-wrap">
        ${updated ? `<span class="ce-updated">Updated ${timeAgo(updated)}</span>` : ""}
        <button type="button" class="ce-refresh" id="ce-refresh" ${ce.refreshing ? "disabled" : ""}>
          <span class="ce-refresh-icon ${ce.refreshing ? "is-spinning" : ""}">⟳</span>
          ${ce.refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>
    </div>
    ${ce.notice ? `<p class="ce-notice">${escapeHtml(ce.notice)}</p>` : ""}
    ${speechPanelHtml()}
    <div class="ce-tabs" role="tablist">
      ${SECTIONS.map(
        (s) => `
        <button type="button" role="tab" class="ce-tab ${s.id === ce.tab ? "is-active" : ""}"
          data-tab="${s.id}" aria-selected="${s.id === ce.tab}">${s.label}</button>`
      ).join("")}
    </div>
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

  document.getElementById("ce-refresh").addEventListener("click", refreshData);

  ce.root.querySelectorAll(".ce-speak").forEach((btn) => {
    btn.addEventListener("click", () => playItems([Number(btn.dataset.speak)]));
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
    playItems(activeItems().map((_, i) => i));
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
  if (ce.refreshing) return;
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
      netflix: payload.netflix,
      sports: payload.sports,
      entertainment: payload.entertainment,
    };
    ce.notice = "Live data pulled just now.";
  } catch {
    await loadAll(true);
    ce.notice =
      "Showing the latest saved data. For a live refresh, serve the app with: node scripts/serve.mjs (or run ./refresh-current-events.command first).";
  } finally {
    ce.refreshing = false;
    render();
  }
}

/* ---------------- entry ---------------- */

export async function renderCurrentEvents({ els }) {
  ce.root = els.currentEvents;
  ce.tab = "netflix";
  ce.notice = "";
  ce.canSpeak = speechSupported();
  if (!Object.keys(ce.data).length) {
    ce.root.innerHTML = `<p class="lede">Loading current events…</p>`;
    try {
      await loadAll();
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
