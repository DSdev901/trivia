#!/usr/bin/env node
/**
 * Project capital cities onto geography maps.
 *
 *   node scripts/build-capital-dots.mjs
 *
 * Needs GeoNames cities15000 at /tmp/geo-cities/cities15000.txt
 * and the same /tmp/geo-build d3-geo + world-atlas setup as build-world-maps.mjs.
 */
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "data", "geography", "capital-dots.json");
const DUMP = "/tmp/geo-cities/cities15000.txt";
const TOPO = "/tmp/countries-50m.json";
const GEO_BUILD = "/tmp/geo-build";

if (!existsSync(DUMP)) {
  throw new Error(`Missing ${DUMP}`);
}

if (!existsSync(path.join(GEO_BUILD, "node_modules", "d3-geo"))) {
  mkdirSync(GEO_BUILD, { recursive: true });
  execSync("npm i --prefix /tmp/geo-build d3-geo topojson-client", {
    stdio: "inherit",
  });
}
if (!existsSync(TOPO)) {
  execSync(
    `curl -sL -o ${TOPO} https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json`,
    { stdio: "inherit" }
  );
}

const { feature } = require("/tmp/geo-build/node_modules/topojson-client");
const { geoNaturalEarth1 } = require("/tmp/geo-build/node_modules/d3-geo");

const US_FIPS = {
  "01": "AL",
  "02": "AK",
  "04": "AZ",
  "05": "AR",
  "06": "CA",
  "08": "CO",
  "09": "CT",
  "10": "DE",
  "11": "DC",
  "12": "FL",
  "13": "GA",
  "15": "HI",
  "16": "ID",
  "17": "IL",
  "18": "IN",
  "19": "IA",
  "20": "KS",
  "21": "KY",
  "22": "LA",
  "23": "ME",
  "24": "MD",
  "25": "MA",
  "26": "MI",
  "27": "MN",
  "28": "MS",
  "29": "MO",
  "30": "MT",
  "31": "NE",
  "32": "NV",
  "33": "NH",
  "34": "NJ",
  "35": "NM",
  "36": "NY",
  "37": "NC",
  "38": "ND",
  "39": "OH",
  "40": "OK",
  "41": "OR",
  "42": "PA",
  "44": "RI",
  "45": "SC",
  "46": "SD",
  "47": "TN",
  "48": "TX",
  "49": "UT",
  "50": "VT",
  "51": "VA",
  "53": "WA",
  "54": "WV",
  "55": "WI",
  "56": "WY",
};

const CA_ADMIN = {
  "01": "AB",
  "02": "BC",
  "03": "MB",
  "04": "NB",
  "05": "NL",
  "07": "NS",
  "08": "ON",
  "09": "PE",
  "10": "QC",
  "11": "SK",
  "12": "YT",
  "13": "NT",
  "14": "NU",
};

/** Geographic boxes for the Wikimedia US states SVG (insets included). */
const US_BOUNDS = {
  AL: [30.22, 35.01, -88.47, -84.89],
  AK: [51.21, 71.54, -179.15, -129.98],
  AZ: [31.33, 37.0, -114.82, -109.05],
  AR: [33.0, 36.5, -94.62, -89.64],
  CA: [32.53, 42.01, -124.41, -114.13],
  CO: [36.99, 41.0, -109.06, -102.04],
  CT: [40.98, 42.05, -73.73, -71.79],
  DE: [38.45, 39.84, -75.79, -75.05],
  FL: [24.52, 31.0, -87.63, -80.03],
  GA: [30.36, 35.0, -85.61, -80.84],
  HI: [18.91, 22.24, -160.25, -154.81],
  ID: [41.99, 49.0, -117.24, -111.04],
  IL: [36.97, 42.51, -91.51, -87.5],
  IN: [37.77, 41.76, -88.1, -84.78],
  IA: [40.38, 43.5, -96.64, -90.14],
  KS: [36.99, 40.0, -102.05, -94.59],
  KY: [36.5, 39.15, -89.57, -81.96],
  LA: [28.93, 33.02, -94.04, -88.82],
  ME: [43.06, 47.46, -71.08, -66.95],
  MD: [37.91, 39.72, -79.49, -75.05],
  MA: [41.24, 42.89, -73.51, -69.93],
  MI: [41.7, 48.19, -90.42, -82.41],
  MN: [43.5, 49.38, -97.24, -89.49],
  MS: [30.17, 34.996, -91.65, -88.1],
  MO: [35.995, 40.61, -95.77, -89.1],
  MT: [44.36, 49.0, -116.05, -104.04],
  NE: [40.0, 43.0, -104.05, -95.31],
  NV: [35.0, 42.0, -120.01, -114.04],
  NH: [42.7, 45.31, -72.56, -70.61],
  NJ: [38.93, 41.36, -75.56, -73.89],
  NM: [31.33, 37.0, -109.05, -103.0],
  NY: [40.5, 45.02, -79.76, -71.86],
  NC: [33.84, 36.59, -84.32, -75.46],
  ND: [45.94, 49.0, -104.05, -96.55],
  OH: [38.4, 41.98, -84.82, -80.52],
  OK: [33.62, 37.0, -103.0, -94.43],
  OR: [41.99, 46.29, -124.57, -116.46],
  PA: [39.72, 42.27, -80.52, -74.7],
  RI: [41.15, 42.02, -71.86, -71.12],
  SC: [32.03, 35.22, -83.35, -78.54],
  SD: [42.48, 45.94, -104.06, -96.44],
  TN: [34.98, 36.68, -90.31, -81.65],
  TX: [25.84, 36.5, -106.65, -93.51],
  UT: [36.99, 42.0, -114.05, -109.04],
  VT: [42.73, 45.02, -73.44, -71.47],
  VA: [36.54, 39.47, -83.68, -75.24],
  WA: [45.54, 49.0, -124.76, -116.92],
  WV: [37.2, 40.64, -82.64, -77.72],
  WI: [42.49, 47.31, -92.89, -86.81],
  WY: [40.99, 45.01, -111.06, -104.05],
};

