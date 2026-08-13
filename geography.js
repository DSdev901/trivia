/** Geography map quizzes: study, pin, name, type, capitals, flags. */

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

/** Pin and Type are the main map modes; the rest are practice variants. */
const MODE_META = {
  pin: {
    label: "Pin",
    blurb: "Find the named place on the map.",
  },
  type: {
    label: "Type",
    blurb: "Type the name of the highlighted place.",
  },
  outline: {
    label: "Outlines",
    blurb: "Identify the place from its silhouette.",
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
  group: null,
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
  _mapLabel: null,
  _panLimit: null,
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
    .replace(/\bst\b/g, "saint")
    .replace(/\s+/g, " ")
    .replace(/^the /, "")
    .trim();
}

const ANSWER_ALIAS_GROUPS = [
  ["united states", "usa", "us", "america", "united states of america"],
  ["united kingdom", "uk", "britain", "great britain", "england"],
  ["south korea", "republic of korea"],
  ["north korea", "dprk", "democratic peoples republic of korea"],
  ["united arab emirates", "uae"],
  ["washington d c", "washington dc", "dc"],
  ["czechia", "czech republic"],
  ["myanmar", "burma"],
  ["eswatini", "swaziland"],
  ["cabo verde", "cape verde"],
  ["ivory coast", "cote d ivoire", "cote divoire"],
  ["timor leste", "east timor"],
  ["north macedonia", "macedonia"],
  ["bosnia and herzegovina", "bosnia"],
  ["dr congo", "drc", "congo kinshasa", "democratic republic of the congo"],
  ["congo", "republic of the congo", "congo brazzaville"],
  ["vatican city", "vatican", "holy see"],
  ["netherlands", "holland"],
  ["yangtze chang jiang", "yangtze", "yangtze river", "chang jiang", "changjiang"],
  ["yellow river huang he", "yellow river", "huang he", "huanghe"],
  ["denali mount mckinley", "denali", "mount mckinley", "mt mckinley", "mckinley"],
  ["sea of japan east sea", "sea of japan", "east sea"],
  ["great wall of china", "great wall"],
  ["statue of liberty", "liberty"],
  ["christ the redeemer", "cristo redentor"],
  ["saint basil s cathedral", "st basil s cathedral", "st basils"],
  ["leptis magna", "leptis"],
  ["amur heilong jiang", "amur", "heilong jiang"],
  ["malabo", "ciudad de la paz", "oyala"],
  ["mbabane", "lobamba"],
  ["gqeberha port elizabeth", "gqeberha", "port elizabeth"],
  ["laayoun", "laayoune", "el aaiun", "el aioun"],
  ["n djamena", "ndjamena"],
  ["marrakesh", "marrakech"],
  ["addis ababa", "addis abeba"],
  ["kyiv", "kiev"],
  ["chennai madras", "chennai", "madras"],
  ["kolkata", "calcutta"],
  ["mumbai", "bombay"],
  ["ho chi minh city", "saigon", "ho chi minh"],
  ["beijing", "peking"],
  ["ulan bator", "ulaanbaatar"],
  ["turkiye", "turkey"],
  ["micronesia", "federated states of micronesia", "the federated states of micronesia"],
];

function answersMatch(input, expected, { kind } = {}) {
  const a = normalizeAnswer(input);
  const b = normalizeAnswer(expected);
  if (!a || !b) return false;
  if (a === b) return true;
  for (const group of ANSWER_ALIAS_GROUPS) {
    if (group.includes(a) && group.includes(b)) return true;
  }
  if (b === "washington d c" && a === "washington") return true;
  const strippedA = a.replace(
    /\b(river|mountains?|mt|mount|desert|sea|lake|ocean|range|strait|gulf|falls?|peninsula|canal)\b/g,
    " "
  ).replace(/\s+/g, " ").trim();
  const strippedB = b.replace(
    /\b(river|mountains?|mt|mount|desert|sea|lake|ocean|range|strait|gulf|falls?|peninsula|canal)\b/g,
    " "
  ).replace(/\s+/g, " ").trim();
  if (strippedA && strippedA.length >= 4 && strippedA === strippedB) return true;
  if (kind === "teams") {
    const last = b.split(" ").filter(Boolean).pop();
    if (last && last.length >= 4 && a === last) return true;
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

function injectFeatureMarkers(svgText, items) {
  let svg = svgText.replace(/\sclass="geo-region[^"]*"/g, ' class="geo-land-bg"');
  const r = items.length > 40 ? 3.4 : 4.2;
  const markers = items
    .filter((it) => Number.isFinite(it.x) && Number.isFinite(it.y))
    .map((it) => {
      const kind = it.kind ? ` geo-marker-${it.kind}` : "";
      return `<g class="geo-pin" data-id="${it.id}">
        <circle class="geo-marker-hit" cx="${it.x}" cy="${it.y}" r="12"/>
        <circle id="${it.id}" data-id="${it.id}" class="geo-region geo-marker${kind}" cx="${it.x}" cy="${it.y}" r="${r}"/>
      </g>`;
    })
    .join("\n  ");
  return svg.replace(/<\/svg>\s*$/i, `  ${markers}\n</svg>`);
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
  geo._panLimit = null;
  if (packMeta.map && MAPS[packMeta.map]) {
    const mapRes = await fetch(MAPS[packMeta.map]);
    if (!mapRes.ok) throw new Error(`Failed to load map ${packMeta.map}`);
    let svg = await mapRes.text();
    svg = svg.replace(/<\?xml[^>]*>/i, "").trim();
    // Let CSS own fills so quiz countries share one color
    svg = svg.replace(/\sfill="[^"]*"/gi, "");
    if (geo.pack?.overlay === "markers") {
      svg = injectFeatureMarkers(svg, geo.items);
    }
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
  const vb = geo._packViewBox || geo._baseViewBox;
  if (vb) svg.setAttribute("viewBox", vb);
  geo._panLimit = vb || geo._panLimit;
}

function viewBoxParts(raw) {
  const [x, y, w, h] = String(raw || "0 0 1000 520")
    .trim()
    .split(/\s+/)
    .map(Number);
  return {
    x: Number.isFinite(x) ? x : 0,
    y: Number.isFinite(y) ? y : 0,
    w: w > 0 ? w : 1000,
    h: h > 0 ? h : 520,
  };
}

function panLimitBox() {
  return viewBoxParts(geo._panLimit || geo._packViewBox || geo._baseViewBox);
}

function clampViewBox(vb) {
  const limit = panLimitBox();
  let { x, y, w, h } = vb;
  if (w > limit.w) {
    const s = limit.w / w;
    w = limit.w;
    h *= s;
  }
  if (h > limit.h) {
    const s = limit.h / h;
    h = limit.h;
    w *= s;
  }
  if (w >= limit.w - 0.001) x = limit.x + (limit.w - w) / 2;
  else x = Math.min(Math.max(x, limit.x), limit.x + limit.w - w);
  if (h >= limit.h - 0.001) y = limit.y + (limit.h - h) / 2;
  else y = Math.min(Math.max(y, limit.y), limit.y + limit.h - h);
  return { x, y, w, h };
}

function ensureBaseViewBox(svg) {
  if (!geo._baseViewBox) {
    geo._baseViewBox =
      svg.getAttribute("viewBox") ||
      `0 0 ${svg.width?.baseVal?.value || 1000} ${svg.height?.baseVal?.value || 520}`;
  }
}

const PATH_NUM_RE = /-?\d*\.?\d+(?:e[-+]?\d+)?/gi;
const CLUSTER_GAP = 45;
const DATELINE_FRACTION = 0.45;
const WIDE_COUNTRY_FRACTION = 0.3;

function trimNum(n) {
  return String(Math.round(n * 1000) / 1000);
}

function pairsFromPath(d) {
  const nums = [];
  String(d).replace(PATH_NUM_RE, (n) => {
    nums.push(parseFloat(n));
    return n;
  });
  const pts = [];
  for (let i = 0; i + 1 < nums.length; i += 2) pts.push([nums[i], nums[i + 1]]);
  return pts;
}

function boxFromPts(pts) {
  if (!pts.length) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of pts) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return {
    minX,
    minY,
    maxX,
    maxY,
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
    area: Math.max(0.01, (maxX - minX) * (maxY - minY)),
  };
}

function subpathRecords(d) {
  return String(d)
    .split(/(?=[Mm])/)
    .filter((chunk) => /^[Mm]/.test(chunk))
    .map((raw) => {
      const box = boxFromPts(pairsFromPath(raw));
      return box ? { ...box, raw } : null;
    })
    .filter(Boolean);
}

function circleRecord(el) {
  const cx = parseFloat(el.getAttribute("cx"));
  const cy = parseFloat(el.getAttribute("cy"));
  const r = parseFloat(el.getAttribute("r") || "5") || 5;
  if (Number.isNaN(cx) || Number.isNaN(cy)) return null;
  return {
    minX: cx - r,
    minY: cy - r,
    maxX: cx + r,
    maxY: cy + r,
    cx,
    cy,
    area: 4 * r * r,
  };
}

function elementParts(el) {
  if (el.tagName.toLowerCase() === "circle") {
    const rec = circleRecord(el);
    return rec ? [rec] : [];
  }
  const d = el.getAttribute("d");
  return d ? subpathRecords(d) : [];
}

function rectDist(a, b) {
  const dx = Math.max(0, b.minX - a.maxX, a.minX - b.maxX);
  const dy = Math.max(0, b.minY - a.maxY, a.minY - b.maxY);
  return Math.hypot(dx, dy);
}

function clusterParts(parts, gap = CLUSTER_GAP) {
  const n = parts.length;
  if (!n) return [];
  const parent = parts.map((_, i) => i);
  const find = (i) => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      if (rectDist(parts[i], parts[j]) <= gap) {
        const ri = find(i);
        const rj = find(j);
        if (ri !== rj) parent[rj] = ri;
      }
    }
  }
  const groups = new Map();
  parts.forEach((part, i) => {
    const root = find(i);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(part);
  });
  return [...groups.values()]
    .map((group) => {
      const minX = Math.min(...group.map((p) => p.minX));
      const minY = Math.min(...group.map((p) => p.minY));
      const maxX = Math.max(...group.map((p) => p.maxX));
      const maxY = Math.max(...group.map((p) => p.maxY));
      return {
        minX,
        minY,
        maxX,
        maxY,
        cx: (minX + maxX) / 2,
        cy: (minY + maxY) / 2,
        area: group.reduce((sum, p) => sum + p.area, 0),
      };
    })
    .sort((a, b) => b.area - a.area);
}

function mainlandForEl(el) {
  return clusterParts(elementParts(el))[0] || null;
}

function regionsForId(host, id) {
  return [...host.querySelectorAll(`.geo-region[data-id="${CSS.escape(id)}"]`)];
}

function bboxUnion(boxes) {
  if (!boxes.length) return null;
  return {
    minX: Math.min(...boxes.map((b) => b.minX)),
    minY: Math.min(...boxes.map((b) => b.minY)),
    maxX: Math.max(...boxes.map((b) => b.maxX)),
    maxY: Math.max(...boxes.map((b) => b.maxY)),
  };
}

function unwrapDx(cx, coreX, mapW) {
  if (cx - coreX > mapW * DATELINE_FRACTION) return -mapW;
  if (coreX - cx > mapW * DATELINE_FRACTION) return mapW;
  return 0;
}

function shiftPathXs(d, dx) {
  let expectingX = true;
  return String(d).replace(PATH_NUM_RE, (num) => {
    if (expectingX) {
      expectingX = false;
      return trimNum(parseFloat(num) + dx);
    }
    expectingX = true;
    return num;
  });
}

function packCorePoint(host, ids) {
  const cxs = [];
  const cys = [];
  for (const id of ids) {
    regionsForId(host, id).forEach((el) => {
      const m = mainlandForEl(el);
      if (!m) return;
      cxs.push(m.cx);
      cys.push(m.cy);
    });
  }
  if (!cxs.length) return null;
  cxs.sort((a, b) => a - b);
  cys.sort((a, b) => a - b);
  return {
    x: cxs[Math.floor(cxs.length / 2)],
    y: cys[Math.floor(cys.length / 2)],
  };
}

function mapSize(svg) {
  const raw = (geo._baseViewBox || svg.getAttribute("viewBox") || "0 0 1000 520")
    .split(/\s+/)
    .map(Number);
  return { mapW: raw[2] || 1000, mapH: raw[3] || 520 };
}

function isWorldCountriesMap() {
  return geo.pack?.map === "world-countries";
}

function packFitBounds(host, ids, { mapW, mapH, core }) {
  const boxes = [];
  for (const id of ids) {
    regionsForId(host, id).forEach((el) => {
      const m = mainlandForEl(el);
      if (!m) return;
      let { minX, minY, maxX, maxY, cx, cy } = m;
      const dx = core ? unwrapDx(cx, core.x, mapW) : 0;
      if (dx) {
        minX += dx;
        maxX += dx;
        cx += dx;
      }
      if (maxX - minX > mapW * WIDE_COUNTRY_FRACTION) return;
      boxes.push({ minX, minY, maxX, maxY, cx, cy });
    });
  }
  if (!boxes.length) return { useFullMap: true };
  const cxs = boxes.map((b) => b.cx).sort((a, b) => a - b);
  const cys = boxes.map((b) => b.cy).sort((a, b) => a - b);
  const mx = cxs[Math.floor(cxs.length / 2)];
  const my = cys[Math.floor(cys.length / 2)];
  const dists = boxes.map((b) => Math.hypot(b.cx - mx, b.cy - my)).sort((a, b) => a - b);
  const mad = dists[Math.floor(dists.length / 2)] || 1;
  const radius = Math.max(200, mad * 3);
  let kept = boxes.filter((b) => Math.hypot(b.cx - mx, b.cy - my) <= radius);
  if (kept.length < Math.max(2, Math.floor(boxes.length * 0.4))) kept = boxes;
  const bounds = bboxUnion(kept);
  if (!bounds) return { useFullMap: true };
  const w = bounds.maxX - bounds.minX;
  const h = bounds.maxY - bounds.minY;
  if (w > mapW * 0.62 && h > mapH * 0.55) return { useFullMap: true };
  return bounds;
}

function simpleBoundsForIds(host, ids) {
  const boxes = [];
  for (const id of ids) {
    regionsForId(host, id).forEach((el) => {
      try {
        const b = el.getBBox();
        if (!b.width && !b.height) return;
        boxes.push({
          minX: b.x,
          minY: b.y,
          maxX: b.x + b.width,
          maxY: b.y + b.height,
        });
      } catch {
        /* ignore */
      }
    });
  }
  return bboxUnion(boxes);
}

function mainlandBoundsForIds(host, ids) {
  const boxes = [];
  for (const id of ids) {
    regionsForId(host, id).forEach((el) => {
      const m = mainlandForEl(el);
      if (m) boxes.push(m);
    });
  }
  return bboxUnion(boxes);
}

function unwrapPackRegions(host, svg) {
  if (!isWorldCountriesMap() || host.dataset.geoUnwrapped === "1") return;
  const ids = [...packItemIds()];
  if (ids.length < 3) return;
  const { mapW, mapH } = mapSize(svg);
  const core = packCorePoint(host, ids);
  if (!core) return;
  const preview = packFitBounds(host, ids, { mapW, mapH, core });
  if (!preview || preview.useFullMap) return;

  ids.forEach((id) => {
    regionsForId(host, id).forEach((el) => {
      if (el.tagName.toLowerCase() === "circle") {
        const rec = circleRecord(el);
        if (!rec) return;
        const dx = unwrapDx(rec.cx, core.x, mapW);
        if (dx) {
          const nx = trimNum(rec.cx + dx);
          el.setAttribute("cx", nx);
          const hit = el.closest(".geo-pin")?.querySelector(".geo-marker-hit");
          if (hit) hit.setAttribute("cx", nx);
        }
        return;
      }
      const d = el.getAttribute("d");
      if (!d) return;
      const next = d
        .split(/(?=[Mm])/)
        .map((chunk) => {
          if (!/^[Mm]/.test(chunk)) return chunk;
          const rec = subpathRecords(chunk)[0];
          if (!rec) return chunk;
          const dx = unwrapDx(rec.cx, core.x, mapW);
          return dx ? shiftPathXs(chunk, dx) : chunk;
        })
        .join("");
      if (next !== d) el.setAttribute("d", next);
    });
  });
  host.dataset.geoUnwrapped = "1";
}

function coverOcean(svg, minX, minY, w, h) {
  const rect = svg.querySelector("rect.geo-ocean-bg");
  if (!rect) return;
  const pad = 250;
  rect.setAttribute("x", String(minX - pad));
  rect.setAttribute("y", String(minY - pad));
  rect.setAttribute("width", String(w + pad * 2));
  rect.setAttribute("height", String(h + pad * 2));
}

function applyViewBox(svg, bounds, padRatio, storeAsPack) {
  const { minX, minY, maxX, maxY } = bounds;
  const pad = Math.max(10, (maxX - minX) * padRatio, (maxY - minY) * padRatio);
  const w = Math.max(30, maxX - minX + pad * 2);
  const h = Math.max(30, maxY - minY + pad * 2);
  const vb = `${minX - pad} ${minY - pad} ${w} ${h}`;
  svg.setAttribute("viewBox", vb);
  coverOcean(svg, minX - pad, minY - pad, w, h);
  if (storeAsPack) geo._packViewBox = vb;
  geo._panLimit = vb;
}

function fitMapToIds(ids, { padRatio = 0.12, storeAsPack = false } = {}) {
  const host = geo.root?.querySelector("#geo-map");
  const svg = host?.querySelector("svg");
  if (!host || !svg) return;
  ensureBaseViewBox(svg);
  unwrapPackRegions(host, svg);

  let bounds;
  if (isWorldCountriesMap()) {
    if (ids.length <= 1) {
      bounds = mainlandBoundsForIds(host, ids);
    } else {
      const { mapW, mapH } = mapSize(svg);
      const core = packCorePoint(host, ids);
      bounds = packFitBounds(host, ids, { mapW, mapH, core });
      if (bounds?.useFullMap) {
        resetMapViewBox();
        if (storeAsPack) geo._packViewBox = geo._baseViewBox;
        geo._panLimit = geo._packViewBox || geo._baseViewBox;
        return;
      }
    }
  } else {
    bounds = simpleBoundsForIds(host, ids);
  }

  if (!bounds) {
    resetMapViewBox();
    return;
  }
  applyViewBox(svg, bounds, padRatio, storeAsPack);
}

function paintMap(activeId = null, { dimOthers = false, flash = null } = {}) {
  const host = geo.root?.querySelector("#geo-map");
  if (!host) return;
  const outline = isOutlineView() && activeId;
  const correctId = flash?.correctId ?? (flash?.ok ? flash.id : null);
  const wrongId = flash?.wrongId ?? (flash && flash.ok === false ? flash.id : null);
  host.classList.toggle("is-outline-mode", Boolean(outline));
  host.classList.toggle("is-feature-map", geo.pack?.overlay === "markers");
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
      el.classList.toggle("is-correct", correctId === id);
      el.classList.toggle("is-wrong", wrongId === id);
      return;
    }
    el.classList.toggle("is-silhouette", false);
    el.classList.toggle("is-hidden-outline", false);
    const out = scopePack && !inPack.has(id);
    el.classList.toggle("is-out", out);
    el.classList.toggle("is-active", !out && id === activeId && !correctId && !wrongId);
    el.classList.toggle(
      "is-dim",
      !out && dimOthers && id !== activeId && id !== correctId && id !== wrongId
    );
    el.classList.toggle("is-correct", !out && correctId === id);
    el.classList.toggle("is-wrong", !out && wrongId === id);
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
  if (outline) setMapLabel(host, null);
  else if (correctId) setMapLabel(host, correctId);
  else if (geo.mode === "study" && activeId) setMapLabel(host, activeId);
  else setMapLabel(host, null);
}

