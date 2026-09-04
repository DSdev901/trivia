#!/usr/bin/env node
/**
 * Rebuild inland lakes + rivers on the world SVGs.
 * Rivers that follow a land border get a dashed overlay on that stretch only.
 * The dash is shown only on waterways quizzes (CSS .is-water-pack).
 *
 * Same /tmp Natural Earth + d3-geo setup as build-world-maps.mjs.
 * Optional: curl -sL -o /tmp/states-10m.json https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json
 * so U.S. state-line rivers (Ohio, Chattahoochee) dash only where they follow the line.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "data", "geography", "maps");

const { feature, mesh } = require("/tmp/geo-build/node_modules/topojson-client");
const { geoNaturalEarth1, geoPath } = require("/tmp/geo-build/node_modules/d3-geo");

const topo = JSON.parse(readFileSync("/tmp/countries-50m.json", "utf8"));
const countries = feature(topo, topo.objects.countries);
const width = 1000;
const height = 520;
const projection = geoNaturalEarth1().fitExtent(
  [
    [8, 8],
    [width - 8, height - 8],
  ],
  countries
);
const toPath = geoPath(projection);

function slug(name) {
  return String(name || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Rivers that form an international or major internal land border. */
const BORDER_SLUGS = new Set([
  "amur",
  "heilong-jiang",
  "rio-grande",
  "oder",
  "rhine",
  "danube",
  "mekong",
  "congo",
  "orange",
  "limpopo",
  "zambezi",
  "st-lawrence",
  "ohio",
  "ottawa",
  "chattahoochee",
  "jordan",
  "uruguay",
  "niagara",
  "colorado",
  "senegal",
  "helmand",
  "shatt-al-arab",
  "ubangi",
  "okavango",
  "salween",
  "hong",
  "amu-darya",
  "vaal",
  "yalu",
  "usumacinta",
  "san-juan",
  "coco",
  "paraguay",
]);

/** International: river vertex must sit on the border, not merely near it. */
const INTL_KM = 16;
/** U.S. state lines: tighter, and the river must run along the line, not just cross it. */
const STATE_KM = 8;
const STATE_MAX_ANGLE = 40;
/** Drop nicks shorter than this unless most of that river feature is on a border (Niagara). */
const MIN_STRETCH_KM = 28;
const GAP_KM = 25;
const MOSTLY_BORDER = 0.75;