const CA_BOUNDS = {
  AB: [49.0, 60.0, -120.0, -110.0],
  BC: [48.3, 60.0, -139.06, -114.03],
  MB: [49.0, 60.0, -102.0, -88.99],
  NB: [44.6, 48.07, -69.06, -63.77],
  NL: [46.61, 60.37, -67.82, -52.62],
  NS: [43.39, 47.03, -66.4, -59.68],
  NT: [60.0, 78.76, -136.44, -101.98],
  NU: [51.64, 83.11, -120.68, -61.09],
  ON: [41.68, 56.86, -95.16, -74.34],
  PE: [45.95, 47.06, -64.42, -61.97],
  QC: [44.99, 62.58, -79.76, -57.1],
  SK: [49.0, 60.0, -110.0, -101.36],
  YT: [60.0, 69.65, -141.0, -123.8],
};

const COORD_OVERRIDES = {
  "world:TV": [-8.521, 179.196],
  "world:NR": [-0.547, 166.921],
  "world:PW": [7.501, 134.624],
  "world:KI": [1.329, 172.976],
  "world:MH": [7.089, 171.38],
  "world:FM": [6.924, 158.161],
  "world:WS": [-13.833, -171.767],
  "world:TO": [-21.135, -175.201],
  "world:CK": [-21.207, -159.775],
  "world:NU": [-19.054, -169.92],
  "world:TK": [-9.167, -171.833],
  "world:VA": [41.902, 12.453],
  "world:SM": [43.937, 12.446],
  "world:MC": [43.731, 7.42],
  "world:LI": [47.141, 9.521],
  "world:AD": [42.507, 1.521],
  "world:MT": [35.899, 14.514],
  "world:SG": [1.29, 103.852],
  "world:BH": [26.228, 50.586],
  "world:MV": [4.175, 73.509],
  "world:SC": [-4.62, 55.451],
  "world:ST": [0.336, 6.727],
  "world:KM": [-11.702, 43.255],
  "world:AG": [17.118, -61.845],
  "world:KN": [17.302, -62.717],
  "world:LC": [14.01, -60.987],
  "world:VC": [13.157, -61.225],
  "world:GD": [12.056, -61.748],
  "world:DM": [15.301, -61.388],
  "world:BB": [13.097, -59.613],
  "world:BS": [25.078, -77.338],
  "world:XK": [42.663, 21.166],
  "world:PS": [31.768, 35.213],
  "world:TW": [25.033, 121.565],
  "world:AS": [-14.278, -170.702],
  "world:GU": [13.474, 144.75],
  "world:MP": [15.21, 145.75],
  "world:PF": [-17.533, -149.566],
  "world:NC": [-22.276, 166.458],
  "world:WF": [-13.282, -176.174],
  "world:PN": [-25.066, -130.101],
  "world:GF": [4.938, -52.335],
  "world:EH": [27.153, -13.203],
  "ca:NU": [63.7466, -68.517],
};

