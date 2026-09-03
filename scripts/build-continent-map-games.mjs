#!/usr/bin/env node
/**
 * Continent map games and hub sections.
 *
 *   node scripts/build-continent-map-games.mjs
 *
 * Run after africa map games / feature packs so existing quizzes stay in packs.json.
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  EUROPE_CITIES_EASY,
  EUROPE_CITIES_EXTRA,
  SA_CITIES_EASY,
  SA_CITIES_EXTRA,
  ASIA_CITIES_EASY,
  ASIA_CITIES_EXTRA,
  AU_CITIES_EASY,
  AU_CITIES_EXTRA,
  ANZ_CITIES,
  US_CITIES_EASY,
  US_CITIES_EXTRA,
  CA_CITIES_EASY,
  CA_CITIES_EXTRA,
} from "./lib/continent-cities.mjs";
import { CA_PROVINCES, CA_REGIONS } from "./lib/canada-provinces.mjs";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "data", "geography");

const MODES_COUNTRY = ["pin", "type", "outline", "name", "choice", "capitals", "study"];
const MODES_CAPITALS = ["pin", "type", "name", "choice", "reverse", "study"];
const MODES_CITIES = ["pin", "type", "name", "choice", "study"];
const MODES_FLAGS = ["type", "choice", "reverse", "study"];
const MODES_OUTLINE = ["outline", "type", "choice", "study"];
const MODES_STATES = ["pin", "type", "outline", "name", "choice", "capitals", "abbr", "study"];

const NAME_OVERRIDES = {
  TL: "East Timor",
  FM: "Federated States of Micronesia",
  GM: "The Gambia",
  CD: "Democratic Republic of the Congo",
  CG: "Republic of the Congo",
};

const CAPITAL_OVERRIDES = {
  GQ: "Ciudad de la Paz",
  SZ: "Mbabane",
};

const EXTRA = {
  XK: {
    id: "XK",
    name: "Kosovo",
    capital: "Pristina",
    flag: "🇽🇰",
    region: "Europe",
    subregion: "Southeast Europe",
  },
  NC: {
    id: "NC",
    name: "New Caledonia",
    capital: "Nouméa",
    flag: "🇳🇨",
    region: "Oceania",
    subregion: "Melanesia",
  },
  EH: {
    id: "EH",
    name: "Western Sahara",
    capital: "",
    flag: "🇪🇭",
    region: "Africa",
    subregion: "Northern Africa",
    fact: "UN non-self-governing territory. Morocco administers most of it. The Sahrawi Arab Democratic Republic claims it.",
  },
  GF: {
    id: "GF",
    name: "French Guiana",
    capital: "Cayenne",
    flag: "🇬🇫",
    region: "Americas",
    subregion: "South America",
  },
  AS: {
    id: "AS",
    name: "American Samoa",
    capital: "Pago Pago",
    flag: "🇦🇸",
    region: "Oceania",
    subregion: "Polynesia",
  },
  CK: {
    id: "CK",
    name: "Cook Islands",
    capital: "Avarua",
    flag: "🇨🇰",
    region: "Oceania",
    subregion: "Polynesia",
  },
  PF: {
    id: "PF",
    name: "French Polynesia",
    capital: "Papeete",
    flag: "🇵🇫",
    region: "Oceania",
    subregion: "Polynesia",
  },
  GU: {
    id: "GU",
    name: "Guam",
    capital: "Hagåtña",
    flag: "🇬🇺",
    region: "Oceania",
    subregion: "Micronesia",
  },
  NU: {
    id: "NU",
    name: "Niue",
    capital: "Alofi",
    flag: "🇳🇺",
    region: "Oceania",
    subregion: "Polynesia",
  },
  MP: {
    id: "MP",
    name: "Northern Mariana Islands",
    capital: "Saipan",
    flag: "🇲🇵",
    region: "Oceania",
    subregion: "Micronesia",
  },
  PN: {
    id: "PN",
    name: "Pitcairn Islands",
    capital: "Adamstown",
    flag: "🇵🇳",
    region: "Oceania",
    subregion: "Polynesia",
  },
  TK: {
    id: "TK",
    name: "Tokelau",
    capital: "Nukunonu",
    flag: "🇹🇰",
    region: "Oceania",
    subregion: "Polynesia",
  },
  WF: {
    id: "WF",
    name: "Wallis and Futuna",
    capital: "Mata-Utu",
    flag: "🇼🇫",
    region: "Oceania",
    subregion: "Polynesia",
  },
};

const LISTS = {
  "northern-europe": ["DK", "EE", "FI", "IS", "IE", "LV", "LT", "NO", "SE", "GB"],
  "western-europe": ["AT", "BE", "FR", "DE", "LI", "LU", "MC", "NL", "CH"],
  "eastern-europe": ["BY", "BG", "CZ", "HU", "MD", "PL", "RO", "RU", "SK", "UA"],
  "southern-europe": [
    "AL", "AD", "BA", "HR", "CY", "GR", "IT", "XK", "MT", "ME", "MK", "PT", "SM", "RS", "SI", "ES", "TR", "VA",
  ],
  nordic: ["DK", "FI", "IS", "NO", "SE"],
  eu: [
    "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU",
    "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE",
  ],
  "southeast-asia": ["BN", "KH", "TL", "ID", "LA", "MY", "MM", "PH", "SG", "TH", "VN"],
  "south-asia": ["AF", "BD", "BT", "IN", "MV", "NP", "PK", "LK"],
  "east-asia": ["CN", "JP", "MN", "KP", "KR", "TW"],
  "central-asia": ["KZ", "KG", "TJ", "TM", "UZ"],
  "middle-east": ["BH", "CY", "EG", "IR", "IQ", "IL", "JO", "KW", "LB", "OM", "QA", "SA", "SY", "TR", "AE", "YE"],
  mena: [
    "DZ", "BH", "CY", "EG", "IR", "IQ", "IL", "JO", "KW", "LB", "LY", "MA", "OM", "QA", "SA", "SY", "TN", "TR", "AE", "YE",
  ],
  "latin-america": [
    "MX", "BZ", "CR", "SV", "GT", "HN", "NI", "PA", "AR", "BO", "BR", "CL", "CO", "EC", "GY", "PY", "PE", "SR", "UY", "VE",
  ],
  "australia-surrounding": ["FJ", "ID", "MY", "NC", "NZ", "PG", "SB", "TL", "VU"],
  melanesia: ["FJ", "PG", "SB", "VU"],
  micronesia: ["KI", "MH", "FM", "NR", "PW"],
  polynesia: ["WS", "TO", "TV"],
  "northern-america": ["CA", "MX", "US"],
  "central-america": ["BZ", "CR", "SV", "GT", "HN", "NI", "PA"],
  caribbean: [
    "AG", "BS", "BB", "CU", "DM", "DO", "GD", "HT", "JM", "KN", "LC", "VC", "TT",
  ],
  // Keep in sync with scripts/build-africa-map-games.mjs
  "northern-africa": ["DZ", "EG", "LY", "MA", "SD", "TN", "EH"],
  "western-africa": [
    "BJ", "BF", "GH", "GN", "GW", "CI", "LR", "ML", "MR", "NE", "NG", "SN", "SL", "GM", "TG",
  ],
  "central-africa": ["AO", "CM", "CF", "TD", "CD", "GQ", "GA", "CG"],
  "eastern-africa": [
    "BI", "DJ", "ER", "ET", "KE", "MG", "MW", "MZ", "RW", "SO", "SS", "TZ", "UG", "ZM", "ZW",
  ],
  "southern-africa": ["BW", "SZ", "LS", "NA", "ZA"],
  "africa-north-equator": [
    "DZ", "BJ", "BF", "CM", "CF", "TD", "DJ", "EG", "ER", "ET", "GH", "GN", "GW", "CI", "LR",
    "LY", "ML", "MR", "MA", "NE", "NG", "SN", "SL", "SO", "SS", "SD", "GM", "TG", "TN", "EH",
  ],
  "africa-south-equator": [
    "AO", "BW", "BI", "CD", "GQ", "SZ", "GA", "KE", "LS", "MG", "MW", "MZ", "NA", "CG", "RW",
    "ZA", "TZ", "UG", "ZM", "ZW",
  ],
  // Seterra Oceania: Countries and Territories (vgp/3128), minus Hawaii
  // which is not a separate region on the world countries map.
  "oceania-territories": [
    "AS", "CK", "FJ", "PF", "GU", "KI", "MH", "FM", "NR", "NC", "NU", "MP",
    "PW", "PG", "PN", "WS", "SB", "TK", "TO", "TV", "VU", "WF",
  ],
};

const US_REGIONS = {
  "us-northeast": {
    name: "The U.S.: States in the Northeast",
    blurb: "New England plus New York, New Jersey, and Pennsylvania.",
    ids: ["CT", "ME", "MA", "NH", "NJ", "NY", "PA", "RI", "VT"],
  },
  "us-midwest": {
    name: "The U.S.: States in the Midwest",
    blurb: "The 12 Midwestern states.",
    ids: ["IL", "IN", "IA", "KS", "MI", "MN", "MO", "NE", "ND", "OH", "SD", "WI"],
  },
  "us-south": {
    name: "The U.S.: States in the South",
    blurb: "The 16 Southern states.",
    ids: ["AL", "AR", "DE", "FL", "GA", "KY", "LA", "MD", "MS", "NC", "OK", "SC", "TN", "TX", "VA", "WV"],
  },
  "us-west": {
    name: "The U.S.: States in the West",
    blurb: "The 13 Western states, including Alaska and Hawaii.",
    ids: ["AK", "AZ", "CA", "CO", "HI", "ID", "MT", "NV", "NM", "OR", "UT", "WA", "WY"],
  },
  "us-new-england": {
    name: "The U.S.: States in New England",
    blurb: "Connecticut through Vermont.",
    ids: ["CT", "ME", "MA", "NH", "RI", "VT"],
  },
  "us-great-plains": {
    name: "The U.S.: Great Plains States",
    blurb: "The High Plains from Montana to Texas.",
    ids: ["CO", "KS", "MT", "NE", "NM", "ND", "OK", "SD", "TX", "WY"],
  },
  "us-south-northeast": {
    name: "The U.S.: States in the South and the Northeast",
    blurb: "Southern and Northeastern states together.",
    ids: [
      "AL", "AR", "DE", "FL", "GA", "KY", "LA", "MD", "MS", "NC", "OK", "SC", "TN", "TX", "VA", "WV",
      "CT", "ME", "MA", "NH", "NJ", "NY", "PA", "RI", "VT",
    ],
  },
  "us-midwest-west": {
    name: "The U.S.: States in the Midwest and the West",
    blurb: "Midwestern and Western states together.",
    ids: [
      "IL", "IN", "IA", "KS", "MI", "MN", "MO", "NE", "ND", "OH", "SD", "WI",
      "AK", "AZ", "CA", "CO", "HI", "ID", "MT", "NV", "NM", "OR", "UT", "WA", "WY",
    ],
  },
};

const AU_STATES = [
  { id: "nsw", name: "New South Wales", lat: -32.8, lon: 147.0, fact: "Most populous Australian state; capital Sydney." },
  { id: "vic", name: "Victoria", lat: -36.9, lon: 144.3, fact: "Southeastern state; capital Melbourne." },
  { id: "qld", name: "Queensland", lat: -22.5, lon: 144.5, fact: "Northeastern state; capital Brisbane." },
  { id: "wa", name: "Western Australia", lat: -25.0, lon: 122.0, fact: "Largest state by area; capital Perth." },
  { id: "sa", name: "South Australia", lat: -30.0, lon: 135.0, fact: "Southern state; capital Adelaide." },
  { id: "tas", name: "Tasmania", lat: -42.0, lon: 146.6, fact: "Island state; capital Hobart." },
  { id: "nt", name: "Northern Territory", lat: -19.5, lon: 133.4, fact: "Sparsely populated territory; capital Darwin." },
  { id: "act", name: "Australian Capital Territory", lat: -35.47, lon: 149.0, fact: "Territory that contains Canberra." },
];

const GROUP_BLURBS = {
  world: "Continents, countries, and physical features of the whole planet.",
  "north-america": "Countries, Canada, the U.S., the Caribbean, and North American landmarks.",
  "south-america": "Countries, cities, landmarks, and physical features.",
  europe: "Countries, cities, regions, waterways, and landmarks.",
  africa: "Countries, cities, regions, landmarks, and physical features.",
  asia: "Countries, cities, regions, and landmarks from the Middle East to Japan.",
  oceania: "Pacific countries, Australian cities, and physical features.",
};

const SECTIONS = {
  world: [
    { name: "Start here", packIds: ["continents", "continents-oceans", "world-countries", "world-capitals"] },
    { name: "Physical features", packIds: ["world-physical", "world-waterways", "world-landmarks"] },
    { name: "Practice & flags", packIds: ["world-populous", "world-populous-capitals", "world-flags", "world-outlines", "continents-cartoon"] },
  ],
  "north-america": [
    {
      name: "The continent",
      packIds: ["na-countries", "na-capitals", "na-physical", "na-waterways", "great-lakes"],
    },
    {
      name: "Northern America",
      packIds: [
        "northern-america-countries",
        "northern-america-capitals",
        "northern-america-flags",
        "northern-america-outlines",
        "northern-america-waterways",
      ],
    },
    {
      name: "Central America",
      packIds: [
        "central-america-countries",
        "central-america-capitals",
        "central-america-flags",
        "central-america-outlines",
        "central-america-waterways",
      ],
    },
    {
      name: "Caribbean",
      packIds: [
        "caribbean-countries",
        "caribbean-capitals",
        "caribbean-flags",
        "caribbean-outlines",
        "caribbean-waterways",
      ],
    },
    {
      name: "Canada",
      packIds: [
        "canada-provinces",
        "canada-cities",
        "canada-cities-difficult",
        "canada-landmarks",
        "canada-waterways",
        "canada-atlantic",
        "canada-east",
        "canada-prairies",
        "canada-west",
        "canada-territories",
        "canada-outlines",
      ],
    },
    {
      name: "United States",
      packIds: [
        "us-states",
        "us-cities",
        "us-cities-difficult",
        "us-landmarks",
        "us-waterways",
        "us-northeast",
        "us-midwest",
        "us-south",
        "us-west",
        "us-new-england",
        "us-great-plains",
        "us-south-northeast",
        "us-midwest-west",
        "us-outlines",
      ],
    },
    { name: "Flags & outlines", packIds: ["na-flags", "na-outlines"] },
    { name: "Sports", packIds: ["nba-teams", "mlb-teams", "nhl-teams", "mls-teams"] },
  ],
  "south-america": [
    {
      name: "The continent",
      packIds: ["sa-countries", "sa-capitals", "sa-cities", "sa-cities-difficult", "sa-landmarks", "sa-physical", "sa-waterways"],
    },
    {
      name: "Latin America",
      packIds: [
        "latin-america-countries",
        "latin-america-capitals",
        "latin-america-flags",
        "latin-america-outlines",
        "latin-america-waterways",
      ],
    },
    { name: "Flags & outlines", packIds: ["sa-flags", "sa-outlines"] },
  ],
  europe: [
    {
      name: "The continent",
      packIds: [
        "europe-countries",
        "europe-capitals",
        "europe-cities",
        "europe-cities-difficult",
        "europe-landmarks",
        "europe-physical",
        "europe-waterways",
      ],
    },
    {
      name: "Northern Europe",
      packIds: [
        "northern-europe-countries",
        "northern-europe-capitals",
        "northern-europe-flags",
        "northern-europe-outlines",
        "northern-europe-waterways",
      ],
    },
    {
      name: "Western Europe",
      packIds: [
        "western-europe-countries",
        "western-europe-capitals",
        "western-europe-flags",
        "western-europe-outlines",
        "western-europe-waterways",
      ],
    },
    {
      name: "Eastern Europe",
      packIds: [
        "eastern-europe-countries",
        "eastern-europe-capitals",
        "eastern-europe-flags",
        "eastern-europe-outlines",
        "eastern-europe-waterways",
      ],
    },
    {
      name: "Southern Europe",
      packIds: [
        "southern-europe-countries",
        "southern-europe-capitals",
        "southern-europe-flags",
        "southern-europe-outlines",
        "southern-europe-waterways",
      ],
    },
    {
      name: "The Nordic Countries",
      packIds: ["nordic-countries", "nordic-capitals", "nordic-flags", "nordic-outlines", "nordic-waterways"],
    },
    {
      name: "European Union",
      packIds: ["eu-countries", "eu-capitals", "eu-flags", "eu-outlines"],
    },
    {
      name: "Flags & outlines",
      packIds: ["europe-flags", "europe-outlines"],
    },
  ],
  africa: [
    {
      name: "The continent",
      packIds: [
        "africa-countries",
        "africa-capitals",
        "africa-cities",
        "africa-cities-difficult",
        "africa-landmarks",
        "africa-physical",
        "africa-waterways",
      ],
    },
    {
      name: "Northern Africa",
      packIds: [
        "northern-africa-countries",
        "northern-africa-capitals",
        "northern-africa-flags",
        "northern-africa-outlines",
        "northern-africa-waterways",
      ],
    },
    {
      name: "Western Africa",
      packIds: [
        "western-africa-countries",
        "western-africa-capitals",
        "western-africa-flags",
        "western-africa-outlines",
        "western-africa-waterways",
      ],
    },
    {
      name: "Central Africa",
      packIds: [
        "central-africa-countries",
        "central-africa-capitals",
        "central-africa-flags",
        "central-africa-outlines",
        "central-africa-waterways",
      ],
    },
    {
      name: "Eastern Africa",
      packIds: [
        "eastern-africa-countries",
        "eastern-africa-capitals",
        "eastern-africa-flags",
        "eastern-africa-outlines",
        "eastern-africa-waterways",
      ],
    },
    {
      name: "Southern Africa",
      packIds: [
        "southern-africa-countries",
        "southern-africa-capitals",
        "southern-africa-flags",
        "southern-africa-outlines",
        "southern-africa-waterways",
      ],
    },
    {
      name: "Africa North Of the Equator",
      packIds: [
        "africa-north-equator-countries",
        "africa-north-equator-capitals",
        "africa-north-equator-flags",
        "africa-north-equator-outlines",
        "africa-north-equator-waterways",
      ],
    },
    {
      name: "Africa South Of the Equator",
      packIds: [
        "africa-south-equator-countries",
        "africa-south-equator-capitals",
        "africa-south-equator-flags",
        "africa-south-equator-outlines",
        "africa-south-equator-waterways",
      ],
    },
    { name: "Flags & outlines", packIds: ["africa-flags", "africa-outlines"] },
  ],
  asia: [
    {
      name: "The continent",
      packIds: ["asia-countries", "asia-capitals", "asia-cities", "asia-cities-difficult", "asia-landmarks", "asia-physical", "asia-waterways"],
    },
    {
      name: "East Asia",
      packIds: [
        "east-asia-countries",
        "east-asia-capitals",
        "east-asia-flags",
        "east-asia-outlines",
        "east-asia-waterways",
      ],
    },
    {
      name: "Southeast Asia",
      packIds: [
        "southeast-asia-countries",
        "southeast-asia-capitals",
        "southeast-asia-flags",
        "southeast-asia-outlines",
        "southeast-asia-waterways",
      ],
    },
    {
      name: "South Asia",
      packIds: [
        "south-asia-countries",
        "south-asia-capitals",
        "south-asia-flags",
        "south-asia-outlines",
        "south-asia-waterways",
      ],
    },
    {
      name: "Central Asia",
      packIds: [
        "central-asia-countries",
        "central-asia-capitals",
        "central-asia-flags",
        "central-asia-outlines",
        "central-asia-waterways",
      ],
    },
    {
      name: "The Middle East",
      packIds: [
        "middle-east-countries",
        "middle-east-capitals",
        "middle-east-flags",
        "middle-east-outlines",
        "middle-east-waterways",
      ],
    },
    {
      name: "The Middle East and North Africa",
      packIds: ["mena-countries", "mena-capitals", "mena-flags", "mena-outlines", "mena-waterways"],
    },
    {
      name: "Flags & outlines",
      packIds: ["asia-flags", "asia-outlines"],
    },
  ],
  oceania: [
    {
      name: "The continent",
      packIds: [
        "oceania-countries",
        "oceania-capitals",
        "oceania-territories",
        "oceania-territories-capitals",
        "oceania-waterways",
      ],
    },
    {
      name: "Australia & New Zealand",
      packIds: [
        "australia-cities",
        "australia-cities-difficult",
        "anz-cities",
        "australia-states",
        "australia-surrounding",
        "australia-surrounding-flags",
        "australia-surrounding-outlines",
        "australia-physical",
        "australia-waterways",
      ],
    },
    {
      name: "Melanesia",
      packIds: ["melanesia-countries", "melanesia-capitals", "melanesia-flags", "melanesia-outlines", "melanesia-waterways"],
    },
    {
      name: "Micronesia",
      packIds: ["micronesia-countries", "micronesia-capitals", "micronesia-flags", "micronesia-outlines"],
    },
    {
      name: "Polynesia",
      packIds: ["polynesia-countries", "polynesia-capitals", "polynesia-flags", "polynesia-outlines"],
    },
    { name: "Flags & outlines", packIds: ["oceania-flags", "oceania-territories-flags", "oceania-outlines"] },
  ],
};

function writeJson(name, data) {
  writeFileSync(path.join(OUT, name), `${JSON.stringify(data, null, 2)}\n`);
}

function loadJson(name) {
  return JSON.parse(readFileSync(path.join(OUT, name), "utf8"));
}

function loadById() {
  const byId = new Map();
  for (const file of [
    "world-countries.json",
    "europe-countries.json",
    "asia-countries.json",
    "africa-countries.json",
    "na-countries.json",
    "sa-countries.json",
    "oceania-countries.json",
    "northern-africa-countries.json",
  ]) {
    try {
      for (const it of loadJson(file).items) byId.set(it.id, it);
    } catch {
      /* optional */
    }
  }
  for (const [id, item] of Object.entries(EXTRA)) {
    if (!byId.has(id)) byId.set(id, item);
  }
  return byId;
}

