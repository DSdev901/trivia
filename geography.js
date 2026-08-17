/** Geography map quizzes: study, pin, name, type, capitals, flags. */

const PACKS_PATH = "data/geography/packs.json";
const MAPS = {
  continents: "data/geography/maps/continents.svg",
  "continents-oceans": "data/geography/maps/continents-oceans.svg",
  "continents-cartoon": "data/geography/maps/continents-cartoon.svg",
  "world-countries": "data/geography/maps/world-countries.svg",
  "us-states": "data/geography/maps/us-states.svg",
  "canada-provinces": "data/geography/maps/canada-provinces.svg",
  "world-physical": "data/geography/maps/world-physical.svg",
  "na-physical": "data/geography/maps/na-physical.svg",
  "nba-teams": "data/geography/maps/nba-teams.svg",
  "mlb-teams": "data/geography/maps/mlb-teams.svg",
  "nhl-teams": "data/geography/maps/nhl-teams.svg",
  "mls-teams": "data/geography/maps/mls-teams.svg",
};

const ISO_CONT = {
  US: "NA", CA: "NA", MX: "NA", GT: "NA", BZ: "NA", SV: "NA", HN: "NA", NI: "NA",
  CR: "NA", PA: "NA", CU: "NA", JM: "NA", HT: "NA", DO: "NA", BS: "NA", TT: "NA",
  BB: "NA", GD: "NA", LC: "NA", VC: "NA", AG: "NA", KN: "NA", DM: "NA", GL: "NA",
  BR: "SA", AR: "SA", CL: "SA", PE: "SA", CO: "SA", VE: "SA", EC: "SA", BO: "SA",
  PY: "SA", UY: "SA", GY: "SA", SR: "SA", GF: "SA", FK: "SA",
  IS: "EU", IE: "EU", GB: "EU", PT: "EU", ES: "EU", FR: "EU", BE: "EU", NL: "EU",
  LU: "EU", DE: "EU", CH: "EU", AT: "EU", LI: "EU", IT: "EU", SM: "EU", VA: "EU",
  MT: "EU", MC: "EU", AD: "EU", PL: "EU", CZ: "EU", SK: "EU", HU: "EU", SI: "EU",
  HR: "EU", BA: "EU", RS: "EU", ME: "EU", MK: "EU", AL: "EU", GR: "EU", BG: "EU",
  RO: "EU", MD: "EU", UA: "EU", BY: "EU", LT: "EU", LV: "EU", EE: "EU", FI: "EU",
  SE: "EU", NO: "EU", DK: "EU", XK: "EU",
  MA: "AF", EH: "AF", DZ: "AF", TN: "AF", LY: "AF", EG: "AF", SD: "AF", SS: "AF",
  TD: "AF", NE: "AF", ML: "AF", MR: "AF", SN: "AF", GM: "AF", GW: "AF", GN: "AF",
  SL: "AF", LR: "AF", CI: "AF", GH: "AF", TG: "AF", BJ: "AF", NG: "AF", BF: "AF",
  CM: "AF", GQ: "AF", GA: "AF", CG: "AF", CD: "AF", CF: "AF", AO: "AF", ZM: "AF",
  MW: "AF", MZ: "AF", ZW: "AF", BW: "AF", NA: "AF", ZA: "AF", LS: "AF", SZ: "AF",
  MG: "AF", MU: "AF", SC: "AF", KM: "AF", DJ: "AF", ER: "AF", ET: "AF", SO: "AF",
  KE: "AF", UG: "AF", RW: "AF", BI: "AF", TZ: "AF", ST: "AF", CV: "AF",
  RU: "AS", TR: "AS", CY: "AS", GE: "AS", AM: "AS", AZ: "AS", KZ: "AS", UZ: "AS",
  TM: "AS", KG: "AS", TJ: "AS", AF: "AS", PK: "AS", IN: "AS", NP: "AS", BT: "AS",
  BD: "AS", LK: "AS", MV: "AS", CN: "AS", MN: "AS", KP: "AS", KR: "AS", JP: "AS",
  TW: "AS", VN: "AS", LA: "AS", KH: "AS", TH: "AS", MM: "AS", MY: "AS", SG: "AS",
  BN: "AS", ID: "AS", PH: "AS", TL: "AS", IR: "AS", IQ: "AS", SY: "AS", LB: "AS",
  IL: "AS", PS: "AS", JO: "AS", SA: "AS", YE: "AS", OM: "AS", AE: "AS", QA: "AS",
  BH: "AS", KW: "AS",
  AU: "OC", NZ: "OC", PG: "OC", SB: "OC", VU: "OC", NC: "OC", FJ: "OC", TO: "OC",
  WS: "OC", KI: "OC", TV: "OC", NR: "OC", PW: "OC", FM: "OC", MH: "OC",
};

const LANDLOCKED = new Set([
  "AD", "AF", "AM", "AT", "AZ", "BY", "BF", "BI", "BO", "BT", "BW", "CF", "CH",
  "CZ", "ET", "HU", "KG", "KZ", "LA", "LI", "LS", "LU", "MD", "MK", "ML", "MN",
  "MW", "NE", "NP", "PY", "RS", "RW", "SK", "SM", "SS", "SZ", "TD", "TJ", "TM",
  "UG", "UZ", "VA", "XK", "ZM", "ZW",
]);

