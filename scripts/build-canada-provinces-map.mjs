#!/usr/bin/env node
/**
 * Canada provinces & territories SVG from Click That Hood / Natural Earth-style GeoJSON.
 * Neighboring countries (US, Greenland, St. Pierre) are drawn behind as muted context land.
 *
 *   curl -sL -o /tmp/canada-provinces.geojson \
 *     https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/canada.geojson
 *   curl -sL -o /tmp/countries-50m.json https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json
 *   curl -sL -o /tmp/countries.json https://raw.githubusercontent.com/mledoze/countries/master/countries.json
 *   node scripts/build-canada-provinces-map.mjs
 */
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CA_PROVINCE_NAME_TO_ID, CA_PROVINCES } from "./lib/canada-provinces.mjs";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_MAP = path.join(ROOT, "data", "geography", "maps", "canada-provinces.svg");
const SRC = "/tmp/canada-provinces.geojson";
const COUNTRIES_TOPO = "/tmp/countries-50m.json";
const COUNTRIES_META = "/tmp/countries.json";
const GEOJSON_URL =
  "https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/canada.geojson";
const CONTEXT_ISO = new Set(["US", "GL"]);
const CONTEXT_NAMES = {
  US: "United States",
  GL: "Greenland",
};
const NAME_ALIASES = {
  "united states of america": "US",
  russia: "RU",
};

if (!existsSync("/tmp/geo-build/node_modules/d3-geo")) {
  mkdirSync("/tmp/geo-build", { recursive: true });
  execSync("npm i --prefix /tmp/geo-build d3-geo topojson-client", { stdio: "inherit" });
}
if (!existsSync("/tmp/geo-build/node_modules/topojson-client")) {
  execSync("npm i --prefix /tmp/geo-build topojson-client", { stdio: "inherit" });
}
if (!existsSync(SRC)) {
  execSync(`curl -sL -o ${SRC} ${GEOJSON_URL}`, { stdio: "inherit" });
}
if (!existsSync(COUNTRIES_TOPO)) {
  execSync(
    `curl -sL -o ${COUNTRIES_TOPO} https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json`,
    { stdio: "inherit" }
  );
}
if (!existsSync(COUNTRIES_META)) {
  execSync(
    `curl -sL -o ${COUNTRIES_META} https://raw.githubusercontent.com/mledoze/countries/master/countries.json`,
    { stdio: "inherit" }
  );
}

const { geoConicEqualArea, geoPath, geoCentroid } = require("/tmp/geo-build/node_modules/d3-geo");
const { feature } = require("/tmp/geo-build/node_modules/topojson-client");
const fc = JSON.parse(readFileSync(SRC, "utf8"));

const byId = new Map();
for (const f of fc.features || []) {
  const raw = String(f.properties?.name || "").trim().toLowerCase();
  const id = CA_PROVINCE_NAME_TO_ID[raw];
  if (!id) throw new Error(`Unknown Canada region in GeoJSON: ${f.properties?.name}`);
  if (!byId.has(id)) byId.set(id, []);
  byId.get(id).push(f);
}

const missing = CA_PROVINCES.filter((p) => !byId.has(p.id)).map((p) => p.id);
if (missing.length) throw new Error(`Missing province geometries: ${missing.join(", ")}`);

const merged = {
  type: "FeatureCollection",
  features: CA_PROVINCES.map((p) => ({
    type: "Feature",
    id: p.id,
    properties: { id: p.id, name: p.name },
    geometry:
      byId.get(p.id).length === 1
        ? byId.get(p.id)[0].geometry
        : {
            type: "GeometryCollection",
            geometries: byId.get(p.id).map((f) => f.geometry),
          },
  })),
};

const width = 1000;
const height = 640;
// Leave room around Canada so the US, Alaska, and Greenland read as land, not ocean.
const projection = geoConicEqualArea()
  .parallels([49, 77])
  .rotate([96, 0])
  .fitExtent(
    [
      [58, 22],
      [width - 52, height - 98],
    ],
    merged
  )
  .clipExtent([
    [-80, -40],
    [width + 80, height + 140],
  ]);
const toPath = geoPath(projection);

function roundPath(d) {
  return d.replace(/[-+]?\d*\.?\d+(?:e[-+]?\d+)?/gi, (n) => {
    const x = Number(n);
    return Number.isFinite(x) ? String(Math.round(x * 10) / 10) : n;
  });
}

