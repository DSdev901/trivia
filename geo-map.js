/** Leaflet map helpers for geography atlas & drill. */

let leafletReady = null;

export function ensureLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (leafletReady) return leafletReady;

  leafletReady = new Promise((resolve, reject) => {
    const cssId = "leaflet-css";
    if (!document.getElementById(cssId)) {
      const link = document.createElement("link");
      link.id = cssId;
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      link.integrity = "sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=";
      link.crossOrigin = "";
      document.head.appendChild(link);
    }
    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.integrity = "sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=";
    script.crossOrigin = "";
    script.onload = () => resolve(window.L);
    script.onerror = () => reject(new Error("Could not load map library (Leaflet). Check your network."));
    document.head.appendChild(script);
  });
  return leafletReady;
}

const KIND_COLOR = {
  river: "#0b5f4b",
  lake: "#1a6f8c",
  sea: "#1a6f8c",
  ocean: "#164e63",
  gulf: "#1a6f8c",
  bay: "#1a6f8c",
  channel: "#0b5f4b",
  strait: "#0b5f4b",
  passage: "#0b5f4b",
  canal: "#b8860b",
  estuary: "#1a6f8c",
};

const HIGHLIGHT = "#c49212";
const LANDMARK_RED = "#8b1a1a";

/** Seas, lakes, gulfs, etc. — paint the water body, not a shore stroke. */
function isAreaKind(kind) {
  return ["lake", "sea", "ocean", "gulf", "bay", "channel", "strait", "passage", "estuary"].includes(
    kind
  );
}

function usesAreaShape(waterway, geom) {
  if (geom?.shape === "area" || geom?.area?.length >= 3) return true;
  return isAreaKind(waterway.kind);
}

function latLngsForFeature(waterway, geom) {
  const ring = geom?.area?.length >= 3 ? geom.area : geom?.path;
  return (ring || []).map(([lat, lng]) => [lat, lng]);
}

/** Idle tint — soft body fill for seas; band for rivers. */
export function styleForKind(kind, { active = false, dim = false, area = false } = {}) {
  const color = active ? HIGHLIGHT : KIND_COLOR[kind] || KIND_COLOR.river;
  if (area || isAreaKind(kind)) {
    return {
      color,
      weight: active ? 2 : 1,
      opacity: dim ? 0.1 : active ? 0.95 : 0.45,
      fillColor: color,
      fillOpacity: dim ? 0.03 : active ? 0.58 : 0.28,
    };
  }
  // Rivers / canals: wide soft band along the course
  return {
    color,
    weight: active ? 16 : 8,
    opacity: dim ? 0.1 : active ? 0.92 : 0.45,
    lineCap: "round",
    lineJoin: "round",
  };
}

export function createGeoMap(container, { center = [20, 0], zoom = 2 } = {}) {
  const L = window.L;
  const map = L.map(container, {
    zoomControl: true,
    attributionControl: true,
    worldCopyJump: true,
  }).setView(center, zoom);

  L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: "abcd",
    maxZoom: 18,
  }).addTo(map);

  const layers = L.layerGroup().addTo(map);
  const markers = L.layerGroup().addTo(map);

  return {
    map,
    layers,
    markers,
    L,
    destroy() {
      map.remove();
    },
    invalidate() {
      setTimeout(() => map.invalidateSize(), 40);
    },
  };
}

let neCountries = null;

export async function ensureCountryBoundaries() {
  if (neCountries) return neCountries;
  const res = await fetch("data/geography/ne-countries-simplified.geojson");
  if (!res.ok) throw new Error("Could not load country boundaries");
  neCountries = await res.json();
  return neCountries;
}

let neProvinces = null;

export async function ensureProvinceBoundaries() {
  if (neProvinces) return neProvinces;
  const res = await fetch("data/geography/ne-provinces-simplified.geojson");
  if (!res.ok) throw new Error("Could not load province boundaries");
  neProvinces = await res.json();
  return neProvinces;
}

/** Find Natural Earth province feature for a region display name. */
export function findProvinceFeature(collection, displayName, countryName) {
  const want = normName(displayName);
  const props = ["name", "name_en", "name_local", "postal", "hasc"];
  for (const f of collection.features || []) {
    for (const p of props) {
      const v = normName(f.properties?.[p]);
      if (v === want) return f;
    }
  }
  // Fallback: try partial match within the target country
  if (countryName) {
    const countryWant = normName(countryName);
    for (const f of collection.features || []) {
      const admin = normName(f.properties?.admin);
      if (admin !== countryWant) continue;
      for (const p of props) {
        const v = normName(f.properties?.[p]);
        if (v.includes(want) || want.includes(v)) return f;
      }
    }
  }
  return null;
}

