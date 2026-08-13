#!/usr/bin/env node
/**
 * Africa map games: regional countries and capitals, plus city quizzes.
 *
 *   node scripts/build-africa-map-games.mjs
 *
 * Run after build-geography-data.mjs (needs africa-countries.json + packs.json).
 * Cities are projected with the same Natural Earth setup as build-geography-features.mjs.
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "data", "geography");

const MODES_COUNTRY = ["pin", "type", "outline", "name", "choice", "capitals", "study"];
const MODES_CAPITALS = ["pin", "type", "name", "choice", "reverse", "study"];
const MODES_CITIES = ["pin", "type", "name", "choice", "study"];

const NAME_OVERRIDES = {
  GM: "The Gambia",
  CD: "Democratic Republic of the Congo",
  CG: "Republic of the Congo",
};

const CAPITAL_OVERRIDES = {
  GQ: "Ciudad de la Paz",
  SZ: "Mbabane",
};

const WESTERN_SAHARA = {
  id: "EH",
  name: "Western Sahara",
  capital: "",
  flag: "🇪🇭",
  region: "Africa",
  subregion: "Northern Africa",
};

/** Regional African country lists. */
const LISTS = {
  "northern-africa": ["DZ", "EG", "LY", "MA", "SD", "TN", "EH"],
  "western-africa": [
    "BJ", "BF", "GH", "GN", "GW", "CI", "LR", "ML", "MR", "NE", "NG", "SN", "SL", "GM", "TG",
  ],
  "central-africa": ["AO", "CM", "CF", "TD", "CD", "GQ", "GA", "CG"],
  "eastern-africa": [
    "BI", "DJ", "ER", "ET", "KE", "MG", "MW", "MZ", "RW", "SO", "SS", "TZ", "UG", "ZM", "ZW",
  ],
  "southern-africa": ["BW", "SZ", "LS", "NA", "ZA"],
  "north-equator": [
    "DZ", "BJ", "BF", "CM", "CF", "TD", "DJ", "EG", "ER", "ET", "GH", "GN", "GW", "CI", "LR",
    "LY", "ML", "MR", "MA", "NE", "NG", "SN", "SL", "SO", "SS", "SD", "GM", "TG", "TN", "EH",
  ],
  "south-equator": [
    "AO", "BW", "BI", "CD", "GQ", "SZ", "GA", "KE", "LS", "MG", "MW", "MZ", "NA", "CG", "RW",
    "ZA", "TZ", "UG", "ZM", "ZW",
  ],
};

const AFRICA_HUB_ORDER = [
  "africa-countries",
  "africa-capitals",
  "africa-cities",
  "africa-cities-difficult",
  "africa-landmarks",
  "africa-physical",
  "africa-north-equator-countries",
  "africa-south-equator-countries",
  "northern-africa-countries",
  "western-africa-countries",
  "central-africa-countries",
  "eastern-africa-countries",
  "southern-africa-countries",
  "northern-africa-capitals",
  "western-africa-capitals",
  "central-africa-capitals",
  "eastern-africa-capitals",
  "southern-africa-capitals",
  "africa-flags",
  "africa-outlines",
];

function writeJson(name, data) {
  writeFileSync(path.join(OUT, name), `${JSON.stringify(data, null, 2)}\n`);
}

