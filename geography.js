/** Seterra-style geography quizzes: study, pin, name, type, capitals, flags. */

const PACKS_PATH = "data/geography/packs.json";
const MAPS = {
  continents: "data/geography/maps/continents.svg",
  "continents-oceans": "data/geography/maps/continents-oceans.svg",
  "continents-cartoon": "data/geography/maps/continents-cartoon.svg",
  "world-countries": "data/geography/maps/world-countries.svg",
  "us-states": "data/geography/maps/us-states.svg",
  "great-lakes": "data/geography/maps/great-lakes.svg",
  "world-lakes": "data/geography/maps/world-lakes.svg",
  "world-physical": "data/geography/maps/world-physical.svg",
  "na-physical": "data/geography/maps/na-physical.svg",
  "nba-teams": "data/geography/maps/nba-teams.svg",
  "mlb-teams": "data/geography/maps/mlb-teams.svg",
  "nhl-teams": "data/geography/maps/nhl-teams.svg",
  "mls-teams": "data/geography/maps/mls-teams.svg",
};

/** Seterra’s main game modes are Pin and Type; extras are practice variants. */
const MODE_META = {
  pin: {
    label: "Pin",
    blurb: "Find the named place on the map (Seterra’s Pin mode).",
  },
  type: {
    label: "Type",
    blurb: "Type the name — spelling counts; close matches count (Seterra’s Type mode).",
  },
  outline: {
    label: "Outlines",
    blurb: "Identify the place from its silhouette — like Seterra’s outline quizzes.",
  },
  name: {
    label: "Name",
    blurb: "A place is highlighted — choose its name from four options.",
  },
  choice: {
    label: "Multiple choice",
    blurb: "Classic four-option drills without needing the map.",
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
  study: {
    label: "Study",
    blurb: "Click places on the map or list to learn names and facts.",
  },
};

const geo = {
  root: null,
  groups: [],
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
  if (a.length >= 4 && b.includes(a)) return true;
  const last = b.split(" ").filter(Boolean).pop();
  if (last && a === last && a.length >= 4) return true;
  // Common variants
  const aliases = {
    "united states": ["usa", "us", "america", "united states of america"],
    "united kingdom": ["uk", "britain", "great britain", "england"],
    "south korea": ["korea", "republic of korea"],
    "north korea": ["dprk", "democratic peoples republic of korea"],
    "united arab emirates": ["uae"],
    "washington d c": ["washington dc", "washington", "dc"],
    "czechia": ["czech republic"],
    "czech republic": ["czechia"],
    "myanmar": ["burma"],
    "eswatini": ["swaziland"],
    "cabo verde": ["cape verde"],
    "cote d ivoire": ["ivory coast", "cote divoire"],
    "timor leste": ["east timor"],
    "north macedonia": ["macedonia"],
    "bosnia and herzegovina": ["bosnia"],
    "democratic republic of the congo": ["drc", "congo kinshasa", "dr congo"],
    "republic of the congo": ["congo brazzaville", "congo"],
    "vatican city": ["vatican", "holy see"],
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
  geo._baseViewBox = null;
  geo._packViewBox = null;
  if (packMeta.map && MAPS[packMeta.map]) {
    const mapRes = await fetch(MAPS[packMeta.map]);
    if (!mapRes.ok) throw new Error(`Failed to load map ${packMeta.map}`);
    let svg = await mapRes.text();
    svg = svg.replace(/<\?xml[^>]*>/i, "").trim();
    // Let CSS own fills so quiz countries share one color
    svg = svg.replace(/\sfill="[^"]*"/gi, "");
    geo.mapSvg = svg;
  }
}

function quizKind() {
  return geo.pack?.quiz || "places";
}

function isOutlineView() {
  return geo.mode === "outline" || quizKind() === "outlines";
}

function packItemIds() {
  return new Set(geo.items.map((i) => i.id));
}

function resetMapViewBox() {
  const svg = geo.root?.querySelector("#geo-map svg");
  if (!svg) return;
  if (geo._packViewBox) {
    svg.setAttribute("viewBox", geo._packViewBox);
  } else if (geo._baseViewBox) {
    svg.setAttribute("viewBox", geo._baseViewBox);
  }
}

function ensureBaseViewBox(svg) {
  if (!geo._baseViewBox) {
    geo._baseViewBox =
      svg.getAttribute("viewBox") ||
      `0 0 ${svg.width?.baseVal?.value || 1000} ${svg.height?.baseVal?.value || 520}`;
  }
}

function boundsForIds(host, ids) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let found = false;
  for (const id of ids) {
    host.querySelectorAll(`.geo-region[data-id="${CSS.escape(id)}"]`).forEach((el) => {
      try {
        const b = el.getBBox();
        if (!b.width && !b.height) return;
        found = true;
        minX = Math.min(minX, b.x);
        minY = Math.min(minY, b.y);
        maxX = Math.max(maxX, b.x + b.width);
        maxY = Math.max(maxY, b.y + b.height);
      } catch {
        /* ignore */
      }
    });
  }
  if (!found) return null;
  return { minX, minY, maxX, maxY };
}

function fitMapToIds(ids, { padRatio = 0.12, storeAsPack = false } = {}) {
  const host = geo.root?.querySelector("#geo-map");
  const svg = host?.querySelector("svg");
  if (!host || !svg) return;
  ensureBaseViewBox(svg);
  const bounds = boundsForIds(host, ids);
  if (!bounds) {
    resetMapViewBox();
    return;
  }
  const { minX, minY, maxX, maxY } = bounds;
  const pad = Math.max(10, (maxX - minX) * padRatio, (maxY - minY) * padRatio);
  const w = Math.max(30, maxX - minX + pad * 2);
  const h = Math.max(30, maxY - minY + pad * 2);
  const vb = `${minX - pad} ${minY - pad} ${w} ${h}`;
  svg.setAttribute("viewBox", vb);
  if (storeAsPack) geo._packViewBox = vb;
}

function paintMap(activeId = null, { dimOthers = false, flash = null } = {}) {
  const host = geo.root?.querySelector("#geo-map");
  if (!host) return;
  const outline = isOutlineView() && activeId;
  host.classList.toggle("is-outline-mode", Boolean(outline));
  const inPack = packItemIds();
  const scopePack = inPack.size > 0 && Boolean(geo.mapSvg) && !outline;
  host.classList.toggle("is-region-scope", scopePack);
  host.querySelectorAll(".geo-region").forEach((el) => {
    const id = el.dataset.id || el.id;
    if (outline) {
      const on = id === activeId;
      el.classList.toggle("is-silhouette", on);
      el.classList.toggle("is-hidden-outline", !on);
      el.classList.toggle("is-out", false);
      el.classList.toggle("is-active", on);
      el.classList.toggle("is-dim", false);
      el.classList.toggle("is-correct", flash?.id === id && flash.ok);
      el.classList.toggle("is-wrong", flash?.id === id && !flash.ok);
      return;
    }
    el.classList.toggle("is-silhouette", false);
    el.classList.toggle("is-hidden-outline", false);
    const out = scopePack && !inPack.has(id);
    el.classList.toggle("is-out", out);
    el.classList.toggle("is-active", !out && id === activeId);
    el.classList.toggle("is-dim", !out && dimOthers && id !== activeId);
    el.classList.toggle("is-correct", !out && flash?.id === id && flash.ok);
    el.classList.toggle("is-wrong", !out && flash?.id === id && !flash.ok);
  });
  if (outline) {
    fitMapToIds([activeId], { padRatio: 0.25 });
  } else if (scopePack) {
    fitMapToIds([...inPack], { padRatio: 0.1, storeAsPack: !geo._packViewBox });
    if (geo._packViewBox) {
      host.querySelector("svg")?.setAttribute("viewBox", geo._packViewBox);
    }
  } else {
    resetMapViewBox();
  }
}

function bindMapControls(host) {
  const svg = host?.querySelector("svg");
  if (!host || !svg || host.dataset.navBound === "1") return;
  host.dataset.navBound = "1";
  ensureBaseViewBox(svg);

  const readVb = () => {
    const raw = (svg.getAttribute("viewBox") || geo._baseViewBox).split(/\s+/).map(Number);
    return { x: raw[0], y: raw[1], w: raw[2], h: raw[3] };
  };
  const writeVb = (vb) => {
    svg.setAttribute("viewBox", `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
  };

  host.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      const vb = readVb();
      const rect = svg.getBoundingClientRect();
      const mx = (e.clientX - rect.left) / rect.width;
      const my = (e.clientY - rect.top) / rect.height;
      const factor = e.deltaY > 0 ? 1.12 : 1 / 1.12;
      const nw = vb.w * factor;
      const nh = vb.h * factor;
      // Keep zoom within sensible bounds relative to pack/base
      const base = (geo._packViewBox || geo._baseViewBox).split(/\s+/).map(Number);
      const maxW = base[2] * 1.4;
      const minW = base[2] * 0.08;
      if (nw > maxW || nw < minW) return;
      vb.x += (vb.w - nw) * mx;
      vb.y += (vb.h - nh) * my;
      vb.w = nw;
      vb.h = nh;
      writeVb(vb);
    },
    { passive: false }
  );

  let dragging = false;
  let last = null;
  host.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    // Don't start drag when clicking a region for pin answers — only empty ocean / with modifier
    const onRegion = e.target.closest?.(".geo-region:not(.is-out)");
    if (onRegion && geo.mode === "pin" && !e.shiftKey) return;
    dragging = true;
    last = { x: e.clientX, y: e.clientY };
    host.setPointerCapture?.(e.pointerId);
    host.classList.add("is-panning");
  });
  host.addEventListener("pointermove", (e) => {
    if (!dragging || !last) return;
    const vb = readVb();
    const rect = svg.getBoundingClientRect();
    const dx = ((e.clientX - last.x) / rect.width) * vb.w;
    const dy = ((e.clientY - last.y) / rect.height) * vb.h;
    vb.x -= dx;
    vb.y -= dy;
    writeVb(vb);
    last = { x: e.clientX, y: e.clientY };
  });
  const endDrag = () => {
    dragging = false;
    last = null;
    host.classList.remove("is-panning");
  };
  host.addEventListener("pointerup", endDrag);
  host.addEventListener("pointercancel", endDrag);
}

function mapHtml() {
  if (!geo.mapSvg) return "";
  return `<div class="geo-map-frame" id="geo-map">${geo.mapSvg}
    <p class="geo-map-hint">Scroll to zoom · drag to pan${
      geo.mode === "pin" ? " · Shift-drag to pan while pinning" : ""
    }</p>
  </div>`;
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
  const kind = quizKind();
  if (mode === "pin") return `Find <strong>${escapeHtml(item.name)}</strong> on the map.`;
  if (mode === "outline") return `What place is this outline?`;
  if (mode === "name") {
    if (isOutlineView()) return `What place is this outline?`;
    return `What is the highlighted place called?`;
  }
  if (mode === "capitals")
    return `What is the capital of <strong>${escapeHtml(item.name)}</strong>?`;
  if (mode === "abbr") {
    return geo._abbrAskName
      ? `What is the postal abbreviation for <strong>${escapeHtml(item.name)}</strong>?`
      : `Which state uses the abbreviation <strong>${escapeHtml(item.abbr)}</strong>?`;
  }
  if (mode === "type") {
    if (kind === "capitals")
      return `Type the capital of <strong>${escapeHtml(item.name)}</strong>.`;
    if (kind === "flags")
      return `<span class="geo-flag-xl" aria-hidden="true">${item.flag}</span><br />Type the country.`;
    if (kind === "teams")
      return `Type the team highlighted on the map (${escapeHtml(item.city || "home city")}).`;
    if (isOutlineView()) return `Type the name of this outline.`;
    if (geo.mapSvg) return `Type the name of the highlighted place.`;
    return `Type the name of this place.`;
  }
  if (mode === "reverse") {
    if (kind === "flags")
      return `<span class="geo-flag-xl" aria-hidden="true">${item.flag}</span><br />Which country is this?`;
    return `Which country has the capital <strong>${escapeHtml(item.capital)}</strong>?`;
  }
  if (mode === "choice") {
    if (kind === "flags")
      return `<span class="geo-flag-xl" aria-hidden="true">${item.flag}</span><br />Which country is this?`;
    if (kind === "capitals")
      return `What is the capital of <strong>${escapeHtml(item.name)}</strong>?`;
    if (isOutlineView()) return `What place is this outline?`;
    return `Which place is this?`;
  }
  return escapeHtml(item.name);
}

function expectedAnswer(item) {
  const mode = geo.mode;
  const kind = quizKind();
  if (mode === "capitals") return item.capital;
  if (mode === "abbr") {
    return geo._abbrAskName ? item.abbr : item.name;
  }
  if ((mode === "type" || mode === "choice") && kind === "capitals") return item.capital;
  if (mode === "reverse" || kind === "flags") return item.name;
  return item.name;
}

function buildChoices(item) {
  const mode = geo.mode;
  const kind = quizKind();
  let correct = expectedAnswer(item);
  let poolKeys;

  if (mode === "capitals" || (mode === "choice" && kind === "capitals")) {
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

function packCardHtml(p) {
  return `
    <button type="button" class="geo-pack-card" data-pack="${escapeHtml(p.id)}">
      <h3>${escapeHtml(p.name)}</h3>
      <p>${escapeHtml(p.blurb)}</p>
      <span class="meta">${p.itemCount} places · ${(p.modes || [])
        .map((m) => MODE_META[m]?.label || m)
        .join(" · ")}</span>
    </button>`;
}

function renderHub() {
  const groups =
    geo.groups.length > 0
      ? geo.groups
      : [{ id: "all", name: "Quizzes", packs: geo.packs }];
  geo.root.innerHTML = `
    <div class="geo-shell">
      <div class="geo-head">
        <div>
          <h2 class="section-title">Geography</h2>
          <p class="lede">Seterra-style map quizzes by region — <strong>Pin</strong> and <strong>Type</strong> first, plus capitals and flags.</p>
        </div>
      </div>
      ${groups
        .map(
          (g) => `
        <section class="geo-group">
          <h3 class="geo-group-title">${escapeHtml(g.name)}</h3>
          <div class="geo-pack-grid">
            ${(g.packs || []).map(packCardHtml).join("")}
          </div>
        </section>`
        )
        .join("")}
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

  // Focus preview on this pack's region
  if (geo.mapSvg) {
    paintMap(null);
    bindMapControls(geo.root.querySelector("#geo-map"));
  }
  geo.root.querySelector("#geo-back-hub")?.addEventListener("click", () => {
    geo.pack = null;
    geo.mode = null;
    geo._packViewBox = null;
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
  bindMapControls(geo.root.querySelector("#geo-map"));
  bindStudy();
}

function studyDetailHtml(item) {
  if (!item) return `<p class="lede">Select a place.</p>`;
  return `
    ${item.flag ? `<p class="geo-flag-xl">${item.flag}</p>` : ""}
    <h3>${escapeHtml(item.name)}</h3>
    ${item.abbr ? `<p class="geo-meta-line">Abbreviation <strong>${escapeHtml(item.abbr)}</strong></p>` : ""}
    ${item.capital ? `<p class="geo-meta-line">Capital <strong>${escapeHtml(item.capital)}</strong></p>` : ""}
    ${item.city ? `<p class="geo-meta-line">City <strong>${escapeHtml(item.city)}</strong></p>` : ""}
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
  geo.root.querySelector("#geo-map")?.addEventListener("click", (e) => {
    const el = e.target.closest?.(".geo-region");
    if (!el || el.classList.contains("is-out")) return;
    const id = el.dataset.id || el.id;
    if (!byId(id)) return;
    geo.selectedId = id;
    renderStudy();
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

  const showMap =
    Boolean(geo.mapSvg) &&
    (["pin", "name", "type", "capitals", "outline"].includes(geo.mode) ||
      (geo.mode === "choice" && isOutlineView()));

  let body = "";
  if (geo.mode === "pin") {
    body = `
      <p class="geo-prompt">${promptForMode(item)}</p>
      <p class="geo-hint">Tap the correct region on the map.</p>`;
  } else if (geo.mode === "type" || geo.mode === "outline") {
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

  if (
    geo.mode === "name" ||
    geo.mode === "capitals" ||
    geo.mode === "outline" ||
    (geo.mode === "type" && geo.mapSvg) ||
    (geo.mode === "choice" && isOutlineView() && geo.mapSvg)
  ) {
    paintMap(item.id, { dimOthers: true });
  } else if (showMap) {
    paintMap(null);
  }

  bindMapControls(geo.root.querySelector("#geo-map"));
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
    geo.root.querySelector("#geo-map")?.addEventListener("click", (e) => {
      if (geo.answered) return;
      const el = e.target.closest?.(".geo-region");
      if (!el || el.classList.contains("is-out")) return;
      const id = el.dataset.id || el.id;
      judge(id === currentItem().id, id);
    });
    return;
  }

  if (geo.mode === "type" || geo.mode === "outline") {
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

  if (
    geo.mode === "pin" ||
    geo.mode === "name" ||
    geo.mode === "capitals" ||
    geo.mode === "outline" ||
    (geo.mode === "type" && geo.mapSvg) ||
    (geo.mode === "choice" && isOutlineView() && geo.mapSvg)
  ) {
    paintMap(item.id, {
      dimOthers: geo.mode !== "pin",
      flash: clickedMapId
        ? { id: clickedMapId, ok }
        : { id: item.id, ok: true },
    });
    if (!ok && clickedMapId && clickedMapId !== item.id) {
      geo.root
        .querySelectorAll(
          `#geo-map .geo-region[data-id="${CSS.escape(clickedMapId)}"]`
        )
        .forEach((el) => el.classList.add("is-wrong"));
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
  geo._baseViewBox = null;
  geo._packViewBox = null;
}

export async function renderGeography({ els }) {
  geo.root = els.geography;
  cleanupGeography();
  try {
    const res = await fetch(PACKS_PATH);
    if (!res.ok) throw new Error(`Failed to load ${PACKS_PATH}`);
    const data = await res.json();
    geo.groups = data.groups || [];
    geo.packs = data.packs || geo.groups.flatMap((g) => g.packs || []);
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