function mapTargetId(e) {
  const pin = e.target.closest?.(".geo-pin");
  if (pin) {
    const visual = pin.querySelector(".geo-region");
    if (visual?.classList.contains("is-out")) return null;
    return pin.dataset.id || visual?.dataset.id || visual?.id || null;
  }
  const el = e.target.closest?.(".geo-region");
  if (!el || el.classList.contains("is-out")) return null;
  return el.dataset.id || el.id || null;
}

function pinTargetNoun() {
  const id = (geo.pack?.id || "").toLowerCase();
  const name = (geo.pack?.name || "").toLowerCase();
  const blob = `${id} ${name}`;
  if (blob.includes("landmark")) return "landmark";
  if (blob.includes("cities") || blob.includes("city")) return "city";
  if (blob.includes("river")) return "river";
  if (blob.includes("lake")) return "lake";
  if (geo.pack?.overlay === "markers") {
    const kinds = new Set(geo.items.map((i) => i.kind).filter(Boolean));
    if (kinds.size === 1) {
      const k = [...kinds][0];
      if (k === "landmark") return "landmark";
      if (k === "city") return "city";
    }
    return "place";
  }
  const q = quizKind();
  if (q === "capitals" || q === "countries") return "country";
  if (q === "teams") return "team";
  if (blob.includes("continent")) return "continent";
  return "region";
}