function pickItems(byId, ids, { rename = true, requireCapital = false } = {}) {
  const items = ids.map((id) => {
    let item = byId.get(id);
    if (!item) throw new Error(`Missing country ${id}`);
    item = { ...item };
    if (rename && NAME_OVERRIDES[id]) item.name = NAME_OVERRIDES[id];
    if (CAPITAL_OVERRIDES[id]) item.capital = CAPITAL_OVERRIDES[id];
    return item;
  });
  const filtered = requireCapital ? items.filter((it) => it.capital) : items;
  return filtered.sort((a, b) => a.name.localeCompare(b.name));
}

function ensureProjectionDeps() {
  if (!existsSync("/tmp/geo-build/node_modules/d3-geo")) {
    mkdirSync("/tmp/geo-build", { recursive: true });
    execSync("npm i --prefix /tmp/geo-build d3-geo topojson-client", { stdio: "inherit" });
  }
  if (!existsSync("/tmp/countries-50m.json")) {
    execSync(
      "curl -sL -o /tmp/countries-50m.json https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json",
      { stdio: "inherit" }
    );
  }
}

function loadProjection() {
  ensureProjectionDeps();
  const { feature } = require("/tmp/geo-build/node_modules/topojson-client");
  const { geoNaturalEarth1 } = require("/tmp/geo-build/node_modules/d3-geo");
  const topo = JSON.parse(readFileSync("/tmp/countries-50m.json", "utf8"));
  const countries = feature(topo, topo.objects.countries);
  return geoNaturalEarth1().fitExtent(
    [
      [8, 8],
      [992, 512],
    ],
    countries
  );
}

