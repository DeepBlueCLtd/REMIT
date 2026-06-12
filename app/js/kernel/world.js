// @ts-check
// kernel/world.js — the synthetic world (DEC-44/28) on an H3 hex grid (ADR-0016):
// single baseline, two channels (static mobility raster + parametric tide), own-force
// profile + state, and the config core (DEC-48) whose hash enters the stamp.
//
// AO "Solway crossing" — the Esk–Eden delta at the head of the Solway Firth, a real
// lat/lon anchor tiled with res-9 H3 (~344 m cells). Terrain is SAMPLED from the Carto
// basemap beneath the AO (tools/sample-terrain.mjs → terrain-sampled.json, baked for
// determinism, ADR-0017) so the water hexes trace the real estuary; designed set-pieces —
// bank roads, an all-tide causeway, and the tidal "waths" (Peatwath, Sandywath, Bowness
// Wath) — are then painted over land/water so the kernel's strategies find different routes.

import { latLngToCell, gridPathCells, gridDisk } from 'h3-js';
import { buildHexAO, H3_RES } from './hexgrid.js';
import sampledTerrain from './terrain-sampled.json' with { type: 'json' };

/** MapLibre bounds [[west,south],[east,north]] framing the AO (for the map view). */
export const AO_BOUNDS = [[-3.215, 54.918], [-2.985, 55.000]];

/** Per-terrain attributes: mobility = speed factor (0 = impassable), cover 0..1.
 *  `ford` is tidal: passable at this mobility only inside the low-tide window
 *  (see TIDE below); outside it the kernel treats it as water. */
export const TERRAIN = {
  road:   { mobility: 1.0,  cover: 0.05, color: '#565b66' },
  track:  { mobility: 0.85, cover: 0.15, color: '#5d5142' },
  open:   { mobility: 0.8,  cover: 0.1,  color: '#2e3a2a' },
  rough:  { mobility: 0.55, cover: 0.4,  color: '#41402d' },
  forest: { mobility: 0.35, cover: 0.9,  color: '#1c3323' },
  marsh:  { mobility: 0.25, cover: 0.2,  color: '#27383a' },
  ford:   { mobility: 0.55, cover: 0.1,  color: '#7a6a45' },
  water:  { mobility: 0,    cover: 0,    color: '#173550' },
};

/** Named places, as real lat/lng anchors; resolved to H3 cells/ids in buildWorld.
 *  The river runs ~N-S near lng -3.103, splitting the AO into a west (start) bank and
 *  an east (RV) bank, crossed by the bridge and the tidal waths. */
export const PLACES = {
  base:   { lat: 54.930, lng: -3.150, name: 'Patrol base SPARROW' },
  rvEast: { lat: 54.961, lng: -3.055, name: 'RV EAST (east bank)' },
  bridge: { lat: 54.928, lng: -3.103, name: 'Solway road causeway (all-tide)' },
  fords: [
    { key: 'Peatwath',     lat: 54.945, lng: -3.103, name: 'Peatwath (tidal ford)' },
    { key: 'Sandywath',    lat: 54.962, lng: -3.103, name: 'Sandywath (tidal ford)' },
    { key: 'Bowness Wath', lat: 54.978, lng: -3.103, name: 'Bowness Wath (tidal ford)' },
  ],
  // OPs sit on the designed tidal spit/islet beside Sandywath, reached dry from the southern
  // base along the spit. The exfil forks at the wath: ford it at low water, or drive the
  // longer all-tide road south to the causeway (the wait-vs-drive decision; ADR-0021).
  ops: [
    { key: 'OP-A', lat: 54.961, lng: -3.127, name: 'OP-A — islet overlook at Sandywath' },
    { key: 'OP-B', lat: 54.953, lng: -3.138, name: 'OP-B — spit overlook below Sandywath' },
    { key: 'OP-C', lat: 54.957, lng: -3.132, name: 'OP-C — north spit overlook at Sandywath' },
  ],
};

