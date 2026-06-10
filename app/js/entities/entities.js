// @ts-check
// entities/entities.js — first-class Entities (DEC-52) + the projection
// catalogue (DEC-53), the "entity slice" of DEC-54.
//
// An Entity is a located thing with identity and PROVENANCE, exposing typed
// time-function ASPECTS (scalar | window | status | cell). The Sync Matrix (D6)
// projects aspect → render-type → track over one shared time axis; the
// catalogue below is CONFIG (entity/aspect/render/preset, DEC-48/49/50) — add a
// row and a track appears.
//
// Sourcing reuses the existing buckets (DEC-52): the SELF entity reads the
// kernel's materialisation through `stateAt` (NF1, no re-derivation); the TIDE
// is a FORECAST entity backed by the baseline's parametric channel; the recce
// satellite is a PROVIDER entity (DEC-49) — a mock ephemeris returning a track,
// not a field. All are DISPLAY-ONLY in v1 (no cast-to-channel); the operator
// scans the aligned tracks for coincidences by eye (the vertical-scan payoff is
// human-only in v1 — DEC-53, NF9-honest; advisory windows are designed-for H2).

import { stateAt } from '../kernel/kernel.js';
import { TIDE, fordOpenAt } from '../kernel/world.js';

/** Mock ephemeris for one recce satellite (a PROVIDER entity, DEC-49): an
 *  overhead pass every ~95 min, 18 min wide, first centred at H+60 — so the
 *  first pass falls across the default OP dwell, a coincidence to spot. */
export const SAT = { period_min: 95, pass_min: 18, first_center_min: 60, name: 'IKAROS-3' };

/** Tide height 0 (low water → ford wadeable) … 1 (high), from the same params
 *  the kernel crosses against. */
export function tideHeight(t, tide = TIDE) {
  return 0.5 - 0.5 * Math.cos((2 * Math.PI * (t - tide.low_tide_min)) / tide.period_min);
}

/** Open crossing windows [start,end] (ford wadeable) within [0, horizon]. */
export function crossingWindows(horizon, tide = TIDE) {
  const out = [];
  const k0 = Math.floor((0 - tide.low_tide_min) / tide.period_min) - 1;
  for (let k = k0; ; k++) {
    const low = tide.low_tide_min + k * tide.period_min;
    const a = low - tide.open_half_width_min, b = low + tide.open_half_width_min;
    if (a > horizon) break;
    if (b < 0) continue;
    out.push({ start: Math.max(0, a), end: Math.min(horizon, b), center: low });
  }
  return out;
}

/** Satellite overhead-pass windows within [0, horizon] (the PROVIDER track). */
export function satPasses(horizon, sat = SAT) {
  const out = [];
  for (let c = sat.first_center_min; c - sat.pass_min / 2 <= horizon; c += sat.period_min) {
    const a = c - sat.pass_min / 2, b = c + sat.pass_min / 2;
    if (b >= 0) out.push({ start: Math.max(0, a), end: Math.min(horizon, b), center: c });
  }
  return out;
}

/** Is the satellite overhead at minute t? */
export function satOverhead(t, sat = SAT) {
  const ph = ((t - sat.first_center_min) % sat.period_min + sat.period_min) % sat.period_min;
  return Math.min(ph, sat.period_min - ph) <= sat.pass_min / 2;
}

/**
 * Build the entity set projected by the Sync Matrix (display-only, DEC-52/53
 * v1). Aspects are typed time-functions; `at(plan, t)` is the single read used
 * by both the track renderer and the cursor readout (NF1).
 */
export function buildEntities() {
  return {
    self: {
      id: 'ent-self', label: 'Own force · ROVER-1',
      provenance: { kind: 'self' },
      aspects: {
        phase: { type: 'status',
                 at: (plan, t) => (plan ? stateAt(plan, t)?.phase : null),
                 segments: (plan) => plan?.materialisation?.schedule ?? [] },
        fuel:  { type: 'scalar', unit: '%', domain: [0, 100],
                 at: (plan, t) => (plan ? stateAt(plan, t)?.fuel_pct : null) },
      },
    },
    tide: {
      id: 'ent-tide', label: 'Tide · K-7 ford',
      provenance: { kind: 'forecast', confidence: 'high', freshness: 'provisioned' },
      aspects: {
        height: { type: 'scalar', unit: '', domain: [0, 1],
                  at: (_plan, t) => tideHeight(t),
                  open: (t) => fordOpenAt(t),
                  windows: (h) => crossingWindows(h) },
      },
    },
    sat: {
      id: 'ent-sat', label: `Recce sat · ${SAT.name}`,
      provenance: { kind: 'provider', confidence: 'high', freshness: 'ephemeris' },
      aspects: {
        pass: { type: 'window',
                at: (_plan, t) => satOverhead(t),
                windows: (h) => satPasses(h) },
      },
    },
  };
}

/**
 * The Sync Matrix catalogue (CONFIG, DEC-53): which entity.aspect is shown, in
 * what order, via which render type. `needsPlan` rows are own-force aspects that
 * only have data once a COA is selected; the rest (tide, satellite) project from
 * the World step on. A fuller build would gate rows by role view-preset
 * (DEC-48/49/50) — here one default preset shows them all.
 */
export function syncCatalogue() {
  return [
    { key: 'self.phase',  entity: 'self', aspect: 'phase',  render: 'status', label: 'Own force · phase',     needsPlan: true },
    { key: 'self.fuel',   entity: 'self', aspect: 'fuel',   render: 'line',   label: 'Own force · fuel %',    needsPlan: true },
    { key: 'tide.height', entity: 'tide', aspect: 'height', render: 'tide',   label: 'Tide · height + window' },
    { key: 'sat.pass',    entity: 'sat',  aspect: 'pass',   render: 'band',   label: `Recce sat · ${SAT.name} pass` },
  ];
}
