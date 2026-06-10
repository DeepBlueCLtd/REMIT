// @ts-check
// kernel/world.js — the synthetic world (DEC-44/28): single baseline, one
// channel, small static grid; own-force profile + state; the sample config
// core (DEC-48) whose hash enters the stamp.
//
// AO "Kara Crossing" — a hand-authored 28×18 land grid (500 m cells, ~14×9 km):
// a southern highway, a north spur road, a large wood, a marsh belt, and the
// river Kara with the K-7 bridge. Authored so the kernel's strategy biases
// find genuinely different routes (fast roads / direct cut / covered wood).

export const GRID_W = 28;
export const GRID_H = 18;
export const CELL_M = 500;

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

/** Named cells the demo uses. */
export const PLACES = {
  base:    { x: 2,  y: 15, name: 'Patrol base SPARROW' },
  bridge:  { x: 23, y: 5,  name: 'K-7 ford (tidal)' },
  k9:      { x: 23, y: 15, name: 'K-9 bridge (southern highway)' },
  rvEast:  { x: 27, y: 8,  name: 'RV EAST (east bank, beyond K-7)' },
  ops: [
    { key: 'OP-A', x: 21, y: 3, name: 'OP-A — treeline overlooking K-7 bridge' },
    { key: 'OP-B', x: 21, y: 11, name: 'OP-B — south-reach overlook' },
    { key: 'OP-C', x: 12, y: 1, name: 'OP-C — wood north edge' },
  ],
};

/**
 * Build the synthetic terrain. Deterministic by construction (no RNG):
 * the baseline object's identity is its content (DEC-35).
 *
 * Authored so the three strategy optima diverge: a riverside track loop in
 * the south-east (road-philic), an open centre corridor (pure time), and the
 * big wood (cover).
 * @returns {string[]} terrain kind per cell, row-major [y*GRID_W + x]
 */
function buildTerrain() {
  const cells = new Array(GRID_W * GRID_H).fill('open');
  const set = (x, y, kind) => {
    if (x >= 0 && x < GRID_W && y >= 0 && y < GRID_H) cells[y * GRID_W + x] = kind;
  };
  const rect = (x0, y0, x1, y1, kind) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, kind);
  };

  rect(4, 9, 12, 14, 'rough');          // broken ground south of the wood
  rect(4, 1, 12, 8, 'forest');          // the big wood
  rect(13, 1, 21, 3, 'forest');         // treeline finger running east
  rect(15, 6, 22, 9, 'marsh');          // marsh belt south of the finger
  rect(16, 10, 22, 12, 'rough');        // broken approaches to the south reach
  rect(23, 0, 24, 17, 'water');         // river Kara
  for (let x = 0; x <= 27; x++) set(x, 15, 'road');   // southern highway (+ K-9 bridge)
  for (let y = 5; y <= 14; y++) set(22, y, 'track');  // riverside track north
  set(23, 5, 'ford'); set(24, 5, 'ford');             // K-7 tidal ford
  return cells;
}

// ---------------------------------------------------------------------------
// Tide (increment A): the K-7 crossing is a ford, wadeable only within ±3 h of
// low tide. Deterministic semidiurnal model — a parametric channel, so the
// open/close times are forecastable changepoints, not surprises.

/** Tide channel parameters (minutes on the mission clock). */
export const TIDE = {
  period_min: 745,            // semidiurnal: 12 h 25 min between low tides
  low_tide_min: 268,          // first low tide after H-hour
  open_half_width_min: 180,   // ford passable within ±3 h of low tide
};

/** Is the ford wadeable at mission-minute t? */
export function fordOpenAt(t, tide = TIDE) {
  const ph = ((t - tide.low_tide_min) % tide.period_min + tide.period_min) % tide.period_min;
  return ph <= tide.open_half_width_min || ph >= tide.period_min - tide.open_half_width_min;
}

/** Earliest minute ≥ t at which the ford is wadeable (t itself if open now). */
export function nextFordOpen(t, tide = TIDE) {
  if (fordOpenAt(t, tide)) return t;
  const ph = ((t - tide.low_tide_min) % tide.period_min + tide.period_min) % tide.period_min;
  return t + (tide.period_min - tide.open_half_width_min - ph);
}

/** Ford open/close transitions in [t0, t1] — the baseline's forecast changepoints. */
export function fordTransitions(t0, t1, tide = TIDE) {
  const out = [];
  // Walk low tides around the interval; each contributes an open and a close edge.
  const k0 = Math.floor((t0 - tide.low_tide_min) / tide.period_min) - 1;
  for (let k = k0; ; k++) {
    const low = tide.low_tide_min + k * tide.period_min;
    const open = low - tide.open_half_width_min;
    const close = low + tide.open_half_width_min;
    if (open > t1) break;
    if (open >= t0) out.push({ at_min: open, channel: 'tide', change: 'K-7 ford opens (low-tide window)' });
    if (close >= t0 && close <= t1) out.push({ at_min: close, channel: 'tide', change: 'K-7 ford closes (tide making)' });
  }
  return out;
}

/** One world build, shared by the app. */
export function buildWorld() {
  const terrain = buildTerrain();
  const cells = terrain.map((kind) => ({
    terrain: kind,
    mobility: TERRAIN[kind].mobility,
    cover: TERRAIN[kind].cover,
  }));

  /** Baseline — data-model §4: single synthetic baseline, two channels
   *  (static mobility raster + parametric periodic tide). */
  const baseline = {
    name: 'SYNTH-AO-1 “Kara Crossing”',
    version: 2,
    medium: {
      domain: 'land',
      grid: { w: GRID_W, h: GRID_H, cell_m: CELL_M },
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
    position: { x: PLACES.base.x, y: PLACES.base.y },
    clock_min: 0,
    endurance_fuel_pct: 100,
    availability: 'available',
  };

  /**
   * Config core (DEC-48) — world-defining, canonicalised and hashed; the hash
   * is a stamp axis. The instance shell below is deployment-only and excluded.
   */
  const configCore = {
    medium: 'land',
    grid: { w: GRID_W, h: GRID_H, cell_m: CELL_M },
    channels: ['mobility', 'tide'],
    movement_model: { realisation: 'parametric', type: 'speed-factor', params: { diagonal: 'sqrt2' } },
    providers: [],
    vocabulary: ['visit'],
  };

  /** Instance shell — identity-free (branding/view defaults only, DEC-48). */
  const instanceShell = {
    app_name: 'REMIT — walking skeleton',
    theme: 'dark',
    view_defaults: { playback_speed: 64 },
  };

  return { baseline, profile, state, configCore, instanceShell };
}

/**
 * Band unit (minutes) derived from the channel's confidence (NF10: band widths
 * derive from channel confidence, not constants). The mapping itself is mock
 * calibration — flagged for the real kernel (DEC-46 band-calibration test).
 * @param {{confidence: string}} channel
 */
export function bandUnitFor(channel) {
  return { high: 20, medium: 40, low: 80 }[channel.confidence] ?? 40;
}
