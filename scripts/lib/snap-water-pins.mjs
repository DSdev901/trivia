/** Snap waterway pins onto the Natural Earth geometries the world SVG draws.
 *
 * Rivers use /tmp/ne_50m_rivers.geojson (same file as the overlay).
 * Lakes use /tmp/ne_50m_lakes.geojson.
 * Seas, gulfs, and straits use /tmp/ne_10m_geography_marine_polys.geojson
 * (not drawn as named shapes; pins should sit in the water the coasts enclose).
 *
 *   curl -sL -o /tmp/ne_10m_geography_marine_polys.geojson \
 *     https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@master/geojson/ne_10m_geography_marine_polys.geojson
 */
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { inferWaterType } from "./water-features.mjs";

const require = createRequire(import.meta.url);
const { feature } = require("/tmp/geo-build/node_modules/topojson-client");
const { geoContains, geoCentroid, geoNaturalEarth1 } = require("/tmp/geo-build/node_modules/d3-geo");

function mapProjection() {
  try {
    const topo = JSON.parse(readFileSync("/tmp/countries-50m.json", "utf8"));
    const countries = feature(topo, topo.objects.countries);
    return geoNaturalEarth1().fitExtent(
      [
        [8, 8],
        [992, 512],
      ],
      countries
    );
  } catch {
    return null;
  }
}

const RIVERS = "/tmp/ne_50m_rivers.geojson";
const LAKES = "/tmp/ne_50m_lakes.geojson";
const MARINE = "/tmp/ne_10m_geography_marine_polys.geojson";

const WORLD_OCEANS = new Set([
  "pacific-ocean",
  "atlantic-ocean",
  "indian-ocean",
  "arctic-ocean",
  "southern-ocean",
]);