/** River centreline longitude — the east/west split (replaces the old `x > 24` test). */
const RIVER_LNG = -3.103;

/** Estuary crossing latitudes — E–W bands carved over the sampled water: one all-tide
 *  road causeway (south) and three tidal fords (the waths). Tuned to the sampled shape. */
const BRIDGE_LAT = 54.928;
const FORD_LATS = [54.945, 54.962, 54.978];

/** Is hex `id` on the east (RV) bank of the river? */
export function isEastOfRiver(ao, id) {
  return ao.centers[id][1] > RIVER_LNG;
}

// --- terrain painters (hex space) ------------------------------------------------
const cellOf = (lat, lng) => latLngToCell(lat, lng, H3_RES);

function paintPath(cells, ao, a, b, kind, widen, onlyOver) {
  let path;
  try { path = gridPathCells(cellOf(a[0], a[1]), cellOf(b[0], b[1])); }
  catch { path = [cellOf(a[0], a[1]), cellOf(b[0], b[1])]; }
  for (const h of path) {
    for (const hh of (widen ? gridDisk(h, widen) : [h])) {
      const id = ao.idOf.get(hh);
      if (id === undefined) continue;
      if (onlyOver && cells[id] !== onlyOver) continue;
      cells[id] = kind;
    }
  }
}

function paintDisk(cells, ao, c, k, kind, onlyOver) {
  for (const hh of gridDisk(cellOf(c[0], c[1]), k)) {
    const id = ao.idOf.get(hh);
    if (id === undefined) continue;
    if (onlyOver && cells[id] !== onlyOver) continue;
    cells[id] = kind;
  }
}

/**
 * Build synthetic terrain over the hex AO. Deterministic (no RNG): ordering matters,
 * so later strokes intentionally override earlier ones (e.g. fords carve over water).
 * @returns {string[]} terrain kind per cell id (length ao.N)
 */
/** A passable band carved across the estuary at a latitude (over water cells only),
 *  spanning the AO width so it connects the west and east banks. */
function paintBand(cells, ao, lat, kind, widen = 1) {
  paintPath(cells, ao, [lat, -3.210], [lat, -2.990], kind, widen, 'water');
}

/** Genuinely dry land: not open water, and not a tidal ford band (which sits *over*
 *  water and is only conditionally passable). Land places must anchor here. */
const isDry = (kind) => kind !== 'water' && kind !== 'ford';

/** BFS from the cell at (lat,lng) to the nearest dry cell — anchors land places so they
 *  never sit in the estuary or on a tidal ford band (DEC-44 / issue: routes wading water). */
function nearestDry(ao, terr, lat, lng) {
  const start = ao.idOf.get(cellOf(lat, lng));
  if (start === undefined || isDry(terr[start])) return start;
  const seen = new Set([start]);
  let frontier = [start];
  while (frontier.length) {
    const next = [];
    for (const id of frontier) for (const nb of ao.adj[id]) {
      if (seen.has(nb)) continue;
      seen.add(nb);
      if (isDry(terr[nb])) return nb;
      next.push(nb);
    }
    frontier = next;
  }
  return start;
}

