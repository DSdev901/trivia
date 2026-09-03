#!/usr/bin/env node
/**
 * Rebuild inland lakes + rivers on the world SVGs, tagging rivers that
 * form a land border with a white/blue dashed stroke.
 *
 * Same /tmp Natural Earth + d3-geo setup as build-world-maps.mjs.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "data", "geography", "maps");

const { feature } = require("/tmp/geo-build/node_modules/topojson-client");
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
]);

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

function riverMarkup(fc) {
  if (!fc?.features) return "";
  const lines = [];
  for (const f of fc.features) {
    const cla = f.properties?.featurecla || "";
    const name = f.properties?.name || f.properties?.name_en || "";
    const key = slug(name);
    const border = Boolean(key && BORDER_SLUGS.has(key));
    if (cla === "Lake Centerline" && !border) continue;
    const rank = Number(f.properties?.scalerank);
    if (Number.isFinite(rank) && rank > 99) continue;
    const d = toPath(f);
    if (!d) continue;
    const rankClass = Number.isFinite(rank) ? ` geo-river-r${rank}` : "";
    if (border) {
      lines.push(
        `<g class="geo-river-border-g" data-river="${key}"${attr("data-name", name)}>
      <path class="geo-river-border-bed" d="${d}"/>
      <path class="geo-river geo-river-border${rankClass}" d="${d}"/>
    </g>`
      );
      continue;
    }
    lines.push(`<path class="geo-river${rankClass}" d="${d}"/>`);
  }
  return lines.join("\n    ");
}

const lakesFc = loadGeojson("/tmp/ne_50m_lakes.geojson");
const riversFc = loadGeojson("/tmp/ne_50m_rivers.geojson");
const lakes = lakeMarkup(lakesFc);
const rivers = riverMarkup(riversFc);
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
console.log(
  `Waterways: ${lakes ? lakes.split("\n").length : 0} lakes, ${
    rivers ? rivers.split("\n").filter((l) => l.includes("<path")).length : 0
  } river paths, ${borders} border stretches → ${OUT}`
);