/** Pin and Type are the main map modes; the rest are practice variants. */
const MODE_META = {
  pin: {
    label: "Pin",
    blurb: "Find the named place on the map. Two misses, then the answer is shown.",
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
    blurb: "A place is highlighted — pick the matching answer from four options.",
  },
  capitals: {
    label: "Capitals",
    blurb: "Name the capital of the highlighted state, province, or country.",
  },
  abbr: {
    label: "Abbreviations",
    blurb: "Match names and two-letter postal codes.",
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
  _focusHalo: false,
  _panLimit: null,
  _zoomAnim: 0,
  _pinMisses: 0,
  _pinMissTimer: 0,
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
  ["newfoundland and labrador", "newfoundland"],
  ["prince edward island", "pei"],
  ["saint john s", "saint johns", "st johns"],
  ["greater sudbury", "sudbury"],
  ["sault ste marie", "sault saint marie", "the soo"],
  ["northwest territories", "nwt"],
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
  const r = items.length > 40 ? 2 : 2.35;
  const markers = items
    .filter((it) => Number.isFinite(it.x) && Number.isFinite(it.y))
    .map((it) => {
      const kind = it.kind ? ` geo-marker-${it.kind}` : "";
      return `<g class="geo-pin" data-id="${it.id}">
        <circle class="geo-marker-hit" cx="${it.x}" cy="${it.y}" r="${r}"/>
        <circle id="${it.id}" data-id="${it.id}" class="geo-region geo-marker${kind}" cx="${it.x}" cy="${it.y}" r="${r}"/>
      </g>`;
    })
    .join("\n  ");
  return svg.replace(/<\/svg>\s*$/i, `  ${markers}\n</svg>`);
}

function ensureMarkerPins(host) {
  const svg = host?.querySelector("svg");
  if (!svg || svg.dataset.geoPinsWrapped === "1") return;
  const NS = "http://www.w3.org/2000/svg";
  svg.querySelectorAll(".geo-region.geo-marker").forEach((el) => {
    if (el.closest(".geo-pin")) return;
    const g = document.createElementNS(NS, "g");
    g.setAttribute("class", "geo-pin");
    const id = el.dataset.id || el.id;
    if (id) g.setAttribute("data-id", id);
    const hit = document.createElementNS(NS, "circle");
    hit.setAttribute("class", "geo-marker-hit");
    hit.setAttribute("cx", el.getAttribute("cx") || "0");
    hit.setAttribute("cy", el.getAttribute("cy") || "0");
    hit.setAttribute("r", el.getAttribute("r") || "3");
    el.parentNode?.insertBefore(g, el);
    g.append(hit, el);
  });
  svg.dataset.geoPinsWrapped = "1";
}

/** Nudge stacked pins apart so overlapping features stay separately tappable. */
function spreadClosePins(host) {
  const svg = host?.querySelector("svg");
  if (!svg || svg.dataset.geoPinsSpread === "1") return;
  if (!host.isConnected) return;
  const rect = svg.getBoundingClientRect();
  if (rect.width < 8) {
    requestAnimationFrame(() => spreadClosePins(host));
    return;
  }
  const pins = [...svg.querySelectorAll(".geo-pin")];
  if (pins.length < 2) {
    svg.dataset.geoPinsSpread = "1";
    return;
  }
  const vb = viewBoxParts(svg.getAttribute("viewBox"));
  const unit = vb.w / rect.width;
  const minDist = 22 * unit;
  const maxNudge = 28 * unit;
  const pts = [];
  for (const g of pins) {
    const c = g.querySelector(".geo-region") || g.querySelector("circle");
    if (!c) continue;
    const x = parseFloat(c.getAttribute("cx"));
    const y = parseFloat(c.getAttribute("cy"));
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    pts.push({
      c,
      hit: g.querySelector(".geo-marker-hit"),
      x,
      y,
      ox: x,
      oy: y,
    });
  }
  for (let iter = 0; iter < 14; iter += 1) {
    let moved = false;
    for (let i = 0; i < pts.length; i += 1) {
      for (let j = i + 1; j < pts.length; j += 1) {
        const a = pts[i];
        const b = pts[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let d = Math.hypot(dx, dy);
        if (d < 1e-6) {
          dx = 1;
          dy = 0;
          d = 1;
        }
        if (d >= minDist) continue;
        const push = (minDist - d) / 2;
        const ux = dx / d;
        const uy = dy / d;
        a.x -= ux * push;
        a.y -= uy * push;
        b.x += ux * push;
        b.y += uy * push;
        moved = true;
      }
    }
    if (!moved) break;
  }
  for (const p of pts) {
    const ndx = p.x - p.ox;
    const ndy = p.y - p.oy;
    const n = Math.hypot(ndx, ndy);
    if (n > maxNudge) {
      p.x = p.ox + (ndx / n) * maxNudge;
      p.y = p.oy + (ndy / n) * maxNudge;
    }
    const x = trimNum(p.x);
    const y = trimNum(p.y);
    p.c.setAttribute("cx", x);
    p.c.setAttribute("cy", y);
    if (p.hit) {
      p.hit.setAttribute("cx", x);
      p.hit.setAttribute("cy", y);
    }
  }
  svg.dataset.geoPinsSpread = "1";
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

function playUsesMap() {
  return (
    Boolean(geo.mapSvg) &&
    ["pin", "name", "type", "capitals", "outline", "choice"].includes(geo.mode)
  );
}

function playHighlightsTarget(afterAnswer = false) {
  if (!playUsesMap()) return false;
  if (geo.mode === "pin") return afterAnswer;
  return true;
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

/** Skip specks (Prince Edward Islands, etc.) that inflate a country's bbox. */
function compactMainlandForEl(el, core = null) {
  const parts = elementParts(el);
  if (!parts.length) return null;
  const maxA = Math.max(...parts.map((p) => p.area));
  const kept = parts.filter((p) => p.area >= maxA * 0.02);
  const clusters = clusterParts(kept.length ? kept : parts);
  if (!clusters.length) return null;
  if (!core || clusters.length === 1) return clusters[0];
  let nearest = clusters[0];
  let nearestD = Infinity;
  for (const c of clusters) {
    const d = Math.hypot(c.cx - core.x, c.cy - core.y);
    if (d < nearestD) {
      nearestD = d;
      nearest = c;
    }
  }
  const largest = clusters[0];
  const far = Math.hypot(largest.cx - core.x, largest.cy - core.y);
  if (far > Math.max(nearestD * 1.8, 70)) return nearest;
  return largest;
}

function clipWideBox(box, core, mapW) {
  if (!box || !core || !mapW) return box;
  const w = box.maxX - box.minX;
  if (w < mapW * 0.18) return box;
  const reach = mapW * 0.14;
  const minX = Math.max(box.minX, core.x - reach);
  const maxX = Math.min(box.maxX, core.x + reach);
  if (maxX - minX < 8) return box;
  return {
    ...box,
    minX,
    maxX,
    cx: (minX + maxX) / 2,
    area: (maxX - minX) * Math.max(0, box.maxY - box.minY),
  };
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
      const m = compactMainlandForEl(el);
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

function packFitPadRatio() {
  // Marker packs have no land extent, so a country-style 3% crop sits on top of the dots.
  if (geo.pack?.overlay === "markers") return 0.32;
  return 0.03;
}

function paddedViewBox(bounds, padRatio) {
  const { minX, minY, maxX, maxY } = bounds;
  const bw = Math.max(1, maxX - minX);
  const bh = Math.max(1, maxY - minY);
  const minPad = geo.pack?.overlay === "markers" ? 36 : 8;
  const padX = Math.max(minPad, bw * padRatio);
  const padY = Math.max(minPad, bh * padRatio);
  return {
    x: minX - padX,
    y: minY - padY,
    w: Math.max(30, bw + padX * 2),
    h: Math.max(30, bh + padY * 2),
  };
}

function viewBoxAttr(vb) {
  return `${vb.x} ${vb.y} ${vb.w} ${vb.h}`;
}

function unionViewBox(a, b) {
  const minX = Math.min(a.x, b.x);
  const minY = Math.min(a.y, b.y);
  const maxX = Math.max(a.x + a.w, b.x + b.w);
  const maxY = Math.max(a.y + a.h, b.y + b.h);
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

function applyViewBox(svg, bounds, padRatio, storeAsPack) {
  const vb = paddedViewBox(bounds, padRatio);
  svg.setAttribute("viewBox", viewBoxAttr(vb));
  coverOcean(svg, vb.x, vb.y, vb.w, vb.h);
  if (storeAsPack) geo._packViewBox = viewBoxAttr(vb);
  geo._panLimit = viewBoxAttr(vb);
  return vb;
}

function boundsArea(b) {
  if (!b || b.useFullMap) return 0;
  return Math.max(0, b.maxX - b.minX) * Math.max(0, b.maxY - b.minY);
}

function allRegionIds(host) {
  return [
    ...new Set(
      [...host.querySelectorAll(".geo-region")]
        .map((el) => el.dataset.id || el.id)
        .filter(Boolean)
    ),
  ];
}

function quizBoundsForIds(host, ids, { mapW, mapH, core, coreOnly = false } = {}) {
  const boxes = [];
  for (const id of ids) {
    regionsForId(host, id).forEach((el) => {
      const m = compactMainlandForEl(el, core);
      if (!m) return;
      let { minX, minY, maxX, maxY, cx, cy, area } = m;
      const dx = core ? unwrapDx(cx, core.x, mapW || 1000) : 0;
      if (dx) {
        minX += dx;
        maxX += dx;
        cx += dx;
      }
      let box = { minX, minY, maxX, maxY, cx, cy, area };
      if (coreOnly) box = clipWideBox(box, core, mapW);
      boxes.push(box);
    });
  }
  const used = coreOnly ? coreLandBoxes(boxes) : boxes;
  const bounds = bboxUnion(used);
  if (!bounds) return { useFullMap: true };
  const w = bounds.maxX - bounds.minX;
  const h = bounds.maxY - bounds.minY;
  if (mapW && mapH && w > mapW * 0.62 && h > mapH * 0.55) return { useFullMap: true };
  return bounds;
}

function coreLandBoxes(boxes) {
  if (boxes.length < 8) return boxes;
  const cxs = boxes.map((b) => b.cx).sort((a, b) => a - b);
  const cys = boxes.map((b) => b.cy).sort((a, b) => a - b);
  const mx = cxs[Math.floor(cxs.length / 2)];
  const my = cys[Math.floor(cys.length / 2)];
  const maxA = Math.max(...boxes.map((b) => b.area || 0));
  const dists = boxes.map((b) => Math.hypot(b.cx - mx, b.cy - my));
  const mad =
    [...dists].sort((a, b) => a - b)[Math.floor(dists.length / 2)] || 1;
  const kept = boxes.filter((b, i) => {
    const huge = (b.area || 0) >= maxA * 0.25;
    if (huge && dists[i] > mad * 1.7) return false;
    if ((b.area || 0) >= maxA * 0.04) return true;
    return dists[i] <= mad * 1.7;
  });
  if (kept.length < Math.max(4, Math.floor(boxes.length * 0.65))) return boxes;
  return kept;
}

function boundsForFitIds(host, svg, ids, { coreOnly = false } = {}) {
  if (isWorldCountriesMap()) {
    if (ids.length <= 1) return mainlandBoundsForIds(host, ids);
    const { mapW, mapH } = mapSize(svg);
    const core = packCorePoint(host, ids);
    return quizBoundsForIds(host, ids, { mapW, mapH, core, coreOnly });
  }
  return simpleBoundsForIds(host, ids);
}

/** Extra land the player can pan into; the camera still fits only quiz places. */
function panIdsForPack(host, inPack) {
  const ids = [...inPack];
  if (!host || geo.pack?.overlay === "markers") return ids;

  if (geo.pack?.map === "us-states" || geo.pack?.map === "canada-provinces") {
    const all = allRegionIds(host);
    return ids.length < all.length * 0.85 ? all : ids;
  }

  if (!isWorldCountriesMap()) return ids;
  const conts = new Set(ids.map((id) => ISO_CONT[id]).filter(Boolean));
  if (conts.size !== 1) return ids;
  const contIds = Object.keys(ISO_CONT).filter((iso) => ISO_CONT[iso] === [...conts][0]);
  if (!contIds.length || ids.length >= contIds.length * 0.85) return ids;

  const svg = host.querySelector("svg");
  if (!svg) return ids;
  const { mapW, mapH } = mapSize(svg);
  const packB = quizBoundsForIds(host, ids, {
    mapW,
    mapH,
    core: packCorePoint(host, ids),
  });
  const contB = quizBoundsForIds(host, contIds, {
    mapW,
    mapH,
    core: packCorePoint(host, contIds),
  });
  const packA = boundsArea(packB);
  const contA = boundsArea(contB);
  if (contA > 0 && packA / contA >= 0.2) return contIds;
  return ids;
}

function fitMapToIds(ids, { padRatio = 0.12, storeAsPack = false, panIds = null } = {}) {
  const host = geo.root?.querySelector("#geo-map");
  const svg = host?.querySelector("svg");
  if (!host || !svg) return;
  ensureBaseViewBox(svg);
  unwrapPackRegions(host, svg);

  const bounds = boundsForFitIds(host, svg, ids, { coreOnly: true });
  if (!bounds || bounds.useFullMap) {
    resetMapViewBox();
    if (storeAsPack) geo._packViewBox = geo._baseViewBox;
    geo._panLimit = geo._packViewBox || geo._baseViewBox;
    return;
  }

  const packVb = applyViewBox(svg, bounds, padRatio, storeAsPack);
  const panSource = panIds?.length ? panIds : ids;
  const panBounds = boundsForFitIds(host, svg, panSource);
  if (!panBounds || panBounds.useFullMap) return;
  const panVb = unionViewBox(packVb, paddedViewBox(panBounds, Math.max(padRatio, 0.1)));
  geo._panLimit = viewBoxAttr(panVb);
  coverOcean(svg, panVb.x, panVb.y, panVb.w, panVb.h);
}

function paintMap(activeId = null, { dimOthers = false, flash = null } = {}) {
  const host = geo.root?.querySelector("#geo-map");
  if (!host) return;
  ensureMarkerPins(host);
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
    el.classList.toggle("is-wrong", !out && wrongId === id && Boolean(correctId));
    el.classList.toggle("is-miss-flash", !out && wrongId === id && !correctId);
  });
  if (outline) {
    if (host.dataset.geoOutlineId !== activeId) {
      fitMapToIds([activeId], { padRatio: 0.05 });
      host.dataset.geoOutlineId = activeId;
    }
  } else if (scopePack) {
    if (host.dataset.geoFitted !== "1") {
      const packIds = [...inPack];
      fitMapToIds(packIds, {
        padRatio: packFitPadRatio(),
        storeAsPack: !geo._packViewBox,
        panIds: panIdsForPack(host, inPack),
      });
      if (geo._packViewBox) {
        host.querySelector("svg")?.setAttribute("viewBox", geo._packViewBox);
      }
      host.dataset.geoFitted = "1";
    }
  } else {
    resetMapViewBox();
  }
  if (!outline) {
    ensureBorderOverlay(host);
    syncTinyIslandScale(host);
    spreadClosePins(host);
  }
  if (outline) setMapLabel(host, null);
  else if (correctId) {
    scheduleFocusPlace(host, correctId);
  } else if (geo.mode === "study" && activeId) {
    const svg = host.querySelector("svg");
    stopFocusZoom();
    if (svg && geo._packViewBox) svg.setAttribute("viewBox", geo._packViewBox);
    scheduleFocusPlace(host, activeId);
  } else if (wrongId) {
    geo._focusHalo = false;
    setMapLabel(host, wrongId, { miss: true });
    syncTinyHitPads(host);
  } else {
    setMapLabel(host, null);
    syncTinyHitPads(host);
  }
}

function clientToSvgPoint(svg, clientX, clientY) {
  try {
    const ctm = svg.getScreenCTM();
    if (ctm) {
      const pt = svg.createSVGPoint();
      pt.x = clientX;
      pt.y = clientY;
      const p = pt.matrixTransform(ctm.inverse());
      if (Number.isFinite(p.x) && Number.isFinite(p.y)) return { x: p.x, y: p.y };
    }
  } catch {
    /* fall through */
  }
  const rect = svg.getBoundingClientRect();
  const vb = viewBoxParts(svg.getAttribute("viewBox"));
  return {
    x: vb.x + ((clientX - rect.left) / Math.max(rect.width, 1)) * vb.w,
    y: vb.y + ((clientY - rect.top) / Math.max(rect.height, 1)) * vb.h,
  };
}

function usesMarkerPins(host) {
  return geo.pack?.overlay === "markers" || Boolean(host?.querySelector(".geo-pin"));
}

function markerTapRadiusSvg(svg) {
  const rect = svg.getBoundingClientRect();
  const vb = viewBoxParts(svg.getAttribute("viewBox"));
  const unit = Math.max(vb.w / Math.max(rect.width, 1), vb.h / Math.max(rect.height, 1));
  const px = window.matchMedia("(pointer: coarse)").matches ? 44 : 30;
  return px * unit;
}

function nearestMarkerId(host, svg, pt) {
  const maxR = markerTapRadiusSvg(svg);
  const maxR2 = maxR * maxR;
  let best = null;
  let bestD = Infinity;
  for (const item of geo.items) {
    const a = regionAnchor(host, item.id);
    if (!a) continue;
    const d2 = (pt.x - a.x) ** 2 + (pt.y - a.y) ** 2;
    if (d2 <= maxR2 && d2 < bestD) {
      bestD = d2;
      best = item.id;
    }
  }
  return best;
}

function mapTargetId(e) {
  const host = e.currentTarget?.closest?.("#geo-map") || geo.root?.querySelector("#geo-map");
  const svg = host?.querySelector("svg");
  if (host && svg && usesMarkerPins(host)) {
    const pt = clientToSvgPoint(svg, e.clientX, e.clientY);
    if (pt) {
      const nearest = nearestMarkerId(host, svg, pt);
      if (nearest) return nearest;
    }
    if (geo.pack?.overlay === "markers") return null;
  }
  const fromEvent = regionIdFromNode(e.target);
  if (fromEvent) return fromEvent;
  return regionIdFromNode(document.elementFromPoint(e.clientX, e.clientY));
}

function regionIdFromNode(node) {
  if (!node?.closest) return null;
  const pad = node.closest(".geo-tiny-hit");
  if (pad?.dataset.id) return pad.dataset.id;
  const pin = node.closest(".geo-pin");
  if (pin) {
    const visual = pin.querySelector(".geo-region");
    if (visual?.classList.contains("is-out")) return null;
    return pin.dataset.id || visual?.dataset.id || visual?.id || null;
  }
  const el = node.closest(".geo-region");
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
  if (geo.pack?.map === "canada-provinces") return "province or territory";
  if (geo.pack?.map === "us-states") return "state";
  if (q === "capitals" || q === "countries") return "country";
  if (q === "teams") return "team";
  if (blob.includes("continent")) return "continent";
  return "region";
}

function regionAnchor(host, id) {
  const els = regionsForId(host, id);
  if (!els.length) return null;
  const el = els[0];
  const tag = el.tagName.toLowerCase();
  if (tag === "circle" || el.classList.contains("geo-marker")) {
    const cx = parseFloat(el.getAttribute("cx"));
    const cy = parseFloat(el.getAttribute("cy"));
    const r = parseFloat(el.getAttribute("r") || "5") || 5;
    if (Number.isFinite(cx) && Number.isFinite(cy)) {
      return { x: cx, y: cy, w: r * 2, h: r * 2, el };
    }
  }
  const m = compactMainlandForEl(el);
  if (m) {
    return {
      x: m.cx,
      y: m.cy,
      w: m.maxX - m.minX,
      h: m.maxY - m.minY,
      el,
    };
  }
  try {
    const b = el.getBBox();
    if (!b.width && !b.height) return null;
    return {
      x: b.x + b.width / 2,
      y: b.y + b.height / 2,
      w: b.width,
      h: b.height,
      el,
    };
  } catch {
    return null;
  }
}

function placePixelSize(svg, anchor, vbRaw) {
  const vb = viewBoxParts(vbRaw || svg.getAttribute("viewBox"));
  const rect = svg.getBoundingClientRect();
  const sx = rect.width / Math.max(vb.w, 1);
  const sy = rect.height / Math.max(vb.h, 1);
  return { pxW: anchor.w * sx, pxH: anchor.h * sy, rect };
}

function placeInViewBox(vb, anchor, edge = 0.1) {
  const padX = vb.w * edge;
  const padY = vb.h * edge;
  return (
    anchor.x >= vb.x + padX &&
    anchor.y >= vb.y + padY &&
    anchor.x <= vb.x + vb.w - padX &&
    anchor.y <= vb.y + vb.h - padY
  );
}

function maybeFocusTinyPlace(host, id) {
  const svg = host.querySelector("svg");
  const anchor = regionAnchor(host, id);
  geo._focusHalo = false;
  if (!svg || !anchor) return true;
  if (geo.pack?.overlay === "markers") {
    geo._focusHalo = true;
    stopFocusZoom();
    if (geo._packViewBox) svg.setAttribute("viewBox", geo._packViewBox);
    return true;
  }
  const packRaw = geo._packViewBox || svg.getAttribute("viewBox");
  const pack = viewBoxParts(packRaw);
  const px = placePixelSize(svg, anchor, packRaw);
  if (px.rect.width < 8 || px.rect.height < 8) return false;
  const longPx = Math.max(px.pxW, px.pxH);
  const tinyDot =
    anchor.el.classList.contains("geo-island-dot") ||
    anchor.el.tagName.toLowerCase() === "circle";
  geo._focusHalo = longPx < 44 || tinyDot;
  if (longPx >= 28 && placeInViewBox(pack, anchor)) {
    stopFocusZoom();
    return true;
  }

  const scale = longPx < 28 ? Math.min(80, 56 / Math.max(longPx, 0.25)) : 1;
  let nw = pack.w / scale;
  let nh = pack.h / scale;
  const limit = panLimitBox();
  const minW = limit.w * 0.01;
  if (nw < minW) {
    const s = minW / nw;
    nw = minW;
    nh *= s;
  }
  const next = clampViewBox({
    x: anchor.x - nw / 2,
    y: anchor.y - nh / 2,
    w: nw,
    h: nh,
  });
  const from = viewBoxParts(svg.getAttribute("viewBox"));
  animateFocusView(host, svg, from, next);
  return true;
}

function stopFocusZoom() {
  if (!geo._zoomAnim) return;
  cancelAnimationFrame(geo._zoomAnim);
  geo._zoomAnim = 0;
}

function easeInOutQuad(t) {
  return t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function viewBoxClose(a, b) {
  return (
    Math.abs(a.x - b.x) < 0.05 &&
    Math.abs(a.y - b.y) < 0.05 &&
    Math.abs(a.w - b.w) < 0.05 &&
    Math.abs(a.h - b.h) < 0.05
  );
}

const FOCUS_ZOOM_MS = 800;

function animateFocusView(host, svg, from, to) {
  stopFocusZoom();
  if (viewBoxClose(from, to)) {
    svg.setAttribute("viewBox", `${to.x} ${to.y} ${to.w} ${to.h}`);
    syncTinyIslandScale(host);
    return;
  }
  const fromCx = from.x + from.w / 2;
  const fromCy = from.y + from.h / 2;
  const toCx = to.x + to.w / 2;
  const toCy = to.y + to.h / 2;
  const logFromW = Math.log(Math.max(from.w, 0.01));
  const logFromH = Math.log(Math.max(from.h, 0.01));
  const logToW = Math.log(Math.max(to.w, 0.01));
  const logToH = Math.log(Math.max(to.h, 0.01));
  const start = performance.now();
  const step = (now) => {
    if (!host.isConnected) {
      geo._zoomAnim = 0;
      return;
    }
    const t = Math.min(1, (now - start) / FOCUS_ZOOM_MS);
    const e = easeInOutQuad(t);
    const w = Math.exp(lerp(logFromW, logToW, e));
    const h = Math.exp(lerp(logFromH, logToH, e));
    const vb = {
      x: lerp(fromCx, toCx, e) - w / 2,
      y: lerp(fromCy, toCy, e) - h / 2,
      w,
      h,
    };
    svg.setAttribute("viewBox", `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
    syncTinyIslandScale(host);
    drawMapLabel(host);
    if (t < 1) {
      geo._zoomAnim = requestAnimationFrame(step);
      return;
    }
    geo._zoomAnim = 0;
    svg.setAttribute("viewBox", `${to.x} ${to.y} ${to.w} ${to.h}`);
    syncTinyIslandScale(host);
    drawMapLabel(host);
    syncTinyHitPads(host);
  };
  geo._zoomAnim = requestAnimationFrame(step);
}

function scheduleFocusPlace(host, id) {
  let tries = 0;
  const run = () => {
    if (!host.isConnected) return;
    const ok = maybeFocusTinyPlace(host, id);
    if (!ok && tries < 2) {
      tries += 1;
      requestAnimationFrame(run);
      return;
    }
    if (!ok) return;
    setMapLabel(host, id);
    if (!geo._zoomAnim) syncTinyHitPads(host);
  };
  run();
}

function ensureBorderOverlay(host) {
  if (!host || isOutlineView()) return;
  const svg = host.querySelector("svg");
  if (!svg || svg.querySelector(".geo-border-overlay")) return;
  const NS = "http://www.w3.org/2000/svg";
  const g = document.createElementNS(NS, "g");
  g.setAttribute("class", "geo-border-overlay");
  g.setAttribute("pointer-events", "none");
  svg.querySelectorAll(".geo-region, .geo-land-bg").forEach((el) => {
    if (el.classList.contains("geo-marker") || el.classList.contains("geo-island-dot")) {
      return;
    }
    const d = el.getAttribute("d");
    if (!d) return;
    const line = document.createElementNS(NS, "path");
    line.setAttribute("d", d);
    line.setAttribute("class", "geo-border-line");
    g.appendChild(line);
  });
  if (!g.childNodes.length) return;
  // Above rivers when present (hybrid water + border); otherwise above land fills.
  const water = svg.querySelector(".geo-waterways");
  const land = svg.querySelector(".geo-region, .geo-land-bg");
  if (water) water.after(g);
  else if (land) land.parentNode?.appendChild(g);
  else svg.appendChild(g);
}

function elFullBox(el) {
  const tag = el.tagName.toLowerCase();
  if (tag === "circle") return circleRecord(el);
  const parts = elementParts(el);
  if (!parts.length) return null;
  const u = bboxUnion(parts);
  if (!u) return null;
  return {
    ...u,
    cx: (u.minX + u.maxX) / 2,
    cy: (u.minY + u.maxY) / 2,
    w: u.maxX - u.minX,
    h: u.maxY - u.minY,
  };
}

function largestPartSize(el) {
  const parts = elementParts(el);
  if (!parts.length) return null;
  let best = parts[0];
  let bestSpan = 0;
  for (const p of parts) {
    const span = Math.max(p.maxX - p.minX, p.maxY - p.minY);
    if (span > bestSpan) {
      bestSpan = span;
      best = p;
    }
  }
  return { w: best.maxX - best.minX, h: best.maxY - best.minY };
}

function placeAnchorCached(host, id) {
  host._geoAnchors ??= new Map();
  if (!host._geoAnchors.has(id)) {
    const a = regionAnchor(host, id);
    if (a) {
      a.full = elFullBox(a.el);
      a.part = largestPartSize(a.el) || { w: a.w, h: a.h };
    }
    host._geoAnchors.set(id, a);
  }
  return host._geoAnchors.get(id);
}

const TINY_LAND_SEE_PX = 8;
const TINY_LAND_DRAW_PX = 16;
const TINY_LAND_FULL_PX = 24;
const ENCLAVE_STROKE_PX = 48;

function landPixelSize(anchor, sx, sy) {
  const w = anchor.part?.w ?? anchor.w;
  const h = anchor.part?.h ?? anchor.h;
  return Math.max(w * sx, h * sy);
}

function tinyLandIds(host, svg, packRect) {
  if (host._tinyLandIds) return host._tinyLandIds;
  const pack = viewBoxParts(geo._packViewBox || svg.getAttribute("viewBox"));
  const sx = packRect.width / Math.max(pack.w, 1);
  const sy = packRect.height / Math.max(pack.h, 1);
  const ids = [];
  for (const id of packItemIds()) {
    const a = placeAnchorCached(host, id);
    if (!a) continue;
    if (landPixelSize(a, sx, sy) >= TINY_LAND_SEE_PX) continue;
    ids.push(id);
  }
  host._tinyLandIds = ids;
  return ids;
}

function clearIslandBoost(el) {
  if (!el || el.dataset.geoBoosted !== "1") return;
  el.removeAttribute("transform");
  el.classList.remove("is-boosted");
  delete el.dataset.geoBoosted;
}

function syncTinyIslandScale(host) {
  if (!host || isOutlineView() || geo.pack?.overlay === "markers") return;
  const svg = host.querySelector("svg");
  if (!svg) return;
  const rect = svg.getBoundingClientRect();
  if (rect.width < 8 || rect.height < 8) return;
  const vb = viewBoxParts(svg.getAttribute("viewBox"));
  const sx = rect.width / Math.max(vb.w, 1);
  const sy = rect.height / Math.max(vb.h, 1);
  const unit = vb.w / rect.width;
  const ids = tinyLandIds(host, svg, rect);
  const NS = "http://www.w3.org/2000/svg";
  host.querySelectorAll(".geo-island-boost").forEach((n) => n.remove());

  for (const id of ids) {
    const a = placeAnchorCached(host, id);
    if (!a) continue;
    const landPx = landPixelSize(a, sx, sy);
    const full = a.full;
    const fullPx = full ? Math.max(full.w * sx, full.h * sy) : landPx;
    if (landPx >= TINY_LAND_SEE_PX) {
      clearIslandBoost(a.el);
      continue;
    }
    const scale = Math.min(24, TINY_LAND_DRAW_PX / Math.max(landPx, 0.2));
    if (fullPx < TINY_LAND_FULL_PX && scale > 1.08) {
      a.el.setAttribute(
        "transform",
        `translate(${a.x} ${a.y}) scale(${scale.toFixed(3)}) translate(${-a.x} ${-a.y})`
      );
      a.el.dataset.geoBoosted = "1";
      a.el.classList.add("is-boosted");
      continue;
    }
    clearIslandBoost(a.el);
    const boost = document.createElementNS(NS, "circle");
    boost.setAttribute("class", "geo-island-boost");
    ["is-active", "is-correct", "is-wrong", "is-miss-flash", "is-dim"].forEach((cls) => {
      if (a.el.classList.contains(cls)) boost.classList.add(cls);
    });
    boost.setAttribute("cx", String(a.x));
    boost.setAttribute("cy", String(a.y));
    boost.setAttribute("r", String((TINY_LAND_DRAW_PX / 2) * unit));
    svg.appendChild(boost);
  }
  syncEnclaveStrokes(host, sx, sy);
}

function syncEnclaveStrokes(host, sx, sy) {
  for (const id of packItemIds()) {
    if (!LANDLOCKED.has(id)) continue;
    const a = placeAnchorCached(host, id);
    if (!a) continue;
    const compactPx = Math.max(a.w * sx, a.h * sy);
    a.el.classList.toggle("is-enclave", compactPx < ENCLAVE_STROKE_PX);
  }
}

function syncTinyHitPads(host) {
  if (!host) return;
  host.querySelectorAll(".geo-tiny-hit").forEach((n) => n.remove());
  if (isOutlineView() || geo.pack?.overlay === "markers") return;
  const svg = host.querySelector("svg");
  if (!svg) return;
  const rect = svg.getBoundingClientRect();
  if (rect.width < 8) return;
  const vb = viewBoxParts(svg.getAttribute("viewBox"));
  const unit = vb.w / rect.width;
  const minR = 13 * unit;
  const inPack = packItemIds();
  const NS = "http://www.w3.org/2000/svg";
  for (const id of inPack) {
    const anchor = regionAnchor(host, id);
    if (!anchor) continue;
    const longPx = Math.max(
      anchor.w * (rect.width / vb.w),
      anchor.h * (rect.height / Math.max(vb.h, 1))
    );
    const tinyDot =
      anchor.el.classList.contains("geo-island-dot") ||
      anchor.el.tagName.toLowerCase() === "circle";
    if (longPx >= 28 && !tinyDot) continue;
    const hit = document.createElementNS(NS, "circle");
    hit.setAttribute("class", "geo-tiny-hit");
    hit.dataset.id = id;
    hit.setAttribute("cx", String(anchor.x));
    hit.setAttribute("cy", String(anchor.y));
    hit.setAttribute("r", String(Math.max(minR, Math.max(anchor.w, anchor.h) / 2)));
    svg.appendChild(hit);
  }
}

function setMapLabel(host, id, { miss = false } = {}) {
  const item = id ? byId(id) : null;
  geo._mapLabel = item ? { id: item.id, name: item.name, miss } : null;
  if (!id || miss) geo._focusHalo = false;
  drawMapLabel(host);
}

function drawMapLabel(host) {
  if (!host) return;
  host.querySelectorAll(".geo-marker-label, .geo-focus-mark").forEach((n) => n.remove());
  const spec = geo._mapLabel;
  if (!spec) return;
  const svg = host.querySelector("svg");
  const anchor = regionAnchor(host, spec.id);
  if (!svg || !anchor) return;

  const vb = svg.viewBox.baseVal;
  const rect = svg.getBoundingClientRect();
  const unit = vb.width / Math.max(rect.width, 1);
  const NS = "http://www.w3.org/2000/svg";

  if (geo._focusHalo) {
    const g = document.createElementNS(NS, "g");
    g.setAttribute("class", "geo-focus-mark");
    g.setAttribute("pointer-events", "none");
    const ring = document.createElementNS(NS, "circle");
    ring.setAttribute("class", "geo-focus-ring");
    ring.setAttribute("cx", String(anchor.x));
    ring.setAttribute("cy", String(anchor.y));
    ring.setAttribute("r", String(15 * unit));
    const dot = document.createElementNS(NS, "circle");
    dot.setAttribute("class", "geo-focus-dot");
    dot.setAttribute("cx", String(anchor.x));
    dot.setAttribute("cy", String(anchor.y));
    dot.setAttribute("r", String(4.2 * unit));
    g.append(ring, dot);
    svg.appendChild(g);
  }

  const fontSize = 13 * unit;
  const padX = 6.5 * unit;
  const padY = 3.4 * unit;
  const gap = (geo._focusHalo ? 18 : 10) * unit;
  const placeAbove = anchor.y - vb.y > fontSize * 3;

  const label = document.createElementNS(NS, "g");
  label.setAttribute("class", spec.miss ? "geo-marker-label is-miss" : "geo-marker-label");
  label.setAttribute("pointer-events", "none");
  const text = document.createElementNS(NS, "text");
  text.setAttribute("class", "geo-marker-label-text");
  text.setAttribute("x", String(anchor.x));
  text.setAttribute("y", String(placeAbove ? anchor.y - gap : anchor.y + gap));
  text.setAttribute("text-anchor", "middle");
  text.setAttribute("dominant-baseline", placeAbove ? "auto" : "hanging");
  text.setAttribute("font-size", String(fontSize));
  text.textContent = spec.name;
  label.appendChild(text);
  svg.appendChild(label);

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
  label.insertBefore(bg, text);
}

function zoomViewBox(src, factor, mx, my) {
  const vb = { x: src.x, y: src.y, w: src.w, h: src.h };
  let nw = vb.w * factor;
  let nh = vb.h * factor;
  const limit = panLimitBox();
  const minW = limit.w * 0.01;
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
  return vb;
}

function bindMapControls(host) {
  const svg = host?.querySelector("svg");
  if (!host || !svg || host.dataset.navBound === "1") return;
  host.dataset.navBound = "1";
  ensureBaseViewBox(svg);

  const PAN_SLOP = 10;

  const readVb = () => {
    const raw = (svg.getAttribute("viewBox") || geo._baseViewBox).split(/\s+/).map(Number);
    return { x: raw[0], y: raw[1], w: raw[2], h: raw[3] };
  };
  const writeVb = (vb) => {
    stopFocusZoom();
    const next = clampViewBox(vb);
    svg.setAttribute("viewBox", `${next.x} ${next.y} ${next.w} ${next.h}`);
    syncTinyIslandScale(host);
    drawMapLabel(host);
  };

  host.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      stopFocusZoom();
      const vb = readVb();
      const rect = svg.getBoundingClientRect();
      const mx = (e.clientX - rect.left) / rect.width;
      const my = (e.clientY - rect.top) / rect.height;
      const factor = e.deltaY > 0 ? 1.12 : 1 / 1.12;
      writeVb(zoomViewBox(vb, factor, mx, my));
    },
    { passive: false }
  );

  const pointers = new Map();
  let dragging = false;
  let last = null;
  let downPt = null;
  let pinch = null;
  let moved = false;

  const setPointer = (e) => {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  };
  const pinchDist = () => {
    const pts = [...pointers.values()];
    if (pts.length < 2) return 0;
    return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
  };
  const pinchMid = () => {
    const pts = [...pointers.values()];
    return { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
  };
  const beginPinch = () => {
    const dist = pinchDist();
    const mid = pinchMid();
    const rect = svg.getBoundingClientRect();
    pinch = dist
      ? {
          dist,
          vb: readVb(),
          mid: { x: mid.x, y: mid.y },
          mx: (mid.x - rect.left) / Math.max(rect.width, 1),
          my: (mid.y - rect.top) / Math.max(rect.height, 1),
        }
      : null;
  };
  const applyPinch = () => {
    const dist = pinchDist();
    if (!dist) return;
    if (!pinch) beginPinch();
    if (!pinch) return;
    const rect = svg.getBoundingClientRect();
    const mid = pinchMid();
    const vb = zoomViewBox(pinch.vb, pinch.dist / dist, pinch.mx, pinch.my);
    vb.x -= ((mid.x - pinch.mid.x) / Math.max(rect.width, 1)) * vb.w;
    vb.y -= ((mid.y - pinch.mid.y) / Math.max(rect.height, 1)) * vb.h;
    writeVb(vb);
  };

  host.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    stopFocusZoom();
    setPointer(e);
    if (pointers.size >= 2) {
      dragging = false;
      last = null;
      downPt = null;
      moved = true;
      beginPinch();
      host.classList.add("is-panning");
      host.setPointerCapture?.(e.pointerId);
      return;
    }
    moved = false;
    dragging = true;
    last = { x: e.clientX, y: e.clientY };
    downPt = { x: e.clientX, y: e.clientY };
  });
  host.addEventListener("pointermove", (e) => {
    if (pointers.has(e.pointerId)) setPointer(e);
    if (pointers.size >= 2) {
      moved = true;
      applyPinch();
      return;
    }
    if (!dragging || !last || !downPt) return;
    if (!moved) {
      const dist = Math.hypot(e.clientX - downPt.x, e.clientY - downPt.y);
      if (dist < PAN_SLOP) return;
      moved = true;
      host.classList.add("is-panning");
      host.setPointerCapture?.(e.pointerId);
    }
    const vb = readVb();
    const rect = svg.getBoundingClientRect();
    const dx = ((e.clientX - last.x) / rect.width) * vb.w;
    const dy = ((e.clientY - last.y) / rect.height) * vb.h;
    vb.x -= dx;
    vb.y -= dy;
    writeVb(vb);
    last = { x: e.clientX, y: e.clientY };
  });
  const endPointer = (e) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (pointers.size === 1) {
      const pt = [...pointers.values()][0];
      dragging = true;
      last = { x: pt.x, y: pt.y };
      downPt = { x: pt.x, y: pt.y };
      return;
    }
    if (pointers.size === 0) {
      dragging = false;
      last = null;
      downPt = null;
      host.classList.remove("is-panning");
    }
  };
  host.addEventListener("pointerup", endPointer);
  host.addEventListener("pointercancel", endPointer);
  host.addEventListener(
    "click",
    (e) => {
      if (!moved) return;
      e.preventDefault();
      e.stopPropagation();
    },
    true
  );
}

function mapHtml() {
  if (!geo.mapSvg) return "";
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const zoomHint = coarse ? "pinch to zoom" : "pinch or scroll to zoom";
  const pinHint = geo.mode === "pin" ? " · tap a place to answer" : "";
  return `<div class="geo-map-frame is-zoomable" id="geo-map">${geo.mapSvg}
    <p class="geo-map-hint">Drag to pan · ${zoomHint}${pinHint}</p>
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
    const unit = geo.pack?.map === "canada-provinces" ? "province or territory" : "state";
    return geo._abbrAskName
      ? `What is the postal abbreviation for <strong>${escapeHtml(item.name)}</strong>?`
      : `Which ${unit} uses the abbreviation <strong>${escapeHtml(item.abbr)}</strong>?`;
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

function foldPlaceName(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function foldedContains(haystack, needle) {
  if (!needle) return false;
  const esc = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^| )${esc}(?: |$)`).test(haystack);
}

function packNationalScope() {
  const id = (geo.pack?.id || "").toLowerCase();
  const nameFold = foldPlaceName(geo.pack?.name || "");
  if (
    /^(us|usa)(-|$)/.test(id) ||
    /\bu s\b/.test(nameFold) ||
    foldedContains(nameFold, "united states")
  ) {
    return "united states";
  }
  if (id === "canada" || id.startsWith("canada-") || foldedContains(nameFold, "canada")) {
    return "canada";
  }
  if (
    /^(uk|gb)(-|$)/.test(id) ||
    /\bu k\b/.test(nameFold) ||
    foldedContains(nameFold, "united kingdom") ||
    foldedContains(nameFold, "great britain")
  ) {
    return "united kingdom";
  }
  return "";
}

function packAlreadyNamesCountry(country) {
  const c = foldPlaceName(country);
  const scope = packNationalScope();
  if (
    scope &&
    (c === scope ||
      (scope === "united states" && c === "united states of america") ||
      (scope === "united kingdom" && c === "great britain"))
  ) {
    return true;
  }
  const nameFold = foldPlaceName(geo.pack?.name || "");
  const idFold = foldPlaceName(geo.pack?.id || "");
  return foldedContains(nameFold, c) || foldedContains(idFold, c);
}

function promptAlreadyNamesCountry(item, country) {
  const c = foldPlaceName(country);
  if (!c) return true;
  const prompt = foldPlaceName(String(promptForMode(item) || "").replace(/<[^>]+>/g, " "));
  return foldedContains(prompt, c) || packAlreadyNamesCountry(country);
}

function confirmParts(item) {
  const kind = quizKind();
  const mode = geo.mode;
  const expected = expectedAnswer(item);
  if (mode === "reverse") return { place: expected, country: "" };
  if (item.capital && (mode === "capitals" || kind === "capitals")) {
    return { place: item.capital, country: item.name || "" };
  }
  if (item.kind === "landmark" || item.kind === "water") {
    if (packNationalScope()) return { place: expected, country: "" };
    return { place: expected, country: item.country || "" };
  }
  return { place: expected, country: "" };
}

function confirmAnswerHtml(ok, item) {
  const { place, country: rawCountry } = confirmParts(item);
  const country =
    rawCountry &&
    foldPlaceName(rawCountry) !== foldPlaceName(place) &&
    !promptAlreadyNamesCountry(item, rawCountry)
      ? rawCountry
      : "";
  const where = country ? ` · ${escapeHtml(country)}` : "";
  const cap =
    ok && item.capital && place === item.name
      ? ` · capital ${escapeHtml(item.capital)}`
      : "";
  if (ok) return `<strong>Correct.</strong> ${escapeHtml(place)}${where}${cap}`;
  return `<strong>Not quite.</strong> Answer: <strong>${escapeHtml(
    place
  )}</strong>${where}`;
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

function scrollPageTop() {
  window.scrollTo(0, 0);
}

function renderHub() {
  geo.group = null;
  geo.pack = null;
  geo.mode = null;
  scrollPageTop();
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
  scrollPageTop();
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
  scrollPageTop();
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
  geo._pinMisses = 0;
  clearPinMissFlash();
  renderPlay();
}

function renderStudy() {
  const item = byId(geo.selectedId) || geo.items[0];
  geo.selectedId = item?.id || null;
  scrollPageTop();
  geo.root.innerHTML = `
    <div class="geo-shell geo-play geo-play--study">
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

  paintMap(geo.selectedId);
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

function selectStudyItem(id) {
  if (!id || !byId(id)) return;
  geo.selectedId = id;
  const root = geo.root;
  if (!root?.querySelector(".geo-play--study")) {
    renderStudy();
    return;
  }
  const detail = root.querySelector("#geo-detail");
  if (detail) detail.innerHTML = studyDetailHtml(byId(id));
  root.querySelectorAll(".geo-item-btn").forEach((btn) => {
    btn.classList.toggle("is-on", btn.dataset.id === id);
  });
  root
    .querySelector(`.geo-item-btn[data-id="${CSS.escape(id)}"]`)
    ?.scrollIntoView({ block: "nearest" });
  paintMap(id);
}

function bindStudy() {
  geo.root.querySelector("#geo-back-modes")?.addEventListener("click", () => {
    renderPackModes();
  });
  geo.root.querySelectorAll(".geo-item-btn").forEach((btn) => {
    btn.addEventListener("click", () => selectStudyItem(btn.dataset.id));
  });
  geo.root.querySelector("#geo-map")?.addEventListener("click", (e) => {
    const id = mapTargetId(e);
    if (!id || !byId(id)) return;
    selectStudyItem(id);
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

  const showMap = playUsesMap();
  scrollPageTop();

  let prompt = "";
  let controls = "";
  if (geo.mode === "pin") {
    prompt = `
      <p class="geo-prompt">${promptForMode(item)}</p>
      <p class="geo-hint">Tap the correct ${escapeHtml(pinTargetNoun())}. Two misses allowed.</p>`;
  } else if (geo.mode === "type" || geo.mode === "outline") {
    prompt = `<p class="geo-prompt">${promptForMode(item)}</p>`;
    controls = `
      <form class="geo-type-form" id="geo-type-form">
        <input type="text" id="geo-type-input" class="geo-type-input" autocomplete="off" autocorrect="off" spellcheck="false" placeholder="Type your answer" />
        <button type="submit" class="primary-btn">Check</button>
      </form>`;
  } else {
    prompt = `<p class="geo-prompt">${promptForMode(item)}</p>`;
    controls = choiceButtons(buildChoices(item));
  }

  const playClass = [
    "geo-shell",
    "geo-play",
    showMap ? "geo-play--map" : "",
    geo.mode === "pin" ? "geo-play--pin" : "",
    geo.mode === "type" || geo.mode === "outline" ? "geo-play--type" : "",
  ]
    .filter(Boolean)
    .join(" ");

  geo.root.innerHTML = `
    <div class="${playClass}">
      <div class="geo-toolbar">
        <button type="button" class="secondary-btn" id="geo-back-modes">Modes</button>
        <p class="speech-kicker">${escapeHtml(geo.pack.name)} · ${escapeHtml(
          MODE_META[geo.mode]?.label || geo.mode
        )}</p>
        ${progressHtml()}
      </div>
      <div class="geo-play-layout ${showMap ? "" : "no-map"}">
        ${showMap ? `<div class="geo-map-wrap">${mapHtml()}</div>` : ""}
        <aside class="geo-side">
          <div class="geo-quiz-panel" id="geo-quiz-panel">${prompt}</div>
          ${controls ? `<div class="geo-quiz-actions">${controls}</div>` : ""}
          <div id="geo-feedback" class="quiz-feedback" hidden></div>
          <div class="geo-next-row" id="geo-next-row" hidden>
            <button type="button" class="primary-btn" id="geo-next">Next</button>
          </div>
        </aside>
      </div>
    </div>`;

  if (playHighlightsTarget()) {
    paintMap(item.id);
  } else if (showMap) {
    paintMap(null);
  }

  bindMapControls(geo.root.querySelector("#geo-map"));
  bindPlay();
}

const PIN_MISS_LIMIT = 3;
const PIN_MISS_MS = 1500;

function clearPinMissFlash() {
  if (!geo._pinMissTimer) return;
  clearTimeout(geo._pinMissTimer);
  geo._pinMissTimer = 0;
}

function flashPinMiss(id) {
  const host = geo.root?.querySelector("#geo-map");
  if (!host || !byId(id)) return;
  clearPinMissFlash();
  paintMap(null, { flash: { wrongId: id } });
  geo._pinMissTimer = setTimeout(() => {
    geo._pinMissTimer = 0;
    if (geo.answered || !host.isConnected) return;
    paintMap(null);
  }, PIN_MISS_MS);
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
    geo._pinMisses = 0;
    clearPinMissFlash();
    renderPlay();
  });

  if (geo.mode === "pin") {
    geo.root.querySelector("#geo-map")?.addEventListener("click", (e) => {
      if (geo.answered) return;
      const id = mapTargetId(e);
      if (!id) return;
      const item = currentItem();
      if (!item) return;
      if (id === item.id) {
        judge(true, id);
        return;
      }
      geo._pinMisses += 1;
      if (geo._pinMisses >= PIN_MISS_LIMIT) {
        judge(false, id);
        return;
      }
      flashPinMiss(id);
    });
    return;
  }

  if (geo.mode === "type" || geo.mode === "outline") {
    const form = geo.root.querySelector("#geo-type-form");
    const input = geo.root.querySelector("#geo-type-input");
    input?.addEventListener("focus", () => {
      requestAnimationFrame(() => {
        input.scrollIntoView({ block: "center", behavior: "smooth" });
      });
    });
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
  clearPinMissFlash();
  geo.answered = true;
  if (ok) geo.correct += 1;
  else geo.wrong += 1;

  const item = currentItem();
  const feedback = geo.root.querySelector("#geo-feedback");
  const nextRow = geo.root.querySelector("#geo-next-row");
  if (feedback) {
    feedback.hidden = false;
    feedback.className = `quiz-feedback ${ok ? "is-correct" : "is-wrong"}`;
    feedback.innerHTML = confirmAnswerHtml(ok, item);
  }
  if (nextRow) nextRow.hidden = false;

  if (playHighlightsTarget(true)) {
    paintMap(item.id, {
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
  scrollPageTop();
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
  geo._pinMisses = 0;
  clearPinMissFlash();
  stopFocusZoom();
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
