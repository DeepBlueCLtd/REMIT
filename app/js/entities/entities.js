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
// scans the aligned tracks for coincidences by eye, now augmented by advisory
// banded windows (H1-lite, the C10-lite dual — see below; DEC-53, NF9-honest).

import { stateAt } from '../kernel/kernel.js';
import { TIDE, fordOpenAt } from '../kernel/world.js';
import { assetToEntity, hasTrack, ALLEGIANCE_COLOR } from '../orbat/orbat.js';

/** A tidal-parameter set (the shape of {@link TIDE}). */
/** @typedef {{ period_min: number, low_tide_min: number, open_half_width_min: number }} Tide */

/** A satellite ephemeris parameter set (the shape of {@link SAT}). */
/** @typedef {{ period_min: number, pass_min: number, first_center_min: number, name: string }} Sat */

/** A time window [start,end] centred on `center`, all in mission-minutes. */
/** @typedef {{ start: number, end: number, center: number }} Window */

/**
 * A typed time-function aspect of an entity (scalar | window | status | cell).
 * Members vary by `type`; all are optional here so the union covers each variant.
 * @typedef {object} Aspect
 * @property {string} type
 * @property {(plan: any, t: number) => any} [at]
 * @property {(plan: any) => any[]} [segments]
 * @property {(t: number) => boolean} [open]
 * @property {(horizon: number) => Window[]} [windows]
 * @property {string} [unit]
 * @property {[number, number]} [domain]
 */

/** A located thing with identity, provenance, and typed aspects (DEC-52). */
/** @typedef {{ id: string, label: string, provenance: { kind: string, confidence?: string, freshness?: string }, aspects: Record<string, Aspect> }} Entity */

/** The set of entities projected by the Sync Matrix, keyed by short name. */
/** @typedef {Record<string, Entity>} Entities */

/** A coincidence rule: a declared conjunction over entity aspects (CONFIG). */
/** @typedef {{ id: string, label: string, color: string, hint: string, tracks: string[], holds: (ctx: { entities: Entities, sel?: any, t: number }) => boolean }} CoincidenceRule */

/** A materialised coincidence window: a rule's conjunction holding over [start,end]. */
/** @typedef {{ id: string, label: string, hint: string, color: string, tracks: string[], start: number, end: number }} CoincidenceWindow */

/** Mock ephemeris for one recce satellite (a PROVIDER entity, DEC-49): an
 *  overhead pass every ~95 min, 18 min wide, first centred at H+60 — so the
 *  first pass falls across the default OP dwell, a coincidence to spot. */
export const SAT = { period_min: 95, pass_min: 18, first_center_min: 60, name: 'IKAROS-3' };

/** Tide height 0 (low water → ford wadeable) … 1 (high), from the same params
 *  the kernel crosses against.
 *  @param {number} t @param {Tide} [tide] */
export function tideHeight(t, tide = TIDE) {
  return 0.5 - 0.5 * Math.cos((2 * Math.PI * (t - tide.low_tide_min)) / tide.period_min);
}

/** Open crossing windows [start,end] (ford wadeable) within [0, horizon].
 *  @param {number} horizon @param {Tide} [tide] */
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

/** Satellite overhead-pass windows within [0, horizon] (the PROVIDER track).
 *  @param {number} horizon @param {Sat} [sat] */
export function satPasses(horizon, sat = SAT) {
  const out = [];
  for (let c = sat.first_center_min; c - sat.pass_min / 2 <= horizon; c += sat.period_min) {
    const a = c - sat.pass_min / 2, b = c + sat.pass_min / 2;
    if (b >= 0) out.push({ start: Math.max(0, a), end: Math.min(horizon, b), center: c });
  }
  return out;
}

/** Is the satellite overhead at minute t?
 *  @param {number} t @param {Sat} [sat] */
export function satOverhead(t, sat = SAT) {
  const ph = ((t - sat.first_center_min) % sat.period_min + sat.period_min) % sat.period_min;
  return Math.min(ph, sat.period_min - ph) <= sat.pass_min / 2;
}

/**
 * Build the entity set projected by the Sync Matrix (display-only, DEC-52/53
 * v1). Aspects are typed time-functions; `at(plan, t)` is the single read used
 * by both the track renderer and the cursor readout (NF1). Authored ORBAT
 * assets (DEC-60) are folded in as allegiance-typed entities keyed by asset id.
 * @param {import('../../../schema/gen/remit').Asset[]} [assets]
 * @returns {Entities}
 */
