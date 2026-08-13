/** Interactive periodic table with trivia facts and spoken tours. */

import {
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

const DATA_PATH = "data/periodic-table/elements.json";

const CATEGORY_ORDER = [
  "alkali-metal",
  "alkaline-earth",
  "transition-metal",
  "post-transition",
  "metalloid",
  "nonmetal",
  "halogen",
  "noble-gas",
  "lanthanide",
  "actinide",
];

const pt = {
  root: null,
  data: null,
  selectedZ: 1,
  /** Empty = all elements; otherwise one or more category ids. */
  focusCategories: [],
  voices: [],
  canSpeak: false,
  playing: false,
  tourIds: [],
  tourSession: 0,
  onStartQuiz: null,
};

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function byZ(z) {
  return pt.data?.elements?.find((e) => e.Z === z) || null;
}

function labelFor(cat) {
  return pt.data?.categoryLabels?.[cat] || cat;
}

function setStatus(msg) {
  const el = pt.root?.querySelector("#pt-speech-status");
  if (el) el.textContent = msg;
}

function stopTour() {
  pt.tourSession += 1;
  stopSpeech();
  pt.playing = false;
  pt.tourIds = [];
  pt.root?.querySelector(".pt-shell")?.classList.remove("is-speaking");
  const listen = pt.root?.querySelector("#pt-listen");
  if (listen) listen.disabled = false;
  highlight(pt.selectedZ);
}

function spokenScript(el) {
  const lines = [];
  lines.push(
    prepareSpokenLine(
      `${el.name}. Symbol ${el.symbol.split("").join(" ")}. Atomic number ${el.Z}.`
    )
  );
  if (el.discoveredBy) {
    const when = el.discoveredYear
      ? ` in ${el.discoveredYear}`
      : "";
    lines.push(
      prepareSpokenLine(
        el.discoveredBy === "known since antiquity"
          ? `${el.name} has been known since antiquity.`
          : `Discovered by ${el.discoveredBy}${when}.`
      )
    );
  }
  if (el.namedAfter) {
    lines.push(prepareSpokenLine(`Named after ${el.namedAfter}.`));
  }
  for (const fact of el.facts || []) {
    lines.push(prepareSpokenLine(fact));
  }
  return lines;
}

function highlight(z) {
  if (!pt.root) return;
  pt.root.querySelectorAll(".pt-cell.is-active, .pt-cell.is-tour").forEach((n) => {
    n.classList.remove("is-active", "is-tour");
  });
  const cell = pt.root.querySelector(`.pt-cell[data-z="${z}"]`);
  if (cell) {
    cell.classList.add(pt.playing ? "is-tour" : "is-active");
    cell.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  }
}

function isAllSelected(cats = pt.focusCategories) {
  return !cats?.length;
}

function elementsForScope(cats = pt.focusCategories) {
  const all = pt.data?.elements || [];
  if (isAllSelected(cats)) return all;
  const set = new Set(cats);
  return all.filter((e) => set.has(e.category));
}

function scopeLabel(cats = pt.focusCategories) {
  if (isAllSelected(cats)) return "All elements";
  const labels = cats.map((c) => labelFor(c));
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} + ${labels[1]}`;
  return `${labels.length} families`;
}

function scopeId(cats = pt.focusCategories) {
  return isAllSelected(cats) ? "all" : [...cats];
}

function toggleFocusCategory(cat) {
  if (cat === "all") {
    pt.focusCategories = [];
    return;
  }
  const cur = [...(pt.focusCategories || [])];
  if (!cur.length) {
    pt.focusCategories = [cat];
    return;
  }
  const idx = cur.indexOf(cat);
  if (idx >= 0) {
    cur.splice(idx, 1);
    pt.focusCategories = cur;
    return;
  }
  cur.push(cat);
  const next = CATEGORY_ORDER.filter((c) => cur.includes(c));
  pt.focusCategories =
    next.length >= CATEGORY_ORDER.length ? [] : next;
}

function applyCategoryFilter() {
  if (!pt.root) return;
  const cats = pt.focusCategories || [];
  const allOn = isAllSelected(cats);
  const set = new Set(cats);

  pt.root.querySelectorAll(".pt-cell[data-z]").forEach((cell) => {
    const z = Number(cell.dataset.z);
    const el = byZ(z);
    const on = allOn || set.has(el?.category);
    cell.classList.toggle("is-dim", !on);
  });

  pt.root.querySelectorAll(".pt-legend-btn").forEach((btn) => {
    const cat = btn.dataset.cat;
    const on = cat === "all" ? allOn : set.has(cat);
    btn.classList.toggle("is-on", on);
    btn.setAttribute("aria-pressed", String(on));
  });

  const quizCopy = pt.root.querySelector(".pt-quiz-panel .speech-lede");
  if (quizCopy) {
    const n = elementsForScope().length;
    const label = scopeLabel();
    quizCopy.innerHTML = `Quiz the current filter: <strong>${escapeHtml(
      label
    )}</strong> (${n} elements). Tap <strong>All</strong>, or one or more families above.
          <strong>Easy</strong> shows a full clue sheet. <strong>Hard</strong> mixes symbols, numbers, families, and facts.`;
  }
  const disabled = elementsForScope().length < 1;
  const scopeShort = scopeLabel();
  const easyBtn = pt.root.querySelector("#pt-quiz-easy");
  const hardBtn = pt.root.querySelector("#pt-quiz-hard");
  if (easyBtn) {
    easyBtn.disabled = disabled;
    easyBtn.textContent = `Easy · ${scopeShort}`;
  }
  if (hardBtn) {
    hardBtn.disabled = disabled;
    hardBtn.textContent = `Hard · ${scopeShort}`;
  }
}

function selectElement(z, { speakOne = false } = {}) {
  const el = byZ(z);
  if (!el) return;
  pt.selectedZ = z;
  highlight(z);
  renderDetail();
  bindDetailSpeech();
  if (speakOne && pt.canSpeak && !pt.playing) {
    void speakElement(el);
  }
}

async function speakElement(el) {
  stopTour();
  pt.playing = true;
  pt.root?.querySelector(".pt-shell")?.classList.add("is-speaking");
  highlight(el.Z);
  setStatus(`Reading ${el.name}…`);
  try {
    await speakLines(spokenScript(el), {
      voiceUri: getSavedVoiceUri(),
      rate: getSavedRate(),
      onStatus: setStatus,
      onEnd: () => {
        pt.playing = false;
        pt.root?.querySelector(".pt-shell")?.classList.remove("is-speaking");
        highlight(pt.selectedZ);
        setStatus(voiceQualityTip(pt.voices));
      },
    });
  } catch (err) {
    pt.playing = false;
    setStatus(err.message);
  }
}

async function speakTour() {
  const list = elementsForScope();
  if (!list.length) {
    setStatus("No elements in that selection.");
    return;
  }
  stopSpeech();
  const session = (pt.tourSession += 1);
  pt.playing = true;
  pt.tourIds = list.map((e) => e.Z);
  pt.root?.querySelector(".pt-shell")?.classList.add("is-speaking");
  const listen = pt.root?.querySelector("#pt-listen");
  if (listen) listen.disabled = true;

  setStatus(`Touring ${scopeLabel()} (${list.length})…`);

  for (let i = 0; i < list.length; i += 1) {
    if (!pt.playing || session !== pt.tourSession) break;
    const el = list[i];
    pt.selectedZ = el.Z;
    highlight(el.Z);
    renderDetail();
    bindDetailSpeech();
    setStatus(`Reading ${el.name} (${i + 1} of ${list.length})…`);
    await new Promise((resolve) => {
      speakLines(spokenScript(el), {
        voiceUri: getSavedVoiceUri(),
        rate: getSavedRate(),
        onStatus: setStatus,
        onEnd: () => resolve(),
      }).catch((err) => {
        setStatus(err.message);
        pt.playing = false;
        resolve();
      });
    });
    if (!pt.playing || session !== pt.tourSession) break;
    await new Promise((r) => setTimeout(r, 450));
  }

  if (session === pt.tourSession) {
    pt.playing = false;
    pt.tourIds = [];
    pt.root?.querySelector(".pt-shell")?.classList.remove("is-speaking");
    if (listen) listen.disabled = false;
    highlight(pt.selectedZ);
    setStatus(voiceQualityTip(pt.voices));
  }
}

function cellHtml(el) {
  return `
    <button type="button" class="pt-cell pt-cat-${escapeHtml(el.category)}"
      data-z="${el.Z}" aria-label="${escapeHtml(el.name)}, atomic number ${el.Z}">
      <span class="pt-z">${el.Z}</span>
      <span class="pt-symbol">${escapeHtml(el.symbol)}</span>
      <span class="pt-name">${escapeHtml(el.name)}</span>
    </button>`;
}

function placeholderHtml(label) {
  return `<div class="pt-cell pt-placeholder" aria-hidden="true"><span class="pt-name">${escapeHtml(label)}</span></div>`;
}

function buildMainGrid() {
  const byKey = new Map();
  for (const el of pt.data.elements) {
    if (el.category === "lanthanide" || el.category === "actinide") continue;
    if (el.group >= 1 && el.group <= 18) {
      byKey.set(`${el.period}-${el.group}`, el);
    }
  }
  // La / Ac sit in group 3 of periods 6 / 7 in many layouts
  const la = byZ(57);
  const ac = byZ(89);
  if (la) byKey.set("6-3", la);
  if (ac) byKey.set("7-3", ac);

  const cells = [];
  for (let period = 1; period <= 7; period += 1) {
    for (let group = 1; group <= 18; group += 1) {
      const el = byKey.get(`${period}-${group}`);
      if (el) {
        cells.push(cellHtml(el));
      } else if (
        (period === 6 && group === 3) ||
        (period === 7 && group === 3)
      ) {
        cells.push(
          placeholderHtml(period === 6 ? "57–71" : "89–103")
        );
      } else {
        cells.push(`<div class="pt-cell pt-empty" aria-hidden="true"></div>`);
      }
    }
  }
  return cells.join("");
}

function buildFBlock(kind) {
  const list = pt.data.elements.filter((e) => e.category === kind);
  return list.map(cellHtml).join("");
}

function renderDetail() {
  const panel = pt.root?.querySelector("#pt-detail");
  if (!panel) return;
  const el = byZ(pt.selectedZ);
  if (!el) {
    panel.innerHTML = `<p class="lede">Select an element.</p>`;
    return;
  }
  const year =
    el.discoveredYear != null ? String(el.discoveredYear) : "ancient times";
  panel.innerHTML = `
    <div class="pt-detail-card pt-cat-${escapeHtml(el.category)}">
      <div class="pt-detail-head">
        <div class="pt-detail-symbol" aria-hidden="true">${escapeHtml(el.symbol)}</div>
        <div>
          <p class="pt-detail-kicker">${escapeHtml(labelFor(el.category))} · Period ${el.period}${
            el.group ? ` · Group ${el.group}` : ""
          }</p>
          <h3>${escapeHtml(el.name)}</h3>
          <p class="pt-detail-meta">Atomic number <strong>${el.Z}</strong>
            · Mass <strong>${escapeHtml(el.atomicMass)}</strong></p>
        </div>
      </div>
      <dl class="pt-dl">
        <div><dt>Discovered</dt><dd>${escapeHtml(el.discoveredBy || "—")}${
          el.discoveredYear ? ` (${year})` : ""
        }</dd></div>
        <div><dt>Named after</dt><dd>${escapeHtml(el.namedAfter || "—")}</dd></div>
      </dl>
      <h4 class="pt-facts-title">Significant facts</h4>
      <ul class="pt-facts">
        ${(el.facts || []).map((f) => `<li>${escapeHtml(f)}</li>`).join("")}
      </ul>
      ${
        pt.canSpeak
          ? `<div class="pt-detail-actions">
              <button type="button" class="speech-btn speech-btn-primary" id="pt-read-one">Read this element</button>
            </div>`
          : ""
      }
    </div>`;
}

function bindDetailSpeech() {
  pt.root?.querySelector("#pt-read-one")?.addEventListener("click", () => {
    unlockSpeech();
    const el = byZ(pt.selectedZ);
    if (el) void speakElement(el);
  });
}

function speechPanelHtml() {
  if (!pt.canSpeak) {
    return `
      <section class="speech-panel pt-speech" aria-label="Read aloud">
        <p class="speech-status">Read-aloud needs a browser with speech synthesis and sound allowed.</p>
      </section>`;
  }
  const savedRate = getSavedRate();
  const savedUri = getSavedVoiceUri();
  return `
    <section class="speech-panel pt-speech" aria-label="Read aloud">
      <input type="checkbox" class="speech-fold" id="speech-fold-pt" aria-label="Show read-aloud options" />
      <div class="speech-panel-head">
        <label class="speech-fold-label" for="speech-fold-pt">Read aloud</label>
        <div class="speech-copy">
          <p class="speech-kicker speech-kicker-wide">Read aloud</p>
          <p class="speech-lede speech-lede-wide">Hear each element’s number, name, discovery, and facts — tours follow the family filter below (one or more groups, or All). On phones, the screen stays awake while listening when allowed, and the app tries to keep reading if you lock the screen (works best on Android; iOS often still pauses).</p>
        </div>
        <div class="speech-actions" role="group" aria-label="Playback">
          <button type="button" class="speech-btn speech-btn-primary" id="pt-listen">Listen</button>
          <button type="button" class="speech-btn speech-btn-quiet" id="pt-stop">Stop</button>
        </div>
      </div>
      <div class="speech-panel-body">
        <p class="speech-lede speech-lede-mobile">Hear each element’s number, name, discovery, and facts — tours follow the family filter below. The screen stays awake while listening when allowed (works best on Android; iOS often still pauses).</p>
        <div class="speech-settings">
        <label class="voice-field">
          <span>Voice</span>
          <select id="pt-voice-select" ${pt.voices.length ? "" : "disabled"}>
            ${
              pt.voices.length
                ? pt.voices
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
          <select id="pt-rate-select">
            <option value="0.8" ${savedRate === 0.8 ? "selected" : ""}>Slower</option>
            <option value="0.9" ${savedRate === 0.9 ? "selected" : ""}>Natural</option>
            <option value="1" ${savedRate === 1 ? "selected" : ""}>Faster</option>
          </select>
        </label>
      </div>
      <p class="speech-status" id="pt-speech-status">${escapeHtml(
        voiceQualityTip(pt.voices)
      )}</p>
      </div>
    </section>`;
}

function quizPanelHtml() {
  const n = elementsForScope().length;
  const label = scopeLabel();
  return `
    <section class="pt-quiz-panel" aria-label="Quiz">
      <div class="pt-quiz-copy">
        <p class="speech-kicker">Quiz</p>
        <p class="speech-lede">Quiz the current filter: <strong>${escapeHtml(
          label
        )}</strong> (${n} elements). Tap <strong>All</strong>, or one or more families above.
          <strong>Easy</strong> shows a full clue sheet. <strong>Hard</strong> mixes symbols, numbers, families, and facts.</p>
      </div>
      <div class="pt-quiz-actions">
        <button type="button" class="speech-btn speech-btn-primary" id="pt-quiz-easy"
          ${n < 1 ? "disabled" : ""}>Easy · ${escapeHtml(label)}</button>
        <button type="button" class="speech-btn" id="pt-quiz-hard"
          ${n < 1 ? "disabled" : ""}>Hard · ${escapeHtml(label)}</button>
      </div>
    </section>`;
}

function legendHtml() {
  const cats = pt.focusCategories || [];
  const allOn = isAllSelected(cats);
  return `
    <div class="pt-legend-wrap">
      <p class="pt-legend-hint">Filter: tap families to combine (or All for the whole table).</p>
      <div class="pt-legend" role="group" aria-label="Element categories">
        <button type="button" class="pt-legend-btn ${allOn ? "is-on" : ""}" data-cat="all"
          aria-pressed="${allOn}">All</button>
        ${CATEGORY_ORDER.map((c) => {
          const on = cats.includes(c);
          return `<button type="button" class="pt-legend-btn pt-cat-${escapeHtml(
            c
          )} ${on ? "is-on" : ""}" data-cat="${escapeHtml(c)}"
            aria-pressed="${on}">${escapeHtml(labelFor(c))}</button>`;
        }).join("")}
      </div>
    </div>`;
}

function render() {
  if (!pt.root || !pt.data) return;
  pt.root.innerHTML = `
    <div class="pt-shell">
      <div class="pt-head">
        <div>
          <h2 class="section-title">Periodic Table</h2>
          <p class="lede">Click an element for discovery, naming, and trivia facts.
            Filter one or more families, then listen or quiz on that selection.</p>
        </div>
      </div>
      ${speechPanelHtml()}
      ${legendHtml()}
      ${quizPanelHtml()}
      <div class="pt-stage">
        <p class="pt-swipe-hint">Swipe sideways to see the full table — cells stay large enough to tap.</p>
        <div class="pt-grid" role="grid" aria-label="Periodic table">${buildMainGrid()}</div>
        <p class="pt-series-label">Lanthanides</p>
        <div class="pt-fblock" aria-label="Lanthanides">${buildFBlock("lanthanide")}</div>
        <p class="pt-series-label">Actinides</p>
        <div class="pt-fblock" aria-label="Actinides">${buildFBlock("actinide")}</div>
      </div>
      <div id="pt-detail" class="pt-detail"></div>
    </div>`;

  renderDetail();
  applyCategoryFilter();
  highlight(pt.selectedZ);
  bind();
}

function bind() {
  pt.root.querySelectorAll(".pt-cell[data-z]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (pt.playing) stopTour();
      selectElement(Number(btn.dataset.z));
    });
  });

  pt.root.querySelectorAll(".pt-legend-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      toggleFocusCategory(btn.dataset.cat || "all");
      applyCategoryFilter();
    });
  });

  pt.root.querySelector("#pt-voice-select")?.addEventListener("change", (e) => {
    saveVoiceUri(e.target.value);
  });
  pt.root.querySelector("#pt-rate-select")?.addEventListener("change", (e) => {
    saveRate(Number(e.target.value));
  });

  pt.root.querySelector("#pt-listen")?.addEventListener("click", () => {
    unlockSpeech();
    void speakTour();
  });

  pt.root.querySelector("#pt-stop")?.addEventListener("click", () => {
    stopTour();
    setStatus("Stopped.");
  });

  const startQuiz = (difficulty) => {
    stopTour();
    applyCategoryFilter();
    const cats = [...(pt.focusCategories || [])];
    const focus = elementsForScope(cats);
    const all = pt.data?.elements || [];
    pt.onStartQuiz?.({
      focus,
      all,
      categoryLabels: pt.data?.categoryLabels || {},
      scopeLabel: scopeLabel(cats),
      scopeId: scopeId(cats),
      difficulty,
    });
  };

  pt.root.querySelector("#pt-quiz-easy")?.addEventListener("click", () => {
    startQuiz("easy");
  });
  pt.root.querySelector("#pt-quiz-hard")?.addEventListener("click", () => {
    startQuiz("hard");
  });

  bindDetailSpeech();
}

export async function renderPeriodicTable({ els, onStartQuiz = null }) {
  pt.root = els.periodicTable;
  pt.onStartQuiz = onStartQuiz;
  pt.canSpeak = speechSupported();
  if (pt.canSpeak) {
    try {
      pt.voices = await listEnglishVoices();
    } catch {
      pt.voices = [];
    }
  }
  try {
    const res = await fetch(DATA_PATH);
    if (!res.ok) throw new Error(`Failed to load ${DATA_PATH}`);
    pt.data = await res.json();
    if (!pt.selectedZ) pt.selectedZ = 1;
    render();
  } catch (err) {
    pt.root.innerHTML = `<p class="error">${escapeHtml(err.message)}</p>`;
  }
}

export function cleanupPeriodicTable() {
  stopTour();
}
