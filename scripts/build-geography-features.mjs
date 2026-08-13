#!/usr/bin/env node
/**
 * Seterra-style physical features, waterways, and landmarks on the Natural Earth world map.
 *
 *   node scripts/build-geography-features.mjs
 *
 * Needs the same /tmp world-atlas + d3-geo setup as build-world-maps.mjs.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "data", "geography");

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
geoPath(projection);

const MODES = ["pin", "type", "name", "choice", "study"];

function f(id, name, lat, lon, fact, kind = "land") {
  return { id, name, lat, lon, fact, kind };
}

function projectItems(items) {
  return items.map((it) => {
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
  });
}

function writePack(file, pack) {
  const items = projectItems(pack.items);
  const data = {
    id: pack.id,
    name: pack.name,
    map: "world-countries",
    overlay: "markers",
    quiz: "places",
    items,
  };
  writeFileSync(path.join(OUT, file), `${JSON.stringify(data, null, 2)}\n`);
  return {
    id: pack.id,
    name: pack.name,
    blurb: pack.blurb,
    map: "world-countries",
    overlay: "markers",
    quiz: "places",
    modes: MODES,
    itemCount: items.length,
  };
}

const WORLD_PHYSICAL = [
  f("amazon", "Amazon", -3.0, -60.0, "Largest river by discharge.", "water"),
  f("andes", "Andes", -20.0, -68.0, "Longest continental mountain range on Earth.", "range"),
  f("antarctica", "Antarctica", -80.0, 20.0, "Earth’s southernmost continent.", "land"),
  f("arctic-ocean", "Arctic Ocean", 82.0, 0.0, "Smallest and shallowest ocean.", "water"),
  f("atlantic-ocean", "Atlantic Ocean", 20.0, -40.0, "Ocean between the Americas, Europe, and Africa.", "water"),
  f("danube", "Danube", 45.2, 19.5, "Europe’s second-longest river.", "water"),
  f("gobi", "Gobi Desert", 42.5, 105.0, "Cold desert across Mongolia and northern China.", "land"),
  f("greenland", "Greenland", 72.0, -42.0, "World’s largest island.", "land"),
  f("himalayas", "Himalayas", 28.0, 86.9, "Home to Earth’s highest peaks, including Everest.", "range"),
  f("indian-ocean", "Indian Ocean", -15.0, 80.0, "Ocean between Africa, Asia, and Australia.", "water"),
  f("victoria", "Lake Victoria", -1.0, 33.0, "Africa’s largest lake by area.", "water"),
  f("mediterranean", "Mediterranean Sea", 35.0, 18.0, "Sea enclosed by Europe, Africa, and Asia.", "water"),
  f("mississippi", "Mississippi River", 35.0, -90.0, "Principal river of the central United States.", "water"),
  f("niger", "Niger", 16.0, 4.0, "Major West African river.", "water"),
  f("nile", "Nile", 26.0, 32.5, "Often cited as the world’s longest river.", "water"),
  f("pacific-ocean", "Pacific Ocean", 5.0, -150.0, "Earth’s largest ocean.", "water"),
  f("persian-gulf", "Persian Gulf", 26.5, 52.0, "Arm of the Indian Ocean between Iran and Arabia.", "water"),
  f("rockies", "Rocky Mountains", 45.0, -113.0, "Major mountain range of western North America.", "range"),
  f("sahara", "Sahara Desert", 23.0, 10.0, "Largest hot desert on Earth.", "land"),
  f("siberia", "Siberia", 62.0, 90.0, "Vast region of northern Asia.", "land"),
  f("gibraltar", "Strait of Gibraltar", 35.97, -5.58, "Channel between Spain and Morocco.", "water"),
  f("ural", "Ural Mountains", 60.0, 60.0, "Traditional boundary between Europe and Asia.", "range"),
  f("yangtze", "Yangtze (Chang Jiang)", 31.0, 112.0, "Longest river in Asia.", "water"),
];

const WORLD_RIVERS = [
  f("amazon", "Amazon", -3.0, -60.0, "Largest river by discharge.", "water"),
  f("nile", "Nile", 26.0, 32.5, "Often cited as the world’s longest river.", "water"),
  f("yangtze", "Yangtze", 31.0, 112.0, "Longest river in Asia.", "water"),
  f("mississippi", "Mississippi", 35.0, -90.0, "Principal river of the central United States.", "water"),
  f("yenisei", "Yenisei", 67.0, 86.5, "Great Siberian river flowing to the Arctic.", "water"),
  f("yellow", "Yellow River", 35.0, 111.0, "China’s Huang He; “cradle of Chinese civilization.”", "water"),
  f("ob", "Ob", 62.0, 70.0, "Major west Siberian river.", "water"),
  f("parana", "Paraná", -27.0, -58.5, "Second-longest river in South America.", "water"),
  f("congo", "Congo", -2.0, 18.0, "Deepest river; second-largest by discharge.", "water"),
  f("amur", "Amur", 50.0, 137.0, "Border river of China and Russia.", "water"),
  f("lena", "Lena", 68.0, 127.0, "Great east Siberian river.", "water"),
  f("mekong", "Mekong", 15.0, 105.0, "Major river of Southeast Asia.", "water"),
  f("niger", "Niger", 16.0, 4.0, "Principal river of West Africa.", "water"),
  f("murray", "Murray", -34.2, 142.0, "Australia’s longest river.", "water"),
  f("volga", "Volga", 56.0, 47.0, "Europe’s longest river.", "water"),
  f("ganges", "Ganges", 25.3, 83.0, "Sacred river of the Indian subcontinent.", "water"),
  f("danube", "Danube", 45.2, 19.5, "Flows through Central and Eastern Europe.", "water"),
  f("indus", "Indus", 28.5, 70.0, "Principal river of Pakistan.", "water"),
  f("rhine", "Rhine", 50.0, 7.0, "Major river of Western Europe.", "water"),
  f("zambezi", "Zambezi", -16.0, 28.5, "Home of Victoria Falls.", "water"),
];

const WORLD_LANDMARKS = [
  f("angkor", "Angkor Wat", 13.4125, 103.867, "Temple complex in Cambodia.", "landmark"),
  f("chichen-itza", "Chichen Itza", 20.6843, -88.5678, "Maya city on the Yucatán Peninsula.", "landmark"),
  f("christ-redeemer", "Christ the Redeemer", -22.9519, -43.2105, "Statue overlooking Rio de Janeiro.", "landmark"),
  f("colosseum", "Colosseum", 41.8902, 12.4922, "Ancient amphitheater in Rome.", "landmark"),
  f("golden-gate", "Golden Gate Bridge", 37.8199, -122.4783, "Suspension bridge in San Francisco.", "landmark"),
  f("pyramids", "Great Pyramids", 29.9792, 31.1342, "Pyramids of Giza, Egypt.", "landmark"),
  f("great-wall", "Great Wall Of China", 40.4319, 116.5704, "Historic fortifications in northern China.", "landmark"),
  f("machu-picchu", "Machu Picchu", -13.1631, -72.545, "Inca citadel in the Peruvian Andes.", "landmark"),
  f("rushmore", "Mount Rushmore", 43.8791, -103.4591, "Presidential sculpture in South Dakota.", "landmark"),
  f("petra", "Petra", 30.3285, 35.4444, "Rock-cut city in Jordan.", "landmark"),
  f("liberty", "Statue Of Liberty", 40.6892, -74.0445, "Monument in New York Harbor.", "landmark"),
  f("stonehenge", "Stonehenge", 51.1789, -1.8262, "Prehistoric stone circle in England.", "landmark"),
  f("opera-house", "Sydney Opera House", -33.8568, 151.2153, "Harbor landmark in Sydney.", "landmark"),
  f("taj-mahal", "Taj Mahal", 27.1751, 78.0421, "Mughal mausoleum in Agra, India.", "landmark"),
];

const NA_PHYSICAL = [
  f("alaska-peninsula", "Alaska Peninsula", 56.5, -158.5, "Peninsula of southwest Alaska.", "land"),
  f("alaska-range", "Alaska Range", 63.4, -150.5, "Range that includes Denali.", "range"),
  f("appalachians", "Appalachian Mountains", 37.0, -81.0, "Ancient range of eastern North America.", "range"),
  f("atlantic-ocean", "Atlantic Ocean", 35.0, -65.0, "Ocean off the east coast.", "water"),
  f("bering-strait", "Bering Strait", 65.8, -168.5, "Separates Alaska from Russia.", "water"),
  f("colorado", "Colorado River", 36.1, -113.8, "Carved the Grand Canyon.", "water"),
  f("denali", "Denali (Mount McKinley)", 63.0695, -151.0074, "Highest peak in North America.", "range"),
  f("great-basin", "Great Basin Desert", 39.5, -117.0, "Largest U.S. desert.", "land"),
  f("great-bear", "Great Bear Lake", 66.0, -121.0, "Largest lake entirely in Canada.", "water"),
  f("great-salt", "Great Salt Lake", 41.15, -112.55, "Largest salt lake in the Western Hemisphere.", "water"),
  f("great-slave", "Great Slave Lake", 61.4, -114.0, "Deepest lake in North America.", "water"),
  f("gulf-mexico", "Gulf of Mexico", 25.0, -90.0, "Atlantic gulf south of the U.S.", "water"),
  f("hudson-bay", "Hudson Bay", 60.0, -85.0, "Large inland sea of northeastern Canada.", "water"),
  f("athabasca", "Lake Athabasca", 59.1, -110.0, "Large lake on the Alberta–Saskatchewan border.", "water"),
  f("erie", "Lake Erie", 42.2, -81.2, "Shallowest of the Great Lakes.", "water"),
  f("huron", "Lake Huron", 44.8, -82.4, "Second-largest Great Lake by area.", "water"),
  f("michigan", "Lake Michigan", 44.0, -87.0, "Only Great Lake entirely in the United States.", "water"),
  f("ontario", "Lake Ontario", 43.7, -77.9, "Easternmost Great Lake.", "water"),
  f("superior", "Lake Superior", 47.7, -87.5, "Largest freshwater lake by surface area.", "water"),
  f("winnipeg", "Lake Winnipeg", 52.5, -97.5, "Large prairie lake in Manitoba.", "water"),
  f("mackenzie", "Mackenzie River", 67.5, -130.0, "Canada’s longest river system.", "water"),
  f("mississippi", "Mississippi River", 35.0, -90.0, "Drains much of the U.S. interior.", "water"),
  f("missouri", "Missouri River", 42.0, -98.0, "Longest tributary of the Mississippi.", "water"),
  f("ohio", "Ohio River", 38.5, -85.0, "Major eastern tributary of the Mississippi.", "water"),
  f("pacific-ocean", "Pacific Ocean", 40.0, -135.0, "Ocean off the west coast.", "water"),
  f("rio-grande", "Rio Grande", 29.0, -103.0, "Part of the U.S.–Mexico border.", "water"),
  f("rockies", "Rocky Mountains", 45.0, -113.0, "From New Mexico into Canada.", "range"),
  f("st-lawrence", "Saint Lawrence", 47.5, -69.5, "Drains the Great Lakes to the Atlantic.", "water"),
  f("tennessee", "Tennessee River", 35.5, -87.0, "Major river of the American South.", "water"),
  f("yukon", "Yukon River", 65.0, -145.0, "Major river of Alaska and Yukon.", "water"),
];

const NA_LAKES = [
  f("great-bear", "Great Bear Lake", 66.0, -121.0, "Largest lake entirely in Canada.", "water"),
  f("great-salt", "Great Salt Lake", 41.15, -112.55, "Largest U.S. salt lake.", "water"),
  f("great-slave", "Great Slave Lake", 61.4, -114.0, "Deepest lake in North America.", "water"),
  f("erie", "Lake Erie", 42.2, -81.2, "Shallowest Great Lake.", "water"),
  f("huron", "Lake Huron", 44.8, -82.4, "Includes Georgian Bay.", "water"),
  f("michigan", "Lake Michigan", 44.0, -87.0, "Entirely within the United States.", "water"),
  f("nipigon", "Lake Nipigon", 49.8, -88.5, "Largest lake entirely in Ontario.", "water"),
  f("okeechobee", "Lake Okeechobee", 26.93, -80.8, "Largest lake in Florida.", "water"),
  f("ontario", "Lake Ontario", 43.7, -77.9, "Easternmost Great Lake.", "water"),
  f("superior", "Lake Superior", 47.7, -87.5, "Largest Great Lake.", "water"),
  f("winnipeg", "Lake Winnipeg", 52.5, -97.5, "Large lake in Manitoba.", "water"),
  f("woods", "Lake of the Woods", 49.1, -94.8, "Lake on the U.S.–Canada border.", "water"),
];

const US_RIVERS = [
  f("arkansas", "Arkansas River", 35.4, -95.0, "Major Mississippi tributary of the southern plains.", "water"),
  f("chattahoochee", "Chattahoochee River", 32.5, -85.0, "Forms part of the Georgia–Alabama border.", "water"),
  f("colorado", "Colorado River", 36.1, -113.8, "Carved the Grand Canyon.", "water"),
  f("columbia", "Columbia River", 45.7, -120.2, "Great river of the Pacific Northwest.", "water"),
  f("delaware", "Delaware River", 40.2, -74.8, "River of the Mid-Atlantic states.", "water"),
  f("mississippi", "Mississippi River", 35.0, -90.0, "From Minnesota to the Gulf of Mexico.", "water"),
  f("missouri", "Missouri River", 42.0, -98.0, "Longest river in the United States.", "water"),
  f("ohio", "Ohio River", 38.5, -85.0, "Forms much of the Midwest–South boundary.", "water"),
  f("potomac", "Potomac River", 38.9, -77.1, "Flows past Washington, D.C.", "water"),
  f("rio-grande", "Rio Grande", 29.0, -103.0, "Part of the U.S.–Mexico border.", "water"),
  f("sacramento", "Sacramento River", 39.1, -121.8, "Principal river of California’s Central Valley.", "water"),
  f("st-lawrence", "Saint Lawrence River", 44.8, -75.0, "Outlet of the Great Lakes.", "water"),
  f("snake", "Snake River", 44.5, -117.0, "Columbia’s largest tributary.", "water"),
  f("tennessee", "Tennessee River", 35.5, -87.0, "Major river of the American South.", "water"),
];

const US_LANDMARKS = [
  f("liberty", "Statue of Liberty", 40.6892, -74.0445, "Monument in New York Harbor.", "landmark"),
  f("golden-gate", "Golden Gate Bridge", 37.8199, -122.4783, "San Francisco’s signature bridge.", "landmark"),
  f("rushmore", "Mount Rushmore", 43.8791, -103.4591, "Presidential sculpture in the Black Hills.", "landmark"),
  f("grand-canyon", "Grand Canyon", 36.1069, -112.1129, "Canyon carved by the Colorado River.", "landmark"),
  f("white-house", "White House", 38.8977, -77.0365, "Residence of the U.S. president.", "landmark"),
  f("gateway-arch", "Gateway Arch", 38.6247, -90.1848, "Monument on the St. Louis riverfront.", "landmark"),
  f("hoover-dam", "Hoover Dam", 36.016, -114.737, "Dam on the Colorado River.", "landmark"),
  f("empire-state", "Empire State Building", 40.7484, -73.9857, "Art Deco skyscraper in New York.", "landmark"),
  f("space-needle", "Space Needle", 47.6205, -122.3493, "Seattle tower from the 1962 World’s Fair.", "landmark"),
  f("independence", "Independence Hall", 39.9489, -75.15, "Where the Declaration of Independence was adopted.", "landmark"),
  f("alamo", "The Alamo", 29.4259, -98.4861, "Mission and fortress in San Antonio.", "landmark"),
  f("niagara", "Niagara Falls", 43.0799, -79.0747, "Waterfalls on the U.S.–Canada border.", "landmark"),
];

const SA_PHYSICAL = [
  f("amazon", "Amazon", -3.0, -60.0, "Largest river by discharge.", "water"),
  f("amazon-rainforest", "Amazon Rainforest", -4.0, -62.0, "World’s largest tropical rainforest.", "land"),
  f("andes", "Andes", -20.0, -68.0, "Spine of western South America.", "range"),
  f("atacama", "Atacama Desert", -24.5, -69.3, "One of the driest places on Earth.", "land"),
  f("atlantic-ocean", "Atlantic Ocean", -15.0, -30.0, "Ocean off the east coast.", "water"),
  f("brazilian-highlands", "Brazilian Highlands", -16.0, -47.0, "Plateau covering much of Brazil.", "land"),
  f("falklands", "Falkland Islands", -51.7, -59.0, "Archipelago in the South Atlantic.", "land"),
  f("galapagos", "Galápagos Islands", -0.7, -90.3, "Volcanic islands west of Ecuador.", "land"),
  f("maracaibo", "Lake Maracaibo", 9.8, -71.55, "Large tidal bay in Venezuela.", "water"),
  f("titicaca", "Lake Titicaca", -15.8, -69.4, "Highest large navigable lake.", "water"),
  f("pacific-ocean", "Pacific Ocean", -20.0, -85.0, "Ocean off the west coast.", "water"),
  f("pampas", "Pampas", -35.0, -62.0, "Fertile plains of Argentina and Uruguay.", "land"),
  f("paraguay-river", "Paraguay River", -21.0, -58.0, "Major tributary of the Paraná.", "water"),
  f("parana", "Paraná River", -27.0, -58.5, "Second-longest river in South America.", "water"),
  f("patagonia", "Patagonia", -47.0, -70.0, "Southern region of Argentina and Chile.", "land"),
  f("rio-plata", "Río de la Plata", -34.9, -57.0, "Estuary of the Paraná and Uruguay rivers.", "water"),
  f("magellan", "Strait of Magellan", -53.5, -70.8, "Passage at the tip of South America.", "water"),
  f("tierra-del-fuego", "Tierra Del Fuego", -54.0, -68.5, "Archipelago at the continent’s southern tip.", "land"),
];

const SA_LANDMARKS = [
  f("angel-falls", "Angel Falls", 5.967, -62.535, "World’s highest uninterrupted waterfall.", "landmark"),
  f("brasilia-cathedral", "Brasilia Cathedral", -15.798, -47.875, "Cathedral of Brasília.", "landmark"),
  f("christ-redeemer", "Christ the Redeemer", -22.9519, -43.2105, "Statue overlooking Rio de Janeiro.", "landmark"),
  f("easter-island", "Easter Island", -27.1127, -109.3497, "Rapa Nui, known for moai statues.", "landmark"),
  f("penol", "El Peñón de Guatapé", 6.223, -75.178, "Rock landmark in Colombia.", "landmark"),
  f("galapagos", "Galápagos Islands", -0.7, -90.3, "UNESCO volcanic archipelago.", "landmark"),
  f("iguazu", "Iguazu Falls", -25.695, -54.437, "Waterfalls on the Argentina–Brazil border.", "landmark"),
  f("la-mano", "La Mano de Punta del Este", -34.957, -54.937, "Sculpture on a Uruguayan beach.", "landmark"),
  f("machu-picchu", "Machu Picchu", -13.1631, -72.545, "Inca citadel in Peru.", "landmark"),
  f("uyuni", "Salar de Uyuni", -20.1338, -67.4891, "World’s largest salt flat.", "landmark"),
  f("santiago-cathedral", "Santiago Metropolitan Cathedral", -33.4378, -70.6505, "Cathedral on Santiago’s Plaza de Armas.", "landmark"),
  f("tierra-del-fuego", "Tierra Del Fuego", -54.8, -68.3, "Southernmost inhabited region of the continent.", "landmark"),
];

const EUROPE_PHYSICAL = [
  f("alps", "Alps", 46.5, 10.0, "High mountains of south-central Europe.", "range"),
  f("arctic-ocean", "Arctic Ocean", 75.0, 20.0, "Ocean north of Scandinavia.", "water"),
  f("atlantic-ocean", "Atlantic Ocean", 48.0, -20.0, "Ocean west of Europe.", "water"),
  f("baltic", "Baltic Sea", 58.0, 20.0, "Sea of northern Europe.", "water"),
  f("biscay", "Bay of Biscay", 45.0, -4.0, "Atlantic bay of France and Spain.", "water"),
  f("black-sea", "Black Sea", 43.3, 34.0, "Inland sea of southeastern Europe.", "water"),
  f("caspian", "Caspian Sea", 42.0, 50.5, "World’s largest inland body of water.", "water"),
  f("caucasus", "Caucasus Mountains", 42.5, 44.0, "Range between the Black and Caspian seas.", "range"),
  f("danube", "Danube", 45.2, 19.5, "Europe’s second-longest river.", "water"),
  f("english-channel", "English Channel", 50.2, -1.0, "Between Great Britain and France.", "water"),
  f("great-britain", "Great Britain", 54.0, -2.5, "Largest island of the British Isles.", "land"),
  f("iberia", "Iberian Peninsula", 40.5, -4.0, "Peninsula of Spain and Portugal.", "land"),
  f("ireland", "Ireland", 53.4, -8.0, "Island west of Great Britain.", "land"),
  f("mediterranean", "Mediterranean Sea", 38.0, 15.0, "Sea south of Europe.", "water"),
  f("north-sea", "North Sea", 56.0, 3.0, "Sea between Britain and Scandinavia.", "water"),
  f("norwegian-sea", "Norwegian Sea", 67.0, 3.0, "Sea west of Norway.", "water"),
  f("rhine", "Rhine", 50.0, 7.0, "Major river of Western Europe.", "water"),
  f("scandinavia", "Scandinavian Peninsula", 64.0, 14.0, "Peninsula of Norway and Sweden.", "land"),
  f("seine", "Seine", 48.9, 2.3, "River of northern France.", "water"),
  f("gibraltar", "Strait of Gibraltar", 35.97, -5.58, "Gateway between the Atlantic and Mediterranean.", "water"),
  f("ural", "Ural Mountains", 60.0, 60.0, "Traditional Europe–Asia boundary.", "range"),
  f("volga", "Volga", 56.0, 47.0, "Europe’s longest river.", "water"),
];

const EUROPE_RIVERS = [
  f("danube", "Danube", 45.2, 19.5, "Passes four European capitals.", "water"),
  f("dniester", "Dniester", 47.5, 29.0, "River of Ukraine and Moldova.", "water"),
  f("dnipro", "Dnipro", 49.0, 32.5, "Major river of Ukraine.", "water"),
  f("don", "Don", 47.5, 40.5, "River of southern Russia.", "water"),
  f("ebro", "Ebro", 41.4, 0.3, "Spain’s longest river entirely in-country.", "water"),
  f("elbe", "Elbe", 52.5, 12.0, "River of Czechia and Germany.", "water"),
  f("loire", "Loire", 47.4, 0.8, "France’s longest river.", "water"),
  f("oder", "Oder", 52.5, 14.6, "Border river of Poland and Germany.", "water"),
  f("po", "Po", 45.0, 11.0, "Italy’s longest river.", "water"),
  f("rhine", "Rhine", 50.0, 7.0, "Major river of Western Europe.", "water"),
  f("rhone", "Rhône", 44.8, 4.8, "Flows from the Alps to the Mediterranean.", "water"),
  f("seine", "Seine", 48.9, 2.3, "Flows through Paris.", "water"),
  f("tagus", "Tagus", 39.5, -8.0, "Longest river of the Iberian Peninsula.", "water"),
  f("thames", "Thames", 51.5, -0.1, "River of southern England.", "water"),
  f("ural-river", "Ural", 51.5, 53.5, "River along the Europe–Asia boundary.", "water"),
  f("vardar", "Vardar", 41.6, 21.7, "Principal river of North Macedonia.", "water"),
  f("vistula", "Vistula", 52.2, 21.0, "Poland’s longest river.", "water"),
  f("volga", "Volga", 56.0, 47.0, "Europe’s longest river.", "water"),
];

const EUROPE_LANDMARKS = [
  f("acropolis", "Acropolis", 37.9715, 23.7267, "Ancient citadel of Athens.", "landmark"),
  f("belem", "Belém Tower", 38.6916, -9.216, "Fortified tower in Lisbon.", "landmark"),
  f("big-ben", "Big Ben", 51.5007, -0.1246, "Clock tower of the Palace of Westminster.", "landmark"),
  f("brandenburg", "Brandenburg Gate", 52.5163, 13.3777, "Neoclassical gate in Berlin.", "landmark"),
  f("colosseum", "Colosseum", 41.8902, 12.4922, "Ancient amphitheater in Rome.", "landmark"),
  f("eiffel", "Eiffel Tower", 48.8584, 2.2945, "Iron tower in Paris.", "landmark"),
  f("hagia-sophia", "Hagia Sophia", 41.0086, 28.9802, "Historic mosque and former church in Istanbul.", "landmark"),
  f("pisa", "Leaning Tower of Pisa", 43.723, 10.3966, "Bell tower in Pisa, Italy.", "landmark"),
  f("neuschwanstein", "Neuschwanstein", 47.5576, 10.7498, "19th-century castle in Bavaria.", "landmark"),
  f("sagrada", "Sagrada Família", 41.4036, 2.1744, "Basilica in Barcelona.", "landmark"),
  f("st-basil", "Saint Basil's Cathedral", 55.7525, 37.6231, "Cathedral on Red Square in Moscow.", "landmark"),
  f("stonehenge", "Stonehenge", 51.1789, -1.8262, "Prehistoric stone circle in England.", "landmark"),
];

const AFRICA_PHYSICAL = [
  f("atlantic-ocean", "Atlantic Ocean", 5.0, -15.0, "Ocean off Africa’s west coast.", "water"),
  f("atlas", "Atlas Mountains", 31.5, -6.0, "Range of Morocco, Algeria, and Tunisia.", "range"),
  f("cape-good-hope", "Cape of Good Hope", -34.36, 18.5, "Famous cape near the southern tip of Africa.", "land"),
  f("congo", "Congo", -2.0, 18.0, "Deepest river; second-largest by discharge.", "water"),
  f("horn", "Horn of Africa", 8.0, 48.0, "Peninsula of Somalia, Ethiopia, Eritrea, and Djibouti.", "land"),
  f("indian-ocean", "Indian Ocean", -10.0, 55.0, "Ocean off Africa’s east coast.", "water"),
  f("kalahari", "Kalahari Desert", -23.0, 22.0, "Sandy basin of southern Africa.", "land"),
  f("kilimanjaro", "Kilimanjaro", -3.067, 37.355, "Africa’s highest mountain.", "range"),
  f("malawi", "Lake Malawi", -12.0, 34.5, "Also called Lake Nyasa.", "water"),
  f("tanganyika", "Lake Tanganyika", -6.5, 29.8, "World’s longest freshwater lake.", "water"),
  f("victoria", "Lake Victoria", -1.0, 33.0, "Africa’s largest lake by area.", "water"),
  f("madagascar", "Madagascar", -19.0, 46.5, "World’s fourth-largest island.", "land"),
  f("mediterranean", "Mediterranean Sea", 34.0, 18.0, "Sea north of Africa.", "water"),
  f("kenya", "Mount Kenya", -0.152, 37.308, "Kenya’s highest mountain.", "range"),
  f("mozambique-channel", "Mozambique Channel", -18.0, 41.0, "Between Madagascar and Mozambique.", "water"),
  f("namib", "Namib Desert", -24.0, 15.0, "Coastal desert of southwest Africa.", "land"),
  f("niger", "Niger", 16.0, 4.0, "Principal river of West Africa.", "water"),
  f("nile", "Nile", 26.0, 32.5, "Often cited as the world’s longest river.", "water"),
  f("red-sea", "Red Sea", 20.0, 38.5, "Between Africa and the Arabian Peninsula.", "water"),
  f("sahara", "Sahara Desert", 23.0, 10.0, "Largest hot desert on Earth.", "land"),
  f("gibraltar", "Strait of Gibraltar", 35.97, -5.58, "Between Morocco and Spain.", "water"),
  f("suez", "Suez Canal", 30.45, 32.35, "Artificial waterway linking the Mediterranean and Red Sea.", "water"),
  f("zambezi", "Zambezi", -16.0, 28.5, "River of Victoria Falls.", "water"),
];

const AFRICA_LANDMARKS = [
  f("baobabs", "Avenue of the Baobabs", -20.251, 44.418, "Famous baobab-lined dirt road in Madagascar.", "landmark"),
  f("pyramids", "Great Pyramids", 29.9792, 31.1342, "Pyramids of Giza.", "landmark"),
  f("kilimanjaro", "Kilimanjaro", -3.067, 37.355, "Africa’s highest peak.", "landmark"),
  f("kruger", "Kruger National Park", -24.0, 31.5, "Flagship safari park of South Africa.", "landmark"),
  f("leptis", "Leptis Magna", 32.639, 14.293, "Roman ruins on the Libyan coast.", "landmark"),
  f("marrakesh", "Marrakesh", 31.6295, -7.9811, "Historic city in Morocco.", "landmark"),
  f("table-mountain", "Table Mountain", -33.9628, 18.4098, "Flat-topped mountain above Cape Town.", "landmark"),
  f("timbuktu", "Timbuktu", 16.773, -3.007, "Historic Saharan city in Mali.", "landmark"),
  f("valley-kings", "Valley of the Kings", 25.7402, 32.6014, "Royal burial ground near Luxor.", "landmark"),
  f("victoria-falls", "Victoria Falls", -17.9243, 25.8572, "Waterfall on the Zambezi River.", "landmark"),
  f("zanzibar", "Zanzibar", -6.165, 39.202, "Island off Tanzania.", "landmark"),
  f("zuma", "Zuma Rock", 9.13, 7.23, "Monolith near Abuja, Nigeria.", "landmark"),
];

const ASIA_PHYSICAL = [
  f("amur", "Amur (Heilong Jiang)", 50.0, 137.0, "Border river of China and Russia.", "water"),
  f("arabian-peninsula", "Arabian Peninsula", 24.0, 45.0, "Peninsula of Southwest Asia.", "land"),
  f("arabian-sea", "Arabian Sea", 15.0, 65.0, "Northwestern Indian Ocean.", "water"),
  f("arctic-ocean", "Arctic Ocean", 75.0, 80.0, "Ocean north of Siberia.", "water"),
  f("bay-bengal", "Bay of Bengal", 15.0, 88.0, "Northeastern Indian Ocean.", "water"),
  f("bering-sea", "Bering Sea", 58.0, 175.0, "Sea between Russia and Alaska.", "water"),
  f("bering-strait", "Bering Strait", 65.8, 169.5, "Separates Asia from North America.", "water"),
  f("borneo", "Borneo", 1.0, 114.0, "World’s third-largest island.", "land"),
  f("caspian", "Caspian Sea", 42.0, 50.5, "World’s largest inland body of water.", "water"),
  f("ganges", "Ganges", 25.3, 83.0, "Sacred river of the Indian subcontinent.", "water"),
  f("himalayas", "Himalayas", 28.0, 86.9, "Earth’s highest mountain range.", "range"),
  f("indian-ocean", "Indian Ocean", 5.0, 80.0, "Ocean south of Asia.", "water"),
  f("indus", "Indus", 28.5, 70.0, "Principal river of Pakistan.", "water"),
  f("kamchatka", "Kamchatka Peninsula", 56.0, 160.0, "Volcanic peninsula of Russia’s Far East.", "land"),
  f("baikal", "Lake Baikal", 53.5, 108.0, "World’s deepest freshwater lake.", "water"),
  f("lena", "Lena", 68.0, 127.0, "Great east Siberian river.", "water"),
  f("mekong", "Mekong", 15.0, 105.0, "Major river of Southeast Asia.", "water"),
  f("ob", "Ob", 62.0, 70.0, "Major west Siberian river.", "water"),
  f("pacific-ocean", "Pacific Ocean", 30.0, 155.0, "Ocean east of Asia.", "water"),
  f("persian-gulf", "Persian Gulf", 26.5, 52.0, "Between Iran and the Arabian Peninsula.", "water"),
  f("japan-sea", "Sea of Japan (East Sea)", 40.0, 135.0, "Sea between Japan and the mainland.", "water"),
  f("siberia", "Siberia", 62.0, 90.0, "Vast region of northern Asia.", "land"),
  f("sumatra", "Sumatra", 0.0, 102.0, "Large island of western Indonesia.", "land"),
  f("taiwan", "Taiwan", 23.7, 121.0, "Island off the coast of China.", "land"),
  f("ural", "Ural Mountains", 60.0, 60.0, "Traditional Europe–Asia boundary.", "range"),
  f("volga", "Volga", 56.0, 47.0, "Europe’s longest river.", "water"),
  f("yangtze", "Yangtze (Chang Jiang)", 31.0, 112.0, "Longest river in Asia.", "water"),
  f("yellow", "Yellow River (Huang He)", 35.0, 111.0, "China’s second-longest river.", "water"),
];

const ASIA_LANDMARKS = [
  f("angkor", "Angkor Wat", 13.4125, 103.867, "Temple complex in Cambodia.", "landmark"),
  f("big-buddha", "Big Buddha", 22.254, 114.155, "Tian Tan Buddha on Lantau Island, Hong Kong.", "landmark"),
  f("burj", "Burj Khalifa", 25.1972, 55.2744, "World’s tallest building, in Dubai.", "landmark"),
  f("forbidden-city", "Forbidden City", 39.9163, 116.3972, "Imperial palace in Beijing.", "landmark"),
  f("great-wall", "Great Wall Of China", 40.4319, 116.5704, "Historic fortifications north of Beijing.", "landmark"),
  f("marina-bay", "Marina Bay Sands", 1.2834, 103.8607, "Hotel and sky park in Singapore.", "landmark"),
  f("fuji", "Mount Fuji", 35.3606, 138.7274, "Japan’s highest and most iconic peak.", "landmark"),
  f("petra", "Petra", 30.3285, 35.4444, "Rock-cut city in Jordan.", "landmark"),
  f("petronas", "Petronas Twin Towers", 3.1579, 101.7116, "Twin skyscrapers in Kuala Lumpur.", "landmark"),
  f("shwedagon", "Shwedagon Pagoda", 16.7984, 96.1498, "Gilded stupa in Yangon.", "landmark"),
  f("taj-mahal", "Taj Mahal", 27.1751, 78.0421, "Mughal mausoleum in Agra.", "landmark"),
  f("terracotta", "Terracotta Army", 34.384, 109.278, "Funerary sculptures near Xi’an.", "landmark"),
];

const AU_PHYSICAL = [
  f("bass", "Bass Strait", -40.0, 146.0, "Between Tasmania and mainland Australia.", "water"),
  f("coral-sea", "Coral Sea", -16.0, 152.0, "Sea of the Great Barrier Reef.", "water"),
  f("darling-range", "Darling Range", -32.0, 116.3, "Escarpment inland from Perth.", "range"),
  f("darling-river", "Darling River", -31.0, 144.0, "Longest tributary of the Murray.", "water"),
  f("flinders", "Flinders River", -18.5, 140.8, "Longest river in Queensland.", "water"),
  f("gascoyne", "Gascoyne River", -24.8, 114.6, "Longest river in Western Australia.", "water"),
  f("gibson", "Gibson Desert", -23.5, 125.0, "Desert of Western Australia.", "land"),
  f("artesian", "Great Artesian Basin", -26.0, 141.0, "World’s largest underground aquifer system.", "land"),
  f("bight", "Great Australian Bight", -35.0, 130.0, "Open bay on the southern coast.", "water"),
  f("barrier-reef", "Great Barrier Reef", -18.0, 147.5, "World’s largest coral reef system.", "water"),
  f("dividing-range", "Great Dividing Range", -28.0, 152.0, "Australia’s principal mountain chain.", "range"),
  f("sandy-desert", "Great Sandy Desert", -20.0, 125.0, "Desert of northwest Australia.", "land"),
  f("victoria-desert", "Great Victoria Desert", -29.0, 129.0, "Australia’s largest desert.", "land"),
  f("carpentaria", "Gulf of Carpentaria", -14.0, 139.0, "Gulf of northern Australia.", "water"),
  f("hamersley", "Hamersley Range", -22.3, 117.8, "Range of the Pilbara.", "range"),
  f("indian-ocean", "Indian Ocean", -25.0, 108.0, "Ocean west of Australia.", "water"),
  f("kimberley", "Kimberley Plateau", -16.5, 126.0, "Rugged region of northern Western Australia.", "land"),
  f("little-sandy", "Little Sandy Desert", -24.5, 121.5, "Desert south of the Great Sandy Desert.", "land"),
  f("macdonnell", "McDonnell Ranges", -23.7, 133.4, "Ranges near Alice Springs.", "range"),
  f("murray", "Murray River", -34.2, 142.0, "Australia’s longest river.", "water"),
  f("nullarbor", "Nullarbor Plain", -31.5, 129.0, "Arid limestone plain on the south coast.", "land"),
  f("tanami", "Tanami Desert", -20.0, 130.0, "Desert of the Northern Territory.", "land"),
  f("tasman-sea", "Tasman Sea", -38.0, 160.0, "Between Australia and New Zealand.", "water"),
  f("tasmania", "Tasmania", -42.0, 146.7, "Island state south of the mainland.", "land"),
  f("torres", "Torres Strait", -10.0, 142.3, "Between Australia and New Guinea.", "water"),
  f("victoria-river", "Victoria River", -16.0, 131.0, "Major river of the Northern Territory.", "water"),
];

const metas = [
  writePack("world-physical.json", {
    id: "world-physical",
    name: "World: Physical Features",
    blurb: "Rivers, ranges, deserts, and oceans — Pin and Type.",
    items: WORLD_PHYSICAL,
  }),
  writePack("world-rivers.json", {
    id: "world-rivers",
    name: "World: Rivers",
    blurb: "The world’s great rivers.",
    items: WORLD_RIVERS,
  }),
  writePack("world-landmarks.json", {
    id: "world-landmarks",
    name: "World: Wonders and Landmarks",
    blurb: "Famous wonders and landmarks on the world map.",
    items: WORLD_LANDMARKS,
  }),
  writePack("na-physical.json", {
    id: "na-physical",
    name: "North America: Physical Features",
    blurb: "Mountains, rivers, lakes, and coasts of North America.",
    items: NA_PHYSICAL,
  }),
  writePack("na-lakes.json", {
    id: "na-lakes",
    name: "North America: Lakes",
    blurb: "The Great Lakes and other major North American lakes.",
    items: NA_LAKES,
  }),
  writePack("us-rivers.json", {
    id: "us-rivers",
    name: "The Contiguous U.S.: Rivers",
    blurb: "Major rivers of the lower 48.",
    items: US_RIVERS,
  }),
  writePack("us-landmarks.json", {
    id: "us-landmarks",
    name: "The U.S.: 12 Landmarks",
    blurb: "Iconic American landmarks.",
    items: US_LANDMARKS,
  }),
  writePack("sa-physical.json", {
    id: "sa-physical",
    name: "South America: Physical Features",
    blurb: "Andes, Amazon, Atacama, and more.",
    items: SA_PHYSICAL,
  }),
  writePack("sa-landmarks.json", {
    id: "sa-landmarks",
    name: "South America: 12 Landmarks",
    blurb: "Machu Picchu, Christ the Redeemer, and more.",
    items: SA_LANDMARKS,
  }),
  writePack("europe-physical.json", {
    id: "europe-physical",
    name: "Europe: Physical Features",
    blurb: "Seas, mountains, peninsulas, and rivers.",
    items: EUROPE_PHYSICAL,
  }),
  writePack("europe-rivers.json", {
    id: "europe-rivers",
    name: "Europe: Rivers",
    blurb: "Volga, Danube, Rhine, and the rest.",
    items: EUROPE_RIVERS,
  }),
  writePack("europe-landmarks.json", {
    id: "europe-landmarks",
    name: "Europe: 12 Landmarks",
    blurb: "Eiffel Tower, Colosseum, Stonehenge, and more.",
    items: EUROPE_LANDMARKS,
  }),
  writePack("africa-physical.json", {
    id: "africa-physical",
    name: "Africa: Physical Features",
    blurb: "Sahara, Nile, Kilimanjaro, and more.",
    items: AFRICA_PHYSICAL,
  }),
  writePack("africa-landmarks.json", {
    id: "africa-landmarks",
    name: "Africa: 12 Landmarks",
    blurb: "Pyramids, Victoria Falls, Table Mountain, and more.",
    items: AFRICA_LANDMARKS,
  }),
  writePack("asia-physical.json", {
    id: "asia-physical",
    name: "Asia: Physical Features",
    blurb: "Himalayas, great rivers, seas, and deserts.",
    items: ASIA_PHYSICAL,
  }),
  writePack("asia-landmarks.json", {
    id: "asia-landmarks",
    name: "Asia: 12 Landmarks",
    blurb: "Taj Mahal, Great Wall, Angkor Wat, and more.",
    items: ASIA_LANDMARKS,
  }),
  writePack("australia-physical.json", {
    id: "australia-physical",
    name: "Australia: Physical Features",
    blurb: "Deserts, the Murray, and the Great Barrier Reef.",
    items: AU_PHYSICAL,
  }),
];

const byGroup = {
  world: ["world-physical", "world-rivers", "world-landmarks"],
  "north-america": ["na-physical", "na-lakes", "us-rivers", "us-landmarks"],
  "south-america": ["sa-physical", "sa-landmarks"],
  europe: ["europe-physical", "europe-rivers", "europe-landmarks"],
  africa: ["africa-physical", "africa-landmarks"],
  asia: ["asia-physical", "asia-landmarks"],
  oceania: ["australia-physical"],
};

const metaById = Object.fromEntries(metas.map((m) => [m.id, m]));
const packsFile = JSON.parse(readFileSync(path.join(OUT, "packs.json"), "utf8"));

function upsert(list, pack) {
  const i = list.findIndex((p) => p.id === pack.id);
  if (i >= 0) list[i] = pack;
  else list.push(pack);
}

for (const [groupId, ids] of Object.entries(byGroup)) {
  const g = packsFile.groups.find((x) => x.id === groupId);
  if (!g) throw new Error(`Missing group ${groupId}`);
  for (const id of ids) upsert(g.packs, metaById[id]);
}
for (const pack of metas) upsert(packsFile.packs, pack);

writeFileSync(path.join(OUT, "packs.json"), `${JSON.stringify(packsFile, null, 2)}\n`);
console.log(`Wrote ${metas.length} feature packs (${metas.reduce((n, p) => n + p.itemCount, 0)} places).`);