/** Extra keys so quiz names meet Natural Earth names. */
const ALIASES = {
  aral: ["north aral sea", "south aral sea", "aral sea"],
  "aral sea": ["north aral sea", "south aral sea"],
  eyre: ["eyre north", "eyre south", "lake eyre north", "lake eyre south"],
  "lake eyre": ["eyre north", "eyre south"],
  yangtze: ["chang jiang"],
  "chang jiang": ["yangtze"],
  yellow: ["huang"],
  huang: ["yellow"],
  amazon: ["amazonas"],
  amazonas: ["amazon"],
  tagus: ["tejo"],
  tejo: ["tagus"],
  dnipro: ["dnieper"],
  dnieper: ["dnipro"],
  irtysh: ["ertix"],
  ertix: ["irtysh"],
  irrawaddy: ["irrawaddy delta"],
  "irrawaddy delta": ["irrawaddy"],
  "red vn": ["hong", "red"],
  pearl: ["xi"],
  "amu darya": ["amu darya"],
  "shatt arab": ["shatt al arab"],
  "shatt al arab": ["shatt arab"],
  "sao francisco": ["sao francisco"],
  "tonle sap": ["tonle sap", "tonle sap lake"],
  "sea japan": ["east sea"],
  "persian gulf": ["arabian gulf"],
  "gulf california": ["golfo de california", "sea of cortez"],
  "gulf aqaba": ["gulf of eilat"],
  "gulf sidra": ["gulf of sirte"],
  "bight biafra": ["bight of bonny"],
  "gulf khambhat": ["gulf of cambay"],
  "bab el mandeb": ["bab el mandeb", "mandeb"],
  "rio plata": ["rio de la plata"],
  "rio de la plata": ["rio plata"],
  magellan: ["strait of magellan", "estrecho de magellanes"],
  "gulf st lawrence": ["gulf of saint lawrence", "gulf of st lawrence"],
  "st lawrence": ["st lawrence", "saint lawrence"],
  "gulf mexico": ["gulf of mexico"],
  "gulf guinea": ["gulf of guinea"],
  "bay bengal": ["bay of bengal"],
  "south china sea": ["south china sea"],
  "east china sea": ["east china sea"],
  "yellow sea": ["yellow sea"],
  bohai: ["bo hai", "bohai sea"],
  "sea azov": ["sea of azov"],
  okhotsk: ["sea of okhotsk"],
  "sea japan": ["sea of japan", "east sea"],
  gibraltar: ["strait of gibraltar"],
  malacca: ["strait of malacca"],
  hormuz: ["strait of hormuz"],
  "bering strait": ["bering strait"],
  "english channel": ["english channel"],
  "taiwan strait": ["taiwan strait"],
  "korea strait": ["korea strait"],
  tsugaru: ["tsugaru strait"],
  palk: ["palk strait"],
  torres: ["torres strait"],
  bass: ["bass strait"],
  cook: ["cook strait"],
  dover: ["strait of dover"],
  bosporus: ["bosporus", "bosphorus"],
  dardanelles: ["dardanelles"],
  "gulf lions": ["gulf of lion", "golfe du lion"],
  "gulf tonkin": ["gulf of tonkin"],
  "gulf thailand": ["gulf of thailand"],
  "gulf aden": ["gulf of aden"],
  "gulf oman": ["gulf of oman"],
  "gulf bothnia": ["gulf of bothnia"],
  "gulf finland": ["gulf of finland"],
  "gulf alaska": ["gulf of alaska"],
  "gulf honduras": ["gulf of honduras"],
  "gulf panama": ["gulf of panama"],
  "gulf venezuela": ["gulf of venezuela"],
  "gulf guayaquil": ["golfo de guayaquil", "gulf of guayaquil"],
  "gulf mannar": ["gulf of mannar"],
  "gulf gabes": ["gulf of gabes"],
  "gulf carpentaria": ["gulf of carpentaria"],
  bight: ["great australian bight"],
  "mozambique channel": ["mozambique channel"],
  "drake passage": ["drake passage"],
  fundy: ["bay of fundy"],
  "yucatan channel": ["yucatan channel"],
  "white sea": ["white sea"],
  "beaufort": ["beaufort sea"],
  "baffin bay": ["baffin bay"],
  "davis strait": ["davis strait"],
  "philippine sea": ["philippine sea"],
  "java sea": ["java sea"],
  "andaman": ["andaman sea"],
  "coral sea": ["coral sea"],
  "tasman sea": ["tasman sea"],
  "solomon sea": ["solomon sea"],
  "bismarck sea": ["bismarck sea"],
  "irish sea": ["irish sea"],
  "norwegian sea": ["norwegian sea"],
  "north sea": ["north sea"],
  "black sea": ["black sea"],
  "baltic": ["baltic sea"],
  "adriatic": ["adriatic sea"],
  "aegean": ["aegean sea"],
  "tyrrhenian": ["tyrrhenian sea"],
  "ionian": ["ionian sea"],
  "caribbean sea": ["caribbean sea"],
  "red sea": ["red sea"],
  "arabian sea": ["arabian sea"],
  "hudson bay": ["hudson bay"],
  "long island sound": ["long island sound"],
  "shark bay": ["shark bay"],
  "caspian": ["caspian sea"],
  "dead sea": ["dead sea"],
  hulun: ["hulun nuur", "hulun nur"],
  "great salt": ["great salt"],
  "great bear": ["great bear"],
  "great slave": ["great slave"],
  woods: ["woods"],
  "tonle sap": ["tonle sap"],
  victoria: ["victoria", "nyanza"],
  malawi: ["malawi", "nyasa"],
  nicaragua: ["nicaragua"],
  titicaca: ["titicaca"],
  enriquillo: ["enriquillo"],
  gatun: ["gatun"],
  toba: ["toba"],
  volta: ["volta"],
  nasser: ["nasser"],
};

const logs = [];

function foldName(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\bsaint\b/g, "st")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripType(s) {
  return foldName(s)
    .replace(/^(the|lago|lago de|danau|lake)\s+/g, "")
    .replace(/\s+(river|rivers|lake|lakes)$/g, "")
    .trim();
}

function addKey(set, raw) {
  const folded = foldName(raw);
  const stripped = stripType(raw);
  if (folded) set.add(folded);
  if (stripped) set.add(stripped);
  if (folded.startsWith("strait of ")) set.add(folded.slice(10));
  if (folded.startsWith("gulf of ")) set.add(folded.slice(8));
  if (folded.startsWith("bay of ")) set.add(folded.slice(7));
  if (folded.startsWith("sea of ")) set.add(folded.slice(7));
  if (folded.startsWith("bight of ")) set.add(folded.slice(9));
  if (/\ssea$/.test(folded)) set.add(folded.replace(/\ssea$/, "").trim());
  if (/\sgulf$/.test(folded)) set.add(folded.replace(/\sgulf$/, "").trim());
  if (/\sstrait$/.test(folded)) set.add(folded.replace(/\sstrait$/, "").trim());
  if (/\schannel$/.test(folded)) set.add(folded.replace(/\schannel$/, "").trim());
  if (/\sbay$/.test(folded)) set.add(folded.replace(/\sbay$/, "").trim());
}

