#!/usr/bin/env node
/**
 * Build world-countries / continents SVGs from Natural Earth (world-atlas).
 * Requires: npm i d3-geo topojson-client  (run from /tmp or a scratch dir)
 * and /tmp/countries.json from mledoze/countries + countries-50m.json.
 *
 *   curl -sL -o /tmp/countries-50m.json https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json
 *   curl -sL -o /tmp/countries.json https://raw.githubusercontent.com/mledoze/countries/master/countries.json
 *   cd /tmp/geo-build && npm i d3-geo topojson-client
 *   node /path/to/scripts/build-world-maps.mjs
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
const numeric = JSON.parse(readFileSync("/tmp/countries.json", "utf8"));
const byNum = new Map();
const byName = new Map();
for (const c of numeric) {
  if (c.ccn3) byNum.set(String(Number(c.ccn3)), c.cca2);
  byName.set(c.name.common.toLowerCase(), c.cca2);
}
const nameAliases = {
  "bosnia and herz.": "BA",
  "solomon is.": "SB",
  "n. cyprus": "CY",
  somaliland: "SO",
  kosovo: "XK",
  "eq. guinea": "GQ",
  "w. sahara": "EH",
  "central african rep.": "CF",
  "dem. rep. congo": "CD",
  congo: "CG",
  "côte d'ivoire": "CI",
  "dominican rep.": "DO",
  "falkland is.": "FK",
  "guinea-bissau": "GW",
  "n. macedonia": "MK",
  palestine: "PS",
  "s. sudan": "SS",
  taiwan: "TW",
  "united states of america": "US",
  tanzania: "TZ",
  venezuela: "VE",
  vietnam: "VN",
  syria: "SY",
  russia: "RU",
  "south korea": "KR",
  "north korea": "KP",
  laos: "LA",
  brunei: "BN",
  "czech rep.": "CZ",
  czechia: "CZ",
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
  AQ: "AN", TF: "AN",
};

const width = 1000;
const height = 520;
const projection = geoNaturalEarth1().fitExtent(
  [
    [8, 8],
    [width - 8, height - 8],
  ],
  countries
);
const path = geoPath(projection);
const byIso = new Map();
for (const f of countries.features) {
  const idNum = f.id != null ? String(Number(f.id)) : "";
  let iso = idNum ? byNum.get(idNum) : null;
  const nm = (f.properties?.name || "").toLowerCase();
  if (!iso) iso = nameAliases[nm] || byName.get(nm);
  if (!iso) continue;
  const d = path(f);
  if (!d) continue;
  if (!byIso.has(iso)) byIso.set(iso, []);
  byIso.get(iso).push(d);
}

const contPaths = new Map();
for (const [iso, ds] of byIso) {
  const cont = ISO_CONT[iso];
  if (!cont) continue;
  if (!contPaths.has(cont)) contPaths.set(cont, []);
  contPaths.get(cont).push(...ds);
}

const countrySvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="100%" role="img" aria-label="World countries map">
  <rect class="geo-ocean-bg" width="${width}" height="${height}"/>
  ${[...byIso.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(
      ([iso, ds]) =>
        `<path id="${iso}" data-id="${iso}" class="geo-region" d="${ds.join(" ")}"/>`
    )
    .join("\n  ")}
</svg>
`;

const order = ["NA", "SA", "EU", "AF", "AS", "OC", "AN"];
const continentsSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="100%" role="img" aria-label="World continents map">
  <rect class="geo-ocean-bg" width="${width}" height="${height}"/>
  ${order
    .filter((c) => contPaths.has(c))
    .map(
      (c) =>
        `<path id="${c}" data-id="${c}" class="geo-region" d="${contPaths.get(c).join(" ")}"/>`
    )
    .join("\n  ")}
</svg>
`;

const oceans = `
  <path id="PO" data-id="PO" class="geo-region geo-ocean" d="M0,40 L180,30 L200,220 L160,380 L80,480 L0,490 Z M820,40 L1000,30 L1000,490 L900,470 L840,300 L820,120 Z"/>
  <path id="AO" data-id="AO" class="geo-region geo-ocean" d="M280,60 L430,50 L470,180 L450,340 L400,450 L320,460 L280,300 Z"/>
  <path id="IO" data-id="IO" class="geo-region geo-ocean" d="M560,200 L720,180 L780,300 L740,420 L600,440 L540,340 Z"/>
  <path id="AR" data-id="AR" class="geo-region geo-ocean" d="M120,0 L880,0 L820,55 L500,45 L200,55 Z"/>
  <path id="SO" data-id="SO" class="geo-region geo-ocean" d="M80,455 L920,455 L1000,520 L0,520 Z"/>
`;
const continentsOceansSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="100%" role="img" aria-label="Continents and oceans map">
  <rect class="geo-ocean-bg" width="${width}" height="${height}"/>
  ${oceans}
  ${order
    .filter((c) => contPaths.has(c))
    .map(
      (c) =>
        `<path id="${c}" data-id="${c}" class="geo-region" d="${contPaths.get(c).join(" ")}"/>`
    )
    .join("\n  ")}
</svg>
`;

writeFileSync(path.join(OUT, "world-countries.svg"), countrySvg);
writeFileSync(path.join(OUT, "continents.svg"), continentsSvg);
writeFileSync(path.join(OUT, "continents-oceans.svg"), continentsOceansSvg);
console.log(`Wrote ${byIso.size} countries → ${OUT}`);
