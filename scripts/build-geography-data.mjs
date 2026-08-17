#!/usr/bin/env node
/**
 * Build geography quiz packs from mledoze/countries.
 *
 *   curl -sL -o /tmp/countries.json \
 *     https://raw.githubusercontent.com/mledoze/countries/master/countries.json
 *   node scripts/build-geography-data.mjs
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CA_PROVINCES } from "./lib/canada-provinces.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "data", "geography");
const MAP_IDS_PATH = path.join(OUT, "maps", "world-countries.svg");

const CONTINENTS = [
  {
    id: "NA",
    name: "North America",
    fact: "Includes Canada, the United States, Mexico, and Central America / the Caribbean.",
  },
  {
    id: "SA",
    name: "South America",
    fact: "Home to the Amazon rainforest and the Andes, the world’s longest mountain range.",
  },
  {
    id: "EU",
    name: "Europe",
    fact: "A peninsula of Eurasia with dozens of countries packed into a relatively small area.",
  },
  {
    id: "AF",
    name: "Africa",
    fact: "The second-largest continent; the Sahara is the largest hot desert on Earth.",
  },
  {
    id: "AS",
    name: "Asia",
    fact: "The largest continent by land and population — from Turkey to Japan.",
  },
  {
    id: "OC",
    name: "Oceania",
    fact: "Australia, New Zealand, and the Pacific island nations of Melanesia, Micronesia, and Polynesia.",
  },
  {
    id: "AN",
    name: "Antarctica",
    fact: "The coldest, driest, and windiest continent — covered almost entirely by ice.",
  },
];

const CONTINENTS_OCEANS = [
  ...CONTINENTS,
  {
    id: "PO",
    name: "Pacific Ocean",
    fact: "The largest and deepest ocean — larger than all of Earth’s land combined.",
  },
  {
    id: "AO",
    name: "Atlantic Ocean",
    fact: "Separates the Americas from Europe and Africa; the second-largest ocean.",
  },
  {
    id: "IO",
    name: "Indian Ocean",
    fact: "Bounded by Africa, Asia, and Australia — the warmest ocean on average.",
  },
  {
    id: "AR",
    name: "Arctic Ocean",
    fact: "The smallest and shallowest ocean, centered on the North Pole.",
  },
  {
    id: "SO",
    name: "Southern Ocean",
    fact: "Encircles Antarctica; recognized as a fifth ocean by many geographers.",
  },
];

const US_STATES = [
  ["AL", "Alabama", "Montgomery"],
  ["AK", "Alaska", "Juneau"],
  ["AZ", "Arizona", "Phoenix"],
  ["AR", "Arkansas", "Little Rock"],
  ["CA", "California", "Sacramento"],
  ["CO", "Colorado", "Denver"],
  ["CT", "Connecticut", "Hartford"],
  ["DE", "Delaware", "Dover"],
  ["FL", "Florida", "Tallahassee"],
  ["GA", "Georgia", "Atlanta"],
  ["HI", "Hawaii", "Honolulu"],
  ["ID", "Idaho", "Boise"],
  ["IL", "Illinois", "Springfield"],
  ["IN", "Indiana", "Indianapolis"],
  ["IA", "Iowa", "Des Moines"],
  ["KS", "Kansas", "Topeka"],
  ["KY", "Kentucky", "Frankfort"],
  ["LA", "Louisiana", "Baton Rouge"],
  ["ME", "Maine", "Augusta"],
  ["MD", "Maryland", "Annapolis"],
  ["MA", "Massachusetts", "Boston"],
  ["MI", "Michigan", "Lansing"],
  ["MN", "Minnesota", "Saint Paul"],
  ["MS", "Mississippi", "Jackson"],
  ["MO", "Missouri", "Jefferson City"],
  ["MT", "Montana", "Helena"],
  ["NE", "Nebraska", "Lincoln"],
  ["NV", "Nevada", "Carson City"],
  ["NH", "New Hampshire", "Concord"],
  ["NJ", "New Jersey", "Trenton"],
  ["NM", "New Mexico", "Santa Fe"],
  ["NY", "New York", "Albany"],
  ["NC", "North Carolina", "Raleigh"],
  ["ND", "North Dakota", "Bismarck"],
  ["OH", "Ohio", "Columbus"],
  ["OK", "Oklahoma", "Oklahoma City"],
  ["OR", "Oregon", "Salem"],
  ["PA", "Pennsylvania", "Harrisburg"],
  ["RI", "Rhode Island", "Providence"],
  ["SC", "South Carolina", "Columbia"],
  ["SD", "South Dakota", "Pierre"],
  ["TN", "Tennessee", "Nashville"],
  ["TX", "Texas", "Austin"],
  ["UT", "Utah", "Salt Lake City"],
  ["VT", "Vermont", "Montpelier"],
  ["VA", "Virginia", "Richmond"],
  ["WA", "Washington", "Olympia"],
  ["WV", "West Virginia", "Charleston"],
  ["WI", "Wisconsin", "Madison"],
  ["WY", "Wyoming", "Cheyenne"],
];

/** Rough population ranks for “most populous” drills (UN-style short list). */
const MOST_POPULOUS = [
  "IN",
  "CN",
  "US",
  "ID",
  "PK",
  "NG",
  "BR",
  "BD",
  "RU",
  "ET",
  "MX",
  "JP",
  "EG",
  "PH",
  "CD",
  "VN",
  "IR",
  "TR",
  "DE",
  "TH",
  "GB",
  "TZ",
  "FR",
  "ZA",
  "IT",
  "KE",
  "MM",
  "CO",
  "KR",
  "SD",
  "UG",
  "ES",
  "AR",
  "DZ",
  "IQ",
  "AF",
  "PL",
  "CA",
  "MA",
  "SA",
  "UA",
  "AO",
  "UZ",
  "YE",
  "PE",
  "MY",
  "GH",
  "MZ",
  "NP",
  "MG",
];