function pickItems(byId, ids, { rename = true, recapital = true, requireCapital = false } = {}) {
  const items = ids.map((id) => {
    let item = byId.get(id);
    if (!item && id === "EH") item = WESTERN_SAHARA;
    if (!item) throw new Error(`Missing African country ${id}`);
    item = { ...item };
    if (rename && NAME_OVERRIDES[id]) item.name = NAME_OVERRIDES[id];
    if (recapital && CAPITAL_OVERRIDES[id]) item.capital = CAPITAL_OVERRIDES[id];
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

function city(id, name, lat, lon, fact) {
  return { id, name, lat, lon, fact, kind: "city" };
}

/** Africa cities (easy) plus extras for the difficult pack. */
const AFRICA_CITIES_EASY = [
  city("abidjan", "Abidjan", 5.36, -4.008, "Largest city of Ivory Coast."),
  city("accra", "Accra", 5.56, -0.205, "Capital of Ghana."),
  city("addis-ababa", "Addis Ababa", 9.03, 38.74, "Capital of Ethiopia."),
  city("alexandria", "Alexandria", 31.2, 29.92, "Mediterranean port of Egypt."),
  city("algiers", "Algiers", 36.75, 3.06, "Capital of Algeria."),
  city("cairo", "Cairo", 30.044, 31.236, "Capital of Egypt; Africa’s largest metro with Lagos."),
  city("cape-town", "Cape Town", -33.925, 18.424, "Legislative capital of South Africa."),
  city("casablanca", "Casablanca", 33.573, -7.59, "Largest city of Morocco."),
  city("dakar", "Dakar", 14.693, -17.448, "Capital of Senegal."),
  city("dar-es-salaam", "Dar es Salaam", -6.816, 39.28, "Largest city of Tanzania."),
  city("durban", "Durban", -29.858, 31.029, "Major port on South Africa’s east coast."),
  city("harare", "Harare", -17.829, 31.052, "Capital of Zimbabwe."),
  city("ibadan", "Ibadan", 7.378, 3.896, "Large city in southwestern Nigeria."),
  city("johannesburg", "Johannesburg", -26.204, 28.047, "Largest city of South Africa."),
  city("kampala", "Kampala", 0.347, 32.583, "Capital of Uganda."),
  city("kano", "Kano", 12.002, 8.592, "Largest city in northern Nigeria."),
  city("kinshasa", "Kinshasa", -4.325, 15.322, "Capital of the Democratic Republic of the Congo."),
  city("lagos", "Lagos", 6.524, 3.379, "Largest city of Nigeria."),
  city("luanda", "Luanda", -8.838, 13.234, "Capital of Angola."),
  city("mogadishu", "Mogadishu", 2.046, 45.318, "Capital of Somalia."),
  city("nairobi", "Nairobi", -1.292, 36.822, "Capital of Kenya."),
  city("niamey", "Niamey", 13.512, 2.112, "Capital of Niger."),
  city("pretoria", "Pretoria", -25.747, 28.188, "Administrative capital of South Africa."),
  city("tripoli", "Tripoli", 32.887, 13.191, "Capital of Libya."),
];

const AFRICA_CITIES_EXTRA = [
  city("abuja", "Abuja", 9.057, 7.495, "Capital of Nigeria."),
  city("antananarivo", "Antananarivo", -18.879, 47.508, "Capital of Madagascar."),
  city("asmara", "Asmara", 15.322, 38.925, "Capital of Eritrea."),
  city("aswan", "Aswan", 24.089, 32.9, "Nile city in southern Egypt."),
  city("bahir-dar", "Bahir Dar", 11.574, 37.361, "City on Lake Tana in Ethiopia."),
  city("bamako", "Bamako", 12.639, -8.003, "Capital of Mali."),
  city("bangui", "Bangui", 4.394, 18.558, "Capital of the Central African Republic."),
  city("benghazi", "Benghazi", 32.117, 20.067, "Second-largest city of Libya."),
  city("bissau", "Bissau", 11.863, -15.598, "Capital of Guinea-Bissau."),
  city("brazzaville", "Brazzaville", -4.263, 15.243, "Capital of the Republic of the Congo."),
  city("bujumbura", "Bujumbura", -3.383, 29.364, "Largest city of Burundi."),
  city("conakry", "Conakry", 9.641, -13.578, "Capital of Guinea."),
  city("djibouti", "Djibouti", 11.589, 43.145, "Capital of Djibouti."),
  city("douala", "Douala", 4.051, 9.767, "Largest city of Cameroon."),
  city("freetown", "Freetown", 8.484, -13.23, "Capital of Sierra Leone."),
  city("gaborone", "Gaborone", -24.628, 25.923, "Capital of Botswana."),
  city("gqeberha", "Gqeberha (Port Elizabeth)", -33.961, 25.602, "Coastal city in South Africa’s Eastern Cape."),
  city("juba", "Juba", 4.859, 31.571, "Capital of South Sudan."),
  city("khartoum", "Khartoum", 15.501, 32.56, "Capital of Sudan."),
  city("kigali", "Kigali", -1.944, 30.061, "Capital of Rwanda."),
  city("laayoun", "Laayoun", 27.153, -13.203, "Largest city in Western Sahara."),
  city("libreville", "Libreville", 0.416, 9.467, "Capital of Gabon."),
  city("lilongwe", "Lilongwe", -13.963, 33.774, "Capital of Malawi."),
  city("lome", "Lomé", 6.131, 1.223, "Capital of Togo."),
  city("lubumbashi", "Lubumbashi", -11.664, 27.479, "Second-largest city of the DRC."),
  city("lusaka", "Lusaka", -15.387, 28.323, "Capital of Zambia."),
  city("maputo", "Maputo", -25.969, 32.573, "Capital of Mozambique."),
  city("marrakesh", "Marrakesh", 31.63, -7.981, "Historic city in Morocco."),
  city("mombasa", "Mombasa", -4.044, 39.668, "Coastal city of Kenya."),
  city("monrovia", "Monrovia", 6.301, -10.797, "Capital of Liberia."),
  city("ndjamena", "N'Djamena", 12.113, 15.049, "Capital of Chad."),
  city("nouakchott", "Nouakchott", 18.073, -15.958, "Capital of Mauritania."),
  city("oran", "Oran", 35.697, -0.634, "Port city in western Algeria."),
  city("ouagadougou", "Ouagadougou", 12.371, -1.52, "Capital of Burkina Faso."),
  city("rabat", "Rabat", 34.02, -6.842, "Capital of Morocco."),
  city("timbuktu", "Timbuktu", 16.766, -3.002, "Historic Saharan city in Mali."),
  city("tunis", "Tunis", 36.806, 10.181, "Capital of Tunisia."),
  city("windhoek", "Windhoek", -22.559, 17.083, "Capital of Namibia."),
  city("yaounde", "Yaoundé", 3.848, 11.502, "Capital of Cameroon."),
];

function projectCities(projection, items) {
  return items
    .map((it) => {
      const xy = projection([it.lon, it.lat]);
      if (!xy || !Number.isFinite(xy[0]) || !Number.isFinite(xy[1])) {
        throw new Error(`Could not project ${it.id} (${it.lat}, ${it.lon})`);
      }
      return {
        id: it.id,
        name: it.name,
        fact: it.fact,
        kind: it.kind,
        lat: it.lat,
        lon: it.lon,
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

function orderAfricaGroup(group, packIds) {
  const byId = new Map(group.packs.map((p) => [p.id, p]));
  const ordered = [];
  for (const id of packIds) {
    const p = byId.get(id);
    if (p) {
      ordered.push(p);
      byId.delete(id);
    }
  }
  group.packs = [...ordered, ...byId.values()];
}

const africa = JSON.parse(readFileSync(path.join(OUT, "africa-countries.json"), "utf8"));
const byId = new Map(africa.items.map((it) => [it.id, it]));

const metas = [];

function writeCountryPack(id, name, blurb, ids) {
  const items = pickItems(byId, ids, { rename: true, recapital: true });
  const data = {
    id,
    name,
    map: "world-countries",
    quiz: "countries",
    items,
  };
  writeJson(`${id}.json`, data);
  const meta = {
    id,
    name,
    blurb,
    map: "world-countries",
    quiz: "countries",
    modes: MODES_COUNTRY,
    itemCount: items.length,
  };
  metas.push(meta);
  return meta;
}

function writeCapitalPack(id, name, blurb, ids) {
  const items = pickItems(byId, ids, { rename: true, recapital: true, requireCapital: true });
  const data = {
    id,
    name,
    map: "world-countries",
    quiz: "capitals",
    items,
  };
  writeJson(`${id}.json`, data);
  const meta = {
    id,
    name,
    blurb,
    map: "world-countries",
    quiz: "capitals",
    modes: MODES_CAPITALS,
    itemCount: items.length,
  };
  metas.push(meta);
  return meta;
}

function writeCityPack(id, name, blurb, items, projection) {
  const projected = projectCities(projection, items);
  const data = {
    id,
    name,
    map: "world-countries",
    overlay: "markers",
    quiz: "places",
    items: projected,
  };
  writeJson(`${id}.json`, data);
  const meta = {
    id,
    name,
    blurb,
    map: "world-countries",
    overlay: "markers",
    quiz: "places",
    modes: MODES_CITIES,
    itemCount: projected.length,
  };
  metas.push(meta);
  return meta;
}

writeCountryPack(
  "africa-north-equator-countries",
  "Africa North Of the Equator: Countries",
  "Countries of Africa north of the equator — Pin and Type.",
  LISTS["north-equator"]
);
writeCountryPack(
  "africa-south-equator-countries",
  "Africa South Of the Equator: Countries",
  "Countries of Africa south of the equator — Pin and Type.",
  LISTS["south-equator"]
);
writeCountryPack(
  "northern-africa-countries",
  "Northern Africa: Countries",
  "Algeria through Western Sahara — Pin and Type.",
  LISTS["northern-africa"]
);
writeCountryPack(
  "western-africa-countries",
  "Western Africa: Countries",
  "From Mauritania to Nigeria — Pin and Type.",
  LISTS["western-africa"]
);
writeCountryPack(
  "central-africa-countries",
  "Central Africa: Countries",
  "The Congo Basin and neighbors — Pin and Type.",
  LISTS["central-africa"]
);
writeCountryPack(
  "eastern-africa-countries",
  "Eastern Africa: Countries",
  "The Horn, the Great Lakes, and Madagascar — Pin and Type.",
  LISTS["eastern-africa"]
);
writeCountryPack(
  "southern-africa-countries",
  "Southern Africa: Countries",
  "South Africa and its neighbors — Pin and Type.",
  LISTS["southern-africa"]
);

writeCapitalPack(
  "northern-africa-capitals",
  "Northern Africa: Capitals",
  "Capitals of Northern Africa — Pin them or Type their names.",
  LISTS["northern-africa"]
);
writeCapitalPack(
  "western-africa-capitals",
  "Western Africa: Capitals",
  "Capitals of Western Africa — Pin them or Type their names.",
  LISTS["western-africa"]
);
writeCapitalPack(
  "central-africa-capitals",
  "Central Africa: Capitals",
  "Capitals of Central Africa — Pin them or Type their names.",
  LISTS["central-africa"]
);
writeCapitalPack(
  "eastern-africa-capitals",
  "Eastern Africa: Capitals",
  "Capitals of Eastern Africa — Pin them or Type their names.",
  LISTS["eastern-africa"]
);
writeCapitalPack(
  "southern-africa-capitals",
  "Southern Africa: Capitals",
  "Capitals of Southern Africa — Pin them or Type their names.",
  LISTS["southern-africa"]
);

const projection = loadProjection();
writeCityPack(
  "africa-cities",
  "Africa: Cities",
  "Major African cities — Pin them or Type their names.",
  AFRICA_CITIES_EASY,
  projection
);
writeCityPack(
  "africa-cities-difficult",
  "Africa: Cities (Difficult Version)",
  "63 African cities — a tougher Pin and Type drill.",
  [...AFRICA_CITIES_EASY, ...AFRICA_CITIES_EXTRA],
  projection
);

// Make continent-wide Africa: Capitals a map quiz (Pin and Type).
{
  const capitals = JSON.parse(readFileSync(path.join(OUT, "africa-capitals.json"), "utf8"));
  capitals.map = "world-countries";
  for (const it of capitals.items) {
    if (CAPITAL_OVERRIDES[it.id]) it.capital = CAPITAL_OVERRIDES[it.id];
  }
  writeJson("africa-capitals.json", capitals);
  metas.push({
    id: "africa-capitals",
    name: "Africa: Capitals",
    blurb: "Capitals of Africa — Pin them or Type their names.",
    map: "world-countries",
    quiz: "capitals",
    modes: MODES_CAPITALS,
    itemCount: capitals.items.length,
  });
}

const packsFile = JSON.parse(readFileSync(path.join(OUT, "packs.json"), "utf8"));
const africaGroup = packsFile.groups.find((g) => g.id === "africa");
if (!africaGroup) throw new Error("Missing Africa group in packs.json");

for (const pack of metas) {
  upsert(africaGroup.packs, pack);
  upsert(packsFile.packs, pack);
}
orderAfricaGroup(africaGroup, AFRICA_HUB_ORDER);

writeJson("packs.json", packsFile);
console.log(
  `Africa map games: wrote ${metas.length} packs (${metas.map((m) => `${m.id}:${m.itemCount}`).join(", ")}).`
);
