import {
  buildEasyElementQuestions,
  buildElementQuestions,
  buildMovieQuestions,
  buildPresidentQuestions,
  createRotation,
  currentQuestion,
  keepInRotation,
  recordAnswer,
  removeFromRotation,
} from "./quiz.js";
import {
  clearFlags,
  factFlagId,
  flagCount,
  flagsAsText,
  isFlagged,
  listFlags,
  quizFlagId,
  removeFlag,
  toggleFlag,
} from "./flags.js";
import { isLocalHost } from "./env.js";
import {
  getDefaultBrowserVoiceUri,
  getSavedLoops,
  getSavedRate,
  getSavedVoiceUri,
  listEnglishVoices,
  prepareSpokenLine,
  saveLoops,
  saveRate,
  saveVoiceUri,
  speakLines,
  speechSupported,
  stopSpeech,
  toConversationalSpeech,
  toMovieQuestionSpeech,
  unlockSpeech,
  voiceQualityTip,
} from "./speech.js";
import { renderCurrentEvents } from "./current-events.js";
import {
  cleanupPeriodicTable,
  renderPeriodicTable,
} from "./periodic-table.js";
import {
  cleanupGeography,
  renderGeography,
} from "./geography.js";
import {
  capturedCanGoBack,
  capturedGoBack,
  cleanupCaptured,
  renderCaptured,
} from "./captured.js";
import { crumbsHtml, hashPath, href, parseHash } from "./routes.js";

const els = {
  nav: document.getElementById("nav"),
  backBtn: document.getElementById("back-btn"),
  homeBtn: document.getElementById("home-btn"),
  categories: document.getElementById("view-categories"),
  hub: document.getElementById("view-hub"),
  batches: document.getElementById("view-batches"),
  presidents: document.getElementById("view-presidents"),
  detail: document.getElementById("view-detail"),
  quizSetup: document.getElementById("view-quiz-setup"),
  quiz: document.getElementById("view-quiz"),
  quizDone: document.getElementById("view-quiz-done"),
  flags: document.getElementById("view-flags"),
  currentEvents: document.getElementById("view-current-events"),
  periodicTable: document.getElementById("view-periodic-table"),
  geography: document.getElementById("view-geography"),
  captured: document.getElementById("view-captured"),
};

const VIEWS = [
  "categories",
  "hub",
  "batches",
  "presidents",
  "detail",
  "quizSetup",
  "quiz",
  "quizDone",
  "flags",
  "currentEvents",
  "periodicTable",
  "geography",
  "captured",
];

const state = {
  categories: [],
  category: null,
  batch: null,
  president: null,
  view: "categories",
  quiz: null,
  lastResult: null,
};

function scrollPageTop() {
  window.scrollTo(0, 0);
}

function show(view) {
  const changed = state.view !== view;
  state.view = view;
  for (const key of VIEWS) {
    const el = els[key];
    if (!el) continue;
    el.hidden = key !== view;
  }
  els.nav.hidden = view === "categories";
  els.backBtn.hidden = view === "categories";
  if (changed) scrollPageTop();
}

function batchLabel(category, n) {
  const meta = category.batches?.find((b) => b.n === n);
  if (meta) return meta.label;
  if (category?.type === "presidents" && n < category.batchCount) {
    return `Presidents ${(n - 1) * 10 + 1}–${n * 10}`;
  }
  return `Section ${n}`;
}

function nextStudyNavHtml(category, batchNumber) {
  const unit = category.type === "movies" ? "round" : "section";
  const total = category.batchCount;
  if (batchNumber < total) {
    const next = batchNumber + 1;
    const label = batchLabel(category, next);
    return `
    <div class="batch-next-row">
      <a class="primary-btn" href="${href([category.id, "study", String(next)])}">Next ${unit}: ${escapeHtml(label)}</a>
    </div>`;
  }
  return `
    <div class="batch-next-row">
      <a class="secondary-btn" href="${href([category.id, "study"])}">Back to ${unit}s</a>
    </div>`;
}

