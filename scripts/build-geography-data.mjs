#!/usr/bin/env node
/** Build static geography quiz packs. */
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "data", "geography");

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

/** Major countries for capital + flag drills (ISO 3166-1 alpha-2). */
const WORLD = [
  ["US", "United States", "Washington, D.C."],
  ["CA", "Canada", "Ottawa"],
  ["MX", "Mexico", "Mexico City"],
  ["BR", "Brazil", "Brasília"],
  ["AR", "Argentina", "Buenos Aires"],
  ["GB", "United Kingdom", "London"],
  ["FR", "France", "Paris"],
  ["DE", "Germany", "Berlin"],
  ["IT", "Italy", "Rome"],
  ["ES", "Spain", "Madrid"],
  ["PT", "Portugal", "Lisbon"],
  ["NL", "Netherlands", "Amsterdam"],
  ["BE", "Belgium", "Brussels"],
  ["CH", "Switzerland", "Bern"],
  ["AT", "Austria", "Vienna"],
  ["SE", "Sweden", "Stockholm"],
  ["NO", "Norway", "Oslo"],
  ["DK", "Denmark", "Copenhagen"],
  ["FI", "Finland", "Helsinki"],
  ["PL", "Poland", "Warsaw"],
  ["IE", "Ireland", "Dublin"],
  ["GR", "Greece", "Athens"],
  ["TR", "Turkey", "Ankara"],
  ["RU", "Russia", "Moscow"],
  ["UA", "Ukraine", "Kyiv"],
  ["EG", "Egypt", "Cairo"],
  ["ZA", "South Africa", "Pretoria"],
  ["NG", "Nigeria", "Abuja"],
  ["KE", "Kenya", "Nairobi"],
  ["MA", "Morocco", "Rabat"],
  ["CN", "China", "Beijing"],
  ["JP", "Japan", "Tokyo"],
  ["KR", "South Korea", "Seoul"],
  ["IN", "India", "New Delhi"],
  ["PK", "Pakistan", "Islamabad"],
  ["ID", "Indonesia", "Jakarta"],
  ["TH", "Thailand", "Bangkok"],
  ["VN", "Vietnam", "Hanoi"],
  ["PH", "Philippines", "Manila"],
  ["AU", "Australia", "Canberra"],
  ["NZ", "New Zealand", "Wellington"],
  ["SA", "Saudi Arabia", "Riyadh"],
  ["AE", "United Arab Emirates", "Abu Dhabi"],
  ["IL", "Israel", "Jerusalem"],
  ["IR", "Iran", "Tehran"],
  ["IQ", "Iraq", "Baghdad"],
  ["CL", "Chile", "Santiago"],
  ["CO", "Colombia", "Bogotá"],
  ["PE", "Peru", "Lima"],
  ["CU", "Cuba", "Havana"],
];

function flagEmoji(cc) {
  return [...cc.toUpperCase()]
    .map((c) => String.fromCodePoint(0x1f1e6 - 65 + c.charCodeAt(0)))
    .join("");
}

await mkdir(OUT, { recursive: true });

await writeFile(
  path.join(OUT, "continents.json"),
  `${JSON.stringify(
    {
      id: "continents",
      name: "Continents",
      map: "continents",
      items: CONTINENTS,
    },
    null,
    2
  )}\n`
);

await writeFile(
  path.join(OUT, "us-states.json"),
  `${JSON.stringify(
    {
      id: "us-states",
      name: "U.S. States",
      map: "us-states",
      items: US_STATES.map(([id, name, capital]) => ({
        id,
        name,
        capital,
        abbr: id,
      })),
    },
    null,
    2
  )}\n`
);

const worldItems = WORLD.map(([id, name, capital]) => ({
  id,
  name,
  capital,
  flag: flagEmoji(id),
}));

await writeFile(
  path.join(OUT, "world-capitals.json"),
  `${JSON.stringify(
    {
      id: "world-capitals",
      name: "World Capitals",
      map: null,
      items: worldItems,
    },
    null,
    2
  )}\n`
);

await writeFile(
  path.join(OUT, "world-flags.json"),
  `${JSON.stringify(
    {
      id: "world-flags",
      name: "World Flags",
      map: null,
      items: worldItems,
    },
    null,
    2
  )}\n`
);

console.log("Wrote continents, us-states, world-capitals, world-flags");
