/** Seterra-style geography quizzes: study, pin, name, type, capitals, flags. */

const PACKS_PATH = "data/geography/packs.json";
const MAPS = {
  continents: "data/geography/maps/continents.svg",
  "us-states": "data/geography/maps/us-states.svg",
};

const MODE_META = {
  study: {
    label: "Study",
    blurb: "Click places on the map or list to learn names and facts.",
  },
  pin: {
    label: "Pin",
    blurb: "Find the place on the map — like Seterra’s pin mode.",
  },
  name: {
    label: "Name",
    blurb: "A place is highlighted — choose its name.",
  },
  choice: {
    label: "Multiple choice",
    blurb: "Classic four-option drills.",
  },
  type: {
    label: "Type",
    blurb: "Type the answer — spelling counts (close matches ok).",
  },
  capitals: {
    label: "Capitals",
    blurb: "Name the capital of the highlighted state or country.",
  },
  abbr: {
    label: "Abbreviations",
    blurb: "Match state names and two-letter postal codes.",
  },
  reverse: {
    label: "Reverse",
    blurb: "See the capital or flag — pick the country.",
  },
};

const geo = {
  root: null,
  packs: [],
  pack: null,
  items: [],
  mapSvg: "",
  mode: null,
  queue: [],
  index: 0,
  correct: 0,
  wrong: 0,
  answered: false,
  selectedId: null,
};

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function shuffle(items) {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function pickDistractors(pool, correct, count, keyFn = (x) => x) {
  const correctKey = keyFn(correct);
  return shuffle(pool.filter((x) => keyFn(x) !== correctKey)).slice(0, count);
}

function normalizeAnswer(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function answersMatch(input, expected) {
  const a = normalizeAnswer(input);
  const b = normalizeAnswer(expected);
  if (!a || !b) return false;
  if (a === b) return true;
  if (b.startsWith(a) && a.length >= Math.min(4, b.length)) return true;
  // Common variants
  const aliases = {
    "united states": ["usa", "us", "america", "united states of america"],
    "united kingdom": ["uk", "britain", "great britain", "england"],
    "south korea": ["korea", "republic of korea"],
    "united arab emirates": ["uae"],
    "washington d c": ["washington dc", "washington", "dc"],
  };
  for (const [canon, list] of Object.entries(aliases)) {
    if (b === canon && list.includes(a)) return true;
  }
  return false;
}

function byId(id) {
  return geo.items.find((i) => i.id === id) || null;
}

function currentItem() {
  return geo.queue[geo.index] || null;
}

function remaining() {
  return Math.max(0, geo.queue.length - geo.index);
}

async function loadPack(packMeta) {
  const res = await fetch(`data/geography/${packMeta.id}.json`);
  if (!res.ok) throw new Error(`Failed to load ${packMeta.id}`);
  const data = await res.json();
  geo.pack = { ...packMeta, ...data };
  geo.items = data.items || [];
  geo.mapSvg = "";
  if (packMeta.map && MAPS[packMeta.map]) {
    const mapRes = await fetch(MAPS[packMeta.map]);
    if (!mapRes.ok) throw new Error(`Failed to load map ${packMeta.map}`);
    let svg = await mapRes.text();
    // Strip XML prolog / title noise for inline inject
    svg = svg.replace(/<\?xml[^>]*>/i, "").trim();
    geo.mapSvg = svg;
  }
}

function paintMap(activeId = null, { dimOthers = false, flash = null } = {}) {
  const host = geo.root?.querySelector("#geo-map");
  if (!host) return;
  host.querySelectorAll(".geo-region").forEach((el) => {
    const id = el.dataset.id || el.id;
    el.classList.toggle("is-active", id === activeId);
    el.classList.toggle("is-dim", dimOthers && id !== activeId);
    el.classList.toggle("is-correct", flash?.id === id && flash.ok);
    el.classList.toggle("is-wrong", flash?.id === id && !flash.ok);
  });
}

function mapHtml() {
  if (!geo.mapSvg) return "";
  return `<div class="geo-map-frame" id="geo-map">${geo.mapSvg}</div>`;
}

function progressHtml() {
  if (geo.mode === "study") return "";
  const total = geo.queue.length;
  const done = geo.index + (geo.answered ? 1 : 0);
  return `
    <div class="geo-progress" aria-live="polite">
      <span>${remaining()} left</span>
      <span>${geo.correct} correct</span>
      <span>${geo.wrong} wrong</span>
      <span>${Math.min(done, total)} / ${total}</span>
    </div>`;
}

function choiceButtons(choices) {
  return `
    <div class="choice-list geo-choices" id="geo-choices">
      ${choices
        .map(
          (c, i) => `
        <button type="button" class="choice-btn" data-choice="${escapeHtml(c)}">
          <span class="choice-letter">${String.fromCharCode(65 + i)}</span>
          <span class="choice-text">${escapeHtml(c)}</span>
        </button>`
        )
        .join("")}
    </div>`;
}

function promptForMode(item) {
  const mode = geo.mode;
  if (mode === "pin") return `Find <strong>${escapeHtml(item.name)}</strong> on the map.`;
  if (mode === "name") return `What is the highlighted place called?`;
  if (mode === "capitals")
    return `What is the capital of <strong>${escapeHtml(item.name)}</strong>?`;
  if (mode === "abbr") {
    return Math.random() < 0.5
      ? `What is the postal abbreviation for <strong>${escapeHtml(item.name)}</strong>?`
      : `Which state uses the abbreviation <strong>${escapeHtml(item.abbr)}</strong>?`;
  }
  if (mode === "type") {
    if (geo.pack.id === "world-capitals")
      return `Type the capital of <strong>${escapeHtml(item.name)}</strong>.`;
    return `Type the name of this place.`;
  }
  if (mode === "reverse") {
    if (geo.pack.id === "world-flags")
      return `<span class="geo-flag-xl" aria-hidden="true">${item.flag}</span><br />Which country is this?`;
    return `Which country has the capital <strong>${escapeHtml(item.capital)}</strong>?`;
  }
  if (mode === "choice") {
    if (geo.pack.id === "world-flags")
      return `<span class="geo-flag-xl" aria-hidden="true">${item.flag}</span><br />Which country is this?`;
    if (geo.pack.id === "world-capitals")
      return `What is the capital of <strong>${escapeHtml(item.name)}</strong>?`;
    return `Which place is this?`;
  }
  return escapeHtml(item.name);
}

function expectedAnswer(item) {
  const mode = geo.mode;
  if (mode === "capitals") return item.capital;
  if (mode === "abbr") {
    // Stored on the question object when rendered
    return geo._abbrAskName ? item.abbr : item.name;
  }
  if (mode === "type" && geo.pack.id === "world-capitals") return item.capital;
  if (mode === "choice" && geo.pack.id === "world-capitals") return item.capital;
  if (mode === "reverse" || (mode === "choice" && geo.pack.id === "world-flags"))
    return item.name;
  return item.name;
}

function buildChoices(item) {
  const mode = geo.mode;
  let correct = expectedAnswer(item);
  let poolKeys;

  if (mode === "capitals" || (mode === "choice" && geo.pack.id === "world-capitals")) {
    poolKeys = geo.items.map((i) => i.capital).filter(Boolean);
    correct = item.capital;
  } else if (mode === "abbr") {
    if (geo._abbrAskName) {
      poolKeys = geo.items.map((i) => i.abbr);
      correct = item.abbr;
    } else {
      poolKeys = geo.items.map((i) => i.name);
      correct = item.name;
    }
  } else {
    poolKeys = geo.items.map((i) => i.name);
    correct = item.name;
  }

  const distractors = pickDistractors(poolKeys, correct, 3);
  if (distractors.length < 3) return shuffle([correct, ...distractors]);
  return shuffle([correct, ...distractors]);
}

function renderHub() {
  geo.root.innerHTML = `
    <div class="geo-shell">
      <div class="geo-head">
        <div>
          <h2 class="section-title">Geography</h2>
          <p class="lede">Seterra-style map drills — study a pack, then pin places, name them, type answers, or practice capitals and flags.</p>
        </div>
      </div>
      <div class="geo-pack-grid">
        ${geo.packs
          .map(
            (p) => `
          <button type="button" class="geo-pack-card" data-pack="${escapeHtml(p.id)}">
            <h3>${escapeHtml(p.name)}</h3>
            <p>${escapeHtml(p.blurb)}</p>
            <span class="meta">${p.itemCount} places · ${(p.modes || [])
              .map((m) => MODE_META[m]?.label || m)
              .join(" · ")}</span>
          </button>`
          )
          .join("")}
      </div>
    </div>`;

  geo.root.querySelectorAll(".geo-pack-card").forEach((btn) => {
    btn.addEventListener("click", () => void openPack(btn.dataset.pack));
  });
}

function renderPackModes() {
  const pack = geo.pack;
  geo.root.innerHTML = `
    <div class="geo-shell">
      <div class="geo-head">
        <div>
          <p class="speech-kicker">Geography pack</p>
          <h2 class="section-title">${escapeHtml(pack.name)}</h2>
          <p class="lede">${escapeHtml(pack.blurb || "")}</p>
        </div>
        <button type="button" class="secondary-btn" id="geo-back-hub">All packs</button>
      </div>
      <div class="geo-mode-grid">
        ${(pack.modes || [])
          .map((m) => {
            const meta = MODE_META[m] || { label: m, blurb: "" };
            return `
              <button type="button" class="geo-mode-card" data-mode="${escapeHtml(m)}">
                <h3>${escapeHtml(meta.label)}</h3>
                <p>${escapeHtml(meta.blurb)}</p>
              </button>`;
          })
          .join("")}
      </div>
      ${
        geo.mapSvg
          ? `<div class="geo-preview">
              <p class="speech-kicker">Map preview</p>
              ${mapHtml()}
            </div>`
          : ""
      }
    </div>`;

  geo.root.querySelector("#geo-back-hub")?.addEventListener("click", () => {
    geo.pack = null;
    geo.mode = null;
    renderHub();
  });
  geo.root.querySelectorAll(".geo-mode-card").forEach((btn) => {
    btn.addEventListener("click", () => startMode(btn.dataset.mode));
  });
}

function startMode(mode) {
  geo.mode = mode;
  geo.queue = mode === "study" ? [...geo.items] : shuffle(geo.items);
  geo.index = 0;
  geo.correct = 0;
  geo.wrong = 0;
  geo.answered = false;
  geo.selectedId = null;
  renderPlay();
}

function renderStudy() {
  const item = byId(geo.selectedId) || geo.items[0];
  geo.selectedId = item?.id || null;
  geo.root.innerHTML = `
    <div class="geo-shell geo-play">
      <div class="geo-toolbar">
        <button type="button" class="secondary-btn" id="geo-back-modes">Modes</button>
        <p class="speech-kicker">${escapeHtml(geo.pack.name)} · Study</p>
      </div>
      <div class="geo-play-layout ${geo.mapSvg ? "" : "no-map"}">
        ${geo.mapSvg ? `<div class="geo-map-wrap">${mapHtml()}</div>` : ""}
        <aside class="geo-side">
          <div class="geo-detail" id="geo-detail">
            ${studyDetailHtml(item)}
          </div>
          <div class="geo-item-list" role="list">
            ${geo.items
              .map(
                (i) => `
              <button type="button" class="geo-item-btn ${
                i.id === geo.selectedId ? "is-on" : ""
              }" data-id="${escapeHtml(i.id)}" role="listitem">
                ${i.flag ? `<span class="geo-flag">${i.flag}</span>` : ""}
                <span>${escapeHtml(i.name)}</span>
              </button>`
              )
              .join("")}
          </div>
        </aside>
      </div>
    </div>`;

  paintMap(geo.selectedId, { dimOthers: false });
  bindStudy();
}

function studyDetailHtml(item) {
  if (!item) return `<p class="lede">Select a place.</p>`;
  return `
    ${item.flag ? `<p class="geo-flag-xl">${item.flag}</p>` : ""}
    <h3>${escapeHtml(item.name)}</h3>
    ${item.abbr ? `<p class="geo-meta-line">Abbreviation <strong>${escapeHtml(item.abbr)}</strong></p>` : ""}
    ${item.capital ? `<p class="geo-meta-line">Capital <strong>${escapeHtml(item.capital)}</strong></p>` : ""}
    ${item.fact ? `<p class="lede">${escapeHtml(item.fact)}</p>` : ""}`;
}

function bindStudy() {
  geo.root.querySelector("#geo-back-modes")?.addEventListener("click", () => {
    renderPackModes();
  });
  geo.root.querySelectorAll(".geo-item-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      geo.selectedId = btn.dataset.id;
      renderStudy();
    });
  });
  geo.root.querySelectorAll("#geo-map .geo-region").forEach((el) => {
    el.addEventListener("click", () => {
      geo.selectedId = el.dataset.id || el.id;
      renderStudy();
    });
  });
}

