#!/usr/bin/env node
/**
 * Rebuild inland lakes + rivers on the world SVGs.
 * Rivers that follow a land border get a dashed overlay on that stretch only.
 * The dash is shown only on waterways quizzes (CSS .is-water-pack).
 *
 * Same /tmp Natural Earth + d3-geo setup as build-world-maps.mjs.
 * Optional: curl -sL -o /tmp/states-10m.json https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json
 * so U.S. state-line rivers (Ohio, Chattahoochee) dash only on those stretches.
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

/** How close a river vertex must sit to a land border to count as the border stretch. */
const BORDER_KM = 38;

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

function nearBorder(pt, index, maxKm) {
  const gx = Math.floor(pt[0] / index.cell);
  const gy = Math.floor(pt[1] / index.cell);
  let best = Infinity;
  for (let dx = -1; dx <= 1; dx += 1) {
    for (let dy = -1; dy <= 1; dy += 1) {
      const ids = index.grid.get(`${gx + dx},${gy + dy}`);
      if (!ids) continue;
      for (const i of ids) {
        const d = distPointSegKm(pt, index.segs[i][0], index.segs[i][1]);
        if (d < best) best = d;
        if (best <= maxKm) return true;
      }
    }
  }
  return best <= maxKm;
}

function dilate(flags, n = 1) {
  const out = flags.slice();
  for (let i = 0; i < flags.length; i += 1) {
    if (!flags[i]) continue;
    for (let j = Math.max(0, i - n); j <= Math.min(flags.length - 1, i + n); j += 1) {
      out[j] = true;
    }
  }
  return out;
}

function borderStretches(line, index, maxKm) {
  if (!line || line.length < 2) return [];
  const flags = dilate(line.map((p) => nearBorder(p, index, maxKm)), 1);
  const out = [];
  let cur = null;
  for (let i = 1; i < line.length; i += 1) {
    const on = flags[i - 1] || flags[i];
    if (on) {
      if (!cur) cur = [line[i - 1]];
      cur.push(line[i]);
    } else if (cur) {
      if (cur.length >= 2) out.push(cur);
      cur = null;
    }
  }
  if (cur && cur.length >= 2) out.push(cur);
  return out;
}

function collectBorderLines() {
  const lines = geomLines(mesh(topo, topo.objects.countries, (a, b) => a !== b));
  const states = loadGeojson("/tmp/states-10m.json");
  if (states?.objects?.states) {
    lines.push(...geomLines(mesh(states, states.objects.states, (a, b) => a !== b)));
  } else if (states?.type === "Topology" && states.objects) {
    const obj = states.objects.states || Object.values(states.objects)[0];
    if (obj) lines.push(...geomLines(mesh(states, obj, (a, b) => a !== b)));
  }
  return lines;
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

function riverMarkup(fc, borderIndex) {
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
    const d = toPath(f);
    if (!d) continue;
    const rankClass = Number.isFinite(rank) ? ` geo-river-r${rank}` : "";
    lines.push(`<path class="geo-river${rankClass}" d="${d}"/>`);
    if (!borderRiver) continue;
    const stretches = geomLines(f.geometry).flatMap((line) =>
      borderStretches(line, borderIndex, BORDER_KM)
    );
    const pts = geomLines(f.geometry).reduce((n, line) => n + line.length, 0);
    const borderPts = stretches.reduce((n, line) => n + line.length, 0);
    stats.push({ name, pts, borderPts, stretches: stretches.length });
    const dashPaths = stretches
      .map((coords) => toPath({ type: "LineString", coordinates: coords }))
      .filter(Boolean);
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

const borderIndex = indexSegments(collectBorderLines());
const lakesFc = loadGeojson("/tmp/ne_50m_lakes.geojson");
const riversFc = loadGeojson("/tmp/ne_50m_rivers.geojson");
const lakes = lakeMarkup(lakesFc);
const { markup: rivers, stats } = riverMarkup(riversFc, borderIndex);
if (!lakesFc) console.warn("Missing /tmp/ne_50m_lakes.geojson");
if (!riversFc) console.warn("Missing /tmp/ne_50m_rivers.geojson");

const group = `  <g class="geo-waterways" pointer-events="none">
    ${lakes}
    ${rivers}
  </g>`;

const files = ["world-countries.svg", "continents.svg", "continents-oceans.svg"];
const re = /  <g class="geo-waterways"[^>]*>[\s\S]*?<\/g>/;
for (const name of files) {
  const file = path.join(OUT, name);
  const svg = readFileSync(file, "utf8");
  if (!re.test(svg)) {
    throw new Error(`No geo-waterways group in ${name}`);
  }
  writeFileSync(file, svg.replace(re, group));
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