async function loadJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load ${path}`);
  return res.json();
}

async function loadBatch(category, batchNumber) {
  const path = category.batchPath.replace("{n}", String(batchNumber).padStart(2, "0"));
  return loadJSON(path);
}

function categoryMetaLabel(category) {
  if (category?.type === "current-events") {
    return "briefing · live feed";
  }
  if (category?.type === "netflix") {
    return "shows · movies";
  }
  if (category?.type === "periodic-table") {
    return "118 elements · tours & quiz";
  }
  if (category?.type === "geography") {
    return "maps · pin · capitals · flags";
  }
  if (category?.type === "captured") {
    return "questions · search";
  }
  if (category?.type === "movies") {
    return `${category.batchCount} rounds · listen & quiz`;
  }
  return `${category.batchCount} sections`;
}

function renderCategories(categories) {
  els.categories.innerHTML = `
    <div class="grid">
      ${categories
        .map(
          (c) => `
        <a class="category-card" href="${href([c.id])}">
          <h2>${c.name}</h2>
          <p>${c.description}</p>
          <span class="meta">${categoryMetaLabel(c)}</span>
        </a>`
        )
        .join("")}
    </div>
  `;
}

function openCategory(id) {
  goToHash([id]);
}

function renderHub(category) {
  const flagged = flagCount(category.id);
  // Flag-for-replacement is a local authoring tool — hidden on the live site.
  const canFlag = isLocalHost();

  els.hub.innerHTML = `
    ${crumbsHtml(
      [
        { label: category.name, href: href([category.id]) },
      ],
      escapeHtml
    )}
    <h2 class="section-title">${category.name}</h2>
    <p class="lede">${
      canFlag
        ? "Study the material, or quiz yourself until every question is cleared from rotation. Flag weak facts while reviewing so they can be replaced later."
        : "Study the material, or quiz yourself until every question is cleared from rotation."
    }</p>
    <div class="hub-actions">
      <a class="hub-card" href="${href([category.id, "study"])}">
        <h3>Study</h3>
        <p>${
          category.type === "movies"
            ? `Browse ${category.batchCount} rounds and review each question and answer.`
            : "Browse sections and review each president’s facts."
        }</p>
      </a>
      <a class="hub-card hub-card-accent" href="${href([category.id, "quiz"])}">
        <h3>Quiz</h3>
        <p>${
          category.type === "movies"
            ? "Pick one or more rounds and work through multiple-choice questions."
            : "Pick one or more sections and work through multiple-choice questions."
        }</p>
      </a>
      ${
        canFlag
          ? `<a class="hub-card" href="${href([category.id, "flags"])}">
        <h3>Flagged for replacement</h3>
        <p>${
          flagged
            ? `${flagged} item${flagged === 1 ? "" : "s"} waiting to be rewritten.`
            : "Nothing flagged yet. Use Flag on any fact or quiz question."
        }</p>
      </a>`
          : ""
      }
    </div>
  `;
}

function startElementQuiz({
  focus,
  all,
  categoryLabels,
  scopeLabel,
  scopeId,
  difficulty = "hard",
}) {
  cleanupPeriodicTable();
  const easy = difficulty === "easy";
  const questions = easy
    ? buildEasyElementQuestions(focus, all, categoryLabels)
    : buildElementQuestions(focus, all, categoryLabels);
  if (!questions.length) {
    alert("Not enough element data to build a quiz for this group.");
    return;
  }
  state.quiz = {
    mode: "elements",
    difficulty: easy ? "easy" : "hard",
    scopeLabel,
    scopeId,
    focus,
    all,
    categoryLabels,
    rotation: createRotation(questions),
    total: questions.length,
  };
  state.lastResult = null;
  const modeLabel = easy ? "Easy" : "Hard";
  renderQuizQuestion();
  show("quiz");
}

function renderBatches(category) {
  const unit = category.type === "movies" ? "Round" : "Section";
  const cards = Array.from({ length: category.batchCount }, (_, i) => {
    const n = i + 1;
    return `
      <a class="batch-card" href="${href([category.id, "study", String(n)])}">
        <h2>${unit} ${n}</h2>
        <p>${batchLabel(category, n)}</p>
        <span class="meta">Study mode</span>
      </a>`;
  }).join("");

  els.batches.innerHTML = `
    ${crumbsHtml(
      [
        { label: category.name, href: href([category.id]) },
        { label: "Study", href: href([category.id, "study"]) },
      ],
      escapeHtml
    )}
    <h2 class="section-title">Choose a ${unit.toLowerCase()}</h2>
    <div class="batch-grid">${cards}</div>
  `;
}

async function openBatch(batchNumber) {
  try {
    const batch = await loadBatch(state.category, batchNumber);
    state.batch = batch;
    state.president = null;
    if (state.category.type === "movies") {
      await renderMovieRound(batch);
    } else {
      renderPresidents(batch);
    }
    show("presidents");
  } catch (err) {
    els.batches.innerHTML = `<p class="error">${err.message}</p>`;
    show("batches");
  }
}

function renderPresidents(batch) {
  const category = state.category;
  els.presidents.innerHTML = `
    ${crumbsHtml(
      [
        { label: category.name, href: href([category.id]) },
        { label: "Study", href: href([category.id, "study"]) },
        {
          label: batchLabel(category, batch.batch),
          href: href([category.id, "study", String(batch.batch)]),
        },
      ],
      escapeHtml
    )}
    <h2 class="section-title">Section ${batch.batch}: Presidents ${batch.range}</h2>
    <div class="president-list">
      ${batch.presidents
        .map(
          (p, i) => `
        <button type="button" class="president-btn" data-index="${i}">
          <span class="num">#${p.number}</span>
          <span class="name">${p.name}</span>
          <span class="years">${p.served}</span>
        </button>`
        )
        .join("")}
    </div>
    ${nextStudyNavHtml(category, batch.batch)}
  `;

  els.presidents.querySelectorAll(".president-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      openPresident(batch.presidents[Number(btn.dataset.index)]);
    });
  });
}

function stopAllSpeech() {
  stopSpeech();
}

async function getSpeechChrome() {
  const canSpeak = speechSupported();
  const rankedVoices = canSpeak ? await listEnglishVoices() : [];
  const defaultUri = canSpeak ? await getDefaultBrowserVoiceUri() : "";
  const savedUri = getSavedVoiceUri();
  const selectedUri =
    (savedUri && rankedVoices.some((v) => v.uri === savedUri) && savedUri) ||
    defaultUri ||
    rankedVoices[0]?.uri ||
    "";
  if (!savedUri && selectedUri) saveVoiceUri(selectedUri);
  return {
    canSpeak,
    rankedVoices,
    selectedUri,
    savedRate: getSavedRate(),
    savedLoops: getSavedLoops(),
    tip: canSpeak
      ? voiceQualityTip(rankedVoices)
      : "Read-aloud needs a Chromium browser with sound allowed (Brave/Chrome/Edge).",
  };
}

function speechPanelHtml(foldId, lede, chrome) {
  const { rankedVoices, selectedUri, savedRate, savedLoops, canSpeak, tip } = chrome;
  const loopOptions = Array.from({ length: 10 }, (_, i) => {
    const n = i + 1;
    return `<option value="${n}" ${savedLoops === n ? "selected" : ""}>${n}${
      n === 1 ? " (default)" : ""
    }</option>`;
  }).join("");
  return `
        <section class="speech-panel" aria-label="Read aloud">
          <input type="checkbox" class="speech-fold" id="${foldId}" aria-label="Show read-aloud options" />
          <div class="speech-panel-head">
            <label class="speech-fold-label" for="${foldId}">Read aloud</label>
            <div class="speech-copy">
              <p class="speech-kicker speech-kicker-wide">Read aloud</p>
              <p class="speech-lede speech-lede-wide">${lede}</p>
            </div>
            <div class="speech-actions" role="group" aria-label="Playback">
              <button type="button" class="speech-btn speech-btn-primary" id="listen-all">Listen</button>
              <button type="button" class="speech-btn speech-btn-quiet" id="stop-speech">Stop</button>
            </div>
          </div>
          <div class="speech-panel-body">
            <p class="speech-lede speech-lede-mobile">${lede}</p>
            <div class="speech-settings">
            <label class="voice-field">
              <span>Voice</span>
              <select id="voice-select" ${rankedVoices.length ? "" : "disabled"}>
                ${
                  rankedVoices.length
                    ? rankedVoices
                        .map(
                          (v) =>
                            `<option value="${escapeHtml(v.uri)}" ${
                              v.uri === selectedUri ? "selected" : ""
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
              <select id="rate-select">
                <option value="0.8" ${savedRate === 0.8 ? "selected" : ""}>Slower</option>
                <option value="0.9" ${savedRate === 0.9 ? "selected" : ""}>Natural</option>
                <option value="1" ${savedRate === 1 ? "selected" : ""}>Faster</option>
              </select>
            </label>
            <label class="voice-field">
              <span>Loops</span>
              <select id="loop-select">${loopOptions}</select>
            </label>
            </div>
            <p class="speech-status" id="speech-status">${escapeHtml(tip)}</p>
          </div>
        </section>`;
}

function bindSpeechPanel(root, chrome, { getLines, highlight }) {
  const { canSpeak, selectedUri, savedRate, savedLoops, tip } = chrome;
  const statusEl = root.querySelector("#speech-status");
  const stopBtn = root.querySelector("#stop-speech");
  const voiceSelect = root.querySelector("#voice-select");
  const rateSelect = root.querySelector("#rate-select");
  const loopSelect = root.querySelector("#loop-select");
  const listenBtn = root.querySelector("#listen-all");
  const speechPanel = root.querySelector(".speech-panel");

  function currentTip() {
    return canSpeak
      ? tip
      : "Read-aloud needs a Chromium browser with sound allowed (Brave/Chrome/Edge).";
  }

  function setSpeakingUI(active, message = "") {
    if (stopBtn) {
      stopBtn.disabled = !active;
      stopBtn.classList.toggle("is-active-stop", active);
    }
    if (listenBtn) {
      listenBtn.disabled = active;
      listenBtn.classList.toggle("is-playing", active);
    }
    speechPanel?.classList.toggle("is-live", active);
    if (statusEl) statusEl.textContent = message || currentTip();
    if (!active) highlight?.(-1);
  }

  setSpeakingUI(false, tip);

  async function playAll() {
    if (!canSpeak) {
      setSpeakingUI(
        false,
        "Browser speech isn’t available. Allow sound in Brave, then hard-refresh."
      );
      return;
    }
    const lines = getLines().map((line) => prepareSpokenLine(line));
    const loops = Number(loopSelect?.value || savedLoops) || 1;
    setSpeakingUI(true, loops > 1 ? `Starting… (${loops} loops)` : "Starting…");
    try {
      await speakLines(lines, {
        voiceUri: voiceSelect?.value || selectedUri,
        rate: Number(rateSelect?.value || savedRate),
        loops,
        loopPadMs: 7000,
        onStartLine: (lineIndex) => highlight?.(lineIndex),
        onStatus: (msg) => {
          if (statusEl) statusEl.textContent = msg;
        },
        onEnd: () => setSpeakingUI(false, ""),
      });
      setSpeakingUI(false, "");
    } catch (err) {
      setSpeakingUI(false, err.message);
    }
  }

  voiceSelect?.addEventListener("change", () => {
    saveVoiceUri(voiceSelect.value);
    stopAllSpeech();
    setSpeakingUI(false, `Voice set to “${voiceSelect.selectedOptions[0]?.text || "selected"}”.`);
  });
  rateSelect?.addEventListener("change", () => {
    saveRate(Number(rateSelect.value));
  });
  loopSelect?.addEventListener("change", () => {
    saveLoops(Number(loopSelect.value));
  });
  listenBtn?.addEventListener("click", () => {
    unlockSpeech();
    playAll();
  });
  stopBtn?.addEventListener("click", () => {
    stopAllSpeech();
    setSpeakingUI(false, "");
  });
}

async function renderMovieRound(batch) {
  const category = state.category;
  const title = batch.title || batch.range || batchLabel(category, batch.batch);
  const chrome = await getSpeechChrome();
  if (state.batch !== batch) return;
  const canFlag = isLocalHost();

  els.presidents.innerHTML = `
    ${crumbsHtml(
      [
        { label: category.name, href: href([category.id]) },
        { label: "Study", href: href([category.id, "study"]) },
        {
          label: batchLabel(category, batch.batch),
          href: href([category.id, "study", String(batch.batch)]),
        },
      ],
      escapeHtml
    )}
    <h2 class="section-title">Round ${batch.batch}: ${escapeHtml(title)}</h2>
    <p class="lede">Ten pub-quiz questions. Expand a card for the answer, or listen to the whole round.</p>
    ${speechPanelHtml("speech-fold-movies-round", "Hear this round’s questions and answers in order.", chrome)}
    <div class="president-list movie-q-list">
      ${batch.questions
        .map((q, i) => {
          const ansId = `movie-ans-${batch.batch}-${i}`;
          const flagId = factFlagId(state.category.id, `${batch.batch}-${i}`, 0);
          const flagged = canFlag && isFlagged(flagId);
          return `
        <article class="movie-q" data-index="${i}">
          <button type="button" class="movie-q-toggle" data-index="${i}" aria-expanded="false" aria-controls="${ansId}">
            <span class="num">#${i + 1}</span>
            <span class="prompt">${escapeHtml(q.question)}</span>
            <svg class="movie-q-chevron" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path fill="currentColor" d="M9.4 6.6a1 1 0 0 1 1.4 0l5.2 5.2a1 1 0 0 1 0 1.4l-5.2 5.2a1 1 0 1 1-1.4-1.4L13.9 12 9.4 7.6a1 1 0 0 1 0-1.4Z"/>
            </svg>
          </button>
          <div class="movie-q-answer" id="${ansId}" hidden>
            <div class="movie-q-answer-inner">
              <p class="movie-q-answer-text">${escapeHtml(q.answer)}</p>
              ${q.note ? `<p class="movie-q-note">${escapeHtml(q.note)}</p>` : ""}
              ${
                canFlag
                  ? `<button type="button" class="flag-btn movie-q-flag ${flagged ? "is-on" : ""}" data-index="${i}">${
                      flagged ? "Flagged" : "Flag for replacement"
                    }</button>`
                  : ""
              }
            </div>
          </div>
        </article>`;
        })
        .join("")}
    </div>
    ${nextStudyNavHtml(category, batch.batch)}
  `;

  function setMovieOpen(card, open) {
    const btn = card.querySelector(".movie-q-toggle");
    const panel = card.querySelector(".movie-q-answer");
    card.classList.toggle("is-open", open);
    btn?.setAttribute("aria-expanded", String(open));
    if (panel) panel.hidden = !open;
  }

  bindSpeechPanel(els.presidents, chrome, {
    getLines: () =>
      batch.questions.map((q, i) => toMovieQuestionSpeech(q, i + 1)),
    highlight: (lineIndex) => {
      els.presidents.querySelectorAll(".movie-q").forEach((card) => {
        const on = Number(card.dataset.index) === lineIndex;
        card.classList.toggle("is-speaking", on);
        if (on) setMovieOpen(card, true);
      });
    },
  });

  els.presidents.querySelectorAll(".movie-q-toggle").forEach((btn) => {
    btn.addEventListener("click", () => {
      const card = btn.closest(".movie-q");
      if (!card) return;
      setMovieOpen(card, !card.classList.contains("is-open"));
    });
  });

  els.presidents.querySelectorAll(".movie-q-flag").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      const index = Number(btn.dataset.index);
      const item = batch.questions[index];
      const id = factFlagId(state.category.id, `${batch.batch}-${index}`, 0);
      const now = toggleFlag({
        id,
        type: "fact",
        categoryId: state.category.id,
        presidentNumber: `${batch.batch}-${index}`,
        presidentName: item.answer,
        factIndex: 0,
        batch: batch.batch,
        text: `${item.question} → ${item.answer}`,
      });
      btn.classList.toggle("is-on", now);
      btn.textContent = now ? "Flagged" : "Flag for replacement";
    });
  });
}