function renderPlay() {
  if (geo.mode === "study") {
    renderStudy();
    return;
  }
  const item = currentItem();
  if (!item) {
    renderDone();
    return;
  }

  if (geo.mode === "abbr") {
    geo._abbrAskName = Math.random() < 0.5;
  }

  const needsMap = ["pin", "name"].includes(geo.mode) || (geo.mapSvg && geo.mode === "capitals");
  const showMap = Boolean(geo.mapSvg) && (needsMap || geo.mode === "pin" || geo.mode === "name");

  let body = "";
  if (geo.mode === "pin") {
    body = `
      <p class="geo-prompt">${promptForMode(item)}</p>
      <p class="geo-hint">Tap the correct region on the map.</p>`;
  } else if (geo.mode === "type") {
    body = `
      <p class="geo-prompt">${promptForMode(item)}</p>
      <form class="geo-type-form" id="geo-type-form">
        <input type="text" id="geo-type-input" class="geo-type-input" autocomplete="off" autocorrect="off" spellcheck="false" placeholder="Type your answer" />
        <button type="submit" class="primary-btn">Check</button>
      </form>`;
  } else {
    const choices = buildChoices(item);
    body = `
      <p class="geo-prompt">${promptForMode(item)}</p>
      ${choiceButtons(choices)}`;
  }

  geo.root.innerHTML = `
    <div class="geo-shell geo-play">
      <div class="geo-toolbar">
        <button type="button" class="secondary-btn" id="geo-back-modes">Modes</button>
        <p class="speech-kicker">${escapeHtml(geo.pack.name)} · ${escapeHtml(
          MODE_META[geo.mode]?.label || geo.mode
        )}</p>
      </div>
      ${progressHtml()}
      <div class="geo-play-layout ${showMap ? "" : "no-map"}">
        ${showMap ? `<div class="geo-map-wrap">${mapHtml()}</div>` : ""}
        <aside class="geo-side">
          <div class="geo-quiz-panel" id="geo-quiz-panel">${body}</div>
          <div id="geo-feedback" class="quiz-feedback" hidden></div>
          <div class="geo-next-row" id="geo-next-row" hidden>
            <button type="button" class="primary-btn" id="geo-next">Next</button>
          </div>
        </aside>
      </div>
    </div>`;

  if (geo.mode === "name" || geo.mode === "capitals") {
    paintMap(item.id, { dimOthers: true });
  } else if (showMap) {
    paintMap(null);
  }

  bindPlay();
}