/** Draw province/state boundary. */
export function drawProvinceBoundary(geoMap, feature, { color = "#5c1a24", fillOpacity = 0.62 } = {}) {
  if (!feature) return null;
  const { L, layers } = geoMap;
  const layer = L.geoJSON(feature, {
    style: {
      color,
      weight: 2,
      opacity: 1,
      fillColor: color,
      fillOpacity,
      dashArray: "6 4",
    },
  });
  layers.addLayer(layer);
  return layer;
}

function normName(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/\s*\(.*?\)\s*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Find Natural Earth feature for a country display name. */
export function findCountryFeature(collection, displayName, nameMap = {}) {
  const want = normName(nameMap[displayName] || displayName);
  const props = ["NAME", "NAME_LONG", "SOVEREIGNT", "ADMIN", "BRK_NAME", "NAME_SORT", "FORMAL_EN", "NAME_EN"];
  for (const f of collection.features || []) {
    for (const p of props) {
      const v = normName(f.properties?.[p]);
      if (v === want) return f;
    }
  }
  return null;
}

/** Draw real country boundary (Leaflet GeoJSON), not a hand-drawn polygon. */
export function drawCountryBoundary(geoMap, feature, { color = "#5c1a24", fillOpacity = 0.88 } = {}) {
  if (!feature) return null;
  const { L, layers } = geoMap;
  const layer = L.geoJSON(feature, {
    style: {
      color,
      weight: 1.5,
      opacity: 1,
      fillColor: color,
      fillOpacity,
    },
  });
  layers.addLayer(layer);
  return layer;
}

/** Legacy: still accepts a manual ring (used as fallback). */
export function drawRegionFocus(geoMap, ring, { color = "#6b1f2a", opacity = 0.88 } = {}) {
  if (!ring?.length) return null;
  const { L, layers } = geoMap;
  const latlngs = ring.map(([lat, lng]) => [lat, lng]);
  const poly = L.polygon(latlngs, {
    color,
    weight: 2,
    opacity: 1,
    fillColor: color,
    fillOpacity: opacity,
    interactive: false,
  });
  layers.addLayer(poly);
  return poly;
}

export function fitContinent(geoMap, continentMeta) {
  if (!continentMeta) return;
  const { map, L } = geoMap;
  if (continentMeta.bounds) {
    map.fitBounds(L.latLngBounds(continentMeta.bounds), { padding: [28, 28], maxZoom: 6 });
  } else {
    map.setView(continentMeta.center || [20, 0], continentMeta.zoom || 3);
  }
}

export function clearMapContent(geoMap) {
  geoMap.layers.clearLayers();
  geoMap.markers.clearLayers();
}

/**
 * Draw waterways as bold filled highlights (bands / water bodies),
 * not thin stroke lines over the basemap.
 */
export function drawWaterways(geoMap, waterways, mapPaths, options = {}) {
  const { map, L } = geoMap;
  clearMapContent(geoMap);
  const {
    selectedId = null,
    interactive = true,
    onSelect = null,
    showMarkersFor = null,
    dimOthers = true,
    clickableIds = null,
  } = options;

  const boundsPts = [];

  for (const w of waterways) {
    const geom = mapPaths.waterways?.[w.id];
    if (!geom?.path?.length) continue;
    if (options.onlyIds && !options.onlyIds.has(w.id)) continue;

    const isSelected = w.id === selectedId;
    const isClickTarget = !clickableIds || clickableIds.has(w.id);
    const dim = dimOthers && selectedId && !isSelected;
    const asArea = usesAreaShape(w, geom);
    const latlngs = latLngsForFeature(w, geom);
    if (latlngs.length < 2) continue;
    latlngs.forEach((p) => boundsPts.push(p));

    const hitLayer = addBoldWaterway(geoMap, w, latlngs, {
      active: isSelected,
      dim,
      asArea,
      highlightColor: options.highlightColor || null,
    });

    hitLayer._waterwayId = w.id;
    if (interactive && isClickTarget) {
      hitLayer.on("click", (e) => {
        L.DomEvent.stopPropagation(e);
        onSelect?.(w.id);
      });
      // Hover brighten only for idle features (selected already has its own glow)
      if (!isSelected) {
        const idle = styleForKind(w.kind, { active: false, dim, area: asArea });
        hitLayer.on("mouseover", () => {
          if (dim) return;
          hitLayer.setStyle({
            ...idle,
            opacity: Math.min(1, (idle.opacity || 0.45) + 0.25),
            weight: asArea ? (idle.weight || 1) + 1 : (idle.weight || 8) + 4,
            fillOpacity: Math.min(0.75, (idle.fillOpacity || 0.28) + 0.2),
          });
        });
        hitLayer.on("mouseout", () => {
          hitLayer.setStyle(idle);
        });
      }
    }
    if (options.showTooltips !== false) {
      hitLayer.bindTooltip(w.name, {
        sticky: true,
        opacity: selectedId && !isSelected ? 0.35 : 0.95,
        className: "geo-map-tooltip",
      });
    }

    if (showMarkersFor === w.id || (isSelected && showMarkersFor !== false)) {
      for (const m of geom.markers || []) {
        addPlaceMarker(geoMap, m, {
          emphasized: isSelected && (m.role === "outlet" || m.role === "landmark"),
          showLabel: options.showMarkerLabels !== false,
          boundsPts,
        });
      }
    }
  }

  // Extra focus places (e.g. capital for the current question)
  for (const m of options.focusPlaces || []) {
    addPlaceMarker(geoMap, m, {
      emphasized: true,
      showLabel: m.showLabel !== false && options.showMarkerLabels !== false,
      permanentLabel: Boolean(m.permanentLabel),
      boundsPts,
    });
  }

  const fitPts = [...boundsPts];
  if (options.fitSelection && selectedId) {
    const geom = mapPaths.waterways?.[selectedId];
    const ring = geom?.area || geom?.path;
    if (ring?.length) fitPts.push(...ring);
  }
  if ((options.fitSelection || options.fitAll) && fitPts.length) {
    map.fitBounds(L.latLngBounds(fitPts), {
      padding: [48, 48],
      maxZoom: options.fitSelection ? 7 : 6,
    });
  }
}

/**
 * Paint a feature as the water body itself:
 * filled basin for seas/lakes/gulfs; bold band for rivers.
 */
function addBoldWaterway(geoMap, waterway, latlngs, { active, dim, asArea, highlightColor = null }) {
  const { layers, L } = geoMap;
  const kind = waterway.kind || "river";
  const color = highlightColor || (active ? HIGHLIGHT : KIND_COLOR[kind] || KIND_COLOR.river);
  const closed = asArea && latlngs.length >= 3;

  if (closed) {
    if (active && !dim) {
      // Outer wash so the sea/lake surface glows as one region
      layers.addLayer(
        L.polygon(latlngs, {
          color,
          weight: 0,
          fillColor: color,
          fillOpacity: 0.22,
          interactive: false,
        })
      );
    }
    const body = L.polygon(latlngs, styleForKind(kind, { active, dim, area: true }));
    layers.addLayer(body);
    return body;
  }

  // Rivers / canals: wide translucent band along the course
  if (active && !dim) {
    layers.addLayer(
      L.polyline(latlngs, {
        color,
        weight: 28,
        opacity: 0.24,
        lineCap: "round",
        lineJoin: "round",
        interactive: false,
      })
    );
    layers.addLayer(
      L.polyline(latlngs, {
        color,
        weight: 16,
        opacity: 0.88,
        lineCap: "round",
        lineJoin: "round",
        interactive: false,
      })
    );
    const core = L.polyline(latlngs, {
      color: highlightColor ? "#ffffff" : "#fff6d6",
      weight: 4,
      opacity: 0.9,
      lineCap: "round",
      lineJoin: "round",
      interactive: true,
    });
    const hit = L.polyline(latlngs, {
      color,
      weight: 22,
      opacity: 0.01,
      lineCap: "round",
      lineJoin: "round",
      interactive: true,
    });
    layers.addLayer(core);
    layers.addLayer(hit);
    return hit;
  }

  const band = L.polyline(latlngs, styleForKind(kind, { active, dim, area: false }));
  layers.addLayer(band);
  return band;
}

function addPlaceMarker(geoMap, place, { emphasized, showLabel, permanentLabel, boundsPts }) {
  const { markers, L } = geoMap;
  const lat = place.lat;
  const lng = place.lng;
  if (lat == null || lng == null) return;

  const role = place.role || "place";
  const baseColor =
    role === "outlet" ? "#b8860b" : role === "capital" ? "#0b5f4b" : "#3d4a5c";
  const color = emphasized ? HIGHLIGHT : baseColor;

  if (emphasized) {
    // Bold landmark halo — reads as “this place”, not a pin line
    const haloColor = role === "landmark" ? LANDMARK_RED : color;
    markers.addLayer(
      L.circleMarker([lat, lng], {
        radius: 22,
        color: haloColor,
        weight: 0,
        fillColor: haloColor,
        fillOpacity: 0.28,
        interactive: false,
      })
    );
    markers.addLayer(
      L.circleMarker([lat, lng], {
        radius: 12,
        color: haloColor,
        weight: 3,
        fillColor: haloColor,
        fillOpacity: 0.55,
        interactive: false,
      })
    );
  }

  const marker = L.circleMarker([lat, lng], {
    radius: emphasized ? 7 : role === "outlet" ? 6 : 5,
    color,
    weight: emphasized ? 2 : 2,
    fillColor: emphasized ? "#fff8e7" : "#fff",
    fillOpacity: 0.98,
  });

  const label = place.label || "";
  if (showLabel && label) {
    const text = `${label}${role && role !== "place" ? ` · ${role}` : ""}`;
    marker.bindTooltip(text, {
      direction: "top",
      permanent: Boolean(permanentLabel || emphasized),
      className: emphasized ? "geo-map-tooltip geo-map-tooltip-focus" : "geo-map-tooltip",
    });
    if (permanentLabel || emphasized) marker.openTooltip();
  }

  markers.addLayer(marker);
  boundsPts.push([lat, lng]);
}

/** Resolve a city name to lat/lng from map markers or city-coords table. */
export function resolveCityCoords(city, waterwayId, mapPaths, cityCoords) {
  if (!city) return null;
  const needle = city.toLowerCase();
  const geom = mapPaths.waterways?.[waterwayId];
  for (const m of geom?.markers || []) {
    if ((m.label || "").toLowerCase() === needle) {
      return { lat: m.lat, lng: m.lng, label: m.label, role: m.role || "capital" };
    }
    if ((m.label || "").toLowerCase().includes(needle.split(",")[0])) {
      return { lat: m.lat, lng: m.lng, label: city, role: "capital" };
    }
  }
  const pair = cityCoords?.[city] || cityCoords?.[city.split(",")[0].trim()];
  if (pair) {
    return { lat: pair[0], lng: pair[1], label: city, role: "capital" };
  }
  return null;
}

export function highlightOnly(geoMap, waterways, mapPaths, waterwayId, options = {}) {
  drawWaterways(geoMap, waterways, mapPaths, {
    selectedId: waterwayId,
    dimOthers: true,
    showMarkersFor: options.showMarkers === false ? false : waterwayId,
    fitSelection: true,
    interactive: false,
    showTooltips: options.showTooltips !== false,
    // Spotlight: only the bold feature — no competing thin overlays
    onlyIds: options.hideOthers === false ? undefined : new Set([waterwayId]),
    focusPlaces: options.focusPlaces || [],
  });
}

/**
 * Highlight a landmark by name on the map.
 * Looks in the waterway's mapPaths for a matching feature (path) or marker (point).
 * If a path is found, draws it as a bold red band with a draw-in animation;
 * if only a point, draws a red halo with a pulse.
 */
export function drawLandmarkHighlight(geoMap, waterway, mapPaths, landmarkName, options = {}) {
  const { L, layers, markers } = geoMap;
  const geom = mapPaths.waterways?.[waterway.id];
  if (!geom) return null;

  const color = options.color || LANDMARK_RED;
  const want = landmarkName.toLowerCase();

  // Try a linear feature first (canal, strait, etc.)
  const feature = (geom.features || []).find(
    (f) => f.name.toLowerCase() === want || f.name.toLowerCase().includes(want)
  );
  if (feature?.path?.length) {
    const latlngs = feature.path.map(([lat, lng]) => [lat, lng]);

    // Animated draw-in: stroke-dashoffset trick
    const halo = L.polyline(latlngs, {
      color,
      weight: 26,
      opacity: 0.22,
      lineCap: "round",
      lineJoin: "round",
      interactive: false,
      dashArray: "8 6",
      className: "geo-landmark-halo",
    });
    const band = L.polyline(latlngs, {
      color,
      weight: 14,
      opacity: 0.88,
      lineCap: "round",
      lineJoin: "round",
      interactive: false,
      dashArray: "6 4",
      className: "geo-landmark-band",
    });
    const core = L.polyline(latlngs, {
      color: "#ffffff",
      weight: 4,
      opacity: 0.9,
      lineCap: "round",
      lineJoin: "round",
      interactive: false,
      className: "geo-landmark-core",
    });
    layers.addLayer(halo);
    layers.addLayer(band);
    layers.addLayer(core);

    // Trigger CSS draw animation by toggling a class after insert
    requestAnimationFrame(() => {
      [halo, band, core].forEach((layer) => {
        const el = layer.getElement();
        if (el) el.classList.add("geo-landmark-drawn");
      });
    });

    return band;
  }

  // Fall back to a point marker (waterfall, city, etc.)
  const marker = (geom.markers || []).find(
    (m) => (m.label || "").toLowerCase() === want || (m.label || "").toLowerCase().includes(want)
  );
  if (marker) {
    addPlaceMarker(geoMap, { ...marker, role: "landmark" }, {
      emphasized: true,
      showLabel: true,
      permanentLabel: true,
      boundsPts: [],
    });
    return marker;
  }

  return null;
}