function openPresident(president) {
  state.president = president;
  renderPresidentDetail();
  show("detail");
}

async function renderPresidentDetail() {
  const president = state.president;
  const batchNum = state.batch.batch;
  const canSpeak = speechSupported();
  const rankedVoices = canSpeak ? await listEnglishVoices() : [];
  const defaultUri = canSpeak ? await getDefaultBrowserVoiceUri() : "";
  const savedUri = getSavedVoiceUri();
  const selectedUri =
    (savedUri && rankedVoices.some((v) => v.uri === savedUri) && savedUri) ||
    defaultUri ||
    rankedVoices[0]?.uri ||
    "";
  if (!savedUri && selectedUri) saveVoiceUri(selectedUri);
  const savedRate = getSavedRate();
  const savedLoops = getSavedLoops();
  const tip = canSpeak
    ? voiceQualityTip(rankedVoices)
    : "Read-aloud needs a Chromium browser with sound allowed (Brave/Chrome/Edge).";

  if (state.view !== "detail" || state.president !== president) return;

  const loopOptions = Array.from({ length: 10 }, (_, i) => {
    const n = i + 1;
    return `<option value="${n}" ${savedLoops === n ? "selected" : ""}>${n}${
      n === 1 ? " (default)" : ""
    }</option>`;
  }).join("");

  els.detail.innerHTML = `
    <article class="detail">
      <header class="detail-header">
        <p class="detail-number">President #${president.number}</p>
        <h1>${president.name}</h1>
        <p class="detail-served">Served ${president.served}</p>
        ${
          isLocalHost()
            ? `<p class="flag-hint">Flag any weak fact for replacement — it saves on this device.</p>`
            : ""
        }
        <section class="speech-panel" aria-label="Read aloud">
          <input type="checkbox" class="speech-fold" id="speech-fold-president" aria-label="Show read-aloud options" />
          <div class="speech-panel-head">
            <label class="speech-fold-label" for="speech-fold-president">Read aloud</label>
            <div class="speech-copy">
              <p class="speech-kicker speech-kicker-wide">Read aloud</p>
              <p class="speech-lede speech-lede-wide">Hear this president’s facts in order.</p>
            </div>
            <div class="speech-actions" role="group" aria-label="Playback">
              <button type="button" class="speech-btn speech-btn-primary" id="listen-all">Listen</button>
              <button type="button" class="speech-btn speech-btn-quiet" id="stop-speech">Stop</button>
            </div>
          </div>
          <div class="speech-panel-body">
            <p class="speech-lede speech-lede-mobile">Hear this president’s facts in order.</p>
            <div class="speech-settings">
            <label class="voice-field">
              <span>Voice</span>
              <select id="voice-select" ${rankedVoices.length ? "" : "disabled"}>
                ${
                  rankedVoices.length
                    ? rankedVoices
                        .map(
                          (v) =>
                            `<option value="${escapeHtml(v.uri)}" ${
                              v.uri === selectedUri ? "selected" : ""
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
              <select id="rate-select">
                <option value="0.8" ${savedRate === 0.8 ? "selected" : ""}>Slower</option>
                <option value="0.9" ${savedRate === 0.9 ? "selected" : ""}>Natural</option>
                <option value="1" ${savedRate === 1 ? "selected" : ""}>Faster</option>
              </select>
            </label>
            <label class="voice-field">
              <span>Loops</span>
              <select id="loop-select">${loopOptions}</select>
            </label>
            </div>
            <p class="speech-status" id="speech-status">${escapeHtml(tip)}</p>
          </div>
        </section>
      </header>
      <ol class="facts">
        ${president.trivia
          .map((fact, i) => {
            const canFlag = isLocalHost();
            const id = factFlagId(state.category.id, president.number, i);
            const flagged = canFlag && isFlagged(id);
            return `
              <li data-n="${i + 1}" class="${flagged ? "is-flagged" : ""}" data-fact-index="${i}">
                <div class="fact-text">${escapeHtml(fact)}</div>
                ${
                  canFlag
                    ? `<div class="fact-actions">
                  <button type="button" class="flag-btn ${flagged ? "is-on" : ""}" data-index="${i}" aria-pressed="${flagged}">
                    ${flagged ? "Flagged" : "Flag for replacement"}
                  </button>
                </div>`
                    : ""
                }
              </li>`;
          })
          .join("")}
      </ol>
    </article>
  `;

  const statusEl = document.getElementById("speech-status");
  const stopBtn = document.getElementById("stop-speech");
  const voiceSelect = document.getElementById("voice-select");
  const rateSelect = document.getElementById("rate-select");
  const loopSelect = document.getElementById("loop-select");

  function currentTip() {
    return canSpeak
      ? voiceQualityTip(rankedVoices)
      : "Read-aloud needs a Chromium browser with sound allowed (Brave/Chrome/Edge).";
  }

  const listenBtn = document.getElementById("listen-all");

  const speechPanel = els.detail.querySelector(".speech-panel");

  function setSpeakingUI(active, message = "") {
    if (stopBtn) {
      stopBtn.disabled = !active;
      stopBtn.classList.toggle("is-active-stop", active);
    }
    if (listenBtn) {
      listenBtn.disabled = active;
      listenBtn.classList.toggle("is-playing", active);
    }
    speechPanel?.classList.toggle("is-live", active);
    if (statusEl) statusEl.textContent = message || currentTip();
    if (!active) {
      els.detail.querySelectorAll(".facts li").forEach((li) => {
        li.classList.remove("is-speaking");
      });
    }
  }

  setSpeakingUI(false, tip);

  function highlightFact(index) {
    els.detail.querySelectorAll(".facts li").forEach((li) => {
      li.classList.toggle("is-speaking", Number(li.dataset.factIndex) === index);
    });
  }

  async function playFacts(indices) {
    if (!canSpeak) {
      setSpeakingUI(
        false,
        "Browser speech isn’t available. Allow sound in Brave, then hard-refresh."
      );
      return;
    }
    const lines = indices.map((i) =>
      prepareSpokenLine(toConversationalSpeech(president, president.trivia[i], i + 1))
    );
    const loops = Number(loopSelect?.value || savedLoops) || 1;
    setSpeakingUI(true, loops > 1 ? `Starting… (${loops} loops)` : "Starting…");
    try {
      await speakLines(lines, {
        voiceUri: voiceSelect?.value || selectedUri,
        rate: Number(rateSelect?.value || savedRate),
        loops,
        loopPadMs: 7000,
        onStartLine: (lineIndex) => highlightFact(indices[lineIndex]),
        onStatus: (msg) => {
          if (statusEl) statusEl.textContent = msg;
        },
        onEnd: () => setSpeakingUI(false, ""),
      });
      setSpeakingUI(false, "");
    } catch (err) {
      setSpeakingUI(false, err.message);
    }
  }

  voiceSelect?.addEventListener("change", () => {
    saveVoiceUri(voiceSelect.value);
    stopAllSpeech();
    setSpeakingUI(false, `Voice set to “${voiceSelect.selectedOptions[0]?.text || "selected"}”.`);
  });

  rateSelect?.addEventListener("change", () => {
    saveRate(Number(rateSelect.value));
  });

  loopSelect?.addEventListener("change", () => {
    saveLoops(Number(loopSelect.value));
  });

  listenBtn?.addEventListener("click", () => {
    unlockSpeech();
    playFacts(president.trivia.map((_, i) => i));
  });

  stopBtn?.addEventListener("click", () => {
    stopAllSpeech();
    setSpeakingUI(false, "");
  });

  els.detail.querySelectorAll(".flag-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      stopAllSpeech();
      const factIndex = Number(btn.dataset.index);
      const id = factFlagId(state.category.id, president.number, factIndex);
      toggleFlag({
        id,
        type: "fact",
        categoryId: state.category.id,
        presidentNumber: president.number,
        presidentName: president.name,
        factIndex,
        batch: batchNum,
        text: president.trivia[factIndex],
      });
      renderPresidentDetail();
    });
  });
}

function renderFlags() {
  if (!isLocalHost()) {
    goHome();
    return;
  }
  const flags = listFlags(state.category.id);
  els.flags.innerHTML = `
    ${crumbsHtml(
      [
        { label: state.category.name, href: href([state.category.id]) },
        { label: "Flagged", href: href([state.category.id, "flags"]) },
      ],
      escapeHtml
    )}
    <h2 class="section-title">Flagged for replacement</h2>
    <p class="lede">These stay on this browser until you clear them. Copy the list when you want them rewritten.</p>
    ${
      flags.length
        ? `<div class="flag-list">
            ${flags
              .map(
                (f) => `
              <article class="flag-card">
                <header>
                  <span class="flag-type">${f.type === "fact" ? "Study fact" : "Quiz question"}</span>
                  <button type="button" class="text-btn unflag-btn" data-id="${escapeHtml(f.id)}">Unflag</button>
                </header>
                <p class="flag-meta">${
                  f.type === "fact"
                    ? `Section ${f.batch ?? "?"} · #${f.presidentNumber} ${escapeHtml(f.presidentName)} · fact ${f.factIndex + 1}`
                    : `Quiz ID: ${escapeHtml(f.questionId)}`
                }</p>
                <p class="flag-text">${escapeHtml(f.text)}</p>
              </article>`
              )
              .join("")}
          </div>
          <div class="setup-actions" style="margin-top: 1.25rem">
            <button type="button" class="primary-btn" id="copy-flags">Copy list</button>
            <button type="button" class="secondary-btn" id="clear-flags">Clear all flags</button>
          </div>
          <p class="copy-status" id="copy-status" hidden></p>`
        : `<p class="empty-flags">No flagged items yet. In Study, open a president and tap <strong>Flag for replacement</strong> on any fact. In Quiz, you can flag after answering.</p>`
    }
  `;

  els.flags.querySelectorAll(".unflag-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      removeFlag(btn.dataset.id);
      renderFlags();
    });
  });

  const copyBtn = document.getElementById("copy-flags");
  if (copyBtn) {
    copyBtn.addEventListener("click", async () => {
      const text = flagsAsText(state.category.id);
      const status = document.getElementById("copy-status");
      try {
        await navigator.clipboard.writeText(text);
        status.hidden = false;
        status.textContent = "Copied to clipboard.";
      } catch {
        status.hidden = false;
        status.textContent = "Could not copy automatically — select and copy manually.";
      }
    });
  }

  const clearBtn = document.getElementById("clear-flags");
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      if (confirm("Clear all flagged items for this category?")) {
        clearFlags(state.category.id);
        renderFlags();
      }
    });
  }
}

function renderQuizSetup(category) {
  const unit = category.type === "movies" ? "Round" : "Section";
  const options = Array.from({ length: category.batchCount }, (_, i) => {
    const n = i + 1;
    return `
      <label class="batch-check">
        <input type="checkbox" name="quiz-batch" value="${n}" checked />
        <span class="batch-check-body">
          <strong>${unit} ${n}</strong>
          <span>${batchLabel(category, n)}</span>
        </span>
      </label>`;
  }).join("");

  els.quizSetup.innerHTML = `
    ${crumbsHtml(
      [
        { label: category.name, href: href([category.id]) },
        { label: "Quiz", href: href([category.id, "quiz"]) },
      ],
      escapeHtml
    )}
    <h2 class="section-title">Quiz setup</h2>
    <p class="lede">Select the ${
      category.type === "movies" ? "rounds" : "sections"
    } to include. After each answer you’ll see if you were right, then choose whether to keep that question in rotation.</p>
    <div class="batch-check-list" id="quiz-batch-list">${options}</div>
    <div class="setup-actions">
      <button type="button" class="text-btn" id="select-all">Select all</button>
      <button type="button" class="text-btn" id="select-none">Select none</button>
      <button type="button" class="primary-btn" id="start-quiz">Start quiz</button>
    </div>
    <p class="setup-error" id="setup-error" hidden></p>
  `;

  const inputs = () => [...els.quizSetup.querySelectorAll('input[name="quiz-batch"]')];

  document.getElementById("select-all").addEventListener("click", () => {
    inputs().forEach((input) => {
      input.checked = true;
    });
  });

  document.getElementById("select-none").addEventListener("click", () => {
    inputs().forEach((input) => {
      input.checked = false;
    });
  });

  document.getElementById("start-quiz").addEventListener("click", () => {
    const selected = inputs()
      .filter((input) => input.checked)
      .map((input) => Number(input.value));
    startQuiz(selected);
  });
}

async function startQuiz(batchNumbers) {
  const errorEl = document.getElementById("setup-error");
  if (!batchNumbers.length) {
    errorEl.hidden = false;
    errorEl.textContent = "Select at least one section.";
    return;
  }

  try {
    errorEl.hidden = true;
    errorEl.textContent = "";
    const batches = await Promise.all(
      batchNumbers.map((n) => loadBatch(state.category, n))
    );

    let questions;
    if (state.category.type === "movies") {
      const items = batches.flatMap((batch) =>
        (batch.questions || []).map((q) => ({ ...q, _batch: batch.batch }))
      );
      questions = buildMovieQuestions(items);
    } else if (state.category.id === "presidents") {
      const presidents = batches.flatMap((batch) =>
        batch.presidents.map((p) => ({ ...p, _batch: batch.batch }))
      );
      questions = buildPresidentQuestions(presidents);
    } else {
      throw new Error("Quiz generation is not available for this category yet.");
    }

    if (questions.length < 1) {
      errorEl.hidden = false;
      errorEl.textContent = "Not enough material to build quiz questions from those sections.";
      return;
    }

    state.quiz = {
      mode: state.category.type === "movies" ? "movies" : "presidents",
      batchNumbers,
      rotation: createRotation(questions),
      total: questions.length,
    };
    state.lastResult = null;
    renderQuizQuestion();
    show("quiz");
  } catch (err) {
    errorEl.hidden = false;
    errorEl.textContent = err.message;
  }
}

function renderQuizQuestion() {
  const { rotation, total } = state.quiz;
  const question = currentQuestion(rotation);

  if (!question) {
    renderQuizDone();
    show("quizDone");
    return;
  }

  scrollPageTop();
  const remaining = rotation.remaining.length;
  const progressRemoved = rotation.removed;
  const answered = rotation.answered;
  const qFlagId = quizFlagId(state.category.id, question.id);
  const flagged = isFlagged(qFlagId);

  const dossier = state.quiz.difficulty === "easy" || question.id.startsWith("el-easy-");

  els.quiz.innerHTML = `
    <div class="quiz-shell">
      <div class="quiz-progress" aria-live="polite">
        <span>${remaining} in rotation</span>
        <span>${progressRemoved} / ${total} cleared</span>
        <span>${answered} answered</span>
      </div>
      <p class="quiz-prompt${dossier ? " quiz-prompt--dossier" : ""}">${escapeHtml(
        question.prompt
      ).replace(/\n/g, "<br />")}</p>
      <div class="choice-list" id="choice-list">
        ${question.choices
          .map(
            (choice, i) => `
          <button type="button" class="choice-btn" data-index="${i}">
            <span class="choice-letter">${String.fromCharCode(65 + i)}</span>
            <span class="choice-text">${escapeHtml(choice)}</span>
          </button>`
          )
          .join("")}
      </div>
      ${
        isLocalHost()
          ? `<div class="quiz-flag-row">
        <button type="button" class="flag-btn ${flagged ? "is-on" : ""}" id="flag-quiz-q" aria-pressed="${flagged}">
          ${flagged ? "Flagged for replacement" : "Flag question for replacement"}
        </button>
      </div>`
          : ""
      }
      <div id="quiz-feedback" class="quiz-feedback" hidden></div>
    </div>
  `;

  document.getElementById("flag-quiz-q")?.addEventListener("click", () => {
    const nowFlagged = toggleFlag({
      id: qFlagId,
      type: "quiz",
      categoryId: state.category.id,
      questionId: question.id,
      text: `${question.prompt.replace(/\n/g, " ")} → ${question.correct}`,
      batch: question.batch,
    });
    const btn = document.getElementById("flag-quiz-q");
    btn.classList.toggle("is-on", nowFlagged);
    btn.setAttribute("aria-pressed", String(nowFlagged));
    btn.textContent = nowFlagged
      ? "Flagged for replacement"
      : "Flag question for replacement";
  });

  els.quiz.querySelectorAll(".choice-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      onAnswer(question.choices[Number(btn.dataset.index)]);
    });
  });
}

function onAnswer(choice) {
  const result = recordAnswer(state.quiz.rotation, choice);
  if (!result) return;
  state.lastResult = result;

  const { question, isCorrect } = result;
  const list = document.getElementById("choice-list");
  list.querySelectorAll(".choice-btn").forEach((btn) => {
    btn.disabled = true;
    const value = question.choices[Number(btn.dataset.index)];
    if (value === question.correct) btn.classList.add("is-correct");
    if (value === choice && !isCorrect) btn.classList.add("is-wrong");
  });

  const feedback = document.getElementById("quiz-feedback");
  feedback.hidden = false;
  feedback.innerHTML = `
    <div class="feedback-banner ${isCorrect ? "feedback-correct" : "feedback-wrong"}">
      <strong>${isCorrect ? "Correct" : "Wrong"}</strong>
      ${
        isCorrect
          ? "<span>Nice work.</span>"
          : `<span>The right answer is <em>${escapeHtml(question.correct)}</em>.</span>`
      }
    </div>
    <p class="feedback-ask">Keep this question in rotation, or clear it?</p>
    <div class="feedback-actions">
      <button type="button" class="primary-btn" id="keep-q">Keep in rotation</button>
      <button type="button" class="secondary-btn" id="remove-q">Remove from rotation</button>
    </div>
  `;

  document.getElementById("keep-q").addEventListener("click", () => {
    keepInRotation(state.quiz.rotation);
    state.lastResult = null;
    renderQuizQuestion();
  });

  document.getElementById("remove-q").addEventListener("click", () => {
    removeFromRotation(state.quiz.rotation);
    state.lastResult = null;
    renderQuizQuestion();
  });
}

function renderQuizDone() {
  const quiz = state.quiz;
  const { rotation, total } = quiz;
  const isElements = quiz.mode === "elements";
  const scopeText = isElements
    ? `${quiz.difficulty === "easy" ? "Easy · " : "Hard · "}${
        quiz.scopeLabel || "Elements"
      }`
    : (quiz.batchNumbers || []).map((n) => `Section ${n}`).join(", ");
  els.quizDone.innerHTML = `
    <div class="quiz-done">
      <h2 class="section-title">Rotation cleared</h2>
      <p class="lede">You’ve removed every question from this quiz.</p>
      <ul class="stats">
        <li><strong>${total}</strong> questions cleared</li>
        <li><strong>${rotation.correctCount}</strong> correct answers</li>
        <li><strong>${rotation.wrongCount}</strong> wrong answers</li>
        <li><strong>${rotation.kept}</strong> times kept for another pass</li>
        <li>${isElements ? "Scope" : "Sections"}: ${escapeHtml(scopeText)}</li>
      </ul>
      <div class="setup-actions">
        <button type="button" class="primary-btn" id="quiz-again">Quiz again</button>
        <button type="button" class="secondary-btn" id="quiz-to-hub">${
          isElements ? "Back to table" : "Back to section"
        }</button>
      </div>
    </div>
  `;

  document.getElementById("quiz-again").addEventListener("click", () => {
    if (isElements) {
      startElementQuiz({
        focus: quiz.focus,
        all: quiz.all,
        categoryLabels: quiz.categoryLabels,
        scopeLabel: quiz.scopeLabel,
        scopeId: quiz.scopeId,
        difficulty: quiz.difficulty || "hard",
      });
      return;
    }
    renderQuizSetup(state.category);
    show("quizSetup");
  });

  document.getElementById("quiz-to-hub").addEventListener("click", () => {
    state.quiz = null;
    if (isElements) goToHash(["periodic-table"]);
    else goToHash([state.category.id]);
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function goToHash(parts) {
  const next = href(parts);
  if (hashPath() === next) {
    void applyRoute();
    return;
  }
  location.hash = next;
}

function setPageTitle(parts) {
  const bits = (parts || []).filter(Boolean);
  document.title = bits.length ? `${bits.join(" · ")} — General Trivia` : "General Trivia";
}

function quizInProgress() {
  return Boolean(state.view === "quiz" && state.quiz?.rotation?.remaining?.length);
}

function confirmLeaveQuiz() {
  if (!quizInProgress()) return true;
  return confirm("Leave this quiz? Your current rotation progress will be lost.");
}

function quizStaysOnRoute(catId, rest) {
  if (!state.quiz || state.category?.id !== catId) return false;
  if (state.quiz.mode === "elements") return catId === "periodic-table";
  return rest[0] === "quiz";
}

let routeSeq = 0;

async function applyRoute() {
  const seq = ++routeSeq;
  const { category: catId, rest } = parseHash();

  if (quizInProgress() && !quizStaysOnRoute(catId, rest)) {
    if (!confirmLeaveQuiz()) {
      const back =
        state.quiz.mode === "elements"
          ? href(["periodic-table"])
          : href([state.category.id, "quiz"]);
      history.replaceState(null, "", back);
      return;
    }
    state.quiz = null;
    state.lastResult = null;
  }

  if (!catId) {
    stopAllSpeech();
    cleanupPeriodicTable();
    cleanupGeography();
    cleanupCaptured();
    state.category = null;
    state.batch = null;
    state.president = null;
    state.quiz = null;
    state.lastResult = null;
    setPageTitle([]);
    show("categories");
    return;
  }

  const category = state.categories.find((c) => c.id === catId);
  if (!category) {
    goToHash([]);
    return;
  }

  if (state.view === "quiz" && quizStaysOnRoute(catId, rest)) return;
  if (state.view === "quizDone" && quizStaysOnRoute(catId, rest)) return;
  if (
    state.view === "detail" &&
    rest[0] === "study" &&
    String(state.batch?.batch) === rest[1]
  ) {
    return;
  }

  stopAllSpeech();
  if (catId !== "geography") cleanupGeography();
  if (catId !== "periodic-table") cleanupPeriodicTable();
  if (catId !== "prior-saucer") cleanupCaptured();

  state.category = category;

  if (category.type === "current-events") {
    show("currentEvents");
    await renderCurrentEvents({ els, mode: "news", tab: rest[0] });
    if (seq !== routeSeq) return;
    const bits = rest[0] === "feed" ? [category.name, "Live feed"] : [category.name];
    setPageTitle(bits);
    return;
  }
  if (category.type === "netflix") {
    show("currentEvents");
    await renderCurrentEvents({ els, mode: "netflix" });
    if (seq !== routeSeq) return;
    setPageTitle([category.name]);
    return;
  }
  if (category.type === "periodic-table") {
    if (state.view !== "periodicTable") {
      void renderPeriodicTable({ els, onStartQuiz: startElementQuiz });
    }
    show("periodicTable");
    setPageTitle([category.name]);
    return;
  }
  if (category.type === "geography") {
    show("geography");
    await renderGeography({
      els,
      groupId: rest[0] || "",
      packId: rest[1] || "",
      mode: rest[2] || "",
    });
    if (seq !== routeSeq) return;
    setPageTitle([category.name, rest[0], rest[1], rest[2]].filter(Boolean));
    return;
  }
  if (category.type === "captured") {
    if (state.view !== "captured") void renderCaptured({ els });
    show("captured");
    setPageTitle([category.name]);
    return;
  }

  if (rest[0] === "study") {
    const n = Number(rest[1]);
    if (n) {
      if (state.batch?.batch === n && state.view === "presidents") {
        setPageTitle([category.name, batchLabel(category, n)]);
        show("presidents");
        return;
      }
      try {
        await openBatch(n);
      } catch {
        /* openBatch renders the error */
      }
      if (seq !== routeSeq) return;
      setPageTitle([category.name, batchLabel(category, n)]);
      return;
    }
    state.batch = null;
    renderBatches(category);
    show("batches");
    setPageTitle([category.name, "Study"]);
    return;
  }
  if (rest[0] === "quiz") {
    state.quiz = null;
    renderQuizSetup(category);
    show("quizSetup");
    setPageTitle([category.name, "Quiz"]);
    return;
  }
  if (rest[0] === "flags") {
    renderFlags();
    show("flags");
    setPageTitle([category.name, "Flagged"]);
    return;
  }

  state.batch = null;
  renderHub(category);
  show("hub");
  setPageTitle([category.name]);
}

function goHome() {
  goToHash([]);
}

function goBack() {
  if (state.view === "detail") {
    stopAllSpeech();
    state.president = null;
    show("presidents");
    return;
  }
  if (state.view === "quiz") {
    if (!confirmLeaveQuiz()) return;
    const wasElements = state.quiz?.mode === "elements";
    state.quiz = null;
    state.lastResult = null;
    if (wasElements) {
      void renderPeriodicTable({ els, onStartQuiz: startElementQuiz });
      show("periodicTable");
      return;
    }
    renderQuizSetup(state.category);
    show("quizSetup");
    return;
  }
  if (state.view === "quizDone") {
    state.quiz = null;
    if (state.category?.type === "periodic-table") {
      goToHash(["periodic-table"]);
      return;
    }
    goToHash([state.category.id]);
    return;
  }
  if (state.view === "captured" && capturedCanGoBack() && capturedGoBack()) {
    return;
  }
  const { parts } = parseHash();
  if (parts.length <= 1) goToHash([]);
  else goToHash(parts.slice(0, -1));
}

els.backBtn.addEventListener("click", goBack);
els.homeBtn.addEventListener("click", () => goToHash([]));

async function init() {
  try {
    const data = await loadJSON("data/categories.json");
    state.categories = data.categories;
    renderCategories(state.categories);
    if (!location.hash) history.replaceState(null, "", "#/");
    window.addEventListener("hashchange", () => void applyRoute());
    await applyRoute();
  } catch (err) {
    // Local runs usually fail because no static server is running; on the
    // live site a load failure is a network problem, so the advice differs.
    const hint = isLocalHost()
      ? `From this folder run: <code>python3 -m http.server 8080</code> then open <code>http://localhost:8080</code>.`
      : `Check your connection and reload the page.`;
    els.categories.innerHTML = `<p class="error">${err.message}. ${hint}</p>`;
  }
}