export function buildEntities(assets = []) {
  /** @type {Entities} */
  const orbatEntities = {};
  for (const a of assets) orbatEntities[a.id] = /** @type {any} */ (assetToEntity(a));
  return {
    ...orbatEntities,
    self: {
      id: 'ent-self', label: 'Own force · ROVER-1',
      provenance: { kind: 'self' },
      aspects: {
        phase: { type: 'status',
                 at: (/** @type {any} */ plan, /** @type {number} */ t) => (plan ? stateAt(plan, t)?.phase : null),
                 segments: (/** @type {any} */ plan) => plan?.materialisation?.schedule ?? [] },
        fuel:  { type: 'scalar', unit: '%', domain: /** @type {[number, number]} */ ([0, 100]),
                 at: (/** @type {any} */ plan, /** @type {number} */ t) => (plan ? stateAt(plan, t)?.fuel_pct : null) },
      },
    },
    tide: {
      id: 'ent-tide', label: 'Tide · K-7 ford',
      provenance: { kind: 'forecast', confidence: 'high', freshness: 'provisioned' },
      aspects: {
        height: { type: 'scalar', unit: '', domain: /** @type {[number, number]} */ ([0, 1]),
                  at: (/** @type {any} */ _plan, /** @type {number} */ t) => tideHeight(t),
                  open: (/** @type {number} */ t) => fordOpenAt(t),
                  windows: (/** @type {number} */ h) => crossingWindows(h) },
      },
    },
    sat: {
      id: 'ent-sat', label: `Recce sat · ${SAT.name}`,
      provenance: { kind: 'provider', confidence: 'high', freshness: 'ephemeris' },
      aspects: {
        pass: { type: 'window',
                at: (/** @type {any} */ _plan, /** @type {number} */ t) => satOverhead(t),
                windows: (/** @type {number} */ h) => satPasses(h) },
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
/**
 * @param {import('../../../schema/gen/remit').Asset[]} [assets]
 * @returns {import('../views/sync-matrix.js').CatalogueRow[]}
 */
export function syncCatalogue(assets = []) {
  /** @type {import('../views/sync-matrix.js').CatalogueRow[]} */
  const rows = [
    { key: 'self.phase',  entity: 'self', aspect: 'phase',  render: 'status', label: 'Own force · phase',     needsPlan: true },
    { key: 'self.fuel',   entity: 'self', aspect: 'fuel',   render: 'line',   label: 'Own force · fuel %',    needsPlan: true },
    { key: 'tide.height', entity: 'tide', aspect: 'height', render: 'tide',   label: 'Tide · height + window' },
    { key: 'sat.pass',    entity: 'sat',  aspect: 'pass',   render: 'band',   label: `Recce sat · ${SAT.name} pass` },
  ];
  // Any authored asset carrying a time-varying aspect (a red patrol window, a blue
  // availability window) projects as a Sync-Matrix track via a catalogue row (DEC-60/US5).
  for (const a of assets) {
    if (!hasTrack(a)) continue;
    rows.push({ key: `${a.id}.active`, entity: a.id, aspect: 'active', render: 'band',
                label: `${a.allegiance} · ${a.label ?? a.id}`, color: ALLEGIANCE_COLOR[/** @type {keyof typeof ALLEGIANCE_COLOR} */ (a.allegiance)] });
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Coincidence analytic (H1-lite, DEC-53): the temporal dual of C10's spatial
// column-aggregation. A rule is a DECLARED CONJUNCTION of aspect-predicates;
// where every predicate holds at once, the tracks "line up" into a coincidence
// window. ADVISORY ONLY — it never decides or alters the plan (the C10-lite
// discipline, DEC-32): it surfaces an opportunity the operator may exploit.
// (First-class coincidence objects, exploitable by the kernel, are H3.)

/** Coincidence rules (CONFIG) — each a conjunction over entity aspects.
 *  @returns {CoincidenceRule[]} */
export function coincidenceRules() {
  return [
    { id: 'imagery', label: 'Imagery window', color: '#f0b429',
      hint: 'recce satellite overhead during the OP observation',
      tracks: ['self.phase', 'sat.pass'],
      holds: ({ entities, sel, t }) =>
        entities.self.aspects.phase.at?.(sel, t) === 'visit' &&
        entities.sat.aspects.pass.at?.(null, t) === true },
    { id: 'dry-crossing', label: 'Tide-aligned crossing', color: '#38d39f',
      hint: 'crossing K-7 while the low-tide window is open',
      tracks: ['self.phase', 'tide.height'],
      holds: ({ entities, sel, t }) =>
        entities.self.aspects.phase.at?.(sel, t) === 'exfil' &&
        entities.tide.aspects.height.open?.(t) === true },
    // Pure forecast × provider — no own-force term, so this one surfaces from the
    // World step before any COA exists (advisory coincidence is not plan-coupled).
    { id: 'open-ford-pass', label: 'Overpass · open ford', color: '#5aa9e6',
      hint: 'recce satellite overhead while the K-7 ford is open — image a live crossing',
      tracks: ['tide.height', 'sat.pass'],
      holds: ({ entities, t }) =>
        entities.tide.aspects.height.open?.(t) === true &&
        entities.sat.aspects.pass.at?.(null, t) === true },
  ];
}

/**
 * Maximal time intervals in [0, horizon] where a rule's conjunction holds.
 * Pure scan at `step`-minute resolution (advisory, so coarse is fine).
 * @param {CoincidenceRule[]} rules
 * @param {Entities} entities
 * @param {any} sel  the selected plan/COA (opaque serialisable blob)
 * @param {number} horizon
 * @param {number} [step]
 * @returns {CoincidenceWindow[]}
 */
export function coincidenceWindows(rules, entities, sel, horizon, step = 1) {
  const out = [];
  for (const rule of rules) {
    /** @type {number | null} */ let start = null;
    let prev = false;
    for (let t = 0; t <= horizon + 1e-6; t += step) {
      const on = !!rule.holds({ entities, sel, t });
      if (on && !prev) start = t;
      // `prev` only flips true after `start` is set, so it is a number here.
      if (!on && prev) { out.push(win(rule, /** @type {number} */ (start), t - step)); start = null; }
      prev = on;
    }
    if (prev && start != null) out.push(win(rule, start, horizon));
  }
  return out;
}

/**
 * @param {CoincidenceRule} rule
 * @param {number} start
 * @param {number} end
 * @returns {CoincidenceWindow}
 */
const win = (rule, start, end) => ({
  id: rule.id, label: rule.label, hint: rule.hint, color: rule.color,
  tracks: rule.tracks, start: Math.round(start * 10) / 10, end: Math.round(end * 10) / 10,
});

