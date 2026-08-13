#!/usr/bin/env node
/**
 * Extra Seterra-style packs: lakes, physical features, sports teams, cartoon continents.
 * Run after build-geography-data.mjs (merges into packs.json).
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "data", "geography");
const MAPS = path.join(OUT, "maps");

await mkdir(MAPS, { recursive: true });

function writeJson(name, data) {
  return writeFile(path.join(OUT, name), `${JSON.stringify(data, null, 2)}\n`);
}

/** Equirectangular project for BlankMap-World-ish 2754×1398. */
function worldXY(lat, lon) {
  const x = ((lon + 180) / 360) * 2754;
  const y = ((90 - lat) / 180) * 1398;
  return [Math.round(x * 10) / 10, Math.round(y * 10) / 10];
}

/** North America sports map 1000×720 (lat 14–72, lon −168…−52). */
function naXY(lat, lon) {
  const x = ((lon - -168) / (-52 - -168)) * 1000;
  const y = ((72 - lat) / (72 - 14)) * 720;
  return [Math.round(x * 10) / 10, Math.round(y * 10) / 10];
}

function markersSvg(viewBox, bg, items, xyFn, opts = {}) {
  const [w, h] = viewBox;
  const r = opts.r ?? 10;
  const circles = items
    .map((it) => {
      const [x, y] = xyFn(it.lat, it.lon);
      return `<circle id="${it.id}" data-id="${it.id}" class="geo-region geo-marker" cx="${x}" cy="${y}" r="${r}"/>`;
    })
    .join("\n  ");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="100%" height="100%" role="img" aria-label="${opts.label || "Map"}">
  <rect width="${w}" height="${h}" fill="#dce9f5"/>
  ${bg}
  ${circles}
</svg>
`;
}

// —— Great Lakes (hand shapes) ——
const GREAT_LAKES = [
  {
    id: "superior",
    name: "Lake Superior",
    fact: "Largest freshwater lake by surface area in the world.",
  },
  {
    id: "michigan",
    name: "Lake Michigan",
    fact: "The only Great Lake entirely within the United States.",
  },
  {
    id: "huron",
    name: "Lake Huron",
    fact: "Includes Georgian Bay; second-largest of the Great Lakes by area.",
  },
  {
    id: "erie",
    name: "Lake Erie",
    fact: "Shallowest of the Great Lakes and the warmest in summer.",
  },
  {
    id: "ontario",
    name: "Lake Ontario",
    fact: "Smallest Great Lake by area; drains to the Atlantic via the St. Lawrence.",
  },
];

const greatLakesSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 560" width="100%" height="100%" role="img" aria-label="Great Lakes map">
  <rect width="900" height="560" fill="#e8f0e4"/>
  <path class="geo-land-bg" fill="#c5d4b8" d="M40,40 L860,40 L860,520 L40,520 Z"/>
  <path id="superior" data-id="superior" class="geo-region geo-lake" d="M180,70 C260,40 420,35 520,70 C580,95 600,140 560,175 C500,210 380,220 280,200 C200,180 150,130 180,70 Z"/>
  <path id="michigan" data-id="michigan" class="geo-region geo-lake" d="M300,210 C340,200 380,230 390,300 C400,380 385,450 350,470 C310,490 270,450 265,360 C260,280 270,220 300,210 Z"/>
  <path id="huron" data-id="huron" class="geo-region geo-lake" d="M400,180 C480,150 580,160 620,210 C650,250 640,320 590,350 C520,390 440,360 410,300 C390,250 370,200 400,180 Z"/>
  <path id="erie" data-id="erie" class="geo-region geo-lake" d="M480,400 C560,385 680,390 740,420 C760,440 740,470 680,475 C580,485 500,470 480,445 C465,425 465,410 480,400 Z"/>
  <path id="ontario" data-id="ontario" class="geo-region geo-lake" d="M700,330 C760,315 820,330 845,365 C860,390 840,420 790,425 C740,430 700,410 690,380 C680,350 680,340 700,330 Z"/>
</svg>
`;

await writeFile(path.join(MAPS, "great-lakes.svg"), greatLakesSvg);
await writeJson("great-lakes.json", {
  id: "great-lakes",
  name: "The Great Lakes",
  map: "great-lakes",
  quiz: "places",
  items: GREAT_LAKES,
});

// —— World lakes (markers on world canvas) ——
const WORLD_LAKES = [
  { id: "caspian", name: "Caspian Sea", lat: 41.8, lon: 50.5, fact: "Largest inland body of water on Earth." },
  { id: "superior", name: "Lake Superior", lat: 47.7, lon: -87.5, fact: "Largest freshwater lake by area." },
  { id: "victoria", name: "Lake Victoria", lat: -1.0, lon: 33.0, fact: "Largest lake in Africa by area." },
  { id: "huron", name: "Lake Huron", lat: 44.8, lon: -82.4, fact: "Second-largest Great Lake by area." },
  { id: "michigan", name: "Lake Michigan", lat: 44.0, lon: -87.0, fact: "Third-largest Great Lake by area." },
  { id: "tanganyika", name: "Lake Tanganyika", lat: -6.5, lon: 29.8, fact: "Longest freshwater lake; second-deepest." },
  { id: "baikal", name: "Lake Baikal", lat: 53.5, lon: 108.0, fact: "Deepest and oldest freshwater lake." },
  { id: "great-bear", name: "Great Bear Lake", lat: 66.0, lon: -121.0, fact: "Largest lake entirely in Canada." },
  { id: "malawi", name: "Lake Malawi", lat: -12.0, lon: 34.5, fact: "Also called Lake Nyasa; African Rift lake." },
  { id: "great-slave", name: "Great Slave Lake", lat: 61.5, lon: -114.0, fact: "Deepest lake in North America." },
  { id: "erie", name: "Lake Erie", lat: 42.2, lon: -81.2, fact: "Shallowest of the Great Lakes." },
  { id: "winnipeg", name: "Lake Winnipeg", lat: 52.5, lon: -97.5, fact: "Large prairie lake in Manitoba." },
  { id: "ontario", name: "Lake Ontario", lat: 43.7, lon: -77.9, fact: "Easternmost Great Lake." },
  { id: "ladoga", name: "Lake Ladoga", lat: 61.0, lon: 31.5, fact: "Largest lake in Europe." },
  { id: "balkhash", name: "Lake Balkhash", lat: 46.0, lon: 74.0, fact: "Large endorheic lake in Kazakhstan." },
  { id: "aral", name: "Aral Sea", lat: 45.0, lon: 60.0, fact: "Once a great lake; now largely dried." },
  { id: "titicaca", name: "Lake Titicaca", lat: -15.8, lon: -69.4, fact: "Highest large navigable lake; Andes." },
  { id: "nicaragua", name: "Lake Nicaragua", lat: 11.6, lon: -85.4, fact: "Largest lake in Central America." },
  { id: "chad", name: "Lake Chad", lat: 13.0, lon: 14.0, fact: "Shallow African lake; size varies greatly." },
  { id: "tonle-sap", name: "Tonlé Sap", lat: 12.9, lon: 104.1, fact: "Southeast Asia’s largest freshwater lake." },
];

const worldLandHint = `<path fill="#c8d5e3" opacity="0.55" d="M200,200 Q400,80 700,150 T1400,200 T2000,280 T2500,220 L2500,900 Q1800,1000 1200,950 T400,1000 Z"/>`;

await writeFile(
  path.join(MAPS, "world-lakes.svg"),
  markersSvg([2754, 1398], worldLandHint, WORLD_LAKES, worldXY, {
    r: 18,
    label: "World lakes",
  })
);
await writeJson("world-lakes.json", {
  id: "world-lakes",
  name: "World: Lakes",
  map: "world-lakes",
  quiz: "places",
  items: WORLD_LAKES.map(({ id, name, fact, lat, lon }) => ({
    id,
    name,
    fact,
    lat,
    lon,
  })),
});

// —— Physical features ——
const WORLD_PHYSICAL = [
  { id: "himalayas", name: "Himalayas", lat: 28.0, lon: 86.9, fact: "Home to the world’s highest peaks, including Everest." },
  { id: "andes", name: "Andes", lat: -20.0, lon: -68.0, fact: "Longest continental mountain range on Earth." },
  { id: "rockies", name: "Rocky Mountains", lat: 45.0, lon: -113.0, fact: "Major mountain range of western North America." },
  { id: "alps", name: "Alps", lat: 46.5, lon: 10.0, fact: "High mountain range across south-central Europe." },
  { id: "sahara", name: "Sahara Desert", lat: 23.0, lon: 10.0, fact: "Largest hot desert on Earth." },
  { id: "gobi", name: "Gobi Desert", lat: 42.5, lon: 105.0, fact: "Cold desert across Mongolia and northern China." },
  { id: "amazon", name: "Amazon River", lat: -3.0, lon: -60.0, fact: "Largest river by discharge; drains the Amazon basin." },
  { id: "nile", name: "Nile River", lat: 26.0, lon: 32.5, fact: "Often cited as the world’s longest river." },
  { id: "mississippi", name: "Mississippi River", lat: 35.0, lon: -90.0, fact: "Principal river of the central United States." },
  { id: "yangtze", name: "Yangtze River", lat: 31.0, lon: 112.0, fact: "Longest river in Asia." },
  { id: "congo-river", name: "Congo River", lat: -2.0, lon: 18.0, fact: "Deepest river; second-largest by discharge." },
  { id: "great-rift", name: "Great Rift Valley", lat: 0.0, lon: 36.0, fact: "Vast rift system through eastern Africa." },
  { id: "grand-canyon", name: "Grand Canyon", lat: 36.1, lon: -112.1, fact: "Iconic canyon carved by the Colorado River." },
  { id: "ural", name: "Ural Mountains", lat: 60.0, lon: 60.0, fact: "Traditional boundary between Europe and Asia." },
  { id: "atacama", name: "Atacama Desert", lat: -24.5, lon: -69.3, fact: "One of the driest places on Earth." },
  { id: "outback", name: "Australian Outback", lat: -25.0, lon: 134.0, fact: "Remote interior of Australia." },
  { id: "danube", name: "Danube River", lat: 45.0, lon: 20.0, fact: "Europe’s second-longest river." },
  { id: "mekong", name: "Mekong River", lat: 15.0, lon: 105.0, fact: "Major river of Southeast Asia." },
];

const NA_PHYSICAL = [
  { id: "rockies", name: "Rocky Mountains", lat: 45.0, lon: -113.0, fact: "Stretch from New Mexico into Canada." },
  { id: "appalachians", name: "Appalachian Mountains", lat: 37.0, lon: -81.0, fact: "Ancient range of eastern North America." },
  { id: "sierra-nevada", name: "Sierra Nevada", lat: 37.5, lon: -119.0, fact: "California’s high granite range." },
  { id: "cascade", name: "Cascade Range", lat: 46.0, lon: -121.5, fact: "Volcanic range of the Pacific Northwest." },
  { id: "mississippi", name: "Mississippi River", lat: 35.0, lon: -90.0, fact: "Drains much of the U.S. interior." },
  { id: "missouri", name: "Missouri River", lat: 42.0, lon: -98.0, fact: "Longest tributary of the Mississippi." },
  { id: "colorado", name: "Colorado River", lat: 36.0, lon: -113.5, fact: "Carved the Grand Canyon." },
  { id: "great-plains", name: "Great Plains", lat: 40.0, lon: -101.0, fact: "Broad grassland of central North America." },
  { id: "gulf-mexico", name: "Gulf of Mexico", lat: 25.0, lon: -90.0, fact: "Atlantic gulf bordered by the U.S., Mexico, and Cuba." },
  { id: "hudson-bay", name: "Hudson Bay", lat: 60.0, lon: -85.0, fact: "Large inland sea of northeastern Canada." },
  { id: "death-valley", name: "Death Valley", lat: 36.5, lon: -117.0, fact: "Hottest place in North America." },
  { id: "yukon", name: "Yukon River", lat: 65.0, lon: -145.0, fact: "Major river of Alaska and Yukon." },
];

await writeFile(
  path.join(MAPS, "world-physical.svg"),
  markersSvg([2754, 1398], worldLandHint, WORLD_PHYSICAL, worldXY, {
    r: 16,
    label: "World physical features",
  })
);
await writeJson("world-physical.json", {
  id: "world-physical",
  name: "World: Physical Features",
  map: "world-physical",
  quiz: "places",
  items: WORLD_PHYSICAL.map(({ id, name, fact, lat, lon }) => ({
    id,
    name,
    fact,
    lat,
    lon,
  })),
});

const naBg = `
  <path fill="#c8d5e3" d="M120,80 C200,40 350,30 480,60 C600,90 720,50 820,90 L880,200 C900,320 860,420 800,480 C720,560 580,600 420,580 C280,560 160,500 100,400 C60,320 70,180 120,80 Z"/>
  <path fill="#c8d5e3" d="M200,480 C280,470 360,500 400,560 C420,600 380,650 300,660 C220,670 160,620 150,560 C140,510 160,490 200,480 Z"/>
`;

await writeFile(
  path.join(MAPS, "na-physical.svg"),
  markersSvg([1000, 720], naBg, NA_PHYSICAL, naXY, {
    r: 12,
    label: "North America physical features",
  })
);
await writeJson("na-physical.json", {
  id: "na-physical",
  name: "North America: Physical Features",
  map: "na-physical",
  quiz: "places",
  items: NA_PHYSICAL.map(({ id, name, fact, lat, lon }) => ({
    id,
    name,
    fact,
    lat,
    lon,
  })),
});

// —— Sports teams ——
const NBA = [
  ["ATL", "Atlanta Hawks", "Atlanta", 33.75, -84.39],
  ["BOS", "Boston Celtics", "Boston", 42.36, -71.06],
  ["BKN", "Brooklyn Nets", "Brooklyn", 40.68, -73.97],
  ["CHA", "Charlotte Hornets", "Charlotte", 35.23, -80.84],
  ["CHI", "Chicago Bulls", "Chicago", 41.88, -87.67],
  ["CLE", "Cleveland Cavaliers", "Cleveland", 41.5, -81.69],
  ["DAL", "Dallas Mavericks", "Dallas", 32.79, -96.81],
  ["DEN", "Denver Nuggets", "Denver", 39.75, -105.01],
  ["DET", "Detroit Pistons", "Detroit", 42.34, -83.06],
  ["GSW", "Golden State Warriors", "San Francisco", 37.77, -122.39],
  ["HOU", "Houston Rockets", "Houston", 29.75, -95.36],
  ["IND", "Indiana Pacers", "Indianapolis", 39.76, -86.16],
  ["LAC", "LA Clippers", "Los Angeles", 34.04, -118.27],
  ["LAL", "Los Angeles Lakers", "Los Angeles", 34.04, -118.27],
  ["MEM", "Memphis Grizzlies", "Memphis", 35.14, -90.05],
  ["MIA", "Miami Heat", "Miami", 25.78, -80.19],
  ["MIL", "Milwaukee Bucks", "Milwaukee", 43.04, -87.92],
  ["MIN", "Minnesota Timberwolves", "Minneapolis", 44.98, -93.28],
  ["NOP", "New Orleans Pelicans", "New Orleans", 29.95, -90.08],
  ["NYK", "New York Knicks", "New York", 40.75, -73.99],
  ["OKC", "Oklahoma City Thunder", "Oklahoma City", 35.46, -97.51],
  ["ORL", "Orlando Magic", "Orlando", 28.54, -81.38],
  ["PHI", "Philadelphia 76ers", "Philadelphia", 39.9, -75.17],
  ["PHX", "Phoenix Suns", "Phoenix", 33.45, -112.07],
  ["POR", "Portland Trail Blazers", "Portland", 45.53, -122.67],
  ["SAC", "Sacramento Kings", "Sacramento", 38.58, -121.5],
  ["SAS", "San Antonio Spurs", "San Antonio", 29.43, -98.44],
  ["TOR", "Toronto Raptors", "Toronto", 43.64, -79.38],
  ["UTA", "Utah Jazz", "Salt Lake City", 40.77, -111.9],
  ["WAS", "Washington Wizards", "Washington", 38.9, -77.02],
];

const MLB = [
  ["ARI", "Arizona Diamondbacks", "Phoenix", 33.45, -112.07],
  ["ATL", "Atlanta Braves", "Atlanta", 33.89, -84.47],
  ["BAL", "Baltimore Orioles", "Baltimore", 39.28, -76.62],
  ["BOS", "Boston Red Sox", "Boston", 42.35, -71.07],
  ["CHC", "Chicago Cubs", "Chicago", 41.95, -87.66],
  ["CWS", "Chicago White Sox", "Chicago", 41.83, -87.63],
  ["CIN", "Cincinnati Reds", "Cincinnati", 39.1, -84.51],
  ["CLE", "Cleveland Guardians", "Cleveland", 41.5, -81.69],
  ["COL", "Colorado Rockies", "Denver", 39.76, -104.99],
  ["DET", "Detroit Tigers", "Detroit", 42.34, -83.05],
  ["HOU", "Houston Astros", "Houston", 29.76, -95.36],
  ["KC", "Kansas City Royals", "Kansas City", 39.05, -94.48],
  ["LAA", "Los Angeles Angels", "Anaheim", 33.8, -117.88],
  ["LAD", "Los Angeles Dodgers", "Los Angeles", 34.07, -118.24],
  ["MIA", "Miami Marlins", "Miami", 25.78, -80.22],
  ["MIL", "Milwaukee Brewers", "Milwaukee", 43.03, -87.97],
  ["MIN", "Minnesota Twins", "Minneapolis", 44.98, -93.28],
  ["NYM", "New York Mets", "New York", 40.76, -73.85],
  ["NYY", "New York Yankees", "New York", 40.83, -73.93],
  ["OAK", "Athletics", "Sacramento", 38.58, -121.5],
  ["PHI", "Philadelphia Phillies", "Philadelphia", 39.91, -75.17],
  ["PIT", "Pittsburgh Pirates", "Pittsburgh", 40.45, -80.01],
  ["SD", "San Diego Padres", "San Diego", 32.71, -117.16],
  ["SF", "San Francisco Giants", "San Francisco", 37.78, -122.39],
  ["SEA", "Seattle Mariners", "Seattle", 47.59, -122.33],
  ["STL", "St. Louis Cardinals", "St. Louis", 38.62, -90.19],
  ["TB", "Tampa Bay Rays", "St. Petersburg", 27.77, -82.63],
  ["TEX", "Texas Rangers", "Arlington", 32.75, -97.08],
  ["TOR", "Toronto Blue Jays", "Toronto", 43.64, -79.39],
  ["WSH", "Washington Nationals", "Washington", 38.87, -77.01],
];

const NHL = [
  ["ANA", "Anaheim Ducks", "Anaheim", 33.81, -117.88],
  ["BOS", "Boston Bruins", "Boston", 42.37, -71.06],
  ["BUF", "Buffalo Sabres", "Buffalo", 42.88, -78.88],
  ["CGY", "Calgary Flames", "Calgary", 51.04, -114.07],
  ["CAR", "Carolina Hurricanes", "Raleigh", 35.8, -78.72],
  ["CHI", "Chicago Blackhawks", "Chicago", 41.88, -87.67],
  ["COL", "Colorado Avalanche", "Denver", 39.75, -105.01],
  ["CBJ", "Columbus Blue Jackets", "Columbus", 39.97, -83.01],
  ["DAL", "Dallas Stars", "Dallas", 32.79, -96.81],
  ["DET", "Detroit Red Wings", "Detroit", 42.33, -83.05],
  ["EDM", "Edmonton Oilers", "Edmonton", 53.55, -113.5],
  ["FLA", "Florida Panthers", "Sunrise", 26.16, -80.33],
  ["LAK", "Los Angeles Kings", "Los Angeles", 34.04, -118.26],
  ["MIN", "Minnesota Wild", "Saint Paul", 44.94, -93.1],
  ["MTL", "Montreal Canadiens", "Montreal", 45.5, -73.57],
  ["NSH", "Nashville Predators", "Nashville", 36.16, -86.78],
  ["NJD", "New Jersey Devils", "Newark", 40.73, -74.17],
  ["NYI", "New York Islanders", "Elmont", 40.72, -73.71],
  ["NYR", "New York Rangers", "New York", 40.75, -73.99],
  ["OTT", "Ottawa Senators", "Ottawa", 45.3, -75.93],
  ["PHI", "Philadelphia Flyers", "Philadelphia", 39.9, -75.17],
  ["PIT", "Pittsburgh Penguins", "Pittsburgh", 40.44, -80.0],
  ["SJS", "San Jose Sharks", "San Jose", 37.33, -121.9],
  ["SEA", "Seattle Kraken", "Seattle", 47.62, -122.35],
  ["STL", "St. Louis Blues", "St. Louis", 38.63, -90.2],
  ["TBL", "Tampa Bay Lightning", "Tampa", 27.94, -82.45],
  ["TOR", "Toronto Maple Leafs", "Toronto", 43.64, -79.38],
  ["UTA", "Utah Mammoth", "Salt Lake City", 40.77, -111.9],
  ["VAN", "Vancouver Canucks", "Vancouver", 49.28, -123.11],
  ["VGK", "Vegas Golden Knights", "Las Vegas", 36.1, -115.18],
  ["WSH", "Washington Capitals", "Washington", 38.9, -77.02],
  ["WPG", "Winnipeg Jets", "Winnipeg", 49.89, -97.14],
];

const MLS = [
  ["ATL", "Atlanta United FC", "Atlanta", 33.76, -84.4],
  ["ATX", "Austin FC", "Austin", 30.39, -97.72],
  ["CLT", "Charlotte FC", "Charlotte", 35.23, -80.84],
  ["CHI", "Chicago Fire FC", "Chicago", 41.86, -87.62],
  ["CIN", "FC Cincinnati", "Cincinnati", 39.12, -84.52],
  ["COL", "Colorado Rapids", "Commerce City", 39.81, -104.89],
  ["CLB", "Columbus Crew", "Columbus", 40.01, -82.99],
  ["DAL", "FC Dallas", "Frisco", 33.15, -96.82],
  ["DC", "D.C. United", "Washington", 38.87, -77.01],
  ["HOU", "Houston Dynamo FC", "Houston", 29.75, -95.35],
  ["SKC", "Sporting Kansas City", "Kansas City", 39.12, -94.82],
  ["LA", "LA Galaxy", "Carson", 33.86, -118.26],
  ["LAFC", "Los Angeles FC", "Los Angeles", 34.01, -118.28],
  ["MIA", "Inter Miami CF", "Fort Lauderdale", 26.12, -80.13],
  ["MIN", "Minnesota United FC", "Saint Paul", 44.95, -93.17],
  ["MTL", "CF Montréal", "Montreal", 45.56, -73.55],
  ["NSH", "Nashville SC", "Nashville", 36.13, -86.81],
  ["NE", "New England Revolution", "Foxborough", 42.09, -71.26],
  ["NYC", "New York City FC", "New York", 40.83, -73.93],
  ["RBNY", "New York Red Bulls", "Harrison", 40.74, -74.15],
  ["ORL", "Orlando City SC", "Orlando", 28.54, -81.39],
  ["PHI", "Philadelphia Union", "Chester", 39.83, -75.38],
  ["POR", "Portland Timbers", "Portland", 45.52, -122.69],
  ["RSL", "Real Salt Lake", "Sandy", 40.58, -111.89],
  ["SJ", "San Jose Earthquakes", "San Jose", 37.35, -121.92],
  ["SEA", "Seattle Sounders FC", "Seattle", 47.6, -122.33],
  ["STL", "St. Louis City SC", "St. Louis", 38.63, -90.19],
  ["SD", "San Diego FC", "San Diego", 32.72, -117.16],
  ["TOR", "Toronto FC", "Toronto", 43.63, -79.42],
  ["VAN", "Vancouver Whitecaps FC", "Vancouver", 49.28, -123.11],
];

function teamItems(rows) {
  return rows.map(([id, name, city, lat, lon]) => ({
    id,
    name,
    city,
    lat,
    lon,
    fact: `Based in ${city}.`,
  }));
}

async function writeSportsPack(id, name, blurb, rows) {
  const items = teamItems(rows);
  // Offset overlapping same-city markers slightly
  const seen = new Map();
  for (const it of items) {
    const key = `${it.lat},${it.lon}`;
    const n = seen.get(key) || 0;
    seen.set(key, n + 1);
    if (n > 0) {
      it.lon += 0.35 * n;
      it.lat += 0.15 * n;
    }
  }
  await writeFile(
    path.join(MAPS, `${id}.svg`),
    markersSvg([1000, 720], naBg, items, naXY, {
      r: 9,
      label: name,
    })
  );
  await writeJson(`${id}.json`, {
    id,
    name,
    map: id,
    quiz: "teams",
    items,
  });
  return { id, name, blurb, map: id, quiz: "teams", modes: ["pin", "type", "name", "choice", "study"], itemCount: items.length };
}

const sportsPacks = [
  await writeSportsPack("nba-teams", "NBA Teams", "Pin or Type each NBA franchise’s home city.", NBA),
  await writeSportsPack("mlb-teams", "MLB Teams", "Major League Baseball clubs on the map.", MLB),
  await writeSportsPack("nhl-teams", "NHL Teams", "National Hockey League teams across the U.S. and Canada.", NHL),
  await writeSportsPack("mls-teams", "MLS Teams", "Major League Soccer clubs.", MLS),
];

// —— Cartoon continents ——
const CARTOON = [
  { id: "NA", name: "North America", fact: "Cartoon outline of North America." },
  { id: "SA", name: "South America", fact: "Cartoon outline of South America." },
  { id: "EU", name: "Europe", fact: "Cartoon outline of Europe." },
  { id: "AF", name: "Africa", fact: "Cartoon outline of Africa." },
  { id: "AS", name: "Asia", fact: "Cartoon outline of Asia." },
  { id: "OC", name: "Oceania", fact: "Cartoon outline of Oceania / Australia." },
  { id: "AN", name: "Antarctica", fact: "Cartoon outline of Antarctica." },
];

const cartoonSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 520" width="100%" height="100%" role="img" aria-label="Cartoon continents">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#b9e0ff"/>
      <stop offset="100%" stop-color="#7ec8f0"/>
    </linearGradient>
  </defs>
  <rect width="1000" height="520" fill="url(#sky)"/>
  <path id="NA" data-id="NA" class="geo-region" fill="#7bc96f" stroke="#fff" stroke-width="3" d="M90,90 C140,40 240,45 300,90 C350,130 340,200 300,240 C250,280 180,260 140,210 C100,160 70,120 90,90 Z"/>
  <path id="SA" data-id="SA" class="geo-region" fill="#8fd18a" stroke="#fff" stroke-width="3" d="M250,270 C300,250 340,290 345,350 C350,420 310,480 270,470 C230,460 220,390 230,340 C235,300 230,280 250,270 Z"/>
  <path id="EU" data-id="EU" class="geo-region" fill="#f0c86a" stroke="#fff" stroke-width="3" d="M470,80 C520,55 570,70 585,110 C595,145 570,175 535,170 C500,165 460,130 470,80 Z"/>
  <path id="AF" data-id="AF" class="geo-region" fill="#e8a45a" stroke="#fff" stroke-width="3" d="M480,185 C540,165 600,200 610,270 C620,350 580,420 520,430 C460,440 440,360 450,290 C455,230 450,195 480,185 Z"/>
  <path id="AS" data-id="AS" class="geo-region" fill="#e07a6a" stroke="#fff" stroke-width="3" d="M590,60 C700,30 820,55 880,120 C920,170 900,230 820,245 C740,260 660,220 620,170 C595,135 570,90 590,60 Z"/>
  <path id="OC" data-id="OC" class="geo-region" fill="#6ec4b8" stroke="#fff" stroke-width="3" d="M780,300 C840,275 900,310 905,360 C910,405 860,430 810,415 C770,400 755,340 780,300 Z"/>
  <path id="AN" data-id="AN" class="geo-region" fill="#dfe9f5" stroke="#fff" stroke-width="3" d="M150,470 C300,450 550,455 820,470 L900,505 L80,505 Z"/>
</svg>
`;

await writeFile(path.join(MAPS, "continents-cartoon.svg"), cartoonSvg);
await writeJson("continents-cartoon.json", {
  id: "continents-cartoon",
  name: "Continents (Cartoon)",
  map: "continents-cartoon",
  quiz: "places",
  items: CARTOON,
});

// —— Outline-only packs (reuse country item lists) ——
async function outlinePack(srcId, id, name, blurb) {
  const src = JSON.parse(await readFile(path.join(OUT, `${srcId}.json`), "utf8"));
  const items = src.items;
  await writeJson(`${id}.json`, {
    id,
    name,
    map: "world-countries",
    quiz: "outlines",
    items,
  });
  return {
    id,
    name,
    blurb,
    map: "world-countries",
    quiz: "outlines",
    modes: ["outline", "type", "choice", "study"],
    itemCount: items.length,
  };
}

const outlinePacks = [
  await outlinePack("world-countries", "world-outlines", "World: Country Outlines", "Identify countries from their silhouettes."),
  await outlinePack("na-countries", "na-outlines", "North & Central America: Outlines", "Silhouette drills for North & Central America."),
  await outlinePack("sa-countries", "sa-outlines", "South America: Outlines", "Silhouette drills for South America."),
  await outlinePack("europe-countries", "europe-outlines", "Europe: Outlines", "Silhouette drills for Europe."),
  await outlinePack("africa-countries", "africa-outlines", "Africa: Outlines", "Silhouette drills for Africa."),
  await outlinePack("asia-countries", "asia-outlines", "Asia: Outlines", "Silhouette drills for Asia."),
  await outlinePack("oceania-countries", "oceania-outlines", "Oceania: Outlines", "Silhouette drills for Oceania."),
  await outlinePack("us-states", "us-outlines", "U.S.: State Outlines", "Identify U.S. states from their shapes.", "us-states"),
];

// Fix us outlines map
{
  const us = JSON.parse(await readFile(path.join(OUT, "us-outlines.json"), "utf8"));
  us.map = "us-states";
  await writeJson("us-outlines.json", us);
  outlinePacks[outlinePacks.length - 1].map = "us-states";
}

// —— Merge into packs.json ——
const packsFile = JSON.parse(await readFile(path.join(OUT, "packs.json"), "utf8"));

const extraByGroup = {
  world: [
    {
      id: "continents-cartoon",
      name: "Continents (Cartoon)",
      blurb: "Same seven continents on a playful cartoon map.",
      map: "continents-cartoon",
      quiz: "places",
      modes: ["pin", "type", "name", "choice", "study"],
      itemCount: CARTOON.length,
    },
    {
      id: "world-lakes",
      name: "World: Lakes",
      blurb: "Major lakes — Pin them or Type their names.",
      map: "world-lakes",
      quiz: "places",
      modes: ["pin", "type", "name", "choice", "study"],
      itemCount: WORLD_LAKES.length,
    },
    {
      id: "world-physical",
      name: "World: Physical Features",
      blurb: "Mountains, deserts, and rivers on a world map.",
      map: "world-physical",
      quiz: "places",
      modes: ["pin", "type", "name", "choice", "study"],
      itemCount: WORLD_PHYSICAL.length,
    },
    outlinePacks[0],
  ],
  "north-america": [
    {
      id: "great-lakes",
      name: "The Great Lakes",
      blurb: "Superior, Michigan, Huron, Erie, and Ontario.",
      map: "great-lakes",
      quiz: "places",
      modes: ["pin", "type", "name", "choice", "study"],
      itemCount: GREAT_LAKES.length,
    },
    {
      id: "na-physical",
      name: "North America: Physical Features",
      blurb: "Rockies, Mississippi, Gulf of Mexico, and more.",
      map: "na-physical",
      quiz: "places",
      modes: ["pin", "type", "name", "choice", "study"],
      itemCount: NA_PHYSICAL.length,
    },
    outlinePacks[1],
    outlinePacks[7],
    ...sportsPacks,
  ],
  "south-america": [outlinePacks[2]],
  europe: [outlinePacks[3]],
  africa: [outlinePacks[4]],
  asia: [outlinePacks[5]],
  oceania: [outlinePacks[6]],
};

// Add outline mode to existing country packs
for (const p of packsFile.packs) {
  if (p.quiz === "countries" && Array.isArray(p.modes) && !p.modes.includes("outline")) {
    const i = p.modes.indexOf("type");
    p.modes.splice(i >= 0 ? i + 1 : 1, 0, "outline");
  }
}

for (const g of packsFile.groups) {
  const extras = extraByGroup[g.id] || [];
  for (const pack of extras) {
    if (!g.packs.some((x) => x.id === pack.id)) g.packs.push(pack);
    if (!packsFile.packs.some((x) => x.id === pack.id)) packsFile.packs.push(pack);
  }
  // sync outline into nested group packs too
  for (const p of g.packs) {
    if (p.quiz === "countries" && Array.isArray(p.modes) && !p.modes.includes("outline")) {
      const i = p.modes.indexOf("type");
      p.modes.splice(i >= 0 ? i + 1 : 1, 0, "outline");
    }
  }
}

await writeJson("packs.json", packsFile);
console.log(
  `Extra packs merged. Total packs: ${packsFile.packs.length}`
);
