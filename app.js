import {
  buildEasyElementQuestions,
  buildElementQuestions,
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
  geographyCanGoBack,
  geographyGoBack,
  renderGeography,
} from "./geography.js";

const els = {
  subtitle: document.getElementById("subtitle"),
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

function show(view) {
  state.view = view;
  for (const key of VIEWS) {
    const el = els[key];
    if (!el) continue;
    el.hidden = key !== view;
  }
  els.nav.hidden = view === "categories";
  els.backBtn.hidden = view === "categories";
}

function batchLabel(category, n) {
  const meta = category.batches?.find((b) => b.n === n);
  if (meta) return meta.label;
  return n < category.batchCount
    ? `Presidents ${(n - 1) * 10 + 1}–${n * 10}`
    : `Batch ${n}`;
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
    return "3 feeds · refreshable";
  }
  if (category?.type === "periodic-table") {
    return "118 elements · tours & quiz";
  }
  if (category?.type === "geography") {
    return "maps · pin · capitals · flags";
  }
  return `${category.batchCount} batches`;
}

function renderCategories(categories) {
  els.categories.innerHTML = `
    <div class="grid">
      ${categories
        .map(
          (c) => `
        <button type="button" class="category-card" data-id="${c.id}">
          <h2>${c.name}</h2>
          <p>${c.description}</p>
          <span class="meta">${categoryMetaLabel(c)}</span>
        </button>`
        )
        .join("")}
    </div>
  `;

  els.categories.querySelectorAll(".category-card").forEach((btn) => {
    btn.addEventListener("click", () => openCategory(btn.dataset.id));
  });
}

function openCategory(id) {
  const category = state.categories.find((c) => c.id === id);
  if (!category) return;
  state.category = category;
  state.batch = null;
  state.president = null;
  state.quiz = null;
  state.lastResult = null;
  els.subtitle.textContent = category.name;
  if (category.type === "current-events") {
    renderCurrentEvents({ els });
    show("currentEvents");
    return;
  }
  if (category.type === "periodic-table") {
    void renderPeriodicTable({ els, onStartQuiz: startElementQuiz });
    show("periodicTable");
    return;
  }
  if (category.type === "geography") {
    void renderGeography({ els });
    show("geography");
    return;
  }
  renderHub(category);
  show("hub");
}

function renderHub(category) {
  const flagged = flagCount(category.id);
  // Flag-for-replacement is a local authoring tool — hidden on the live site.
  const canFlag = isLocalHost();

  els.hub.innerHTML = `
    <h2 class="section-title">${category.name}</h2>
    <p class="lede">${
      canFlag
        ? "Study the material, or quiz yourself until every question is cleared from rotation. Flag weak facts while reviewing so they can be replaced later."
        : "Study the material, or quiz yourself until every question is cleared from rotation."
    }</p>
    <div class="hub-actions">
      <button type="button" class="hub-card" id="hub-study">
        <h3>Study</h3>
        <p>Browse batches and review each president’s facts.</p>
      </button>
      <button type="button" class="hub-card hub-card-accent" id="hub-quiz">
        <h3>Quiz</h3>
        <p>Pick one or more batches and work through multiple-choice questions.</p>
      </button>
      ${
        canFlag
          ? `<button type="button" class="hub-card" id="hub-flags">
        <h3>Flagged for replacement</h3>
        <p>${
          flagged
            ? `${flagged} item${flagged === 1 ? "" : "s"} waiting to be rewritten.`
            : "Nothing flagged yet. Use Flag on any fact or quiz question."
        }</p>
      </button>`
          : ""
      }
    </div>
  `;

  document.getElementById("hub-study").addEventListener("click", () => {
    renderBatches(category);
    show("batches");
    els.subtitle.textContent = `${category.name} · Study`;
  });

  document.getElementById("hub-quiz").addEventListener("click", () => {
    renderQuizSetup(category);
    show("quizSetup");
    els.subtitle.textContent = `${category.name} · Quiz setup`;
  });

  document.getElementById("hub-flags")?.addEventListener("click", () => {
    renderFlags();
    show("flags");
    els.subtitle.textContent = `${category.name} · Flagged`;
  });
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
  els.subtitle.textContent = `${state.category.name} · ${modeLabel} · ${scopeLabel}`;
  renderQuizQuestion();
  show("quiz");
}

