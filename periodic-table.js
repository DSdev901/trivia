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
  focusCategory: "all",
  voices: [],
  canSpeak: false,
  playing: false,
  tourIds: [],
  tourSession: 0,
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

function applyCategoryFilter() {
  if (!pt.root) return;
  const cat = pt.focusCategory;
  pt.root.querySelectorAll(".pt-cell[data-z]").forEach((cell) => {
    const z = Number(cell.dataset.z);
    const el = byZ(z);
    const on = cat === "all" || el?.category === cat;
    cell.classList.toggle("is-dim", !on);
  });
  pt.root.querySelectorAll(".pt-legend-btn").forEach((btn) => {
    btn.classList.toggle("is-on", btn.dataset.cat === cat);
  });
  const sel = pt.root.querySelector("#pt-group-select");
  if (sel) sel.value = cat;
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

async function speakTour(category) {
  const list = (pt.data.elements || []).filter(
    (e) => category === "all" || e.category === category
  );
  if (!list.length) {
    setStatus("No elements in that group.");
    return;
  }
  stopSpeech();
  const session = (pt.tourSession += 1);
  pt.playing = true;
  pt.tourIds = list.map((e) => e.Z);
  pt.root?.querySelector(".pt-shell")?.classList.add("is-speaking");
  const listen = pt.root?.querySelector("#pt-listen");
  if (listen) listen.disabled = true;

  const label = category === "all" ? "all elements" : labelFor(category);
  setStatus(`Touring ${label} (${list.length})…`);

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
  const options = [
    `<option value="all">All elements</option>`,
    ...CATEGORY_ORDER.map(
      (c) =>
        `<option value="${escapeHtml(c)}" ${
          pt.focusCategory === c ? "selected" : ""
        }>${escapeHtml(labelFor(c))}</option>`
    ),
  ].join("");
  return `
    <section class="speech-panel pt-speech" aria-label="Read aloud">
      <div class="speech-panel-top">
        <div>
          <p class="speech-kicker">Read aloud</p>
          <p class="speech-lede">Hear each element’s number, name, discovery, and facts — the table highlights as it goes.</p>
        </div>
        <div class="speech-actions" role="group" aria-label="Playback">
          <button type="button" class="speech-btn speech-btn-primary" id="pt-listen">Listen</button>
          <button type="button" class="speech-btn speech-btn-quiet" id="pt-stop">Stop</button>
        </div>
      </div>
      <div class="speech-settings">
        <label class="voice-field">
          <span>Tour</span>
          <select id="pt-group-select">${options}</select>
        </label>
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
    </section>`;
}

function legendHtml() {
  return `
    <div class="pt-legend" role="group" aria-label="Element categories">
      <button type="button" class="pt-legend-btn is-on" data-cat="all">All</button>
      ${CATEGORY_ORDER.map(
        (c) =>
          `<button type="button" class="pt-legend-btn pt-cat-${escapeHtml(
            c
          )}" data-cat="${escapeHtml(c)}">${escapeHtml(labelFor(c))}</button>`
      ).join("")}
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
            Use Listen to hear a full tour — or just one group, like the noble gases.</p>
        </div>
      </div>
      ${speechPanelHtml()}
      ${legendHtml()}
      <div class="pt-stage">
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
      pt.focusCategory = btn.dataset.cat || "all";
      applyCategoryFilter();
    });
  });

  pt.root.querySelector("#pt-group-select")?.addEventListener("change", (e) => {
    pt.focusCategory = e.target.value || "all";
    applyCategoryFilter();
  });

  pt.root.querySelector("#pt-voice-select")?.addEventListener("change", (e) => {
    saveVoiceUri(e.target.value);
  });
  pt.root.querySelector("#pt-rate-select")?.addEventListener("change", (e) => {
    saveRate(Number(e.target.value));
  });

  pt.root.querySelector("#pt-listen")?.addEventListener("click", () => {
    const cat = pt.root.querySelector("#pt-group-select")?.value || "all";
    pt.focusCategory = cat;
    applyCategoryFilter();
    void speakTour(cat);
  });

  pt.root.querySelector("#pt-stop")?.addEventListener("click", () => {
    stopTour();
    setStatus("Stopped.");
  });

  bindDetailSpeech();
}

export async function renderPeriodicTable({ els }) {
  pt.root = els.periodicTable;
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