function isoForFeature(f, byNum, byName) {
  const idNum = f.id != null ? String(Number(f.id)) : "";
  const nm = (f.properties?.name || "").toLowerCase();
  return (idNum && byNum.get(idNum)) || NAME_ALIASES[nm] || byName.get(nm) || "";
}

/** Keep polygons that actually sit next to Canada (drop Hawaii, metro France, etc.). */
function nearCanada(lon, lat) {
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return false;
  if (lat < 41 || lat > 86) return false;
  return lon <= -12 || lon >= 160;
}

function filterNearCanada(geometry) {
  if (!geometry) return null;
  if (geometry.type === "Polygon") {
    const [lon, lat] = geoCentroid({ type: "Feature", geometry });
    return nearCanada(lon, lat) ? geometry : null;
  }
  if (geometry.type === "MultiPolygon") {
    const kept = geometry.coordinates.filter((coordinates) => {
      const [lon, lat] = geoCentroid({
        type: "Feature",
        geometry: { type: "Polygon", coordinates },
      });
      return nearCanada(lon, lat);
    });
    if (!kept.length) return null;
    return kept.length === 1
      ? { type: "Polygon", coordinates: kept[0] }
      : { type: "MultiPolygon", coordinates: kept };
  }
  return null;
}

function contextPaths() {
  const topo = JSON.parse(readFileSync(COUNTRIES_TOPO, "utf8"));
  const countries = feature(topo, topo.objects.countries);
  const numeric = JSON.parse(readFileSync(COUNTRIES_META, "utf8"));
  const byNum = new Map();
  const byName = new Map();
  for (const c of numeric) {
    if (c.ccn3) byNum.set(String(Number(c.ccn3)), c.cca2);
    byName.set(c.name.common.toLowerCase(), c.cca2);
  }

  const lines = [];
  for (const f of countries.features) {
    const iso = isoForFeature(f, byNum, byName);
    if (!CONTEXT_ISO.has(iso)) continue;
    const geometry = filterNearCanada(f.geometry);
    if (!geometry) continue;
    const clipped = { ...f, geometry };
    const d = toPath(clipped);
    if (!d) continue;
    const [[x0, y0], [x1, y1]] = geoPath(projection).bounds(clipped);
    if (x1 < -40 || y1 < -40 || x0 > width + 40 || y0 > height + 80) continue;
    const name = CONTEXT_NAMES[iso] || iso;
    lines.push(
      `<path class="geo-context" data-iso="${iso}" d="${roundPath(d)}"><title>${name}</title></path>`
    );
    console.log(
      `Context ${iso} bbox ${(x1 - x0).toFixed(1)}×${(y1 - y0).toFixed(1)} at ${x0.toFixed(0)},${y0.toFixed(0)}`
    );
  }
  return lines;
}

const extras = [];
const paths = [];
for (const f of merged.features) {
  const d = toPath(f);
  if (!d) throw new Error(`Could not project ${f.id}`);
  paths.push(
    `<path id="${f.id}" data-id="${f.id}" class="geo-region" d="${roundPath(d)}"><title>${f.properties.name}</title></path>`
  );
  const [[x0, y0], [x1, y1]] = geoPath(projection).bounds(f);
  const bw = x1 - x0;
  const bh = y1 - y0;
  if (Math.min(bw, bh) < 6) {
    const [cx, cy] = projection(geoCentroid(f));
    extras.push(
      `<circle data-id="${f.id}" class="geo-region geo-island-dot" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="5.5"/>`
    );
    console.log(`Added hit-dot for ${f.id} (bbox ${bw.toFixed(1)}×${bh.toFixed(1)})`);
  } else {
    console.log(`${f.id} bbox ${bw.toFixed(1)}×${bh.toFixed(1)}`);
  }
}

const neighbors = contextPaths();

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="100%" role="img" aria-label="Canada provinces and territories map">
  <rect class="geo-ocean-bg" width="${width}" height="${height}"/>
  ${neighbors.join("\n  ")}
  ${paths.join("\n  ")}
  ${extras.join("\n  ")}
</svg>
`;

writeFileSync(OUT_MAP, svg);
console.log(`Wrote ${OUT_MAP} (${neighbors.length} neighbor countries)`);