function projectItems(projection, items) {
  return items
    .map((it) => {
      const xy = projection([it.lon, it.lat]);
      if (!xy || !Number.isFinite(xy[0]) || !Number.isFinite(xy[1])) {
        throw new Error(`Could not project ${it.id} (${it.lat}, ${it.lon})`);
      }
      return {
        ...it,
        x: Math.round(xy[0] * 10) / 10,
        y: Math.round(xy[1] * 10) / 10,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

function upsert(list, pack) {
  const i = list.findIndex((p) => p.id === pack.id);
  if (i >= 0) list[i] = pack;
  else list.push(pack);
}

const byId = loadById();
const metas = [];

function addMeta(meta) {
  metas.push(meta);
  return meta;
}

function writeCountryPack(id, name, blurb, groupId, ids) {
  const items = pickItems(byId, ids);
  writeJson(`${id}.json`, { id, name, map: "world-countries", quiz: "countries", items });
  return addMeta({
    id,
    name,
    blurb,
    map: "world-countries",
    quiz: "countries",
    modes: MODES_COUNTRY,
    itemCount: items.length,
    groupId,
  });
}

function writeCapitalPack(id, name, blurb, groupId, ids) {
  const items = pickItems(byId, ids, { requireCapital: true });
  writeJson(`${id}.json`, { id, name, map: "world-countries", quiz: "capitals", items });
  return addMeta({
    id,
    name,
    blurb,
    map: "world-countries",
    quiz: "capitals",
    modes: MODES_CAPITALS,
    itemCount: items.length,
    groupId,
  });
}

function writeFlagPack(id, name, blurb, groupId, ids) {
  const items = pickItems(byId, ids);
  writeJson(`${id}.json`, { id, name, map: null, quiz: "flags", items });
  return addMeta({
    id,
    name,
    blurb,
    map: null,
    quiz: "flags",
    modes: MODES_FLAGS,
    itemCount: items.length,
    groupId,
  });
}

function writeOutlinePack(id, name, blurb, groupId, ids) {
  const items = pickItems(byId, ids);
  writeJson(`${id}.json`, { id, name, map: "world-countries", quiz: "outlines", items });
  return addMeta({
    id,
    name,
    blurb,
    map: "world-countries",
    quiz: "outlines",
    modes: MODES_OUTLINE,
    itemCount: items.length,
    groupId,
  });
}

function writeIdentityPacks(spec) {
  const ids = spec.ids || LISTS[spec.prefix];
  if (!ids) throw new Error(`Missing country list for ${spec.prefix}`);
  if (spec.capitals) {
    writeCapitalPack(
      `${spec.prefix}-capitals`,
      `${spec.title}: Capitals`,
      spec.capitalBlurb || `Capitals of ${spec.title}.`,
      spec.group,
      ids
    );
  }
  writeFlagPack(
    `${spec.prefix}-flags`,
    spec.flagName || `${spec.title}: Flags`,
    spec.flagBlurb || `Flags of ${spec.title}.`,
    spec.group,
    ids
  );
  writeOutlinePack(
    `${spec.prefix}-outlines`,
    spec.outlineName || `${spec.title}: Outlines`,
    spec.outlineBlurb || `Country silhouettes of ${spec.title}.`,
    spec.group,
    ids
  );
}

function writeCityPack(id, name, blurb, groupId, items, projection) {
  const projected = projectItems(projection, items);
  writeJson(`${id}.json`, {
    id,
    name,
    map: "world-countries",
    overlay: "markers",
    quiz: "places",
    items: projected,
  });
  return addMeta({
    id,
    name,
    blurb,
    map: "world-countries",
    overlay: "markers",
    quiz: "places",
    modes: MODES_CITIES,
    itemCount: projected.length,
    groupId,
  });
}

const usStates = loadJson("us-states.json").items;
const usById = new Map(usStates.map((it) => [it.id, it]));
const caProvinces = CA_PROVINCES.map((p) => ({
  id: p.id,
  name: p.name,
  capital: p.capital,
  abbr: p.id,
}));
const caById = new Map(caProvinces.map((it) => [it.id, it]));

writeJson("canada-provinces.json", {
  id: "canada-provinces",
  name: "Canada Provinces and Territories",
  map: "canada-provinces",
  quiz: "countries",
  items: caProvinces,
});
addMeta({
  id: "canada-provinces",
  name: "Canada: Provinces and Territories",
  blurb: "Ten provinces and three territories — Pin, Type, capitals, and abbreviations.",
  map: "canada-provinces",
  quiz: "countries",
  modes: MODES_STATES,
  itemCount: caProvinces.length,
  groupId: "north-america",
});

function writeUsRegion(id, spec) {
  const items = spec.ids.map((sid) => {
    const it = usById.get(sid);
    if (!it) throw new Error(`Missing U.S. state ${sid}`);
    return it;
  });
  writeJson(`${id}.json`, { id, name: spec.name, map: "us-states", quiz: "countries", items });
  return addMeta({
    id,
    name: spec.name,
    blurb: spec.blurb,
    map: "us-states",
    quiz: "countries",
    modes: MODES_STATES,
    itemCount: items.length,
    groupId: "north-america",
  });
}

function writeCaRegion(id, spec) {
  const items = spec.ids.map((sid) => {
    const it = caById.get(sid);
    if (!it) throw new Error(`Missing Canadian province ${sid}`);
    return it;
  });
  writeJson(`${id}.json`, { id, name: spec.name, map: "canada-provinces", quiz: "countries", items });
  return addMeta({
    id,
    name: spec.name,
    blurb: spec.blurb,
    map: "canada-provinces",
    quiz: "countries",
    modes: MODES_STATES,
    itemCount: items.length,
    groupId: "north-america",
  });
}

// —— Europe ——
writeCountryPack("northern-europe-countries", "Northern Europe: Countries", "The Nordics, Baltics, Ireland, and the UK.", "europe", LISTS["northern-europe"]);
writeCountryPack("western-europe-countries", "Western Europe: Countries", "France, Germany, the Low Countries, and the Alps.", "europe", LISTS["western-europe"]);
writeCountryPack("eastern-europe-countries", "Eastern Europe: Countries", "From Poland and Czechia to Ukraine and Russia.", "europe", LISTS["eastern-europe"]);
writeCountryPack("southern-europe-countries", "Southern Europe: Countries", "The Mediterranean, including Türkiye and the Balkans.", "europe", LISTS["southern-europe"]);
writeCountryPack("nordic-countries", "The Nordic Countries", "Denmark, Finland, Iceland, Norway, and Sweden.", "europe", LISTS.nordic);
writeCountryPack("eu-countries", "European Union: Countries", "The 27 EU member states.", "europe", LISTS.eu);
writeCapitalPack("northern-europe-capitals", "Northern Europe: Capitals", "Capitals of Northern Europe — Pin or Type.", "europe", LISTS["northern-europe"]);
writeCapitalPack("western-europe-capitals", "Western Europe: Capitals", "Capitals of Western Europe — Pin or Type.", "europe", LISTS["western-europe"]);
writeCapitalPack("eastern-europe-capitals", "Eastern Europe: Capitals", "Capitals of Eastern Europe — Pin or Type.", "europe", LISTS["eastern-europe"]);
writeCapitalPack("southern-europe-capitals", "Southern Europe: Capitals", "Capitals of Southern Europe — Pin or Type.", "europe", LISTS["southern-europe"]);

// —— Asia ——
writeCountryPack("southeast-asia-countries", "Southeast Asia: Countries", "Eleven countries from Myanmar to East Timor.", "asia", LISTS["southeast-asia"]);
writeCountryPack("south-asia-countries", "South Asia: Countries", "The Indian subcontinent.", "asia", LISTS["south-asia"]);
writeCountryPack("east-asia-countries", "East Asia: Countries", "China, Japan, Korea, Mongolia, and Taiwan.", "asia", LISTS["east-asia"]);
writeCountryPack("central-asia-countries", "Central Asia: Countries", "The five ‘stans’ of Central Asia.", "asia", LISTS["central-asia"]);
writeCountryPack("middle-east-countries", "The Middle East: Countries", "From Egypt and Türkiye to Yemen and Iran.", "asia", LISTS["middle-east"]);
writeCountryPack("mena-countries", "The Middle East and North Africa: Countries", "MENA countries across Asia and Africa.", "asia", LISTS.mena);
writeCapitalPack("southeast-asia-capitals", "Southeast Asia: Capitals", "Capitals of Southeast Asia — Pin or Type.", "asia", LISTS["southeast-asia"]);
writeCapitalPack("south-asia-capitals", "South Asia: Capitals", "Capitals of South Asia — Pin or Type.", "asia", LISTS["south-asia"]);
writeCapitalPack("east-asia-capitals", "East Asia: Capitals", "Capitals of East Asia — Pin or Type.", "asia", LISTS["east-asia"]);
writeCapitalPack("central-asia-capitals", "Central Asia: Capitals", "Capitals of Central Asia — Pin or Type.", "asia", LISTS["central-asia"]);
writeCapitalPack("middle-east-capitals", "The Middle East: Capitals", "Capitals of the Middle East — Pin or Type.", "asia", LISTS["middle-east"]);

// —— Americas extras ——
writeCountryPack("latin-america-countries", "Latin America: Countries", "Mexico, Central America, and South America.", "south-america", LISTS["latin-america"]);
writeCapitalPack("northern-america-capitals", "Northern America: Capitals", "Ottawa, Washington, D.C., and Mexico City.", "north-america", LISTS["northern-america"]);

const REGION_IDENTITY = [
  { prefix: "northern-america", title: "Northern America", group: "north-america" },
  { prefix: "central-america", title: "Central America", group: "north-america" },
  { prefix: "caribbean", title: "The Caribbean", group: "north-america" },
  { prefix: "latin-america", title: "Latin America", group: "south-america", capitals: true },
  { prefix: "northern-europe", title: "Northern Europe", group: "europe" },
  { prefix: "western-europe", title: "Western Europe", group: "europe" },
  { prefix: "eastern-europe", title: "Eastern Europe", group: "europe" },
  { prefix: "southern-europe", title: "Southern Europe", group: "europe" },
  { prefix: "nordic", title: "The Nordic Countries", group: "europe", capitals: true },
  { prefix: "eu", title: "European Union", group: "europe", capitals: true },
  { prefix: "northern-africa", title: "Northern Africa", group: "africa" },
  { prefix: "western-africa", title: "Western Africa", group: "africa" },
  { prefix: "central-africa", title: "Central Africa", group: "africa" },
  { prefix: "eastern-africa", title: "Eastern Africa", group: "africa" },
  { prefix: "southern-africa", title: "Southern Africa", group: "africa" },
  { prefix: "africa-north-equator", title: "Africa North Of the Equator", group: "africa", capitals: true },
  { prefix: "africa-south-equator", title: "Africa South Of the Equator", group: "africa", capitals: true },
  { prefix: "east-asia", title: "East Asia", group: "asia" },
  { prefix: "southeast-asia", title: "Southeast Asia", group: "asia" },
  { prefix: "south-asia", title: "South Asia", group: "asia" },
  { prefix: "central-asia", title: "Central Asia", group: "asia" },
  { prefix: "middle-east", title: "The Middle East", group: "asia" },
  { prefix: "mena", title: "The Middle East and North Africa", group: "asia", capitals: true },
  { prefix: "melanesia", title: "Melanesia", group: "oceania", capitals: true },
  { prefix: "micronesia", title: "Micronesia", group: "oceania", capitals: true },
  { prefix: "polynesia", title: "Polynesia", group: "oceania", capitals: true },
  {
    prefix: "australia-surrounding",
    title: "Australia: Surrounding",
    group: "oceania",
    flagName: "Australia: Surrounding Flags",
    outlineName: "Australia: Surrounding Outlines",
    flagBlurb: "Flags of Australia’s neighboring countries.",
    outlineBlurb: "Silhouettes of Australia’s neighboring countries.",
  },
];

for (const spec of REGION_IDENTITY) writeIdentityPacks(spec);

for (const [id, spec] of Object.entries(US_REGIONS)) writeUsRegion(id, spec);
for (const [id, spec] of Object.entries(CA_REGIONS)) writeCaRegion(id, spec);

writeJson("canada-outlines.json", {
  id: "canada-outlines",
  name: "Canada: Province Outlines",
  map: "canada-provinces",
  quiz: "outlines",
  items: caProvinces,
});
addMeta({
  id: "canada-outlines",
  name: "Canada: Province Outlines",
  blurb: "Identify provinces and territories from their shapes.",
  map: "canada-provinces",
  quiz: "outlines",
  modes: MODES_OUTLINE,
  itemCount: caProvinces.length,
  groupId: "north-america",
});

// —— Oceania ——
writeCountryPack("australia-surrounding", "Australia: Surrounding Countries", "Neighbors across the Timor, Coral, and Tasman seas.", "oceania", LISTS["australia-surrounding"]);
writeCountryPack("melanesia-countries", "Melanesia: Countries", "Fiji, Papua New Guinea, Solomon Islands, and Vanuatu.", "oceania", LISTS.melanesia);
writeCountryPack("micronesia-countries", "Micronesia: Countries", "The independent countries of Micronesia.", "oceania", LISTS.micronesia);
writeCountryPack("polynesia-countries", "Polynesia: Countries", "Samoa, Tonga, and Tuvalu.", "oceania", LISTS.polynesia);
writeCountryPack(
  "oceania-territories",
  "Oceania: Countries and Territories",
  "Independent Pacific countries plus territories. Hawaii is on the U.S. states quiz.",
  "oceania",
  LISTS["oceania-territories"]
);
writeCapitalPack(
  "oceania-territories-capitals",
  "Oceania: Capitals of Countries and Territories",
  "Capitals of those Pacific countries and territories.",
  "oceania",
  LISTS["oceania-territories"]
);
writeFlagPack(
  "oceania-territories-flags",
  "Oceania: Flags of Countries and Territories",
  "Flags of those Pacific countries and territories.",
  "oceania",
  LISTS["oceania-territories"]
);

const projection = loadProjection();
writeCityPack("europe-cities", "Europe: Cities", "Major European cities — Pin them or Type their names.", "europe", EUROPE_CITIES_EASY, projection);
writeCityPack("europe-cities-difficult", "Europe: Cities (Difficult Version)", "86 European cities — a tougher Pin and Type drill.", "europe", [...EUROPE_CITIES_EASY, ...EUROPE_CITIES_EXTRA], projection);
writeCityPack("sa-cities", "South America: Cities", "Major South American cities — Pin them or Type their names.", "south-america", SA_CITIES_EASY, projection);
writeCityPack("sa-cities-difficult", "South America: Cities (Difficult Version)", "43 South American cities — a tougher Pin and Type drill.", "south-america", [...SA_CITIES_EASY, ...SA_CITIES_EXTRA], projection);
writeCityPack("asia-cities", "Asia: Cities", "Major Asian cities — Pin them or Type their names.", "asia", ASIA_CITIES_EASY, projection);
writeCityPack("asia-cities-difficult", "Asia: Cities (Difficult Version)", "75 Asian cities — a tougher Pin and Type drill.", "asia", [...ASIA_CITIES_EASY, ...ASIA_CITIES_EXTRA], projection);
writeCityPack("australia-cities", "Australia: Cities", "Major Australian cities — Pin them or Type their names.", "oceania", AU_CITIES_EASY, projection);
writeCityPack("australia-cities-difficult", "Australia: Cities (Difficult Version)", "50 Australian cities — a tougher Pin and Type drill.", "oceania", [...AU_CITIES_EASY, ...AU_CITIES_EXTRA], projection);
writeCityPack("anz-cities", "Australia and New Zealand: Cities", "Main cities of Australia, New Zealand, and Port Moresby.", "oceania", ANZ_CITIES, projection);
writeCityPack("us-cities", "The U.S.: Cities", "Major U.S. cities — Pin them or Type their names.", "north-america", US_CITIES_EASY, projection);
writeCityPack("us-cities-difficult", "The U.S.: Cities (Difficult Version)", "U.S. cities large and small — a tougher Pin and Type drill.", "north-america", [...US_CITIES_EASY, ...US_CITIES_EXTRA], projection);
writeCityPack("canada-cities", "Canada: Cities", "Major Canadian cities — Pin them or Type their names.", "north-america", CA_CITIES_EASY, projection);
writeCityPack(
  "canada-cities-difficult",
  "Canada: Cities (Difficult Version)",
  "Canadian cities large and small — a tougher Pin and Type drill.",
  "north-america",
  [...CA_CITIES_EASY, ...CA_CITIES_EXTRA],
  projection
);
writeCityPack(
  "australia-states",
  "Australia: States and Territories",
  "The six states plus the Northern Territory and ACT.",
  "oceania",
  AU_STATES.map((s) => ({ ...s, kind: "land" })),
  projection
);

// Map-based capitals for existing continent packs
for (const id of [
  "world-capitals",
  "world-populous-capitals",
  "na-capitals",
  "central-america-capitals",
  "caribbean-capitals",
  "sa-capitals",
  "europe-capitals",
  "asia-capitals",
  "oceania-capitals",
]) {
  const data = loadJson(`${id}.json`);
  data.map = "world-countries";
  writeJson(`${id}.json`, data);
  addMeta({
    id: data.id,
    name: data.name,
    blurb: data.name.includes("Capitals")
      ? `${data.name.replace(/:.*/, "")}: Capitals — Pin them or Type their names.`
      : data.name,
    map: "world-countries",
    quiz: "capitals",
    modes: MODES_CAPITALS,
    itemCount: data.items.length,
  });
}

const packsFile = loadJson("packs.json");

for (const g of packsFile.groups) {
  if (GROUP_BLURBS[g.id]) g.blurb = GROUP_BLURBS[g.id];
  const sections = SECTIONS[g.id];
  if (sections) g.sections = sections;
}

for (const pack of metas) {
  const groupId = pack.groupId;
  const { groupId: _drop, ...clean } = pack;
  if (groupId) {
    const g = packsFile.groups.find((x) => x.id === groupId);
    if (g) upsert(g.packs, clean);
  } else {
    for (const g of packsFile.groups) {
      if (g.packs.some((p) => p.id === clean.id)) upsert(g.packs, clean);
    }
  }
  upsert(packsFile.packs, clean);
}

for (const g of packsFile.groups) {
  g.packs = (g.packs || []).filter((p) => p.id === "great-lakes" || !/-(rivers|lakes)$/.test(p.id));
  const sections = g.sections;
  if (!sections) continue;
  const byPack = new Map(g.packs.map((p) => [p.id, p]));
  const ordered = [];
  const seen = new Set();
  for (const sec of sections) {
    for (const id of sec.packIds || []) {
      const p = byPack.get(id);
      if (p && !seen.has(id)) {
        ordered.push(p);
        seen.add(id);
      }
    }
  }
  for (const p of g.packs) {
    if (!seen.has(p.id)) ordered.push(p);
  }
  g.packs = ordered;
}

packsFile.packs = (packsFile.packs || []).filter(
  (p) => p.id === "great-lakes" || !/-(rivers|lakes)$/.test(p.id)
);
writeJson("packs.json", packsFile);
console.log(`Continent map games: wrote ${metas.length} pack updates.`);