function bindPlay() {
  geo.root.querySelector("#geo-back-modes")?.addEventListener("click", () => {
    if (
      remaining() < geo.queue.length &&
      !confirm("Leave this quiz? Progress on this run will be lost.")
    ) {
      return;
    }
    renderPackModes();
  });

  geo.root.querySelector("#geo-next")?.addEventListener("click", () => {
    geo.index += 1;
    geo.answered = false;
    renderPlay();
  });

  if (geo.mode === "pin") {
    geo.root.querySelectorAll("#geo-map .geo-region").forEach((el) => {
      el.addEventListener("click", () => {
        if (geo.answered) return;
        const id = el.dataset.id || el.id;
        judge(id === currentItem().id, id);
      });
    });
    return;
  }

  if (geo.mode === "type") {
    const form = geo.root.querySelector("#geo-type-form");
    const input = geo.root.querySelector("#geo-type-input");
    input?.focus();
    form?.addEventListener("submit", (e) => {
      e.preventDefault();
      if (geo.answered) return;
      const item = currentItem();
      const ok = answersMatch(input.value, expectedAnswer(item));
      judge(ok);
    });
    return;
  }

  geo.root.querySelectorAll("#geo-choices .choice-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (geo.answered) return;
      const item = currentItem();
      const ok = btn.dataset.choice === expectedAnswer(item);
      judge(ok, null, btn);
    });
  });
}

