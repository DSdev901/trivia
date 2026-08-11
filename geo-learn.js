/**
 * Map-first geography learning: dual coding (map + labels),
 * retrieval before reveal, interleaved drills, SM-2 spacing.
 */

import {
  capitalsFor,
  countriesFor,
  DEPTH_OPTIONS,
  ENTITY_OPTIONS,
  factsFor,
  filterWaterways,
  regionsFor,
} from "./geography.js";
import {
  createGeoMap,
  drawCountryBoundary,
  drawLandmarkHighlight,
  drawProvinceBoundary,
  drawRegionFocus,
  ensureCountryBoundaries,
  ensureProvinceBoundaries,
  findCountryFeature,
  findProvinceFeature,
  drawWaterways,
  ensureLeaflet,
  fitContinent,
  highlightOnly,
  resolveCityCoords,
} from "./geo-map.js";
import {
  getCard,
  listDueCardIds,
  orderQueue,
  progressSummary,
  RATINGS,
  schedule,
} from "./geo-srs.js";

function shuffle(items) {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function pickDistractors(pool, correct, n = 3) {
  return shuffle([...new Set(pool)].filter((x) => x !== correct)).slice(0, n);
}

function shortName(waterway) {
  return String(waterway.name || "")
    .replace(/\s*\(.*?\)\s*/g, " ")
    .replace(/\bRiver\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Parse "Suez Canal" on the Red Sea into ["Mediterranean Sea", "Red Sea"] */
function parseLandmarkConnection(landmarkName, waterway, allWaterways) {
  const name = landmarkName.toLowerCase();
  const outlet = (waterway.outlet || "").toLowerCase();
  const wname = waterway.name.toLowerCase();

  // Suez Canal: connects Mediterranean + Red Sea
  if (name.includes("suez")) {
    const med = allWaterways.find((x) => x.id === "mediterranean-europe" || x.id === "mediterranean-africa" || x.name.toLowerCase().includes("mediterranean"));
    const red = allWaterways.find((x) => x.id === "red-sea" || x.name.toLowerCase().includes("red sea"));
    if (med && red) return [med.name, red.name];
  }

  // Panama Canal: connects Caribbean Sea + Pacific Ocean
  if (name.includes("panama canal")) {
    const carib = allWaterways.find((x) => x.id === "caribbean" || x.name.toLowerCase().includes("caribbean"));
    const pac = allWaterways.find((x) => x.id === "pacific-ocean" || x.name.toLowerCase().includes("pacific"));
    if (carib && pac) return [carib.name, pac.name];
  }

  // Kiel Canal: connects North Sea + Baltic Sea
  if (name.includes("kiel")) {
    const north = allWaterways.find((x) => x.id === "north-sea" || x.name.toLowerCase().includes("north sea"));
    const baltic = allWaterways.find((x) => x.id === "baltic-sea" || x.name.toLowerCase().includes("baltic"));
    if (north && baltic) return [north.name, baltic.name];
  }

  // Bosphorus: connects Black Sea + Sea of Marmara (→ Mediterranean)
  if (name.includes("bosphorus") || name.includes("bosporus")) {
    const black = allWaterways.find((x) => x.id === "black-sea" || x.name.toLowerCase().includes("black sea"));
    const med = allWaterways.find((x) => x.id === "mediterranean-europe" || x.name.toLowerCase().includes("mediterranean"));
    if (black && med) return [black.name, med.name];
  }

  // Dardanelles: connects Aegean + Sea of Marmara (→ Mediterranean)
  if (name.includes("dardanelles")) {
    const med = allWaterways.find((x) => x.id === "mediterranean-europe" || x.name.toLowerCase().includes("mediterranean"));
    const black = allWaterways.find((x) => x.id === "black-sea" || x.name.toLowerCase().includes("black sea"));
    if (med && black) return [med.name, black.name];
  }

  // Bab el-Mandeb: connects Red Sea + Gulf of Aden / Indian Ocean
  if (name.includes("bab el-mandeb") || name.includes("bab el mandeb")) {
    const red = allWaterways.find((x) => x.id === "red-sea" || x.name.toLowerCase().includes("red sea"));
    const indian = allWaterways.find((x) => x.id === "indian-ocean" || x.name.toLowerCase().includes("indian ocean"));
    if (red && indian) return [red.name, indian.name];
  }

  // Strait of Hormuz: connects Persian Gulf + Gulf of Oman / Indian Ocean
  if (name.includes("hormuz")) {
    const persian = allWaterways.find((x) => x.id === "persian-gulf" || x.name.toLowerCase().includes("persian gulf"));
    const indian = allWaterways.find((x) => x.id === "indian-ocean" || x.name.toLowerCase().includes("indian ocean"));
    if (persian && indian) return [persian.name, indian.name];
  }

  // Strait of Malacca: connects Andaman Sea (Indian) + South China Sea (Pacific)
  if (name.includes("malacca")) {
    const indian = allWaterways.find((x) => x.id === "indian-ocean" || x.name.toLowerCase().includes("indian ocean"));
    const pacific = allWaterways.find((x) => x.id === "pacific-ocean" || x.name.toLowerCase().includes("pacific"));
    if (indian && pacific) return [indian.name, pacific.name];
  }

  return null;
}

function outletLabel(outlet) {
  if (!outlet) return "";
  // Keep the body-of-water people say in trivia; drop long parentheticals when possible.
  const cut = outlet.split(";")[0].trim();
  return cut.replace(/\s*\(via.*?\)\s*/gi, "").trim() || cut;
}

function cleanFactText(text) {
  return String(text || "")
    .replace(/^Pub-trivia shorthand:\s*/i, "")
    .replace(/\.$/, "")
    .trim();
}

function factIsTriviaGold(fact) {
  const tags = fact.tags || [];
  return (
    tags.includes("shorthand") ||
    tags.includes("length") ||
    tags.includes("capital") ||
    tags.includes("outlet") ||
    tags.includes("waterfall") ||
    tags.includes("port") ||
    tags.includes("canal") ||
    tags.includes("reef") ||
    tags.includes("tunnel")
  );
}

const LANDMARK_TYPES = new Set([
  "waterfall",
  "gorge",
  "delta",
  "reef",
  "strait",
  "canal",
  "tunnel",
  "port city",
  "estuary",
  "dam",
]);

function headlineCountries(waterway, depth) {
  const fromCaps = capitalsFor(waterway, Math.min(depth, 1)).map((c) => c.country);
  if (fromCaps.length) return [...new Set(fromCaps)].slice(0, depth === 1 ? 2 : 3);
  return countriesFor(waterway, depth).slice(0, depth === 1 ? 1 : 2);
}

function mcq(correct, pool, n = 3) {
  const distractors = pickDistractors(pool, correct, n);
  if (distractors.length < Math.min(n, 2)) return null;
  return shuffle([correct, ...distractors]);
}

export const CARD_TYPE_META = {
  clue: { label: "Pub clue", tone: "classic" },
  outlet: { label: "Mouth / outlet", tone: "classic" },
  capital_rev: { label: "Capital → waterway", tone: "classic" },
  capital: { label: "Waterway → capital", tone: "classic" },
  landmark: { label: "Landmark", tone: "classic" },
  "landmark-connection": { label: "Connector", tone: "classic" },
  country: { label: "Country link", tone: "classic" },
  region: { label: "Region link", tone: "classic" },
  identify: { label: "Map ID", tone: "map" },
  locate: { label: "Find on map", tone: "map" },
  "locate-landmark": { label: "Find landmark", tone: "map" },
};

export function buildLearnCards(waterways, filters) {
  const depth = filters.depth || 1;
  const entities = filters.entities;
  const pool = filterWaterways(waterways, depth);
  const allWaterways = waterways;
  const cards = [];
  const allNames = pool.map((w) => w.name);
  const allOutlets = [...new Set(pool.map((w) => outletLabel(w.outlet)).filter(Boolean))];
  const allCountries = [...new Set(pool.flatMap((w) => headlineCountries(w, depth)))];
  const allCapitals = [
    ...new Set(pool.flatMap((w) => capitalsFor(w, depth).map((c) => c.city))),
  ];
  // "City · Country" pairs so answers state what the city is the capital of
  const allCapitalsFull = [
    ...new Set(
      pool.flatMap((w) => capitalsFor(w, depth).map((c) => `${c.city} · ${c.country}`))
    ),
  ];
  const allLandmarks = [
    ...new Set(
      pool.flatMap((w) =>
        regionsFor(w, depth)
          .filter((r) => LANDMARK_TYPES.has(r.type))
          .map((r) => r.name)
      )
    ),
  ];
  const allSubRegionObjs = pool.flatMap((w) =>
    regionsFor(w, depth)
      .filter(
        (r) =>
          !LANDMARK_TYPES.has(r.type) &&
          (r.type === "state" || r.type === "province" || r.type === "region")
      )
      .map((r) => ({ name: r.name, type: r.type }))
  );

  for (const w of pool) {
    const nick = shortName(w);

    if (entities.waterways) {
      // Classic fact / shorthand clues — the undergrad trivia core
      const goldFacts = factsFor(w, depth).filter(factIsTriviaGold);
      const factPool = goldFacts.length ? goldFacts : factsFor(w, depth).slice(0, 2);
      for (const fact of factPool.slice(0, depth === 1 ? 2 : 3)) {
        const clue = cleanFactText(fact.text);
        if (clue.length < 24) continue;
        const choices = mcq(w.name, allNames);
        if (!choices) continue;
        cards.push({
          id: `clue:${w.id}:${clue.slice(0, 40)}`,
          type: "clue",
          waterwayId: w.id,
          prompt: `Common trivia clue — which waterway?\n“${clue}”`,
          answer: w.name,
          choices,
          encodeHint: "Picture the map course, then lock the name.",
          weight: (fact.tags || []).includes("shorthand") ? 5 : 4,
        });
      }

      if (w.outlet) {
        const out = outletLabel(w.outlet);
        // Exclude anything named in this waterway's own outlet string —
        // e.g. Red Sea outlet mentions both Indian Ocean and Mediterranean,
        // so neither may appear as a distractor for the other.
        const ownOutlet = (w.outlet || "").toLowerCase();
        const outletPool = allOutlets.filter((o) => {
          if (o === out) return false;
          const core = o
            .toLowerCase()
            .replace(/\b(sea|ocean|gulf|bay|channel|strait|river)\b/g, "")
            .replace(/\s+/g, " ")
            .trim();
          return !(core && ownOutlet.includes(core));
        });
        const choices = mcq(out, outletPool);
        if (choices) {
          const prompt =
            w.kind === "river" || w.kind === "canal" || w.kind === "estuary"
              ? `Into which body of water does the ${nick} empty?`
              : `The ${nick} connects to / opens into which body of water?`;
          cards.push({
            id: `outlet:${w.id}`,
            type: "outlet",
            waterwayId: w.id,
            prompt,
            answer: out,
            choices,
            encodeHint: "Find the mouth or gateway on the map.",
            weight: 5,
          });
        }
      }

      // Map checks — fewer, essentials only at shallow depth
      if (depth >= 1 && (w.depth || 1) <= Math.min(depth, 2)) {
        const idChoices = mcq(w.name, allNames);
        if (idChoices) {
          cards.push({
            id: `identify:${w.id}`,
            type: "identify",
            waterwayId: w.id,
            prompt: "Map check — which waterway is highlighted?",
            answer: w.name,
            choices: idChoices,
            encodeHint: "Trace source → mouth before you answer.",
            weight: 2,
          });
        }
        if ((w.depth || 1) === 1) {
          const locateOptions = shuffle([
            w.id,
            ...pickDistractors(
              pool.map((x) => x.id),
              w.id,
              Math.min(3, pool.length - 1)
            ),
          ]);
          if (locateOptions.length >= 2) {
            cards.push({
              id: `locate:${w.id}`,
              type: "locate",
              waterwayId: w.id,
              prompt: `Find it — tap the ${nick} on the map.`,
              answer: w.id,
              locateOptions,
              encodeHint: "College-map skill: know where the famous ones run.",
              weight: 2,
            });
          }
        }

      }

      // Reverse cards whose ANSWER is a waterway belong to this toggle —
      // users who only want countries/capitals/states never see them.
      for (const cap of capitalsFor(w, depth)) {
        const revChoices = mcq(w.name, allNames);
        if (revChoices && (cap.depth || 1) <= 2) {
          cards.push({
            id: `capital-rev:${w.id}:${cap.city}`,
            type: "capital_rev",
            waterwayId: w.id,
            focusCity: cap.city,
            prompt: `${cap.city} (capital of ${cap.country}) is classically associated with which waterway?`,
            answer: w.name,
            choices: revChoices,
            encodeHint: "Capital-on-the-river is core undergrad trivia.",
            weight: (cap.depth || 1) === 1 ? 5 : 3,
          });
        }
      }

      const revLandmarks = regionsFor(w, depth).filter((r) => LANDMARK_TYPES.has(r.type));
      for (const r of revLandmarks.slice(0, depth === 1 ? 2 : 4)) {
        // Skip when another waterway claims the same landmark (e.g. Suez is
        // listed under both Red Sea and Med) — two correct answers.
        const sharedElsewhere = pool.some(
          (x) => x.id !== w.id && regionsFor(x, 3).some((rr) => rr.name === r.name)
        );
        if (!sharedElsewhere) {
          // Distractors must not be the landmark's own name or a waterway
          // that is itself a region of this one (Río de la Plata on Paraná).
          const revPool = allNames.filter(
            (n) => n !== r.name && !regionsFor(w, 3).some((rr) => rr.name === n)
          );
          const rev = mcq(w.name, revPool);
          if (rev) {
            cards.push({
              id: `landmark-rev:${w.id}:${r.name}`,
              type: "landmark",
              waterwayId: w.id,
              prompt: `${r.name} is on / associated with which waterway?`,
              answer: w.name,
              choices: rev,
              encodeHint: "Landmarks (falls, straits, reefs) are pub-trivia gold.",
              weight: (r.depth || 1) === 1 ? 5 : 3,
            });
          }
        }

        // Connection cards: "The X connects which two bodies of water?"
        const connection = parseLandmarkConnection(r.name, w, allWaterways);
        if (connection) {
          const [bodyA, bodyB] = connection;
          cards.push({
            id: `landmark-conn:${w.id}:${r.name}`,
            type: "landmark-connection",
            waterwayId: w.id,
            prompt: `The ${r.name} connects which two bodies of water?`,
            answer: `${bodyA} ↔ ${bodyB}`,
            choices: shuffle([
              `${bodyA} ↔ ${bodyB}`,
              ...pickDistractors(
                allWaterways.map((x) => x.name),
                bodyA,
                2
              ).map((d) => `${d} ↔ ${bodyB}`),
              `${bodyA} ↔ ${pickDistractors(allWaterways.map((x) => x.name), bodyB, 1)[0] || "Atlantic"}`,
            ]).slice(0, 4),
            encodeHint: "Canals and straits are bridges between basins.",
            weight: 4,
          });
        }
      }
    }

    if (entities.capitals) {
      for (const cap of capitalsFor(w, depth)) {
        // Forward: answer states city AND what it's the capital of.
        // Sister capitals on the SAME waterway (e.g. Vienna/Budapest on the
        // Danube) are also correct answers, so they can't be distractors.
        const answerFull = `${cap.city} · ${cap.country}`;
        const sameCaps = new Set(capitalsFor(w, 3).map((c) => `${c.city} · ${c.country}`));
        const fwdPool = allCapitalsFull.filter((x) => !sameCaps.has(x));
        const fwd = mcq(answerFull, fwdPool);
        if (fwd && (cap.depth || 1) <= depth) {
          cards.push({
            id: `capital:${w.id}:${cap.city}`,
            type: "capital",
            waterwayId: w.id,
            focusCity: cap.city,
            prompt: `Which capital sits on / beside the ${nick}? (city + what it's the capital of)`,
            answer: answerFull,
            choices: fwd,
            encodeHint: "The map marks the capital — name the city and its country/state.",
            weight: (cap.depth || 1) === 1 ? 4 : 2,
          });
        }
      }
    }

    if (entities.countries) {
      // Every country this waterway touches is a correct answer — exclude all
      // of them from the distractor pool, not just the headline ones.
      const sameCountries = new Set(countriesFor(w, 3));
      const countryPool = allCountries.filter((x) => !sameCountries.has(x));
      for (const country of headlineCountries(w, depth)) {
        const choices = mcq(country, countryPool);
        if (!choices) continue;
        cards.push({
          id: `country:${w.id}:${country}`,
          type: "country",
          waterwayId: w.id,
          prompt:
            w.kind === "river"
              ? `Which country is a classic association for the ${nick}?`
              : `Which country borders or claims a shore of the ${nick}?`,
          answer: country,
          choices,
          encodeHint: "Think the country a quiz bowl host would expect first.",
          weight: 3,
        });
      }
    }

    if (entities.regions) {
      const landmarks = regionsFor(w, depth).filter((r) => LANDMARK_TYPES.has(r.type));
      const subRegions = regionsFor(w, depth).filter(
        (r) => !LANDMARK_TYPES.has(r.type) && (r.type === "state" || r.type === "province" || r.type === "region")
      );

      // Landmarks tied to THIS waterway can never be distractors for each
      // other — Gibraltar and Suez are both correct for the Mediterranean.
      const sameLandmarks = new Set(
        regionsFor(w, 3)
          .filter((rr) => LANDMARK_TYPES.has(rr.type))
          .map((rr) => rr.name)
      );
      const landmarkPool = allLandmarks.filter((x) => !sameLandmarks.has(x));

      for (const r of landmarks.slice(0, depth === 1 ? 2 : 4)) {
        if (landmarkPool.length >= 2) {
          const fwd = mcq(r.name, landmarkPool);
          if (fwd) {
            cards.push({
              id: `landmark:${w.id}:${r.name}`,
              type: "landmark",
              waterwayId: w.id,
              prompt: `Which landmark is famously tied to the ${nick}?`,
              answer: r.name,
              choices: fwd,
              encodeHint: "If it’s on a quiz packet, it’s probably this one.",
              weight: 3,
            });
          }
        }

        // Click-to-locate: "Tap the Suez Canal on the map" — answer is the
        // landmark itself, so it lives under the regions toggle.
        if (depth >= 2 && landmarks.indexOf(r) < 2) {
          const otherLandmarks = allLandmarks.filter((x) => x !== r.name);
          if (otherLandmarks.length >= 2) {
            cards.push({
              id: `locate-landmark:${w.id}:${r.name}`,
              type: "locate-landmark",
              waterwayId: w.id,
              prompt: `Tap the ${r.name} on the map.`,
              answer: r.name,
              locateOptions: shuffle([r.name, ...otherLandmarks.slice(0, 3)]),
              encodeHint: "Landmarks are often chokepoints or crossings.",
              weight: 3,
            });
          }
        }
      }

      // Sub-country region cards: "Which state/province is the X in?"
      // Distractors come from OTHER waterways — sister regions on this one
      // (e.g. Colorado/Utah/Arizona on the Colorado) are all correct too.
      const sameRegions = new Set(
        regionsFor(w, 3)
          .filter((rr) => !LANDMARK_TYPES.has(rr.type))
          .map((rr) => rr.name)
      );
      for (const r of subRegions.slice(0, depth === 1 ? 2 : 3)) {
        let regionPool = [
          ...new Set(
            allSubRegionObjs
              .filter((x) => x.type === r.type && !sameRegions.has(x.name))
              .map((x) => x.name)
          ),
        ];
        if (regionPool.length < 3) {
          regionPool = [
            ...new Set(
              allSubRegionObjs.filter((x) => !sameRegions.has(x.name)).map((x) => x.name)
            ),
          ];
        }
        const choices = mcq(r.name, regionPool);
        if (choices) {
          // Name the parent country when the waterway is single-country, so
          // "which state" isn't floating without context
          const countryHint =
            (w.countries || []).length === 1 ? ` in ${w.countries[0]}` : "";
          cards.push({
            id: `region:${w.id}:${r.name}`,
            type: "region",
            waterwayId: w.id,
            prompt: `The ${nick} touches / runs through which ${r.type}${countryHint}?`,
            answer: r.name,
            choices,
            encodeHint: "Think political geography along the course.",
            weight: 2,
          });
        }
      }
    }
  }

  return cards.filter((c) => {
    if (c.type === "locate" || c.type === "locate-landmark")
      return (c.locateOptions || []).length >= 2;
    return (c.choices || []).length >= 2;
  });
}

function filterBarHTML(filters, escapeHtml, { estimate = null } = {}) {
  return `
    <div class="geo-filters geo-filters-compact">
      <p class="geo-filter-label">Depth</p>
      <div class="geo-depth geo-depth-row" role="radiogroup" aria-label="Depth">
        ${DEPTH_OPTIONS.map(
          (d) => `
          <button type="button" class="geo-depth-btn ${
            filters.depth === d.value ? "is-on" : ""
          }" data-depth="${d.value}" title="${escapeHtml(d.blurb)}">
            <strong>${d.label}</strong>
          </button>`
        ).join("")}
      </div>
      <p class="geo-filter-label">Trivia layers</p>
      <div class="geo-entities" role="group">
        ${ENTITY_OPTIONS.map(
          (e) => `
          <label class="geo-chip ${filters.entities[e.id] ? "is-on" : ""}">
            <input type="checkbox" data-entity="${e.id}" ${
              filters.entities[e.id] ? "checked" : ""
            } />
            ${e.label}
          </label>`
        ).join("")}
      </div>
      ${
        estimate != null
          ? `<p class="geo-estimate">${estimate}</p>`
          : ""
      }
    </div>
  `;
}

function bindFilters(root, filters, onChange) {
  root.querySelectorAll("[data-depth]").forEach((btn) => {
    btn.addEventListener("click", () => {
      filters.depth = Number(btn.dataset.depth);
      onChange();
    });
  });
  root.querySelectorAll("[data-entity]").forEach((input) => {
    input.addEventListener("change", () => {
      filters.entities[input.dataset.entity] = input.checked;
      onChange();
    });
  });
}

/**
 * Create geo UI controller bound to app state/els.
 */
export function createGeoController(ctx) {
  const {
    els,
    state,
    show,
    escapeHtml,
    loadContinent,
    loadWaterwaysForContinents,
    loadJSON,
  } = ctx;

  let mapPaths = null;
  let cityCoords = null;
  let countryShapes = null;
  let atlasMap = null;
  let drillMap = null;
  let drillSession = null;

  async function getMapPaths() {
    if (!mapPaths) mapPaths = await loadJSON("data/geography/map-paths.json");
    return mapPaths;
  }

  async function getCityCoords() {
    if (!cityCoords) cityCoords = await loadJSON("data/geography/city-coords.json");
    return cityCoords;
  }

  async function getCountryShapes() {
    if (!countryShapes) countryShapes = await loadJSON("data/geography/country-shapes.json");
    return countryShapes;
  }

  async function drawCountryFocus(drillMapRef, countryName) {
    const [geojson, shapes] = await Promise.all([ensureCountryBoundaries(), getCountryShapes()]);
    const nameMap = shapes.names || {};
    const feature = findCountryFeature(geojson, countryName, nameMap);
    if (feature) {
      drawCountryBoundary(drillMapRef, feature, { color: "#5c1a24", fillOpacity: 0.88 });
      return true;
    }
    // fallback to manual ring if name not in Natural Earth (e.g. some territories)
    const ring = shapes[countryName];
    if (ring) {
      drawRegionFocus(drillMapRef, ring, { color: "#5c1a24", opacity: 0.88 });
      return true;
    }
    return false;
  }

  async function drawProvinceFocus(drillMapRef, regionName, waterway) {
    const provinces = await ensureProvinceBoundaries();
    // Try to find the country context from the waterway
    const countryName = waterway?.countries?.[0] || null;
    const feature = findProvinceFeature(provinces, regionName, countryName);
    if (feature) {
      drawProvinceBoundary(drillMapRef, feature, { color: "#5c1a24", fillOpacity: 0.62 });
      return true;
    }
    return false;
  }

  function focusPlaceForCard(card, paths, cities, { revealName = true } = {}) {
    // Strip the " · Country" suffix when only the decorated answer is available
    const raw = card.focusCity || (card.type === "capital" ? card.answer : null);
    const city = raw ? raw.split(" · ")[0] : null;
    if (!city) return null;
    const resolved = resolveCityCoords(city, card.waterwayId, paths, cities);
    if (!resolved) return null;
    return {
      ...resolved,
      label: revealName ? city : "Capital",
      role: "capital",
      permanentLabel: true,
      showLabel: true,
    };
  }

  function destroyAtlasMap() {
    if (atlasMap) {
      atlasMap.destroy();
      atlasMap = null;
    }
  }

  function destroyDrillMap() {
    if (drillMap) {
      drillMap.destroy();
      drillMap = null;
    }
  }

  async function renderHubExtra(category) {
    // used from app for geo-specific hub copy — app still owns hub shell
    return category;
  }

  function renderContinents(category) {
    destroyAtlasMap();
    destroyDrillMap();
    const cards = (category.continents || [])
      .map(
        (c) => `
      <button type="button" class="batch-card" data-continent="${c.id}">
        <h2>${escapeHtml(c.name)}</h2>
        <p>Map atlas + pub-trivia angles</p>
        <span class="meta">Outlet · capital · landmark</span>
      </button>`
      )
      .join("");

    els.continents.innerHTML = `
      <h2 class="section-title">Atlas — choose a continent</h2>
      <p class="lede">Map + the facts an undergrad trivia player is expected to know: mouths, capitals on rivers, and famous landmarks.</p>
      <div class="batch-grid">${cards}</div>
    `;

    els.continents.querySelectorAll("[data-continent]").forEach((btn) => {
      btn.addEventListener("click", () => openAtlas(btn.dataset.continent));
    });
  }

  async function openAtlas(continentId) {
    try {
      await ensureLeaflet();
      const paths = await getMapPaths();
      const meta = state.category.continents.find((c) => c.id === continentId);
      const data = await loadContinent(meta);
      state.geoContinent = data;
      state.geoContinentIds = [continentId];
      state.waterway = null;
      els.subtitle.textContent = `${state.category.name} · ${data.name} atlas`;
      await renderAtlas();
      show("waterways");
    } catch (err) {
      els.continents.innerHTML = `<p class="error">${escapeHtml(err.message)}</p>`;
      show("continents");
    }
  }

  async function renderAtlas() {
    const continent = state.geoContinent;
    const paths = await getMapPaths();
    const filters = state.geoFilters;
    const visible = filterWaterways(continent.waterways || [], filters.depth);
    const continentMeta = paths.continents[continent.id];
    const cards = buildLearnCards(
      visible.map((w) => ({ ...w, _continentName: continent.name })),
      filters
    );
    const prog = progressSummary(cards.map((c) => c.id));
    const selected = state.waterway;

    els.waterways.innerHTML = `
      <div class="geo-atlas">
        <div class="geo-atlas-top">
          <div>
            <h2 class="section-title">${escapeHtml(continent.name)} atlas</h2>
            <p class="lede geo-lede-tight">Click a waterway. Cover the name — can you hit the outlet, capital, and landmark a quiz bowl host would expect?</p>
          </div>
          <div class="geo-progress-pills" aria-label="Spaced-repetition progress">
            <span><strong>${prog.due}</strong> due</span>
            <span><strong>${prog.newCount}</strong> new</span>
            <span><strong>${prog.learning}</strong> learning</span>
            <span><strong>${prog.mature}</strong> mature</span>
          </div>
        </div>
        ${filterBarHTML(filters, escapeHtml)}
        <div class="geo-atlas-stage">
          <div id="geo-atlas-map" class="geo-map" role="img" aria-label="Continent waterways map"></div>
          <aside class="geo-atlas-panel" id="geo-atlas-panel"></aside>
        </div>
        <div class="geo-water-rail" id="geo-water-rail">
          ${visible
            .map(
              (w) => `
            <button type="button" class="geo-rail-chip ${
              selected?.id === w.id ? "is-on" : ""
            }" data-id="${escapeHtml(w.id)}">${escapeHtml(w.name)}</button>`
            )
            .join("")}
        </div>
      </div>
    `;

    bindFilters(els.waterways, filters, () => renderAtlas());

    destroyAtlasMap();
    const mapEl = document.getElementById("geo-atlas-map");
    atlasMap = createGeoMap(mapEl, {
      center: continentMeta?.center || [20, 0],
      zoom: continentMeta?.zoom || 3,
    });
    fitContinent(atlasMap, continentMeta);
    drawWaterways(atlasMap, visible, paths, {
      selectedId: selected?.id || null,
      dimOthers: Boolean(selected),
      showMarkersFor: selected?.id || false,
      fitAll: !selected,
      onSelect: (id) => {
        const w = visible.find((x) => x.id === id);
        if (!w || state.waterway?.id === w.id) return;
        state.waterway = w;
        renderAtlas();
      },
    });
    atlasMap.invalidate();

    els.waterways.querySelectorAll(".geo-rail-chip").forEach((btn) => {
      btn.addEventListener("click", () => {
        const w = visible.find((x) => x.id === btn.dataset.id);
        if (!w || state.waterway?.id === w.id) return;
        state.waterway = w;
        renderAtlas();
      });
    });

    if (selected) renderAtlasPanel(selected, visible, paths);
    else {
      document.getElementById("geo-atlas-panel").innerHTML = `
        <div class="geo-panel-empty">
          <p class="geo-panel-kicker">Undergrad / pub trivia</p>
          <h3>Select a waterway</h3>
          <p>Click the map or a chip. Before revealing: outlet, a capital on it, and one landmark.</p>
          <ol class="geo-method-list">
            <li><strong>See</strong> it on the map</li>
            <li><strong>Say</strong> the trivia triple (mouth · capital · landmark)</li>
            <li><strong>Drill</strong> spaced pub-style questions</li>
          </ol>
        </div>
      `;
    }
  }

  function syncRail(id) {
    els.waterways.querySelectorAll(".geo-rail-chip").forEach((btn) => {
      btn.classList.toggle("is-on", btn.dataset.id === id);
    });
  }

  function renderAtlasPanel(w, visible, paths) {
    const depth = state.geoFilters.depth;
    const entities = state.geoFilters.entities;
    const countries = countriesFor(w, depth);
    const capitals = capitalsFor(w, depth);
    const regions = regionsFor(w, depth);
    const facts = factsFor(w, depth);
    const panel = document.getElementById("geo-atlas-panel");
    if (!panel) return;

    const triviaAngles = facts
      .filter(factIsTriviaGold)
      .map((f) => cleanFactText(f.text))
      .slice(0, 3);
    const landmarkBits = regions
      .filter((r) => LANDMARK_TYPES.has(r.type))
      .slice(0, 3);

    panel.innerHTML = `
      <div class="geo-panel">
        <p class="geo-panel-kicker">${escapeHtml(w.kind)} · trivia depth ${w.depth || 1}</p>
        <h3>${escapeHtml(w.name)}</h3>
        <p class="geo-retrieve-prompt">Quiz yourself first: outlet? capital on it? one landmark?</p>
        ${
          triviaAngles.length
            ? `<div class="geo-trivia-angles">
                <p class="geo-filter-label">Likely trivia angles</p>
                <ul class="geo-fact-bullets">${triviaAngles
                  .map((t) => `<li>${escapeHtml(t)}</li>`)
                  .join("")}</ul>
              </div>`
            : ""
        }
        <details class="geo-reveal">
          <summary>Reveal outlet &amp; snapshot</summary>
          <dl class="geo-dl">
            <div><dt>Outlet / connection</dt><dd class="geo-answer">${escapeHtml(
              outletLabel(w.outlet) || "—"
            )}</dd></div>
            <div><dt>Kind</dt><dd>${escapeHtml(w.kind || "—")}</dd></div>
          </dl>
        </details>
        ${
          entities.countries
            ? `<details class="geo-reveal"><summary>Countries <span class="geo-reveal-hint">retrieve first</span></summary>
                <ul class="geo-chip-list">${countries
                  .map((c) => `<li>${escapeHtml(c)}</li>`)
                  .join("")}</ul></details>`
            : ""
        }
        ${
          entities.capitals
            ? `<details class="geo-reveal"><summary>Capitals <span class="geo-reveal-hint">retrieve first</span></summary>
                <ul class="geo-assoc-list">${capitals
                  .map(
                    (c) =>
                      `<li><strong>${escapeHtml(c.city)}</strong> · ${escapeHtml(
                        c.country
                      )}</li>`
                  )
                  .join("")}</ul></details>`
            : ""
        }
        ${
          entities.regions || landmarkBits.length
            ? `<details class="geo-reveal"><summary>Landmarks / states <span class="geo-reveal-hint">retrieve first</span></summary>
                <ul class="geo-assoc-list">${(landmarkBits.length ? landmarkBits : regions)
                  .map(
                    (r) =>
                      `<li><strong>${escapeHtml(r.name)}</strong>${
                        r.type ? ` · ${escapeHtml(r.type)}` : ""
                      }</li>`
                  )
                  .join("")}</ul></details>`
            : ""
        }
        ${
          entities.waterways
            ? `<details class="geo-reveal"><summary>More facts</summary>
                <ul class="geo-fact-bullets">${facts
                  .map((f) => `<li>${escapeHtml(cleanFactText(f.text))}</li>`)
                  .join("")}</ul></details>`
            : ""
        }
        <button type="button" class="primary-btn" id="geo-drill-this" style="width:100%;margin-top:1rem">
          Drill pub questions for this one
        </button>
      </div>
    `;

    document.getElementById("geo-drill-this")?.addEventListener("click", () => {
      state.geoMode = "drill";
      state.geoContinentIds = [state.geoContinent.id];
      state.geoFocusWaterwayId = w.id;
      renderDrillSetup(state.category);
      show("quizSetup");
      els.subtitle.textContent = `${state.category.name} · Map drill`;
    });
  }

  function renderDrillSetup(category) {
    destroyDrillMap();
    drillSession = null;
    const filters = state.geoFilters;
    if (!state.geoContinentIds.length) {
      state.geoContinentIds = (category.continents || []).map((c) => c.id);
    }

    const continentOptions = (category.continents || [])
      .map(
        (c) => `
      <label class="batch-check">
        <input type="checkbox" name="geo-continent" value="${c.id}" ${
          state.geoContinentIds.includes(c.id) ? "checked" : ""
        } />
        <span class="batch-check-body">
          <strong>${escapeHtml(c.name)}</strong>
          <span>Pub-trivia waterways for this continent</span>
        </span>
      </label>`
      )
      .join("");

    els.quizSetup.innerHTML = `
      <h2 class="section-title">Trivia drill setup</h2>
      <p class="lede">Pick continents and layers. Wrong answers <strong>repeat within the session</strong> (interleaved); “Again” ratings bring them back sooner — keep drilling until the deck feels automatic.</p>
      <div class="batch-check-list">${continentOptions}</div>
      <div id="geo-setup-filters">${filterBarHTML(filters, escapeHtml, {
        estimate: "Loading card count…",
      })}</div>
      <div class="setup-actions">
        <button type="button" class="text-btn" id="select-all">Select all</button>
        <button type="button" class="text-btn" id="select-none">Select none</button>
        <button type="button" class="primary-btn" id="start-quiz">Start trivia drill</button>
      </div>
      <p class="setup-error" id="setup-error" hidden></p>
    `;

    const inputs = () => [...els.quizSetup.querySelectorAll('input[name="geo-continent"]')];

    async function refresh() {
      state.geoContinentIds = inputs()
        .filter((i) => i.checked)
        .map((i) => i.value);
      const estimateEl = els.quizSetup.querySelector(".geo-estimate");
      try {
        const waterways = await loadWaterwaysForContinents(state.geoContinentIds);
        let cards = buildLearnCards(waterways, state.geoFilters);
        if (state.geoFocusWaterwayId) {
          cards = cards.filter((c) => c.waterwayId === state.geoFocusWaterwayId);
        }
        const prog = progressSummary(cards.map((c) => c.id));
        if (estimateEl) {
          estimateEl.innerHTML = `<strong>${cards.length}</strong> cards · <strong>${prog.due}</strong> due now · <strong>${prog.newCount}</strong> new`;
        }
      } catch (err) {
        if (estimateEl) estimateEl.textContent = err.message;
      }
    }

    function rerenderFilters() {
      const wrap = document.getElementById("geo-setup-filters");
      wrap.innerHTML = filterBarHTML(state.geoFilters, escapeHtml, {
        estimate: "…",
      });
      bindFilters(wrap, state.geoFilters, () => {
        rerenderFilters();
        refresh();
      });
      refresh();
    }

    bindFilters(els.quizSetup, state.geoFilters, () => {
      rerenderFilters();
    });
    inputs().forEach((i) => i.addEventListener("change", refresh));
    document.getElementById("select-all").addEventListener("click", () => {
      inputs().forEach((i) => {
        i.checked = true;
      });
      refresh();
    });
    document.getElementById("select-none").addEventListener("click", () => {
      inputs().forEach((i) => {
        i.checked = false;
      });
      refresh();
    });
    document.getElementById("start-quiz").addEventListener("click", () => {
      const selected = inputs()
        .filter((i) => i.checked)
        .map((i) => i.value);
      startDrill(selected);
    });
    refresh();
  }

  async function startDrill(continentIds) {
    const errorEl = document.getElementById("setup-error");
    if (!continentIds.length) {
      errorEl.hidden = false;
      errorEl.textContent = "Select at least one continent.";
      return;
    }
    if (!Object.values(state.geoFilters.entities).some(Boolean)) {
      errorEl.hidden = false;
      errorEl.textContent = "Turn on at least one drill layer.";
      return;
    }

    try {
      errorEl.hidden = true;
      await ensureLeaflet();
      const paths = await getMapPaths();
      const waterways = await loadWaterwaysForContinents(continentIds);
      let cards = buildLearnCards(waterways, state.geoFilters);
      if (state.geoFocusWaterwayId) {
        cards = cards.filter((c) => c.waterwayId === state.geoFocusWaterwayId);
      }
      if (!cards.length) {
        errorEl.hidden = false;
        errorEl.textContent = "No cards for those filters.";
        return;
      }

      // Prefer classic trivia cards slightly when scheduling a fresh mix
      cards.sort((a, b) => (b.weight || 0) - (a.weight || 0));
      const byId = Object.fromEntries(cards.map((c) => [c.id, c]));
      const queue = orderQueue(cards.map((c) => c.id));
      const sessionIds = queue.slice(0, 35);

      drillSession = {
        continentIds,
        waterways,
        paths,
        byId,
        queue: sessionIds,
        index: 0,
        answered: 0,
        correctCount: 0,
        againCount: 0,
        streak: 0,
        bestStreak: 0,
        reviewed: new Set(),
        focusId: state.geoFocusWaterwayId || null,
      };
      state.geoFocusWaterwayId = null;
      state.quiz = { mode: "geography-map", remaining: sessionIds.length };
      els.subtitle.textContent = `${state.category.name} · Map drill`;
      show("quiz");
      await renderDrillCard();
    } catch (err) {
      errorEl.hidden = false;
      errorEl.textContent = err.message;
    }
  }

  async function renderDrillCard() {
    if (!drillSession || drillSession.index >= drillSession.queue.length) {
      renderDrillDone();
      return;
    }

    const cardId = drillSession.queue[drillSession.index];
    const card = drillSession.byId[cardId];
    const w = drillSession.waterways.find((x) => x.id === card.waterwayId);
    const remaining = drillSession.queue.length - drillSession.index;
    const dueNow = listDueCardIds(Object.keys(drillSession.byId)).length;
    const srs = getCard(cardId);
    const isRepeat = drillSession.reviewed.has(cardId);
    const meta = CARD_TYPE_META[card.type] || { label: "Trivia", tone: "classic" };
    const promptHtml = escapeHtml(card.prompt).replace(/\n/g, "<br />");

    els.quiz.innerHTML = `
      <div class="geo-drill">
        <div class="geo-drill-hud">
          <div class="geo-hud-stat"><strong>${remaining}</strong><span>cards left</span></div>
          <div class="geo-hud-stat"><strong>${drillSession.streak}</strong><span>streak</span></div>
          <div class="geo-hud-stat"><strong>${drillSession.answered ? Math.round((drillSession.correctCount / drillSession.answered) * 100) : 0}%</strong><span>accuracy</span></div>
          <div class="geo-hud-stat"><strong>${dueNow}</strong><span>due in deck</span></div>
        </div>
        <div class="geo-q-head">
          <div>
            <span class="geo-q-badge geo-q-badge-${meta.tone}">${escapeHtml(meta.label)}</span>
            ${isRepeat ? `<span class="geo-q-badge geo-q-badge-hard">Review · repeat</span>` : ""}
          </div>
          <p class="geo-encode-hint">${escapeHtml(card.encodeHint || "")}</p>
        </div>
        <p class="quiz-prompt geo-trivia-prompt">${promptHtml}</p>
        <div id="geo-drill-map" class="geo-map geo-map-drill"></div>
        <div id="geo-drill-answers" class="geo-drill-answers"></div>
        <div id="geo-drill-feedback" hidden></div>
      </div>
    `;

    destroyDrillMap();
    const mapEl = document.getElementById("geo-drill-map");
    drillMap = createGeoMap(mapEl, { center: [20, 0], zoom: 2 });
    const continentId = w?._continentId;
    const continentMeta = drillSession.paths.continents[continentId];
    if (continentMeta) fitContinent(drillMap, continentMeta);

    const answers = document.getElementById("geo-drill-answers");

    if (card.type === "locate") {
      const optionSet = new Set(card.locateOptions);
      const subset = drillSession.waterways.filter((x) => optionSet.has(x.id));
      drawWaterways(drillMap, subset, drillSession.paths, {
        selectedId: null,
        dimOthers: false,
        showMarkersFor: false,
        fitAll: true,
        clickableIds: optionSet,
        showTooltips: false,
        onSelect: (id) => onLocateAnswer(card, id),
      });
      answers.innerHTML = `<p class="lede geo-lede-tight">Tap the correct waterway path on the map (names hidden).</p>`;
    } else if (card.type === "locate-landmark") {
      // Draw the waterway with all landmark features clickable
      drawWaterways(drillMap, [w], drillSession.paths, {
        selectedId: w.id,
        showMarkersFor: w.id,
        fitSelection: true,
        interactive: false,
        showTooltips: false,
        highlightColor: "#1d4ed8",
      });
      // Overlay clickable landmark features
      const geom = drillSession.paths.waterways?.[w.id];
      if (geom?.features) {
        const clickable = new Set(card.locateOptions);
        for (const f of geom.features) {
          if (!clickable.has(f.name)) continue;
          const latlngs = f.path.map(([lat, lng]) => [lat, lng]);
          const hit = drillMap.L.polyline(latlngs, {
            color: "#8b1a1a",
            weight: 22,
            opacity: 0.01,
            interactive: true,
          });
          hit._landmarkName = f.name;
          hit.on("click", () => onLocateLandmarkAnswer(card, f.name));
          drillMap.layers.addLayer(hit);
        }
      }
      // Also check markers for point landmarks
      if (geom?.markers) {
        const clickable = new Set(card.locateOptions);
        for (const m of geom.markers) {
          if (!clickable.has(m.label)) continue;
          const hit = drillMap.L.circleMarker([m.lat, m.lng], {
            radius: 18,
            color: "#8b1a1a",
            weight: 2,
            fillColor: "#8b1a1a",
            fillOpacity: 0.01,
            interactive: true,
          });
          hit._landmarkName = m.label;
          hit.on("click", () => onLocateLandmarkAnswer(card, m.label));
          drillMap.markers.addLayer(hit);
        }
      }
      answers.innerHTML = `<p class="lede geo-lede-tight">Tap the landmark on the map (names hidden).</p>`;
    } else if (card.type === "identify") {
      highlightOnly(drillMap, drillSession.waterways, drillSession.paths, card.waterwayId, {
        showTooltips: false,
        showMarkers: false,
        hideOthers: true,
      });
      answers.innerHTML = choiceButtons(card);
      bindChoices(card);
    } else if (card.type === "capital" || card.type === "capital_rev") {
      const cities = await getCityCoords();
      // Forward capital Q: mark the spot without naming it; reverse already names the city in the prompt
      const revealName = card.type === "capital_rev";
      const focus = focusPlaceForCard(card, drillSession.paths, cities, { revealName });
      drawWaterways(drillMap, [w], drillSession.paths, {
        selectedId: w.id,
        showMarkersFor: false,
        focusPlaces: focus ? [focus] : [],
        fitSelection: true,
        interactive: false,
        showTooltips: true,
        showMarkerLabels: true,
      });
      answers.innerHTML = choiceButtons(card);
      bindChoices(card);
    } else if (card.type === "country") {
      // Blue waterway first; then real country boundary in burgundy on top
      drawWaterways(drillMap, [w], drillSession.paths, {
        selectedId: w.id,
        showMarkersFor: w.id,
        fitSelection: true,
        interactive: false,
        showTooltips: true,
        highlightColor: "#1d4ed8", // noticeable blue for the waterway
      });
      await drawCountryFocus(drillMap, card.answer);
      answers.innerHTML = choiceButtons(card);
      bindChoices(card);
    } else if (card.type === "landmark") {
      // Waterway in blue; landmark in bold red
      drawWaterways(drillMap, [w], drillSession.paths, {
        selectedId: w.id,
        showMarkersFor: w.id,
        fitSelection: true,
        interactive: false,
        showTooltips: true,
        highlightColor: "#1d4ed8",
      });
      drawLandmarkHighlight(drillMap, w, drillSession.paths, card.answer);
      answers.innerHTML = choiceButtons(card);
      bindChoices(card);
    } else if (card.type === "landmark-connection") {
      // Two connected bodies in blue; the canal/strait in bold red
      const [bodyA, bodyB] = card.answer.split(" ↔ ");
      const connected = drillSession.waterways.filter(
        (x) => x.name === bodyA || x.name === bodyB || x.id === w.id
      );
      drawWaterways(drillMap, connected, drillSession.paths, {
        selectedId: w.id,
        showMarkersFor: w.id,
        fitSelection: true,
        interactive: false,
        showTooltips: true,
        highlightColor: "#1d4ed8",
      });
      drawLandmarkHighlight(drillMap, w, drillSession.paths, card.answer.split(" ↔ ")[0]);
      answers.innerHTML = choiceButtons(card);
      bindChoices(card);
    } else if (card.type === "region") {
      // Waterway in blue; sub-country region in dashed burgundy
      drawWaterways(drillMap, [w], drillSession.paths, {
        selectedId: w.id,
        showMarkersFor: w.id,
        fitSelection: true,
        interactive: false,
        showTooltips: true,
        highlightColor: "#1d4ed8",
      });
      await drawProvinceFocus(drillMap, card.answer, w);
      answers.innerHTML = choiceButtons(card);
      bindChoices(card);
    } else {
      // outlet — waterway context
      drawWaterways(drillMap, [w], drillSession.paths, {
        selectedId: w.id,
        showMarkersFor: w.id,
        fitSelection: true,
        interactive: false,
        showTooltips: true,
      });
      answers.innerHTML = choiceButtons(card);
      bindChoices(card);
    }

    drillMap.invalidate();
  }

  function choiceButtons(card) {
    return `
      <div class="choice-list">
        ${(card.choices || [])
          .map(
            (choice, i) => `
          <button type="button" class="choice-btn" data-index="${i}">
            <span class="choice-letter">${String.fromCharCode(65 + i)}</span>
            <span class="choice-text">${escapeHtml(choice)}</span>
          </button>`
          )
          .join("")}
      </div>
    `;
  }

  function bindChoices(card) {
    els.quiz.querySelectorAll(".choice-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        onChoiceAnswer(card, card.choices[Number(btn.dataset.index)]);
      });
    });
  }

  function onLocateAnswer(card, id) {
    const correct = id === card.answer;
    highlightOnly(drillMap, drillSession.waterways, drillSession.paths, card.waterwayId);
    showRating(card, correct, correct ? "Correct." : "Not that one — the highlighted area is the answer.");
  }

  function onLocateLandmarkAnswer(card, landmarkName) {
    const correct = landmarkName === card.answer;
    const w = drillSession.waterways.find((x) => x.id === card.waterwayId);
    // Reveal the correct landmark in red; dim the others
    if (w) {
      drawWaterways(drillMap, [w], drillSession.paths, {
        selectedId: w.id,
        showMarkersFor: w.id,
        fitSelection: true,
        interactive: false,
        showTooltips: true,
        highlightColor: "#1d4ed8",
      });
      drawLandmarkHighlight(drillMap, w, drillSession.paths, card.answer);
    }
    showRating(card, correct, correct ? "Correct." : `Answer: ${card.answer}`);
  }

  async function onChoiceAnswer(card, choice) {
    const correct = choice === card.answer;
    els.quiz.querySelectorAll(".choice-btn").forEach((btn) => {
      btn.disabled = true;
      const value = card.choices[Number(btn.dataset.index)];
      if (value === card.answer) btn.classList.add("is-correct");
      if (value === choice && !correct) btn.classList.add("is-wrong");
    });
    if (card.waterwayId) {
      const w = drillSession.waterways.find((x) => x.id === card.waterwayId);
      if (card.type === "capital" || card.type === "capital_rev") {
        const cities = await getCityCoords();
        const focus = focusPlaceForCard(card, drillSession.paths, cities, {
          revealName: true,
        });
        if (w) {
          drawWaterways(drillMap, [w], drillSession.paths, {
            selectedId: w.id,
            showMarkersFor: false,
            focusPlaces: focus ? [focus] : [],
            fitSelection: true,
            interactive: false,
            showTooltips: true,
          });
        }
      } else {
        highlightOnly(drillMap, drillSession.waterways, drillSession.paths, card.waterwayId);
      }
    }
    const cityNote =
      (card.type === "capital" || card.type === "capital_rev") && card.focusCity
        ? ` · ${card.focusCity} marked on the map`
        : "";
    showRating(
      card,
      correct,
      correct ? `Nice retrieval.${cityNote}` : `Answer: ${card.answer}${cityNote}`
    );
  }

  function showRating(card, wasCorrect, message) {
    drillSession.answered += 1;
    drillSession.reviewed.add(card.id);
    if (wasCorrect) {
      drillSession.correctCount += 1;
      drillSession.streak += 1;
      drillSession.bestStreak = Math.max(drillSession.bestStreak, drillSession.streak);
    } else {
      drillSession.streak = 0;
    }

    const feedback = document.getElementById("geo-drill-feedback");
    feedback.hidden = false;
    feedback.innerHTML = `
      <div class="feedback-banner ${wasCorrect ? "feedback-correct" : "feedback-wrong"}">
        <strong>${wasCorrect ? "Correct" : "Wrong"}</strong>
        <span>${escapeHtml(message)}</span>
      </div>
      <p class="feedback-ask">${
        wasCorrect
          ? "Rate how easy it was — wrong / “Again” cards repeat soon."
          : "This card will repeat in this session until you nail it."
      }</p>
      <div class="geo-rate-row">
        ${RATINGS.map((r) => {
          const isAgain = r.id === "again";
          const defaultPick = !wasCorrect && isAgain;
          const disableIfWrong = !wasCorrect && !isAgain;
          return `
          <button type="button" class="geo-rate-btn ${defaultPick ? "is-suggested" : ""}" data-grade="${r.grade}" ${
            disableIfWrong ? "disabled" : ""
          } title="${r.hint}">
            <strong>${r.label}</strong>
            <span>${r.hint}</span>
          </button>`;
        }).join("")}
      </div>
    `;

    feedback.querySelectorAll(".geo-rate-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        let grade = Number(btn.dataset.grade);
        if (!wasCorrect) grade = 1;
        schedule(card.id, wasCorrect ? grade : 1);
        if (!wasCorrect || grade === 1) {
          drillSession.againCount += 1;
          // Interleave the repeat a few cards later (spacing, not back-to-back)
          const insertAt = Math.min(
            drillSession.queue.length,
            drillSession.index + 2 + Math.floor(Math.random() * 3)
          );
          drillSession.queue.splice(insertAt, 0, card.id);
        }
        drillSession.index += 1;
        renderDrillCard();
      });
    });

    const suggested = feedback.querySelector(".geo-rate-btn.is-suggested");
    suggested?.focus();
  }

  function renderDrillDone() {
    destroyDrillMap();
    const s = drillSession;
    const cards = Object.keys(s.byId);
    const prog = progressSummary(cards);
    const missed = cards.filter((id) => {
      const c = getCard(id);
      return c.lapses > 0 || (c.seen > 0 && c.repetitions === 0);
    });
    const acc = s.answered ? Math.round((s.correctCount / s.answered) * 100) : 0;

    show("quizDone");
    els.subtitle.textContent = `${state.category.name} · Drill complete`;
    els.quizDone.innerHTML = `
      <div class="quiz-done">
        <h2 class="section-title">Session complete</h2>
        <p class="lede">Missed cards got requeued during the session; “Again” ratings keep them coming back until they stick.</p>
        <div class="geo-final-score">
          <div><strong>${acc}%</strong><span>accuracy</span></div>
          <div><strong>${s.bestStreak}</strong><span>best streak</span></div>
          <div><strong>${s.againCount}</strong><span>repeats scheduled</span></div>
        </div>
        <ul class="stats">
          <li><strong>${s.answered}</strong> total answers</li>
          <li><strong>${missed.length}</strong> cards still flagged hard (Again / missed)</li>
          <li><strong>${prog.due}</strong> due now · <strong>${prog.learning}</strong> learning · <strong>${prog.mature}</strong> mature</li>
        </ul>
        <div class="setup-actions">
          <button type="button" class="primary-btn" id="drill-hard-again" ${missed.length ? "" : "disabled"}>
            Drill hard ones again (${missed.length})
          </button>
          <button type="button" class="secondary-btn" id="quiz-again">New session (spaced)</button>
          <button type="button" class="text-btn" id="quiz-to-hub">Back to Geography</button>
        </div>
      </div>
    `;

    document.getElementById("drill-hard-again")?.addEventListener("click", () => {
      if (!missed.length) return;
      startFocusReview(s.continentIds, new Set(missed));
    });

    document.getElementById("quiz-again").addEventListener("click", () => {
      renderDrillSetup(state.category);
      show("quizSetup");
      els.subtitle.textContent = `${state.category.name} · Map drill`;
    });
    document.getElementById("quiz-to-hub").addEventListener("click", () => {
      drillSession = null;
      state.quiz = null;
      ctx.renderHub(state.category);
      show("hub");
      els.subtitle.textContent = state.category.name;
    });
  }

  /** Repeat only cards the learner marked hard / missed. */
  async function startFocusReview(continentIds, hardCardIds) {
    await ensureLeaflet();
    const paths = await getMapPaths();
    const waterways = await loadWaterwaysForContinents(continentIds);
    let cards = buildLearnCards(waterways, state.geoFilters);
    cards = cards.filter((c) => hardCardIds.has(c.id));
    if (!cards.length) {
      renderDrillSetup(state.category);
      show("quizSetup");
      return;
    }
    const byId = Object.fromEntries(cards.map((c) => [c.id, c]));
    const queue = orderQueue(cards.map((c) => c.id)).slice(0, 40);
    drillSession = {
      continentIds,
      waterways,
      paths,
      byId,
      queue,
      index: 0,
      answered: 0,
      correctCount: 0,
      againCount: 0,
      streak: 0,
      bestStreak: 0,
      reviewed: new Set(),
      focusId: null,
    };
    state.quiz = { mode: "geography-map", remaining: queue.length };
    els.subtitle.textContent = `${state.category.name} · Review hard cards`;
    show("quiz");
    await renderDrillCard();
  }

  function cleanup() {
    destroyAtlasMap();
    destroyDrillMap();
  }

  return {
    renderContinents,
    openAtlas,
    renderAtlas,
    renderDrillSetup,
    startDrill,
    cleanup,
    renderHubExtra,
    get drillActive() {
      return Boolean(drillSession && state.view === "quiz" && state.quiz?.mode === "geography-map");
    },
  };
}