function expandKeys(rawKeys) {
  const out = new Set();
  for (const key of rawKeys) {
    if (!key) continue;
    out.add(key);
    for (const extra of ALIASES[key] || []) out.add(foldName(extra));
  }
  return [...out].filter(Boolean);
}

function itemKeys(item) {
  const raw = new Set();
  addKey(raw, item.id?.replace(/-/g, " "));
  addKey(raw, item.name);
  addKey(raw, item.waterway);
  return expandKeys(raw);
}

function featureKeys(props) {
  const raw = new Set();
  for (const field of ["name", "name_en", "label", "name_alt", "namealt"]) {
    const val = props?.[field];
    if (!val) continue;
    for (const part of String(val).split("|")) addKey(raw, part);
  }
  return [...raw].filter(Boolean);
}

function loadFc(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function geomLines(geom) {
  if (!geom) return [];
  if (geom.type === "LineString") return [geom.coordinates];
  if (geom.type === "MultiLineString") return geom.coordinates;
  if (geom.type === "GeometryCollection") {
    return (geom.geometries || []).flatMap(geomLines);
  }
  return [];
}

function geomRings(geom) {
  if (!geom) return [];
  if (geom.type === "Polygon") return geom.coordinates || [];
  if (geom.type === "MultiPolygon") return (geom.coordinates || []).flat();
  if (geom.type === "GeometryCollection") {
    return (geom.geometries || []).flatMap(geomRings);
  }
  return [];
}

function distKm(a, b) {
  const lat = ((a[1] + b[1]) / 2) * (Math.PI / 180);
  const dx = (b[0] - a[0]) * Math.cos(lat) * 111;
  const dy = (b[1] - a[1]) * 111;
  return Math.hypot(dx, dy);
}

function closestOnSegXY(p, a, b) {
  const vx = b[0] - a[0];
  const vy = b[1] - a[1];
  const c2 = vx * vx + vy * vy;
  const t = c2 <= 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / c2));
  return [a[0] + t * vx, a[1] + t * vy];
}

function closestOnLinesXY(pt, lines) {
  let best = null;
  let bestD = Infinity;
  for (const line of lines) {
    if (!line || line.length < 2) continue;
    for (let i = 0; i < line.length - 1; i += 1) {
      const a = line[i];
      const b = line[i + 1];
      if (!a || !b || a.length < 2 || b.length < 2) continue;
      const q = closestOnSegXY(pt, a, b);
      const d = Math.hypot(pt[0] - q[0], pt[1] - q[1]);
      if (d < bestD) {
        bestD = d;
        best = q;
      }
    }
  }
  return best ? { pt: best, d: bestD } : null;
}

function closestOnSeg(p, a, b) {
  const lat = ((p[1] + a[1] + b[1]) / 3) * (Math.PI / 180);
  const kx = Math.cos(lat) * 111;
  const ky = 111;
  const px = p[0] * kx;
  const py = p[1] * ky;
  const ax = a[0] * kx;
  const ay = a[1] * ky;
  const bx = b[0] * kx;
  const by = b[1] * ky;
  const vx = bx - ax;
  const vy = by - ay;
  const c2 = vx * vx + vy * vy;
  const t = c2 <= 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / c2));
  return [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
}

function closestOnLines(pt, lines) {
  let best = null;
  let bestD = Infinity;
  for (const line of lines) {
    if (!line || line.length < 2) continue;
    for (let i = 0; i < line.length - 1; i += 1) {
      const a = line[i];
      const b = line[i + 1];
      if (!a || !b || a.length < 2 || b.length < 2) continue;
      const q = closestOnSeg(pt, a, b);
      const d = distKm(pt, q);
      if (d < bestD) {
        bestD = d;
        best = q;
      }
    }
  }
  return best ? { pt: best, km: bestD } : null;
}

function closestOnRings(pt, rings) {
  return closestOnLines(pt, rings);
}

function indexByName(features, pick) {
  const map = new Map();
  for (const f of features) {
    const rec = pick(f);
    if (!rec) continue;
    for (const key of featureKeys(f.properties)) {
      let bucket = map.get(key);
      if (!bucket) {
        bucket = [];
        map.set(key, bucket);
      }
      bucket.push(rec);
    }
  }
  return map;
}