init();

const VIEWPORT_CONTENT =
  "width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover";

function forceLayoutReset() {
  const root = document.documentElement;
  root.style.height = `${Math.max(window.innerHeight, 1) + 1}px`;
  void root.offsetHeight;
  root.style.height = "";
  window.scrollTo(0, window.scrollY);
}

function snapPageScale() {
  const meta = document.querySelector('meta[name="viewport"]');
  if (meta) {
    meta.setAttribute(
      "content",
      "width=device-width, initial-scale=1, maximum-scale=1.0001, viewport-fit=cover"
    );
    requestAnimationFrame(() => {
      meta.setAttribute("content", VIEWPORT_CONTENT);
      forceLayoutReset();
    });
  } else {
    forceLayoutReset();
  }
}

function scaledAwayFrom1() {
  const scale = window.visualViewport?.scale ?? 1;
  return Math.abs(scale - 1) > 0.01;
}

let snapTimer = 0;
function scheduleSnapIfScaled() {
  clearTimeout(snapTimer);
  snapTimer = window.setTimeout(() => {
    if (scaledAwayFrom1()) snapPageScale();
  }, 450);
}

const blockPageGesture = (e) => e.preventDefault();
document.addEventListener("gesturestart", blockPageGesture, { passive: false });
document.addEventListener("gesturechange", blockPageGesture, { passive: false });
document.addEventListener("gestureend", blockPageGesture, { passive: false });

window.addEventListener("pageshow", snapPageScale);
window.addEventListener("orientationchange", () => {
  window.setTimeout(snapPageScale, 200);
});
/* Wait until the rubber-band settles. Snapping mid-bounce (or on every
   visualViewport resize) is what left Safari stuck zoomed-in. */
window.addEventListener(
  "touchend",
  (e) => {
    if (e.touches.length) return;
    scheduleSnapIfScaled();
  },
  { passive: true }
);
window.addEventListener("touchcancel", scheduleSnapIfScaled, { passive: true });