const MAP_COUNTRY = "world-countries";
const MODES_MAP = ["pin", "type", "outline", "name", "choice", "capitals", "study"];
const MODES_TEXT = ["type", "choice", "reverse", "study"];
const MODES_FLAGS = ["type", "choice", "reverse", "study"];

function flagEmoji(cc) {
  return [...String(cc).toUpperCase()]
    .map((c) => String.fromCodePoint(0x1f1e6 - 65 + c.charCodeAt(0)))
    .join("");
}

function toItem(c) {
  return {
    id: c.cca2,
    name: c.name.common,
    capital: (c.capital && c.capital[0]) || "",
    flag: flagEmoji(c.cca2),
    region: c.region,
    subregion: c.subregion || "",
  };
}

async function loadMapIds() {
  const svg = await readFile(MAP_IDS_PATH, "utf8");
  return new Set([...svg.matchAll(/data-id="([A-Z]{2})"/g)].map((m) => m[1]));
}

async function loadCountries() {
  const candidates = [
    "/tmp/countries.json",
    path.join(OUT, "countries-source.json"),
  ];
  for (const p of candidates) {
    try {
      return JSON.parse(await readFile(p, "utf8"));
    } catch {
      /* try next */
    }
  }
  throw new Error(
    "Missing countries.json — download mledoze/countries to /tmp/countries.json"
  );
}