function renderBatches(category) {
  const cards = Array.from({ length: category.batchCount }, (_, i) => {
    const n = i + 1;
    return `
      <button type="button" class="batch-card" data-batch="${n}">
        <h2>Batch ${n}</h2>
        <p>${batchLabel(category, n)}</p>
        <span class="meta">Study mode</span>
      </button>`;
  }).join("");

  els.batches.innerHTML = `
    <h2 class="section-title">Choose a batch</h2>
    <div class="batch-grid">${cards}</div>
  `;

  els.batches.querySelectorAll(".batch-card").forEach((btn) => {
    btn.addEventListener("click", () => openBatch(Number(btn.dataset.batch)));
  });
}

async function openBatch(batchNumber) {
  try {
    const batch = await loadBatch(state.category, batchNumber);
    state.batch = batch;
    state.president = null;
    els.subtitle.textContent = `${state.category.name} · Batch ${batch.batch} (${batch.range})`;
    renderPresidents(batch);
    show("presidents");
  } catch (err) {
    els.batches.innerHTML = `<p class="error">${err.message}</p>`;
    show("batches");
  }
}

function renderPresidents(batch) {
  els.presidents.innerHTML = `
    <h2 class="section-title">Batch ${batch.batch}: Presidents ${batch.range}</h2>
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

function openPresident(president) {
  state.president = president;
  els.subtitle.textContent = president.name;
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
          <div class="speech-panel-top">
            <div>
              <p class="speech-kicker">Read aloud</p>
              <p class="speech-lede">Hear this president’s facts in order.</p>
            </div>
            <div class="speech-actions" role="group" aria-label="Playback">
              <button type="button" class="speech-btn speech-btn-primary" id="listen-all">Listen</button>
              <button type="button" class="speech-btn speech-btn-quiet" id="stop-speech">Stop</button>
            </div>
          </div>
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
                    ? `Batch ${f.batch ?? "?"} · #${f.presidentNumber} ${escapeHtml(f.presidentName)} · fact ${f.factIndex + 1}`
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
  const options = Array.from({ length: category.batchCount }, (_, i) => {
    const n = i + 1;
    return `
      <label class="batch-check">
        <input type="checkbox" name="quiz-batch" value="${n}" checked />
        <span class="batch-check-body">
          <strong>Batch ${n}</strong>
          <span>${batchLabel(category, n)}</span>
        </span>
      </label>`;
  }).join("");

  els.quizSetup.innerHTML = `
    <h2 class="section-title">Quiz setup</h2>
    <p class="lede">Select the batches to include. After each answer you’ll see if you were right, then choose whether to keep that question in rotation.</p>
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
    errorEl.textContent = "Select at least one batch.";
    return;
  }

  try {
    errorEl.hidden = true;
    errorEl.textContent = "";
    const batches = await Promise.all(
      batchNumbers.map((n) => loadBatch(state.category, n))
    );
    const presidents = batches.flatMap((batch) =>
      batch.presidents.map((p) => ({ ...p, _batch: batch.batch }))
    );

    let questions;
    if (state.category.id === "presidents") {
      questions = buildPresidentQuestions(presidents);
    } else {
      throw new Error("Quiz generation is not available for this category yet.");
    }

    if (questions.length < 1) {
      errorEl.hidden = false;
      errorEl.textContent = "Not enough material to build quiz questions from those batches.";
      return;
    }

    state.quiz = {
      mode: "presidents",
      batchNumbers,
      rotation: createRotation(questions),
      total: questions.length,
    };
    state.lastResult = null;
    els.subtitle.textContent = `${state.category.name} · Quiz`;
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
    : (quiz.batchNumbers || []).map((n) => `Batch ${n}`).join(", ");
  els.subtitle.textContent = `${state.category.name} · Quiz complete`;
  els.quizDone.innerHTML = `
    <div class="quiz-done">
      <h2 class="section-title">Rotation cleared</h2>
      <p class="lede">You’ve removed every question from this quiz.</p>
      <ul class="stats">
        <li><strong>${total}</strong> questions cleared</li>
        <li><strong>${rotation.correctCount}</strong> correct answers</li>
        <li><strong>${rotation.wrongCount}</strong> wrong answers</li>
        <li><strong>${rotation.kept}</strong> times kept for another pass</li>
        <li>${isElements ? "Scope" : "Batches"}: ${escapeHtml(scopeText)}</li>
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
    els.subtitle.textContent = `${state.category.name} · Quiz setup`;
  });

  document.getElementById("quiz-to-hub").addEventListener("click", () => {
    state.quiz = null;
    if (isElements) {
      void renderPeriodicTable({ els, onStartQuiz: startElementQuiz });
      show("periodicTable");
      els.subtitle.textContent = state.category.name;
      return;
    }
    renderHub(state.category);
    show("hub");
    els.subtitle.textContent = state.category.name;
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function goHome() {
  stopAllSpeech();
  cleanupPeriodicTable();
  cleanupGeography();
  state.category = null;
  state.batch = null;
  state.president = null;
  state.quiz = null;
  state.lastResult = null;
  els.subtitle.textContent = "Pick a category";
  show("categories");
}

function goBack() {
  stopAllSpeech();
  switch (state.view) {
    case "detail":
      state.president = null;
      els.subtitle.textContent = `${state.category.name} · Batch ${state.batch.batch} (${state.batch.range})`;
      show("presidents");
      break;
    case "presidents":
      state.batch = null;
      els.subtitle.textContent = `${state.category.name} · Study`;
      show("batches");
      break;
    case "batches":
    case "quizSetup":
    case "flags":
      state.quiz = null;
      renderHub(state.category);
      els.subtitle.textContent = state.category.name;
      show("hub");
      break;
    case "quizDone":
      state.quiz = null;
      if (state.category?.type === "periodic-table") {
        void renderPeriodicTable({ els, onStartQuiz: startElementQuiz });
        els.subtitle.textContent = state.category.name;
        show("periodicTable");
      } else {
        renderHub(state.category);
        els.subtitle.textContent = state.category.name;
        show("hub");
      }
      break;
    case "quiz": {
      const hasProgress = state.quiz?.rotation?.remaining?.length;
      if (
        hasProgress &&
        !confirm("Leave this quiz? Your current rotation progress will be lost.")
      ) {
        return;
      }
      const wasElements = state.quiz?.mode === "elements";
      state.quiz = null;
      state.lastResult = null;
      if (wasElements) {
        void renderPeriodicTable({ els, onStartQuiz: startElementQuiz });
        els.subtitle.textContent = state.category.name;
        show("periodicTable");
      } else {
        renderQuizSetup(state.category);
        els.subtitle.textContent = `${state.category.name} · Quiz setup`;
        show("quizSetup");
      }
      break;
    }
    case "geography":
      if (geographyCanGoBack() && geographyGoBack()) {
        els.subtitle.textContent = state.category.name;
        break;
      }
      goHome();
      break;
    case "hub":
    case "currentEvents":
    case "periodicTable":
      goHome();
      break;
    default:
      goHome();
  }
}

els.backBtn.addEventListener("click", goBack);
els.homeBtn.addEventListener("click", () => {
  if (state.view === "quiz") {
    const hasProgress = state.quiz?.rotation?.remaining?.length;
    if (
      hasProgress &&
      !confirm("Leave this quiz? Your current rotation progress will be lost.")
    ) {
      return;
    }
  }
  goHome();
});

async function init() {
  try {
    const data = await loadJSON("data/categories.json");
    state.categories = data.categories;
    renderCategories(state.categories);
    show("categories");
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

const blockPageGesture = (e) => e.preventDefault();
document.addEventListener("gesturestart", blockPageGesture, { passive: false });
document.addEventListener("gesturechange", blockPageGesture, { passive: false });
document.addEventListener("gestureend", blockPageGesture, { passive: false });