function setMapLabel(host, id) {
  const item = id ? byId(id) : null;
  geo._mapLabel = item ? { id: item.id, name: item.name } : null;
  drawMapLabel(host);
}

function drawMapLabel(host) {
  if (!host) return;
  host.querySelectorAll(".geo-marker-label").forEach((n) => n.remove());
  const spec = geo._mapLabel;
  if (!spec) return;
  const svg = host.querySelector("svg");
  const marker = host.querySelector(
    `.geo-region.geo-marker[data-id="${CSS.escape(spec.id)}"]`
  );
  if (!svg || !marker) return;
  const cx = parseFloat(marker.getAttribute("cx"));
  const cy = parseFloat(marker.getAttribute("cy"));
  if (!Number.isFinite(cx) || !Number.isFinite(cy)) return;

  const vb = svg.viewBox.baseVal;
  const rect = svg.getBoundingClientRect();
  const unit = vb.width / Math.max(rect.width, 1);
  const fontSize = 12.5 * unit;
  const padX = 6 * unit;
  const padY = 3.2 * unit;
  const gap = 10 * unit;
  const placeAbove = cy - vb.y > fontSize * 3;
  const NS = "http://www.w3.org/2000/svg";

  const g = document.createElementNS(NS, "g");
  g.setAttribute("class", "geo-marker-label");
  g.setAttribute("pointer-events", "none");

  const text = document.createElementNS(NS, "text");
  text.setAttribute("class", "geo-marker-label-text");
  text.setAttribute("x", String(cx));
  text.setAttribute("y", String(placeAbove ? cy - gap : cy + gap));
  text.setAttribute("text-anchor", "middle");
  text.setAttribute("dominant-baseline", placeAbove ? "auto" : "hanging");
  text.setAttribute("font-size", String(fontSize));
  text.textContent = spec.name;
  g.appendChild(text);
  svg.appendChild(g);

  let bbox;
  try {
    bbox = text.getBBox();
  } catch {
    return;
  }
  if (!bbox.width || !bbox.height) return;
  const bg = document.createElementNS(NS, "rect");
  bg.setAttribute("class", "geo-marker-label-bg");
  bg.setAttribute("x", String(bbox.x - padX));
  bg.setAttribute("y", String(bbox.y - padY));
  bg.setAttribute("width", String(bbox.width + padX * 2));
  bg.setAttribute("height", String(bbox.height + padY * 2));
  bg.setAttribute("rx", String(3.2 * unit));
  g.insertBefore(bg, text);
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
    const next = clampViewBox(vb);
    svg.setAttribute("viewBox", `${next.x} ${next.y} ${next.w} ${next.h}`);
    drawMapLabel(host);
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
      let nw = vb.w * factor;
      let nh = vb.h * factor;
      const limit = panLimitBox();
      const minW = limit.w * 0.08;
      if (nw < minW) {
        const s = minW / nw;
        nw = minW;
        nh *= s;
      }
      if (nw > limit.w || nh > limit.h) {
        const s = Math.min(limit.w / nw, limit.h / nh);
        nw *= s;
        nh *= s;
      }
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
    const onPin = e.target.closest?.(".geo-pin");
    const onRegion =
      onPin || e.target.closest?.(".geo-region:not(.is-out)");
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
  if (mode === "pin") {
    if (kind === "capitals" && item.capital) {
      return `Find <strong>${escapeHtml(item.capital)}</strong> on the map.`;
    }
    return `Find <strong>${escapeHtml(item.name)}</strong> on the map.`;
  }
  if (mode === "outline") return `What place is this outline?`;
  if (mode === "name") {
    if (isOutlineView()) return `What place is this outline?`;
    if (kind === "capitals") return `What is the capital of the highlighted country?`;
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
  if (
    (mode === "type" || mode === "choice" || mode === "name") &&
    kind === "capitals"
  ) {
    return item.capital;
  }
  if (mode === "reverse" || kind === "flags") return item.name;
  return item.name;
}

function buildChoices(item) {
  const mode = geo.mode;
  const kind = quizKind();
  let correct = expectedAnswer(item);
  let poolKeys;

  if (
    mode === "capitals" ||
    ((mode === "choice" || mode === "name") && kind === "capitals")
  ) {
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

function packById(id) {
  return (
    (geo.group?.packs || []).find((p) => p.id === id) ||
    geo.packs.find((p) => p.id === id) ||
    null
  );
}

function continentCardHtml(g) {
  const n = (g.packs || []).length;
  return `
    <button type="button" class="geo-continent-card" data-group="${escapeHtml(g.id)}">
      <h3>${escapeHtml(g.name)}</h3>
      <p>${escapeHtml(g.blurb || "Map quizzes by region.")}</p>
      <span class="meta">${n} quiz${n === 1 ? "" : "zes"}</span>
    </button>`;
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
  geo.group = null;
  geo.pack = null;
  geo.mode = null;
  geo.root.innerHTML = `
    <div class="geo-shell">
      <div class="geo-head">
        <div>
          <h2 class="section-title">Geography</h2>
          <p class="lede">Choose a continent, then a quiz — <strong>Pin</strong> the map or <strong>Type</strong> the name.</p>
        </div>
      </div>
      <div class="geo-continent-grid">
        ${geo.groups.map(continentCardHtml).join("")}
      </div>
    </div>`;

  geo.root.querySelectorAll(".geo-continent-card").forEach((btn) => {
    btn.addEventListener("click", () => {
      geo.group = geo.groups.find((g) => g.id === btn.dataset.group) || null;
      renderGroup();
    });
  });
}

function renderGroup() {
  const g = geo.group;
  if (!g) {
    renderHub();
    return;
  }
  const sections =
    g.sections?.length > 0
      ? g.sections
      : [{ name: "Quizzes", packIds: (g.packs || []).map((p) => p.id) }];
  geo.root.innerHTML = `
    <div class="geo-shell">
      <div class="geo-head">
        <div>
          <p class="speech-kicker">Geography</p>
          <h2 class="section-title">${escapeHtml(g.name)}</h2>
          <p class="lede">${escapeHtml(g.blurb || "Map quizzes by region.")}</p>
        </div>
        <button type="button" class="secondary-btn" id="geo-back-continents">All continents</button>
      </div>
      ${sections
        .map((sec) => {
          const packs = (sec.packIds || [])
            .map((id) => (g.packs || []).find((p) => p.id === id) || packById(id))
            .filter(Boolean);
          if (!packs.length) return "";
          return `
            <section class="geo-group">
              <h3 class="geo-group-title">${escapeHtml(sec.name)}</h3>
              ${
                sec.blurb
                  ? `<p class="geo-section-lede">${escapeHtml(sec.blurb)}</p>`
                  : ""
              }
              <div class="geo-pack-grid">
                ${packs.map(packCardHtml).join("")}
              </div>
            </section>`;
        })
        .join("")}
    </div>`;

  geo.root.querySelector("#geo-back-continents")?.addEventListener("click", () => {
    geo.group = null;
    renderHub();
  });
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
        <button type="button" class="secondary-btn" id="geo-back-hub">${
          geo.group ? `Back to ${escapeHtml(geo.group.name)}` : "All continents"
        }</button>
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
    geo._panLimit = null;
    if (geo.group) renderGroup();
    else renderHub();
  });
  geo.root.querySelectorAll(".geo-mode-card").forEach((btn) => {
    btn.addEventListener("click", () => startMode(btn.dataset.mode));
  });
}

function startMode(mode) {
  geo.mode = mode;
  const pool =
    mode === "capitals" ? geo.items.filter((i) => i.capital) : geo.items;
  geo.queue = mode === "study" ? [...geo.items] : shuffle(pool);
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

  paintMap(geo.selectedId, { dimOthers: true });
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
    const id = mapTargetId(e);
    if (!id || !byId(id)) return;
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
      <p class="geo-hint">Tap the correct ${escapeHtml(pinTargetNoun())} on the map.</p>`;
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
      const id = mapTargetId(e);
      if (!id) return;
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
      const ok = answersMatch(input.value, expectedAnswer(item), {
        kind: quizKind(),
      });
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
      dimOthers: true,
      flash: {
        correctId: item.id,
        wrongId:
          !ok && clickedMapId && clickedMapId !== item.id ? clickedMapId : null,
      },
    });
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
          <button type="button" class="secondary-btn" id="geo-to-hub">${
            geo.group ? `Back to ${escapeHtml(geo.group.name)}` : "All continents"
          }</button>
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
    if (geo.group) renderGroup();
    else renderHub();
  });
}

async function openPack(packId) {
  const meta = packById(packId);
  if (!meta) return;
  try {
    await loadPack(meta);
    renderPackModes();
  } catch (err) {
    geo.root.innerHTML = `<p class="error">${escapeHtml(err.message)}</p>`;
  }
}

export function cleanupGeography() {
  geo.group = null;
  geo.pack = null;
  geo.mode = null;
  geo.queue = [];
  geo.items = [];
  geo.mapSvg = "";
  geo._baseViewBox = null;
  geo._packViewBox = null;
  geo._panLimit = null;
  geo._mapLabel = null;
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
  return Boolean(geo.pack || geo.group);
}

export function geographyGoBack() {
  if (geo.mode) {
    geo.mode = null;
    renderPackModes();
    return true;
  }
  if (geo.pack) {
    geo.pack = null;
    if (geo.group) renderGroup();
    else renderHub();
    return true;
  }
  if (geo.group) {
    geo.group = null;
    renderHub();
    return true;
  }
  return false;
}