function buildTerrain(ao) {
  // Base terrain sampled offline from the Carto Positron basemap (tools/sample-terrain.mjs),
  // baked to terrain-sampled.json so the hex shading matches the real Solway estuary while
  // the kernel stays deterministic (NF3 — no live fetch). The sampled classes are
  // water / open / forest / rough; a few designed set-pieces are then painted *over* land
  // or *over* water as marked, so they refine but never fight the sampled coastline.
  const cells = ao.indexes.map((h3) => sampledTerrain[h3] ?? 'open');

  // Cover & broken ground on the banks (Positron landuse is sparse) — gives the "covered"
  // strategy somewhere to hide. Painted over open land only.
  paintDisk(cells, ao, [54.955, -3.170], 3, 'forest', 'open');
  paintDisk(cells, ao, [54.936, -3.176], 2, 'rough', 'open');
  paintDisk(cells, ao, [54.982, -3.050], 2, 'forest', 'open');
  paintDisk(cells, ao, [54.946, -3.038], 2, 'rough', 'open');

  // Bank roads (Positron road pixels don't classify reliably) — a designed net on land.
  paintPath(cells, ao, [54.922, -3.190], [54.994, -3.184], 'road', 0, 'open');   // west bank
  paintPath(cells, ao, [54.922, -3.030], [54.994, -3.026], 'road', 0, 'open');   // east bank

  // The all-tide road causeway across the estuary (the ford-free detour).
  paintBand(cells, ao, BRIDGE_LAT, 'road');

  // Tidal fords (the historic "waths"): bands wadeable across the estuary only within the
  // low-tide window (TIDE below); outside it the kernel treats them as water.
  for (const lat of FORD_LATS) paintBand(cells, ao, lat, 'ford');

  // Designed tidal spit + islet (ADR-0021): a rough saltmarsh causeway runs from the south
  // shore out to a dry knoll beside Sandywath, giving the OP a stance right at the wath.
  // The exfil then FORKS — ford Sandywath at low water, or drive the longer all-tide road
  // back south to the causeway — the wait-vs-drive decision on two distinct routes.
  paintPath(cells, ao, [54.938, -3.152], [54.960, -3.130], 'rough', 1);   // the spit (raised over the flats)
  paintDisk(cells, ao, [54.961, -3.127], 1, 'open');                       // the islet knoll at the wath

  // Close the north-head walk-around so the only all-tide alternative to fording Sandywath
  // is the long road south to the causeway (without this the exfil slips round the head for
  // free and never engages the tide). East of the OPs/spit; the west shore is untouched.
  for (let id = 0; id < ao.N; id++) {
    const [lat, lng] = ao.centers[id];
    if (lat >= 54.972 && lng >= -3.103 && lng <= -3.083) cells[id] = 'water';
  }

  return cells;
}

// ---------------------------------------------------------------------------
// Tide: the waths are wadeable only within ±3 h of low tide. Deterministic semidiurnal
// model — a parametric channel, so open/close times are forecastable changepoints. One
// tide gates all fords (it is one estuary).

/** Tide channel parameters (minutes on the mission clock). */
export const TIDE = {
  period_min: 745,            // semidiurnal: 12 h 25 min between low tides
  low_tide_min: 268,          // first low tide after H-hour
  open_half_width_min: 180,   // fords passable within ±3 h of low tide
};

/** Are the fords wadeable at mission-minute t? */
export function fordOpenAt(t, tide = TIDE) {
  const ph = ((t - tide.low_tide_min) % tide.period_min + tide.period_min) % tide.period_min;
  return ph <= tide.open_half_width_min || ph >= tide.period_min - tide.open_half_width_min;
}

/** Earliest minute ≥ t at which the fords are wadeable (t itself if open now). */
export function nextFordOpen(t, tide = TIDE) {
  if (fordOpenAt(t, tide)) return t;
  const ph = ((t - tide.low_tide_min) % tide.period_min + tide.period_min) % tide.period_min;
  return t + (tide.period_min - tide.open_half_width_min - ph);
}

/** Ford open/close transitions in [t0, t1] — the baseline's forecast changepoints. */
export function fordTransitions(t0, t1, tide = TIDE) {
  const out = [];
  const k0 = Math.floor((t0 - tide.low_tide_min) / tide.period_min) - 1;
  for (let k = k0; ; k++) {
    const low = tide.low_tide_min + k * tide.period_min;
    const open = low - tide.open_half_width_min;
    const close = low + tide.open_half_width_min;
    if (open > t1) break;
    if (open >= t0) out.push({ at_min: open, channel: 'tide', change: 'waths open (low-tide window)' });
    if (close >= t0 && close <= t1) out.push({ at_min: close, channel: 'tide', change: 'waths close (tide making)' });
  }
  return out;
}