function lookup(index, keys) {
  let bestLen = 0;
  const seen = new Set();
  const out = [];
  for (const key of keys) {
    const hits = index.get(key) || [];
    if (!hits.length) continue;
    if (key.length < bestLen) continue;
    if (key.length > bestLen) {
      bestLen = key.length;
      seen.clear();
      out.length = 0;
    }
    for (const rec of hits) {
      if (seen.has(rec)) continue;
      seen.add(rec);
      out.push(rec);
    }
  }
  const specific = keys.some(
    (k) => k.length >= 10 && !/\s+(river|rivers|lake|lakes)$/.test(k)
  );
  if (specific && bestLen <= 6) return [];
  return out;
}

const MAX_RIVER_KM = 750;
const MAX_POLY_KM = 420;

function loadLand() {
  try {
    const topo = JSON.parse(readFileSync("/tmp/countries-50m.json", "utf8"));
    return feature(topo, topo.objects.countries);
  } catch {
    return null;
  }
}

function onLand(pt, land) {
  if (!land?.features) return false;
  return land.features.some((f) => geoContains(f, pt));
}

function loadIndexes() {
  const riversFc = loadFc(RIVERS);
  const lakesFc = loadFc(LAKES);
  const marineFc = loadFc(MARINE);
  const riverIndex = indexByName(riversFc?.features || [], (f) => {
    if ((f.properties?.featurecla || "") === "Lake Centerline") return null;
    const lines = geomLines(f.geometry);
    return lines.length ? { kind: "line", lines, name: f.properties?.name || "" } : null;
  });
  const lakeIndex = indexByName(lakesFc?.features || [], (f) => {
    const rings = geomRings(f.geometry);
    return rings.length
      ? { kind: "poly", feature: f, rings, name: f.properties?.name || f.properties?.name_en || "" }
      : null;
  });
  const marineIndex = indexByName(marineFc?.features || [], (f) => {
    const cla = f.properties?.featurecla || "";
    if (cla === "ocean") return null;
    const rings = geomRings(f.geometry);
    return rings.length
      ? { kind: "poly", feature: f, rings, name: f.properties?.name_en || f.properties?.name || "" }
      : null;
  });
  return {
    riverIndex,
    lakeIndex,
    marineIndex,
    haveRivers: Boolean(riversFc),
    haveLakes: Boolean(lakesFc),
    haveMarine: Boolean(marineFc),
    land: loadLand(),
    projection: mapProjection(),
  };
}

let cached = null;
function indexes() {
  if (!cached) cached = loadIndexes();
  return cached;
}

function snapToLines(pt, recs, projection) {
  const lines = recs.flatMap((r) => r.lines);
  const geo = closestOnLines(pt, lines);
  if (!geo) return null;
  if (!projection) return geo;
  const seed = projection(pt);
  if (!seed || !Number.isFinite(seed[0])) return geo;
  const projected = [];
  for (const line of lines) {
    let row = [];
    for (const c of line) {
      const xy = c && projection(c);
      if (!xy || !Number.isFinite(xy[0])) {
        if (row.length >= 2) projected.push(row);
        row = [];
        continue;
      }
      row.push(xy);
    }
    if (row.length >= 2) projected.push(row);
  }
  const hit = closestOnLinesXY(seed, projected);
  if (!hit) return geo;
  const inv = projection.invert(hit.pt);
  if (!inv || !Number.isFinite(inv[0])) return { ...geo, xy: hit.pt };
  return { pt: inv, km: geo.km, xy: hit.pt };
}

function snapIntoPolys(pt, recs) {
  for (const rec of recs) {
    if (geoContains(rec.feature, pt)) return { pt, km: 0, inside: true, name: rec.name };
  }
  let best = null;
  let bestRec = null;
  for (const rec of recs) {
    const hit = closestOnRings(pt, rec.rings);
    if (hit && (!best || hit.km < best.km)) {
      best = hit;
      bestRec = rec;
    }
  }
  if (!best || !bestRec) return null;
  const centroid = geoCentroid(bestRec.feature);
  if (centroid && geoContains(bestRec.feature, centroid)) {
    for (const t of [0.12, 0.25, 0.4, 0.6, 1]) {
      const q = [
        best.pt[0] + t * (centroid[0] - best.pt[0]),
        best.pt[1] + t * (centroid[1] - best.pt[1]),
      ];
      if (geoContains(bestRec.feature, q)) {
        return { pt: q, km: distKm(pt, q), inside: false, name: bestRec.name };
      }
    }
    return { pt: centroid, km: distKm(pt, centroid), inside: false, name: bestRec.name };
  }
  return { pt: best.pt, km: best.km, inside: false, name: bestRec.name };
}