function judge(ok, clickedMapId = null, clickedBtn = null) {
  geo.answered = true;
  if (ok) geo.correct += 1;
  else geo.wrong += 1;

  const item = currentItem();
  const feedback = geo.root.querySelector("#geo-feedback");
  const nextRow = geo.root.querySelector("#geo-next-row");
  if (feedback) {
    feedback.hidden = false;
    feedback.className = `quiz-feedback ${ok ? "is-correct" : "is-wrong"}`;
    feedback.innerHTML = ok
      ? `<strong>Correct.</strong> ${escapeHtml(item.name)}${
          item.capital ? ` · capital ${escapeHtml(item.capital)}` : ""
        }`
      : `<strong>Not quite.</strong> Answer: <strong>${escapeHtml(
          expectedAnswer(item)
        )}</strong>`;
  }
  if (nextRow) nextRow.hidden = false;

  if (geo.mode === "pin" || geo.mode === "name" || geo.mode === "capitals") {
    paintMap(item.id, {
      dimOthers: geo.mode !== "pin",
      flash: clickedMapId
        ? { id: clickedMapId, ok }
        : { id: item.id, ok: true },
    });
    if (!ok && clickedMapId && clickedMapId !== item.id) {
      const wrongEl = geo.root.querySelector(
        `#geo-map .geo-region[data-id="${CSS.escape(clickedMapId)}"]`
      );
      wrongEl?.classList.add("is-wrong");
    }
  }

  geo.root.querySelectorAll("#geo-choices .choice-btn").forEach((btn) => {
    btn.disabled = true;
    const isRight = btn.dataset.choice === expectedAnswer(item);
    if (isRight) btn.classList.add("is-correct");
    if (btn === clickedBtn && !ok) btn.classList.add("is-wrong");
  });

  const input = geo.root.querySelector("#geo-type-input");
  if (input) input.disabled = true;
}