function fold(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(city|the|of)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function loadJson(name) {
  return JSON.parse(
    readFileSync(path.join(ROOT, "data", "geography", name), "utf8")
  );
}

function parseCities() {
  const byCc = new Map();
  const byUs = new Map();
  const byCa = new Map();
  const lines = readFileSync(DUMP, "utf8").split("\n");
  for (const line of lines) {
    if (!line) continue;
    const p = line.split("\t");
    const code = p[7];
    if (!code || !code.startsWith("PPL")) continue;
    const row = {
      name: p[1],
      ascii: p[2],
      alts: (p[3] || "").split(","),
      lat: Number(p[4]),
      lon: Number(p[5]),
      code,
      cc: p[8],
      admin1: p[10] || "",
      pop: Number(p[14]) || 0,
    };
    if (!byCc.has(row.cc)) byCc.set(row.cc, []);
    byCc.get(row.cc).push(row);
    if (row.cc === "US") {
      const st = US_FIPS[row.admin1] || (row.admin1.length === 2 ? row.admin1 : "");
      if (st) {
        if (!byUs.has(st)) byUs.set(st, []);
        byUs.get(st).push(row);
      }
    }
    if (row.cc === "CA") {
      const st = CA_ADMIN[row.admin1];
      if (st) {
        if (!byCa.has(st)) byCa.set(st, []);
        byCa.get(st).push(row);
      }
    }
  }
  return { byCc, byUs, byCa };
}

function namesOf(row) {
  return [row.name, row.ascii, ...(row.alts || [])].filter(Boolean);
}

function scoreRow(row, want) {
  if (!want) {
    if (row.code === "PPLC") return 4;
    if (row.code === "PPLA") return 2;
    return 0;
  }
  const names = namesOf(row).map(fold);
  if (names.includes(want)) return row.code === "PPLC" ? 12 : 10;
  if (want.length > 4 && names.some((n) => n.includes(want) || want.includes(n))) {
    return row.code === "PPLC" ? 8 : 6;
  }
  if (row.code === "PPLC") return 4;
  if (row.code === "PPLA") return 2;
  return 0;
}

function pickRow(rows, capital) {
  const want = fold(capital);
  let best = null;
  let bestS = 0;
  for (const row of rows || []) {
    const s = scoreRow(row, want);
    if (s > bestS || (s === bestS && best && row.pop > best.pop)) {
      best = row;
      bestS = s;
    }
  }
  return bestS > 0 ? best : null;
}

function fracInBox(lat, lon, box) {
  const [south, north, west, east] = box;
  const fx = (lon - west) / (east - west);
  const fy = (north - lat) / (north - south);
  return {
    fx: Math.round(Math.min(0.92, Math.max(0.08, fx)) * 1000) / 1000,
    fy: Math.round(Math.min(0.92, Math.max(0.08, fy)) * 1000) / 1000,
  };
}

function worldProjection() {
  const topo = JSON.parse(readFileSync(TOPO, "utf8"));
  const countries = feature(topo, topo.objects.countries);
  return geoNaturalEarth1().fitExtent(
    [
      [8, 8],
      [992, 512],
    ],
    countries
  );
}

const { byCc, byUs, byCa } = parseCities();
const projection = worldProjection();

function extraWorldItems() {
  const seen = new Set();
  const extra = [];
  for (const name of [
    "oceania-territories-capitals.json",
    "sa-capitals.json",
    "africa-countries.json",
  ]) {
    const pack = loadJson(name);
    for (const it of pack.items || []) {
      if (!it.id || !it.capital || seen.has(it.id)) continue;
      seen.add(it.id);
      extra.push(it);
    }
  }
  return extra;
}

const worldItems = [
  ...loadJson("world-countries.json").items,
  ...extraWorldItems(),
];
const usItems = loadJson("us-states.json").items;
const caItems = loadJson("canada-provinces.json").items;

const countries = {};
const missingWorld = [];
for (const it of worldItems) {
  if (countries[it.id]) continue;
  const override = COORD_OVERRIDES[`world:${it.id}`];
  let lat = override?.[0];
  let lon = override?.[1];
  if (lat == null) {
    const rows = byCc.get(it.id) || byCc.get(it.id === "XK" ? "KO" : "") || [];
    const row = pickRow(rows, it.capital);
    if (row) {
      lat = row.lat;
      lon = row.lon;
    }
  }
  if (lat == null) {
    missingWorld.push(`${it.id} ${it.capital}`);
    continue;
  }
  const xy = projection([lon, lat]);
  if (!xy || !Number.isFinite(xy[0]) || !Number.isFinite(xy[1])) {
    missingWorld.push(`${it.id} ${it.capital} (project)`);
    continue;
  }
  countries[it.id] = {
    x: Math.round(xy[0] * 10) / 10,
    y: Math.round(xy[1] * 10) / 10,
  };
}

const us = {};
const missingUs = [];
for (const it of usItems) {
  const box = US_BOUNDS[it.id];
  const row = pickRow(byUs.get(it.id) || [], it.capital);
  if (!row || !box) {
    missingUs.push(`${it.id} ${it.capital}`);
    continue;
  }
  us[it.id] = fracInBox(row.lat, row.lon, box);
}

const ca = {};
const missingCa = [];
for (const it of caItems) {
  const box = CA_BOUNDS[it.id];
  const override = COORD_OVERRIDES[`ca:${it.id}`];
  const row = pickRow(byCa.get(it.id) || [], it.capital);
  const lat = override?.[0] ?? row?.lat;
  const lon = override?.[1] ?? row?.lon;
  if (lat == null || lon == null || !box) {
    missingCa.push(`${it.id} ${it.capital}`);
    continue;
  }
  ca[it.id] = fracInBox(lat, lon, box);
}

const payload = { countries, us, ca };
writeFileSync(OUT, `${JSON.stringify(payload, null, 2)}\n`);
console.log(
  `wrote ${OUT} world=${Object.keys(countries).length} us=${
    Object.keys(us).length
  } ca=${Object.keys(ca).length}`
);
if (missingWorld.length) console.warn("missing world", missingWorld.join(", "));
if (missingUs.length) console.warn("missing us", missingUs.join(", "));
if (missingCa.length) console.warn("missing ca", missingCa.join(", "));