function loadGeojson(p) {
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

function attr(name, value) {
  return value ? ` ${name}="${String(value).replace(/"/g, "&quot;")}"` : "";
}

function geomLines(geom) {
  if (!geom) return [];
  if (geom.type === "LineString") return [geom.coordinates];
  if (geom.type === "MultiLineString") return geom.coordinates;
  if (geom.type === "GeometryCollection") {
    return (geom.geometries || []).flatMap(geomLines);
  }
  return [];
}

function distPointSegKm(p, a, b) {
  const lat = ((p[1] + a[1] + b[1]) / 3) * (Math.PI / 180);
  const kx = Math.cos(lat) * 111;
  const ky = 111;
  const px = p[0] * kx;
  const py = p[1] * ky;
  const ax = a[0] * kx;
  const ay = a[1] * ky;
  const bx = b[0] * kx;
  const by = b[1] * ky;
  const vx = bx - ax;
  const vy = by - ay;
  const wx = px - ax;
  const wy = py - ay;
  const c1 = vx * wx + vy * wy;
  if (c1 <= 0) return Math.hypot(px - ax, py - ay);
  const c2 = vx * vx + vy * vy;
  if (c2 <= c1) return Math.hypot(px - bx, py - by);
  const t = c1 / c2;
  return Math.hypot(px - (ax + t * vx), py - (ay + t * vy));
}

function indexSegments(lines, cell = 1.25) {
  const segs = [];
  const grid = new Map();
  const add = (key, i) => {
    let bucket = grid.get(key);
    if (!bucket) {
      bucket = [];
      grid.set(key, bucket);
    }
    bucket.push(i);
  };
  for (const line of lines) {
    for (let i = 0; i < line.length - 1; i += 1) {
      const a = line[i];
      const b = line[i + 1];
      if (!a || !b || a.length < 2 || b.length < 2) continue;
      const idx = segs.length;
      segs.push([a, b]);
      const minx = Math.floor(Math.min(a[0], b[0]) / cell);
      const maxx = Math.floor(Math.max(a[0], b[0]) / cell);
      const miny = Math.floor(Math.min(a[1], b[1]) / cell);
      const maxy = Math.floor(Math.max(a[1], b[1]) / cell);
      for (let x = minx; x <= maxx; x += 1) {
        for (let y = miny; y <= maxy; y += 1) add(`${x},${y}`, idx);
      }
    }
  }
  return { segs, grid, cell };
}

function distKm(a, b) {
  const lat = ((a[1] + b[1]) / 2) * (Math.PI / 180);
  const dx = (b[0] - a[0]) * Math.cos(lat) * 111;
  const dy = (b[1] - a[1]) * 111;
  return Math.hypot(dx, dy);
}

function polylineKm(coords) {
  let km = 0;
  for (let i = 1; i < coords.length; i += 1) km += distKm(coords[i - 1], coords[i]);
  return km;
}

function heading(a, b) {
  const lat = ((a[1] + b[1]) / 2) * (Math.PI / 180);
  return Math.atan2(b[1] - a[1], (b[0] - a[0]) * Math.cos(lat));
}

function angleDiffDeg(h1, h2) {
  let d = Math.abs(h1 - h2) * (180 / Math.PI);
  if (d > 180) d = 360 - d;
  if (d > 90) d = 180 - d;
  return d;
}

function riverHeading(line, i) {
  const a = line[Math.max(0, i - 1)];
  const b = line[Math.min(line.length - 1, i + 1)];
  return heading(a, b);
}

function nearestOnIndex(pt, index) {
  const gx = Math.floor(pt[0] / index.cell);
  const gy = Math.floor(pt[1] / index.cell);
  let best = Infinity;
  let bestSeg = null;
  for (let dx = -1; dx <= 1; dx += 1) {
    for (let dy = -1; dy <= 1; dy += 1) {
      const ids = index.grid.get(`${gx + dx},${gy + dy}`);
      if (!ids) continue;
      for (const i of ids) {
        const [a, b] = index.segs[i];
        const d = distPointSegKm(pt, a, b);
        if (d < best) {
          best = d;
          bestSeg = [a, b];
        }
      }
    }
  }
  return { dist: best, seg: bestSeg };
}

function nearIntl(pt, index) {
  return nearestOnIndex(pt, index).dist <= INTL_KM;
}

function alongState(pt, line, i, index) {
  const { dist, seg } = nearestOnIndex(pt, index);
  if (dist > STATE_KM || !seg) return false;
  return angleDiffDeg(riverHeading(line, i), heading(seg[0], seg[1])) <= STATE_MAX_ANGLE;
}

/** Fill 1–2 inland vertices trapped between on-border vertices. Does not grow outward. */
function closeGaps(flags, gap = 2) {
  const out = flags.slice();
  let i = 0;
  while (i < flags.length) {
    if (flags[i]) {
      i += 1;
      continue;
    }
    let j = i;
    while (j < flags.length && !flags[j]) j += 1;
    if (i > 0 && j < flags.length && j - i <= gap) {
      for (let k = i; k < j; k += 1) out[k] = true;
    }
    i = j;
  }
  return out;
}

function keepColoradoLine(line) {
  const mid = line[Math.floor(line.length / 2)];
  return Boolean(mid && mid[1] > 25 && mid[0] < -100);
}

function onBorderFlags(line, intlIndex, stateIndex) {
  return line.map(
    (p, i) => nearIntl(p, intlIndex) || alongState(p, line, i, stateIndex)
  );
}

function splitStretches(line, intlIndex, stateIndex) {
  const inland = [];
  const border = [];
  if (!line || line.length < 2) return { inland, border };
  const flags = closeGaps(onBorderFlags(line, intlIndex, stateIndex), 2);
  const pct = flags.filter(Boolean).length / flags.length;
  const keepShort = pct >= MOSTLY_BORDER;
  const runs = [];
  let cur = [line[0]];
  let mode = flags[0];
  for (let i = 1; i < line.length; i += 1) {
    if (flags[i] === mode) {
      cur.push(line[i]);
      continue;
    }
    if (mode) {
      runs.push({ mode, coords: cur });
      cur = [line[i - 1], line[i]];
    } else {
      cur.push(line[i]);
      runs.push({ mode, coords: cur });
      cur = [line[i]];
    }
    mode = flags[i];
  }
  runs.push({ mode, coords: cur });
  if (!keepShort) {
    for (const run of runs) {
      if (run.mode && polylineKm(run.coords) < MIN_STRETCH_KM) run.mode = false;
    }
  }
  for (let i = 1; i < runs.length - 1; i += 1) {
    if (runs[i].mode || !runs[i - 1].mode || !runs[i + 1].mode) continue;
    if (polylineKm(runs[i].coords) <= GAP_KM) runs[i].mode = true;
  }
  const merged = [];
  for (const run of runs) {
    const last = merged[merged.length - 1];
    if (last && last.mode === run.mode) {
      last.coords = last.coords.concat(run.coords.slice(1));
    } else {
      merged.push(run);
    }
  }
  for (const run of merged) {
    if (run.coords.length < 2 || polylineKm(run.coords) < 1) continue;
    (run.mode ? border : inland).push(run.coords);
  }
  return { inland, border };
}

function collectIntlLines() {
  return geomLines(mesh(topo, topo.objects.countries, (a, b) => a !== b));
}

function collectStateLines() {
  const states = loadGeojson("/tmp/states-10m.json");
  if (!states) return [];
  if (states.objects?.states) {
    return geomLines(mesh(states, states.objects.states, (a, b) => a !== b));
  }
  if (states.type === "Topology" && states.objects) {
    const obj = states.objects.states || Object.values(states.objects)[0];
    return obj ? geomLines(mesh(states, obj, (a, b) => a !== b)) : [];
  }
  return [];
}

function projectedPath(coords) {
  let d = "";
  let started = false;
  for (const c of coords) {
    if (!c || c.length < 2) continue;
    const xy = projection(c);
    if (!xy || !Number.isFinite(xy[0]) || !Number.isFinite(xy[1])) {
      started = false;
      continue;
    }
    const x = Math.round(xy[0] * 10) / 10;
    const y = Math.round(xy[1] * 10) / 10;
    d += `${started ? "L" : "M"}${x},${y}`;
    started = true;
  }
  return d.includes("L") ? d : "";
}

function lakeMarkup(fc) {
  if (!fc?.features) return "";
  const lines = [];
  for (const f of fc.features) {
    const rank = Number(f.properties?.scalerank);
    if (Number.isFinite(rank) && rank > 99) continue;
    const d = toPath(f);
    if (!d) continue;
    const rankClass = Number.isFinite(rank) ? ` geo-inland-water-r${rank}` : "";
    lines.push(`<path class="geo-inland-water${rankClass}" d="${d}"/>`);
  }
  return lines.join("\n    ");
}

function riverMarkup(fc, intlIndex, stateIndex) {
  if (!fc?.features) return { markup: "", stats: [] };
  const lines = [];
  const stats = [];
  for (const f of fc.features) {
    const cla = f.properties?.featurecla || "";
    const name = f.properties?.name || f.properties?.name_en || "";
    const key = slug(name);
    const borderRiver = Boolean(key && BORDER_SLUGS.has(key));
    if (cla === "Lake Centerline" && !borderRiver) continue;
    const rank = Number(f.properties?.scalerank);
    if (Number.isFinite(rank) && rank > 99) continue;
    const rankClass = Number.isFinite(rank) ? ` geo-river-r${rank}` : "";
    if (!borderRiver) {
      const d = geomLines(f.geometry).map(projectedPath).filter(Boolean).join("");
      if (d) lines.push(`<path class="geo-river${rankClass}" d="${d}"/>`);
      continue;
    }
    const parts = geomLines(f.geometry).map((line) => {
      if (key === "colorado" && !keepColoradoLine(line)) {
        return { inland: [line], border: [] };
      }
      return splitStretches(line, intlIndex, stateIndex);
    });
    const inland = parts.flatMap((p) => p.inland);
    const stretches = parts.flatMap((p) => p.border);
    const pts = geomLines(f.geometry).reduce((n, line) => n + line.length, 0);
    const borderPts = stretches.reduce((n, line) => n + line.length, 0);
    stats.push({ name, pts, borderPts, stretches: stretches.length });
    for (const coords of inland) {
      const d = projectedPath(coords);
      if (d) lines.push(`<path class="geo-river${rankClass}" d="${d}"/>`);
    }
    const dashPaths = stretches.map((coords) => projectedPath(coords)).filter(Boolean);
    if (!dashPaths.length) continue;
    lines.push(
      `<g class="geo-river-border-g" data-river="${key}"${attr("data-name", name)}>
      ${dashPaths
        .map(
          (dash) => `<path class="geo-river-border-bed" d="${dash}"/>
      <path class="geo-river geo-river-border${rankClass}" d="${dash}"/>`
        )
        .join("\n      ")}
    </g>`
    );
  }
  return { markup: lines.join("\n    "), stats };
}

const intlIndex = indexSegments(collectIntlLines());
const stateIndex = indexSegments(collectStateLines());
const lakesFc = loadGeojson("/tmp/ne_50m_lakes.geojson");
const riversFc = loadGeojson("/tmp/ne_50m_rivers.geojson");
const lakes = lakeMarkup(lakesFc);
const { markup: rivers, stats } = riverMarkup(riversFc, intlIndex, stateIndex);
if (!lakesFc) console.warn("Missing /tmp/ne_50m_lakes.geojson");
if (!riversFc) console.warn("Missing /tmp/ne_50m_rivers.geojson");

const group = `  <g class="geo-waterways" pointer-events="none">
    ${lakes}
    ${rivers}
  </g>`;

function replaceWaterwaysGroup(svg, next) {
  const start = svg.search(/  <g class="geo-waterways"[^>]*>/);
  if (start < 0) throw new Error("No geo-waterways group");
  const from = svg.slice(start);
  const tagRe = /<\/?g\b[^>]*>/g;
  let depth = 0;
  let end = -1;
  let m;
  while ((m = tagRe.exec(from))) {
    depth += m[0].startsWith("</") ? -1 : 1;
    if (depth === 0) {
      end = start + m.index + m[0].length;
      break;
    }
  }
  if (end < 0) throw new Error("Unclosed geo-waterways group");
  return svg.slice(0, start) + next + svg.slice(end);
}

const files = ["world-countries.svg", "continents.svg", "continents-oceans.svg"];
for (const name of files) {
  const file = path.join(OUT, name);
  writeFileSync(file, replaceWaterwaysGroup(readFileSync(file, "utf8"), group));
}

const borders = (rivers.match(/geo-river-border-g/g) || []).length;
for (const row of stats.sort((a, b) => a.name.localeCompare(b.name))) {
  const pct = row.pts ? Math.round((row.borderPts / row.pts) * 100) : 0;
  console.log(
    `  ${row.name}: ${pct}% of vertices on a border (${row.stretches} stretch${
      row.stretches === 1 ? "" : "es"
    })`
  );
}
console.log(
  `Waterways: ${lakes ? lakes.split("\n").length : 0} lakes, ${
    rivers ? rivers.split("\n").filter((l) => l.includes("<path")).length : 0
  } river paths, ${borders} dashed border rivers → ${OUT}`
);
