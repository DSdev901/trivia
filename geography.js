/** Geography waterway filters + drill question builder. */

import {
  createRotation,
  currentQuestion,
  keepInRotation,
  recordAnswer,
  removeFromRotation,
} from "./quiz.js";

export { createRotation, currentQuestion, keepInRotation, recordAnswer, removeFromRotation };

export const DEPTH_OPTIONS = [
  {
    value: 1,
    label: "Pub essentials",
    blurb: "Undergrad / pub-trivia staples — Nile, Amazon, Seine, Great Lakes, etc.",
  },
  {
    value: 2,
    label: "College solid",
    blurb: "Adds secondary capitals, states, and mid-tier landmarks.",
  },
  {
    value: 3,
    label: "Deep cut",
    blurb: "Harder associations — fine for specialists, not first-pass trivia.",
  },
];

export const ENTITY_OPTIONS = [
  { id: "waterways", label: "Rivers & seas" },
  { id: "countries", label: "Countries" },
  { id: "capitals", label: "Capitals on them" },
  { id: "regions", label: "Landmarks / states" },
];

function shuffle(items) {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function pickDistractors(pool, correct, count) {
  const candidates = shuffle(unique(pool).filter((x) => x !== correct));
  return candidates.slice(0, count);
}

function makeChoices(correct, distractors) {
  return shuffle([correct, ...distractors]);
}

export function defaultGeoFilters() {
  return {
    depth: 1,
    entities: {
      waterways: true,
      countries: true,
      capitals: true,
      regions: true, // landmarks (falls, straits, reefs) are core pub trivia
    },
  };
}

export function waterwayVisible(waterway, depth) {
  return (waterway.depth || 1) <= depth;
}

export function filterWaterways(waterways, depth) {
  return waterways.filter((w) => waterwayVisible(w, depth));
}

export function capitalsFor(waterway, depth) {
  return (waterway.capitals || []).filter((c) => (c.depth || 1) <= depth);
}

export function regionsFor(waterway, depth) {
  return (waterway.regions || []).filter((r) => (r.depth || 1) <= depth);
}

export function factsFor(waterway, depth) {
  return (waterway.facts || []).filter((f) => (f.depth || 1) <= depth);
}

export function countriesFor(waterway, depth) {
  // At essentials, show first 5 countries; deeper shows more.
  const all = waterway.countries || [];
  if (depth <= 1) return all.slice(0, Math.min(5, all.length));
  if (depth === 2) return all.slice(0, Math.min(8, all.length));
  return all;
}

/** Count how many drillable items a filtered set produces. */
export function estimateDrillSize(waterways, filters) {
  return buildGeographyQuestions(waterways, filters).length;
}

export function buildGeographyQuestions(waterways, filters) {
  const depth = filters.depth || 1;
  const entities = filters.entities || defaultGeoFilters().entities;
  const pool = filterWaterways(waterways, depth);
  const questions = [];

  const allNames = pool.map((w) => w.name);
  const allOutlets = unique(pool.map((w) => w.outlet));
  const allCountries = unique(pool.flatMap((w) => countriesFor(w, depth)));
  const allCapitals = unique(
    pool.flatMap((w) => capitalsFor(w, depth).map((c) => `${c.city} (${c.country})`))
  );
  const allRegions = unique(pool.flatMap((w) => regionsFor(w, depth).map((r) => r.name)));

  for (const w of pool) {
    const continent = w._continentName || "";

    if (entities.waterways) {
      if (w.outlet) {
        const distractors = pickDistractors(allOutlets, w.outlet, 3);
        if (distractors.length === 3) {
          questions.push({
            id: `outlet-${w.id}`,
            prompt: `Where does the ${w.name} ultimately empty / connect?`,
            choices: makeChoices(w.outlet, distractors),
            correct: w.outlet,
            batch: continent,
          });
        }
      }

      const kindPool = unique(pool.map((x) => x.kind));
      const kindDistractors = pickDistractors(kindPool, w.kind, 3);
      if (kindDistractors.length === 3) {
        questions.push({
          id: `kind-${w.id}`,
          prompt: `What kind of waterway is the ${w.name}?`,
          choices: makeChoices(w.kind, kindDistractors),
          correct: w.kind,
          batch: continent,
        });
      }

      for (const fact of factsFor(w, depth)) {
        const distractors = pickDistractors(allNames, w.name, 3);
        if (distractors.length < 3) continue;
        questions.push({
          id: `fact-${w.id}-${fact.text.slice(0, 24)}`,
          prompt: `Which waterway does this describe?\n“${fact.text}”`,
          choices: makeChoices(w.name, distractors),
          correct: w.name,
          batch: continent,
        });
      }
    }

    if (entities.countries) {
      const countries = countriesFor(w, depth);
      for (const country of countries.slice(0, depth === 1 ? 3 : 6)) {
        const distractors = pickDistractors(allCountries, country, 3);
        if (distractors.length < 3) continue;
        // Mix: "which country touches X" and "which waterway touches country"
        questions.push({
          id: `country-touch-${w.id}-${country}`,
          prompt: `Which country is touched by / associated with the ${w.name}?`,
          choices: makeChoices(country, distractors),
          correct: country,
          batch: continent,
        });

        const waterDistractors = pickDistractors(allNames, w.name, 3);
        if (waterDistractors.length === 3) {
          questions.push({
            id: `water-for-country-${w.id}-${country}`,
            prompt: `Which waterway is most associated with ${country} in this set?`,
            choices: makeChoices(w.name, waterDistractors),
            correct: w.name,
            batch: continent,
          });
        }
      }
    }

    if (entities.capitals) {
      for (const cap of capitalsFor(w, depth)) {
        const label = `${cap.city} (${cap.country})`;
        const distractors = pickDistractors(allCapitals, label, 3);
        if (distractors.length < 3) continue;
        questions.push({
          id: `capital-${w.id}-${cap.city}`,
          prompt: `Which capital is linked with the ${w.name}?`,
          choices: makeChoices(label, distractors),
          correct: label,
          batch: continent,
        });

        const waterDistractors = pickDistractors(allNames, w.name, 3);
        if (waterDistractors.length === 3) {
          questions.push({
            id: `water-for-capital-${w.id}-${cap.city}`,
            prompt: `Which waterway is linked with ${cap.city}?`,
            choices: makeChoices(w.name, waterDistractors),
            correct: w.name,
            batch: continent,
          });
        }
      }
    }

    if (entities.regions) {
      for (const region of regionsFor(w, depth)) {
        const distractors = pickDistractors(allRegions, region.name, 3);
        if (distractors.length < 3) continue;
        questions.push({
          id: `region-${w.id}-${region.name}`,
          prompt: `Which state/region/landmark is associated with the ${w.name}?`,
          choices: makeChoices(region.name, distractors),
          correct: region.name,
          batch: continent,
        });
      }
    }
  }

  return shuffle(questions);
}