function isWorldOcean(item) {
  if (WORLD_OCEANS.has(item.id)) return true;
  return /^(pacific|atlantic|indian|arctic|southern) ocean$/.test(foldName(item.name));
}

function record(item, hit, via) {
  if (!hit?.pt) return null;
  const lat = Math.round(hit.pt[1] * 1000) / 1000;
  const lon = Math.round(hit.pt[0] * 1000) / 1000;
  const x = Array.isArray(hit.xy) ? Math.round(hit.xy[0] * 10) / 10 : null;
  const y = Array.isArray(hit.xy) ? Math.round(hit.xy[1] * 10) / 10 : null;
  logs.push({
    id: item.id,
    name: item.name,
    via,
    target: hit.name || "",
    km: Math.round(hit.km * 10) / 10,
    from: [item.lat, item.lon],
    to: [lat, lon],
  });
  const same =
    Math.abs(lat - item.lat) < 1e-3 &&
    Math.abs(lon - item.lon) < 1e-3 &&
    x == null;
  if (same) return null;
  const out = { lat, lon, km: hit.km, via };
  if (x != null && y != null) {
    out.x = x;
    out.y = y;
  }
  return out;
}

/** Move a water pin onto its named river line, lake, or marine polygon. */
export function snapWaterItem(item) {
  if (!item || item.kind !== "water") return null;
  if (!Number.isFinite(item.lat) || !Number.isFinite(item.lon)) return null;
  if (isWorldOcean(item)) return null;
  const type = item.waterType || inferWaterType(item.name);
  const keys = itemKeys(item);
  const pt = [item.lon, item.lat];
  const db = indexes();

  if (type === "river" || item.waterway) {
    const recs = lookup(db.riverIndex, keys);
    const hit = recs.length ? snapToLines(pt, recs, db.projection) : null;
    if (hit && hit.km <= MAX_RIVER_KM) {
      return record(item, { ...hit, name: recs[0].name }, "river");
    }
    if (/plata|estuary/i.test(item.name)) {
      const marine = lookup(db.marineIndex, keys);
      const poly = marine.length ? snapIntoPolys(pt, marine) : null;
      if (poly && poly.km <= MAX_POLY_KM) return record(item, poly, "marine");
    }
    return null;
  }
  if (type === "lake") {
    const recs = lookup(db.lakeIndex, keys);
    const hit = recs.length ? snapIntoPolys(pt, recs) : null;
    if (hit && (hit.inside || hit.km <= MAX_POLY_KM)) return record(item, hit, "lake");
    const marine = lookup(db.marineIndex, keys);
    const sea = marine.length ? snapIntoPolys(pt, marine) : null;
    if (sea && (sea.inside || sea.km <= MAX_POLY_KM)) return record(item, sea, "marine");
    return null;
  }
  const marine = lookup(db.marineIndex, keys);
  const sea = marine.length ? snapIntoPolys(pt, marine) : null;
  if (sea) {
    if (sea.inside) return record(item, sea, "marine");
    if (onLand(pt, db.land) && sea.km <= MAX_POLY_KM) return record(item, sea, "marine");
  }
  const lakes = lookup(db.lakeIndex, keys);
  const lake = lakes.length ? snapIntoPolys(pt, lakes) : null;
  if (lake && (lake.inside || lake.km <= MAX_POLY_KM)) return record(item, lake, "lake");
  return null;
}

export function reportWaterSnaps() {
  const db = indexes();
  if (!db.haveRivers) console.warn("  [snap] missing /tmp/ne_50m_rivers.geojson");
  if (!db.haveLakes) console.warn("  [snap] missing /tmp/ne_50m_lakes.geojson");
  if (!db.haveMarine) console.warn("  [snap] missing /tmp/ne_10m_geography_marine_polys.geojson");
  const byId = new Map();
  for (const row of logs) {
    const prev = byId.get(row.id);
    if (!prev || row.km > prev.km) byId.set(row.id, row);
  }
  const rows = [...byId.values()].sort((a, b) => b.km - a.km);
  const moved = rows.filter((r) => r.km >= 25);
  console.log(
    `  [snap] ${rows.length} named water pins aligned (${moved.length} moved ≥25 km)`
  );
  for (const row of moved.slice(0, 24)) {
    console.log(`  [snap] ${row.id} ${row.km} km → ${row.via} ${row.target || ""}`.trim());
  }
}