/** Resolve a {lat,lng,...} place to {...place, h3, id}. */
function resolvePlace(ao, p) {
  const h3 = cellOf(p.lat, p.lng);
  return { ...p, h3, id: ao.idOf.get(h3) };
}

/** One world build, shared by the app. Builds the hex AO once and carries it. */
export function buildWorld() {
  const ao = buildHexAO();
  const terrain = buildTerrain(ao);
  const cells = terrain.map((kind) => ({
    terrain: kind,
    mobility: TERRAIN[kind].mobility,
    cover: TERRAIN[kind].cover,
  }));

  // Land places (base / RV / OPs) snap to the nearest dry cell of the sampled terrain, so
  // they never land in the real estuary or on a tidal ford band; fords and the bridge keep
  // their carved-crossing cell.
  const landPlace = (p) => {
    const id = nearestDry(ao, terrain, p.lat, p.lng);
    const [lat, lng] = ao.centers[id];
    return { ...p, h3: ao.indexes[id], id, lat, lng };
  };
  const places = {
    base: landPlace(PLACES.base),
    rvEast: landPlace(PLACES.rvEast),
    bridge: resolvePlace(ao, PLACES.bridge),
    fords: PLACES.fords.map((f) => resolvePlace(ao, f)),
    ops: PLACES.ops.map(landPlace),
  };

  /** Baseline — data-model §4: single synthetic baseline, two channels. */
  const baseline = {
    name: 'SYNTH-AO-2 “Solway crossing”',
    version: 1,
    medium: {
      domain: 'land',
      grid: { kind: 'h3', res: H3_RES, origin: { lat: 54.96, lng: -3.10 }, cell_count: ao.N },
      cell_attrs: ['terrain', 'cover'],
    },
    cells,
    channels: [{
      id: 'mobility',
      domain_type: 'speed_factor',
      realisation: 'raster',
      confidence: 'high',
      freshness: 'provisioned',
      sampling_step_min: 60,
      predictability: 'static',
    }, {
      id: 'tide',
      domain_type: 'water_level',
      realisation: 'parametric',
      confidence: 'high',
      freshness: 'provisioned',
      sampling_step_min: 15,
      predictability: 'periodic',
      params: { ...TIDE, applies_to: 'ford' },
    }],
    facts: { observations: [] },
    forecast_changepoints: fordTransitions(0, 24 * 60),
    lineage: {},
  };

  /** Own force — data-model §5. */
  const profile = {
    name: 'ROVER-1 (light recce vehicle)',
    version: 1,
    domain: 'land',
    speed_by_medium: { land_kph: 38 },
    endurance: { fuel_pct: 100, hours: 9 },
    sensors: ['optics'],
    dynamics: 'wheeled',
  };
  const state = {
    position: { h3: places.base.h3 },
    clock_min: 0,
    endurance_fuel_pct: 100,
    availability: 'available',
  };

  /**
   * Config core (DEC-48) — world-defining, canonicalised and hashed; the hash is a
   * stamp axis. Hex movement is uniform (no diagonal step).
   */
  const configCore = {
    medium: 'land',
    grid: { kind: 'h3', res: H3_RES, origin: { lat: 54.96, lng: -3.10 } },
    channels: ['mobility', 'tide'],
    movement_model: { realisation: 'parametric', type: 'speed-factor', params: { step: 'hex-uniform' } },
    providers: [],
    vocabulary: ['visit'],
  };

  /** Instance shell — identity-free (branding/view defaults only, DEC-48). */
  const instanceShell = {
    app_name: 'REMIT — walking skeleton',
    theme: 'dark',
    view_defaults: { playback_speed: 2 },
  };

  return { baseline, profile, state, configCore, instanceShell, ao, places };
}

/**
 * Band unit (minutes) derived from the channel's confidence (NF10).
 * @param {{confidence: string}} channel
 */
export function bandUnitFor(channel) {
  return { high: 20, medium: 40, low: 80 }[channel.confidence] ?? 40;
}
