#!/usr/bin/env node
/**
 * Canada provinces & territories SVG from Click That Hood / Natural Earth-style GeoJSON.
 *
 *   curl -sL -o /tmp/canada-provinces.geojson \
 *     https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/canada.geojson
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
const GEOJSON_URL =
  "https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/canada.geojson";

if (!existsSync("/tmp/geo-build/node_modules/d3-geo")) {
  mkdirSync("/tmp/geo-build", { recursive: true });
  execSync("npm i --prefix /tmp/geo-build d3-geo", { stdio: "inherit" });
}
if (!existsSync(SRC)) {
  execSync(`curl -sL -o ${SRC} ${GEOJSON_URL}`, { stdio: "inherit" });
}

const { geoConicEqualArea, geoPath, geoCentroid } = require("/tmp/geo-build/node_modules/d3-geo");
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
const projection = geoConicEqualArea()
  .parallels([49, 77])
  .rotate([96, 0])
  .fitExtent(
    [
      [18, 18],
      [width - 18, height - 18],
    ],
    merged
  );
const toPath = geoPath(projection);

function roundPath(d) {
  return d.replace(/[-+]?\d*\.?\d+(?:e[-+]?\d+)?/gi, (n) => {
    const x = Number(n);
    return Number.isFinite(x) ? String(Math.round(x * 10) / 10) : n;
  });
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

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="100%" role="img" aria-label="Canada provinces and territories map">
  <rect class="geo-ocean-bg" width="${width}" height="${height}"/>
  ${paths.join("\n  ")}
  ${extras.join("\n  ")}
</svg>
`;

writeFileSync(OUT_MAP, svg);
console.log(`Wrote ${OUT_MAP}`);
