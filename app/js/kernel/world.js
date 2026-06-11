// @ts-check
// kernel/world.js — the synthetic world (DEC-44/28) on an H3 hex grid (ADR-0012):
// single baseline, two channels (static mobility raster + parametric tide), own-force
// profile + state, and the config core (DEC-48) whose hash enters the stamp.
//
// AO "Solway crossing" — the Esk–Eden delta at the head of the Solway Firth, a real
// lat/lon anchor tiled with res-9 H3 (~344 m cells). Terrain is synthetic, authored in
// hex space (h3 paths/disks) so the river, the all-tide road bridge, and several tidal
// fords (the historic "waths": Peatwath, Sandywath, Bowness Wath) are connected and
// crossable. Authored so the kernel's strategy biases find genuinely different routes.

import { latLngToCell, gridPathCells, gridDisk } from 'h3-js';
import { buildHexAO, H3_RES } from './hexgrid.js';

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
  base:   { lat: 54.958, lng: -3.185, name: 'Patrol base SPARROW' },
  rvEast: { lat: 54.958, lng: -3.022, name: 'RV EAST (east bank)' },
  bridge: { lat: 54.924, lng: -3.106, name: 'Solway road bridge (all-tide)' },
  fords: [
    { key: 'Peatwath',     lat: 54.940, lng: -3.1015, name: 'Peatwath (tidal ford)' },
    { key: 'Sandywath',    lat: 54.962, lng: -3.1040, name: 'Sandywath (tidal ford)' },
    { key: 'Bowness Wath', lat: 54.982, lng: -3.1025, name: 'Bowness Wath (tidal ford)' },
  ],
  ops: [
    { key: 'OP-A', lat: 54.962, lng: -3.130, name: 'OP-A — overlook above Sandywath' },
    { key: 'OP-B', lat: 54.940, lng: -3.128, name: 'OP-B — south overlook above Peatwath' },
    { key: 'OP-C', lat: 54.984, lng: -3.128, name: 'OP-C — north overlook above Bowness Wath' },
  ],
};

/** River centreline longitude — the east/west split (replaces the old `x > 24` test). */
const RIVER_LNG = -3.103;

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
function buildTerrain(ao) {
  const cells = new Array(ao.N).fill('open');

  // Cover & broken ground on the west (start) bank — gives the "covered" strategy a wood.
  paintDisk(cells, ao, [54.952, -3.150], 3, 'forest');
  paintDisk(cells, ao, [54.935, -3.158], 2, 'rough');
  paintDisk(cells, ao, [54.978, -3.150], 2, 'forest');

  // The river Esk/Eden — a connected, ~3-wide water corridor down the AO.
  const riverPts = [[54.919, -3.108], [54.945, -3.100], [54.968, -3.107], [54.993, -3.099]];
  for (let i = 1; i < riverPts.length; i++) {
    paintPath(cells, ao, riverPts[i - 1], riverPts[i], 'water', 1);
  }
  // Estuary marsh fringing the channel (slow, low cover) — only over open ground.
  for (let i = 1; i < riverPts.length; i++) {
    paintPath(cells, ao, riverPts[i - 1], riverPts[i], 'marsh', 2, 'open');
  }

  // Roads: a west coast road past the base, an east road to the RV, and the southern
  // approach to the all-tide bridge.
  paintPath(cells, ao, [54.920, -3.190], [54.992, -3.182], 'road', 0);   // west road
  paintPath(cells, ao, [54.958, -3.185], [54.940, -3.140], 'road', 0);   // base spur east
  paintPath(cells, ao, [54.922, -3.030], [54.992, -3.028], 'road', 0);   // east road
  paintPath(cells, ao, [54.958, -3.022], [54.940, -3.060], 'road', 0);   // RV spur west
  paintPath(cells, ao, [54.924, -3.150], [54.924, -3.060], 'road', 0);   // southern approach

  // The all-tide road bridge: carve a road crossing over the water (the ford-free detour).
  paintPath(cells, ao, [PLACES.bridge.lat, -3.150], [PLACES.bridge.lat, -3.060], 'road', 1, 'water');

  // The tidal fords (waths): carve passable ford bands across the water at each crossing.
  for (const f of PLACES.fords) {
    paintPath(cells, ao, [f.lat, -3.128], [f.lat, -3.082], 'ford', 1, 'water');
  }

  // Pin named places to sensible dry terrain (never water).
  const dry = (p, kind) => { const id = ao.idOf.get(cellOf(p.lat, p.lng)); if (id !== undefined && cells[id] === 'water') cells[id] = kind; };
  dry(PLACES.base, 'road');
  dry(PLACES.rvEast, 'road');
  for (const op of PLACES.ops) dry(op, 'open');

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

  const places = {
    base: resolvePlace(ao, PLACES.base),
    rvEast: resolvePlace(ao, PLACES.rvEast),
    bridge: resolvePlace(ao, PLACES.bridge),
    fords: PLACES.fords.map((f) => resolvePlace(ao, f)),
    ops: PLACES.ops.map((op) => resolvePlace(ao, op)),
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
    view_defaults: { playback_speed: 64 },
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