function renderDone() {
  const total = geo.queue.length;
  geo.root.innerHTML = `
    <div class="geo-shell">
      <div class="quiz-done">
        <h2 class="section-title">Quiz complete</h2>
        <p class="lede">${escapeHtml(geo.pack.name)} · ${escapeHtml(
          MODE_META[geo.mode]?.label || geo.mode
        )}</p>
        <ul class="stats">
          <li><strong>${total}</strong> questions</li>
          <li><strong>${geo.correct}</strong> correct</li>
          <li><strong>${geo.wrong}</strong> wrong</li>
          <li><strong>${
            total ? Math.round((geo.correct / total) * 100) : 0
          }%</strong> accuracy</li>
        </ul>
        <div class="setup-actions">
          <button type="button" class="primary-btn" id="geo-again">Quiz again</button>
          <button type="button" class="secondary-btn" id="geo-to-modes">Back to modes</button>
          <button type="button" class="secondary-btn" id="geo-to-hub">All packs</button>
        </div>
      </div>
    </div>`;

  geo.root.querySelector("#geo-again")?.addEventListener("click", () => {
    startMode(geo.mode);
  });
  geo.root.querySelector("#geo-to-modes")?.addEventListener("click", () => {
    renderPackModes();
  });
  geo.root.querySelector("#geo-to-hub")?.addEventListener("click", () => {
    geo.pack = null;
    geo.mode = null;
    renderHub();
  });
}

async function openPack(packId) {
  const meta = geo.packs.find((p) => p.id === packId);
  if (!meta) return;
  try {
    await loadPack(meta);
    renderPackModes();
  } catch (err) {
    geo.root.innerHTML = `<p class="error">${escapeHtml(err.message)}</p>`;
  }
}

export function cleanupGeography() {
  geo.pack = null;
  geo.mode = null;
  geo.queue = [];
  geo.items = [];
  geo.mapSvg = "";
}

export async function renderGeography({ els }) {
  geo.root = els.geography;
  cleanupGeography();
  try {
    const res = await fetch(PACKS_PATH);
    if (!res.ok) throw new Error(`Failed to load ${PACKS_PATH}`);
    const data = await res.json();
    geo.packs = data.packs || [];
    renderHub();
  } catch (err) {
    geo.root.innerHTML = `<p class="error">${escapeHtml(err.message)}</p>`;
  }
}

/** Used by app back navigation — true if inside a pack/mode. */
export function geographyCanGoBack() {
  return Boolean(geo.pack);
}

export function geographyGoBack() {
  if (geo.mode) {
    geo.mode = null;
    renderPackModes();
    return true;
  }
  if (geo.pack) {
    geo.pack = null;
    renderHub();
    return true;
  }
  return false;
}