function filterCountries(all, mapIds, pred) {
  return all
    .filter((c) => mapIds.has(c.cca2) && pred(c))
    .map(toItem)
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function writeJson(name, data) {
  await writeFile(path.join(OUT, name), `${JSON.stringify(data, null, 2)}\n`);
}

await mkdir(OUT, { recursive: true });
const raw = await loadCountries();
// Do not commit the full source dump — packs are enough.
const mapIds = await loadMapIds();

const unMembers = filterCountries(
  raw,
  mapIds,
  (c) => c.unMember === true && c.cca2 !== "AQ"
);
const bySub = (subs) =>
  filterCountries(
    raw,
    mapIds,
    (c) =>
      (c.unMember === true || ["XK"].includes(c.cca2)) &&
      subs.includes(c.subregion)
  );
const byRegion = (region) =>
  filterCountries(
    raw,
    mapIds,
    (c) =>
      (c.unMember === true || ["XK", "TW", "PS"].includes(c.cca2)) &&
      c.region === region &&
      c.cca2 !== "AQ"
  );

// Americas splits (Northern, Central, Caribbean, South)
const northernAmerica = bySub(["North America"]);
const centralAmerica = bySub(["Central America"]);
const caribbean = bySub(["Caribbean"]);
const northCentralCaribbean = filterCountries(
  raw,
  mapIds,
  (c) =>
    c.unMember === true &&
    ["North America", "Central America", "Caribbean"].includes(c.subregion)
);
const southAmerica = bySub(["South America"]);
const europe = filterCountries(
  raw,
  mapIds,
  (c) =>
    (c.unMember === true || c.cca2 === "XK") &&
    c.region === "Europe"
);
const africa = byRegion("Africa");
const asia = byRegion("Asia");
const oceania = byRegion("Oceania");

const populous = MOST_POPULOUS.map((id) =>
  unMembers.find((c) => c.id === id)
).filter(Boolean);

const packs = [];
const groups = [
  { id: "world", name: "World", packIds: [] },
  { id: "north-america", name: "North America", packIds: [] },
  { id: "south-america", name: "South America", packIds: [] },
  { id: "europe", name: "Europe", packIds: [] },
  { id: "africa", name: "Africa", packIds: [] },
  { id: "asia", name: "Asia", packIds: [] },
  { id: "oceania", name: "Oceania", packIds: [] },
];

function addPack(groupId, meta, items) {
  const pack = {
    ...meta,
    itemCount: items.length,
  };
  packs.push(pack);
  const g = groups.find((x) => x.id === groupId);
  if (g) g.packIds.push(pack.id);
  return pack;
}

async function writeCountryPack(id, name, blurb, groupId, items, map = MAP_COUNTRY) {
  await writeJson(`${id}.json`, { id, name, map, quiz: "countries", items });
  addPack(
    groupId,
    {
      id,
      name,
      blurb,
      map,
      quiz: "countries",
      modes: MODES_MAP,
    },
    items
  );
}

async function writeCapitalPack(id, name, blurb, groupId, items) {
  await writeJson(`${id}.json`, { id, name, map: null, quiz: "capitals", items });
  addPack(
    groupId,
    {
      id,
      name,
      blurb,
      map: null,
      quiz: "capitals",
      modes: MODES_TEXT,
    },
    items
  );
}

async function writeFlagPack(id, name, blurb, groupId, items) {
  await writeJson(`${id}.json`, { id, name, map: null, quiz: "flags", items });
  addPack(
    groupId,
    {
      id,
      name,
      blurb,
      map: null,
      quiz: "flags",
      modes: MODES_FLAGS,
    },
    items
  );
}

// —— World ——
await writeJson("continents.json", {
  id: "continents",
  name: "Continents",
  map: "continents",
  quiz: "places",
  items: CONTINENTS,
});
addPack(
  "world",
  {
    id: "continents",
    name: "Continents",
    blurb: "Seven continents — Pin and Type on a real world map.",
    map: "continents",
    quiz: "places",
    modes: ["pin", "type", "name", "choice", "study"],
  },
  CONTINENTS
);

await writeJson("continents-oceans.json", {
  id: "continents-oceans",
  name: "Continents & Oceans",
  map: "continents-oceans",
  quiz: "places",
  items: CONTINENTS_OCEANS,
});
addPack(
  "world",
  {
    id: "continents-oceans",
    name: "Continents & Oceans",
    blurb: "Seven continents plus five oceans.",
    map: "continents-oceans",
    quiz: "places",
    modes: ["pin", "type", "name", "choice", "study"],
  },
  CONTINENTS_OCEANS
);

await writeCountryPack(
  "world-countries",
  "World: Countries",
  "UN member states on the world map — Pin and Type.",
  "world",
  unMembers
);
await writeCapitalPack(
  "world-capitals",
  "World: Capitals",
  "Capitals of UN member states — Type or multiple choice.",
  "world",
  unMembers
);
await writeFlagPack(
  "world-flags",
  "World: Flags",
  "Flags of UN member states — Type the country or pick it.",
  "world",
  unMembers
);
await writeCountryPack(
  "world-populous",
  "World: 50 Most Populous",
  "Pin or Type the 50 most populous countries.",
  "world",
  populous
);
await writeCapitalPack(
  "world-populous-capitals",
  "World: 50 Most Populous Capitals",
  "Capitals of the 50 most populous countries.",
  "world",
  populous
);

// —— North America ——
await writeJson("us-states.json", {
  id: "us-states",
  name: "U.S. States",
  map: "us-states",
  quiz: "countries",
  items: US_STATES.map(([id, name, capital]) => ({
    id,
    name,
    capital,
    abbr: id,
  })),
});
addPack(
  "north-america",
  {
    id: "us-states",
    name: "U.S.: 50 States",
    blurb: "All 50 states — Pin, Type, capitals, and abbreviations.",
    map: "us-states",
    quiz: "countries",
    modes: ["pin", "type", "name", "choice", "capitals", "abbr", "study"],
  },
  US_STATES
);

await writeJson("canada-provinces.json", {
  id: "canada-provinces",
  name: "Canada Provinces and Territories",
  map: "canada-provinces",
  quiz: "countries",
  items: CA_PROVINCES.map((p) => ({
    id: p.id,
    name: p.name,
    capital: p.capital,
    abbr: p.id,
  })),
});
addPack(
  "north-america",
  {
    id: "canada-provinces",
    name: "Canada: Provinces and Territories",
    blurb: "Ten provinces and three territories — Pin, Type, capitals, and abbreviations.",
    map: "canada-provinces",
    quiz: "countries",
    modes: ["pin", "type", "name", "choice", "capitals", "abbr", "study"],
  },
  CA_PROVINCES
);

await writeCountryPack(
  "na-countries",
  "North & Central America: Countries",
  "Canada, the U.S., Mexico, Central America, and the Caribbean.",
  "north-america",
  northCentralCaribbean
);
await writeCapitalPack(
  "na-capitals",
  "North & Central America: Capitals",
  "Capitals across North America, Central America, and the Caribbean.",
  "north-america",
  northCentralCaribbean
);
await writeFlagPack(
  "na-flags",
  "North & Central America: Flags",
  "Flags for North America, Central America, and the Caribbean.",
  "north-america",
  northCentralCaribbean
);
await writeCountryPack(
  "central-america-countries",
  "Central America: Countries",
  "Belize through Panama — Pin and Type.",
  "north-america",
  centralAmerica
);
await writeCapitalPack(
  "central-america-capitals",
  "Central America: Capitals",
  "Capitals of Central American countries.",
  "north-america",
  centralAmerica
);
await writeCountryPack(
  "caribbean-countries",
  "Caribbean: Countries",
  "Island nations of the Caribbean.",
  "north-america",
  caribbean
);
await writeCapitalPack(
  "caribbean-capitals",
  "Caribbean: Capitals",
  "Capitals of Caribbean countries.",
  "north-america",
  caribbean
);
await writeFlagPack(
  "caribbean-flags",
  "Caribbean: Flags",
  "Flags of Caribbean countries.",
  "north-america",
  caribbean
);
await writeCountryPack(
  "northern-america-countries",
  "Northern America: Countries",
  "Canada, the United States, and Mexico.",
  "north-america",
  northernAmerica
);

// —— South America ——
await writeCountryPack(
  "sa-countries",
  "South America: Countries",
  "Every South American country — Pin and Type.",
  "south-america",
  southAmerica
);
await writeCapitalPack(
  "sa-capitals",
  "South America: Capitals",
  "Capitals of South America.",
  "south-america",
  southAmerica
);
await writeFlagPack(
  "sa-flags",
  "South America: Flags",
  "Flags of South America.",
  "south-america",
  southAmerica
);

// —— Europe ——
await writeCountryPack(
  "europe-countries",
  "Europe: Countries",
  "European countries (incl. Kosovo) — Pin and Type.",
  "europe",
  europe
);
await writeCapitalPack(
  "europe-capitals",
  "Europe: Capitals",
  "Capitals of Europe.",
  "europe",
  europe
);
await writeFlagPack(
  "europe-flags",
  "Europe: Flags",
  "Flags of Europe.",
  "europe",
  europe
);

// —— Africa ——
await writeCountryPack(
  "africa-countries",
  "Africa: Countries",
  "African countries — Pin and Type.",
  "africa",
  africa
);
await writeCapitalPack(
  "africa-capitals",
  "Africa: Capitals",
  "Capitals of Africa.",
  "africa",
  africa
);
await writeFlagPack(
  "africa-flags",
  "Africa: Flags",
  "Flags of Africa.",
  "africa",
  africa
);

// —— Asia ——
await writeCountryPack(
  "asia-countries",
  "Asia: Countries",
  "Asian countries — Pin and Type.",
  "asia",
  asia
);
await writeCapitalPack(
  "asia-capitals",
  "Asia: Capitals",
  "Capitals of Asia.",
  "asia",
  asia
);
await writeFlagPack(
  "asia-flags",
  "Asia: Flags",
  "Flags of Asia.",
  "asia",
  asia
);

// —— Oceania ——
await writeCountryPack(
  "oceania-countries",
  "Oceania: Countries",
  "Australia, New Zealand, and Pacific island nations.",
  "oceania",
  oceania
);
await writeCapitalPack(
  "oceania-capitals",
  "Oceania: Capitals",
  "Capitals of Oceania.",
  "oceania",
  oceania
);
await writeFlagPack(
  "oceania-flags",
  "Oceania: Flags",
  "Flags of Oceania.",
  "oceania",
  oceania
);

await writeJson("packs.json", {
  groups: groups.map((g) => ({
    id: g.id,
    name: g.name,
    packs: g.packIds
      .map((id) => packs.find((p) => p.id === id))
      .filter(Boolean),
  })),
  packs,
});

console.log(
  `Wrote ${packs.length} packs · ${unMembers.length} UN countries on map · map ids ${mapIds.size}`
);
for (const g of groups) {
  console.log(`  ${g.name}: ${g.packIds.length} packs`);
}
