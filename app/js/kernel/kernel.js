// @ts-check
// kernel/kernel.js — the mock kernel (DEC-44, NF9): an honest non-planner.
//
// Real but trivial: each strategy bias runs a deterministic A* over the small
// grid (DEC-22 fan-out, v1 axes), the movement model is trivially parametric,
// and scores are banded by a unit derived from channel confidence (NF10).
// Canned: the robustness bands (single baseline → no real sampling) and the
// cost thresholds. Everything here is illustrative of flow, not of planner
// quality (DEC-41) — the UI must say so.
//
// NF1 lives here: `stateAt` and `assess` are the single evaluation surface.
// Views project through them; the wingman re-anchors through them; nothing
// else re-derives position, margin or verdict.

import { findPath } from './astar.js';
import { bandUnitFor, CELL_M } from './world.js';
import { contentId } from '../shapes/canonical.js';

export const KERNEL_VERSION = 'mock-0.1';

/** DEC-22 v1 strategy axes (the fan-out that makes a handful). */
const STRATEGIES = [
  { key: 'direct',  label: 'Direct',  axis: 'time/speed',   blurb: 'shortest time, cuts cross-country' },
  { key: 'tracked', label: 'Tracked', axis: 'completeness', blurb: 'hugs roads — predictable, fast, exposed' },
  { key: 'covered', label: 'Covered', axis: 'exposure',     blurb: 'maximises cover — slow, concealed' },
];

/**
 * Minutes to traverse between two adjacent cells (trivial parametric
 * MovementModel: speed = profile speed × mean mobility; diagonals ×√2).
 */
function edgeMinutes(cells, profile, from, to, diag) {
  const m = (cells[from].mobility + cells[to].mobility) / 2;
  if (cells[from].mobility === 0 || cells[to].mobility === 0) return Infinity;
  const dist = (diag ? Math.SQRT2 : 1) * CELL_M;
  return dist / (profile.speed_by_medium.land_kph * m * 1000 / 60);
}

/** Strategy-biased search cost. The bias warps the SEARCH metric only —
 *  materialised time always uses the real movement model. `nogo` is the set of
 *  operator no-go cell indices (steering, DEC-24): impassable to the search. */
function strategyCost(strategy, cells, profile, nogo) {
  const roadlike = (c) => c.terrain === 'road' || c.terrain === 'track';
  return (from, to, diag) => {
    if (nogo.has(to) || nogo.has(from)) return Infinity;   // operator no-go zone
    const t = edgeMinutes(cells, profile, from, to, diag);
    if (!Number.isFinite(t)) return Infinity;
    if (strategy === 'tracked') return t * (roadlike(cells[to]) ? 0.65 : 2.5);
    if (strategy === 'covered') {
      const cover = (cells[from].cover + cells[to].cover) / 2;
      return t * (1 + 3.0 * (1 - cover));
    }
    return t; // direct = pure time
  };
}

/** Margin band from a slack in minutes (NF10 vocabulary). */
export function bandFor(slackMin, unit) {
  if (slackMin < 0) return 'violated';
  if (slackMin >= 2 * unit) return 'robust';
  if (slackMin >= unit) return 'marginal';
  return 'tight';
}

/**
 * The kernel call behind POST /plan/handful. Pure function of its inputs:
 * same body → same plans, ids included (NF3, decision-level).
 *
 * Note for register reconciliation (DEC-47): the data-model §6 Stamp omits
 * the profile/start-state axis, yet plans depend on both; the skeleton adds
 * `profile_version` + `start` to its stamp. Likewise plan identity needs a
 * within-handful discriminator: id = hash({stamp, strategy}).
 *
 * @param {{requirement: any, requirement_version: string,
 *          baseline: any, baseline_version: string,
 *          profile: any, profile_version: string,
 *          state: any, config_core: string,
 *          appetites: Record<string, string>, steering: any[],
 *          strategy_seed: number}} input
 */
export async function planHandful(input) {
  const { baseline, profile, state } = input;
  const cells = baseline.cells;
  const grid = baseline.medium.grid;
  const unit = bandUnitFor(baseline.channels[0]);
  const commitments = input.requirement.commitments;
  const visitC = commitments[0];
  const exfilC = commitments[1];                          // optional second leg (exfil E)
  const op = visitC.activity.where;
  const window = visitC.activity.when.window;
  const duration = visitC.activity.duration.min_min;
  const latestOkArrival = window.end_min - duration;
  const rv = exfilC?.activity?.where ?? null;
  const exfilDeadline = exfilC?.activity?.when?.before_min ?? null;

  const stamp = {
    requirement_version: input.requirement_version,
    baseline_version: input.baseline_version,
    excursions: [],
    config_core_hash: input.config_core,
    profile_version: input.profile_version,          // skeleton addition (see note)
    start: { x: state.position.x, y: state.position.y, clock_min: state.clock_min },
    appetites: input.appetites,
    steering: input.steering ?? [],
    kernel_version: KERNEL_VERSION,
    strategy_seed: input.strategy_seed,
  };

  const bestStep = CELL_M / (profile.speed_by_medium.land_kph * 1000 / 60);
  const plans = [];
  const seenTrajectories = new Set();

  // Operator steering (DEC-24): no-go cells the search must route around.
  const nogo = new Set();
  for (const c of (input.steering ?? [])) {
    if (c.type === 'no-go') for (const cell of (c.cells ?? [])) nogo.add(cell.y * grid.w + cell.x);
  }

  for (const strat of STRATEGIES) {
    const cost = strategyCost(strat.key, cells, profile, nogo);
    // Admissible heuristic scale: best possible minutes per orthogonal step,
    // tightened by the strategy's own minimum multiplier.
    const hScale = bestStep * (strat.key === 'tracked' ? 0.65 : 1);
    const leg1 = findPath(grid, state.position, op, cost, hScale);          // → OP
    const leg2 = leg1 && rv ? findPath(grid, op, rv, cost, hScale) : null;  // OP → RV (exfil)

    if (!leg1 || (rv && !leg2)) {
      plans.push(await finalisePlan(stamp, strat, null, {
        conflicts: [{
          id: `conflict-${strat.key}`, kind: 'structural', parties: [visitC.id],
          narrative: !leg1 ? `No route from start to OP ${op.x},${op.y}.`
            : `No exfil route OP → RV ${rv.x},${rv.y}.`,
        }],
        visitC, exfilC, unit, latestOkArrival, exfilDeadline,
      }));
      continue;
    }

    // Within-band duplicate rejection (DEC-22): identical trajectories collapse.
    const sig = leg1.concat(leg2 ?? []).map((p) => p.x + ',' + p.y).join(';');
    if (seenTrajectories.has(sig)) continue;
    seenTrajectories.add(sig);

    // Materialise with the REAL movement model (bias was search-only).
    let t = state.clock_min;
    let fuel = state.endurance_fuel_pct;
    const trajectory = [{ x: leg1[0].x, y: leg1[0].y, t: round1(t), fuel_pct: round1(fuel) }];
    const advance = (path) => {
      for (let i = 1; i < path.length; i++) {
        const from = path[i - 1].y * grid.w + path[i - 1].x;
        const to = path[i].y * grid.w + path[i].x;
        const diag = path[i].x !== path[i - 1].x && path[i].y !== path[i - 1].y;
        t += edgeMinutes(cells, profile, from, to, diag);
        fuel -= (diag ? Math.SQRT2 : 1) * 0.35;     // toy consumption: %/cell
        trajectory.push({ x: path[i].x, y: path[i].y, t: round1(t), fuel_pct: round1(fuel) });
      }
    };

    advance(leg1);
    const arrival = round1(t);
    const visitStart = Math.max(arrival, window.start_min);
    const dwellEnd = round1(visitStart + duration);

    const schedule = [{ kind: 'transit', label: 'Transit to OP', start_min: state.clock_min, end_min: arrival }];
    if (visitStart > arrival) {
      schedule.push({ kind: 'hold', label: 'Hold (await window)', start_min: arrival, end_min: visitStart });
    }
    schedule.push({
      kind: 'visit', label: 'Observe OP', commitment_id: visitC.id,
      start_min: visitStart, end_min: dwellEnd,
    });

    let rvArrival = null;
    if (rv && leg2) {
      // Position holds at the OP through hold+dwell; one trajectory point at the
      // OP at dwellEnd makes interpolation stand still, then the exfil leg runs.
      trajectory.push({ x: op.x, y: op.y, t: dwellEnd, fuel_pct: round1(fuel) });
      t = dwellEnd;
      advance(leg2);
      rvArrival = round1(t);
      schedule.push({
        kind: 'exfil', label: 'Exfil E · cross K-7', commitment_id: exfilC.id,
        start_min: dwellEnd, end_min: rvArrival,
      });
    }

    plans.push(await finalisePlan(stamp, strat, {
      schedule, trajectory,
      state_curves: { fuel_end_pct: round1(fuel) },
      verified: true, kernel_version_verified: KERNEL_VERSION,
    }, { visitC, exfilC, unit, latestOkArrival, arrival, exfilDeadline, rvArrival }));
  }

  return { plans, kernel_version: KERNEL_VERSION };
}

/** Assemble Plan with id = hash({stamp, strategy}) and banded scores over
 *  every commitment (visit + optional exfil). */
async function finalisePlan(stamp, strat, materialisation, ctx) {
  const { visitC, exfilC, unit, latestOkArrival, arrival, exfilDeadline, rvArrival } = ctx;
  const infeasible = !materialisation;

  const score = (margin) => {
    const band = bandFor(margin, unit);
    return { margin_min: margin, margin_band: band === 'violated' ? 'crossed' : band,
             verdict: margin < 0 ? 'violated' : 'satisfied' };
  };

  const satisfaction = [];
  const vMargin = infeasible ? -1 : round1(latestOkArrival - arrival);
  satisfaction.push({ commitment_id: visitC.id, label: 'Observe OP', ...score(vMargin) });
  let eVerdict = null;
  if (exfilC) {
    const eMargin = infeasible || rvArrival == null ? -1 : round1(exfilDeadline - rvArrival);
    const s = score(eMargin);
    eVerdict = s.verdict;
    satisfaction.push({ commitment_id: exfilC.id, label: 'Exfil E', ...s });
  }

  // Cost: total mission time (incl. exfil) bucketed — illustrative (NF9).
  const totalMin = infeasible ? Infinity : (rvArrival ?? arrival);
  const cost_band = totalMin <= 100 ? 'robust' : totalMin <= 140 ? 'marginal' : 'fragile';
  // Robustness: canned per strategy — single baseline, no real sampling (NF9).
  const robustness_band = { tracked: 'robust', direct: 'marginal', covered: 'marginal' }[strat.key];

  const conflicts = ctx.conflicts ?? [
    ...(satisfaction[0].verdict === 'violated' && !infeasible
      ? [{ id: `conflict-${strat.key}-visit`, kind: 'emergent', parties: [visitC.id],
           narrative: 'Observation window unachievable at profile speed.' }] : []),
    ...(eVerdict === 'violated' && !infeasible
      ? [{ id: `conflict-${strat.key}-exfil`, kind: 'emergent', parties: [exfilC.id],
           narrative: 'Exfil deadline missed.' }] : []),
  ];

  return {
    id: await contentId({ stamp, strategy: strat.key }),
    strategy: strat,
    stamp,
    materialisation,
    scores: { satisfaction, cost_band, robustness_band },
    conflicts,
  };
}

const round1 = (n) => Math.round(n * 10) / 10;

// ---------------------------------------------------------------------------
// NF1 — the single evaluation surface. Views and wingman both project through
// these; neither re-derives.

/**
 * Where the vehicle is at plan-time τ (minutes), interpolated along the
 * kernel's own trajectory. Returns fractional cell coords for rendering.
 * @param {any} plan
 * @param {number} tau
 */
export function stateAt(plan, tau) {
  const m = plan.materialisation;
  if (!m) return null;
  const traj = m.trajectory;
  const sched = m.schedule;
  const last = traj[traj.length - 1];

  // Position + fuel: interpolate along the trajectory by time (the dwell is two
  // same-position points, so the vehicle naturally stands still there).
  let x, y, fuel;
  if (tau <= traj[0].t) { x = traj[0].x; y = traj[0].y; fuel = traj[0].fuel_pct; }
  else if (tau >= last.t) { x = last.x; y = last.y; fuel = last.fuel_pct; }
  else {
    let i = 1;
    while (traj[i].t < tau) i++;
    const a = traj[i - 1], b = traj[i];
    const f = (b.t - a.t) ? (tau - a.t) / (b.t - a.t) : 0;
    x = a.x + (b.x - a.x) * f;
    y = a.y + (b.y - a.y) * f;
    fuel = round1(a.fuel_pct + (b.fuel_pct - a.fuel_pct) * f);
  }

  // Phase: the schedule leg whose [start,end) contains tau (transit/hold/visit/
  // exfil); past the last leg → complete.
  let phase = sched[0].kind;
  if (tau >= sched[sched.length - 1].end_min) phase = 'complete';
  else for (const leg of sched) {
    if (tau >= leg.start_min && tau < leg.end_min) { phase = leg.kind; break; }
  }
  return { x, y, phase, fuel_pct: fuel };
}

/**
 * Time-varying measures for one plan at plan-time t — what a candidate looks
 * like mid-flight if followed exactly. Compare's racing ghosts and the live
 * measures strip render this; nothing outside the kernel re-derives it (NF1).
 * @param {any} plan
 * @param {number} t
 * @returns {{phase: string, x: number, y: number, fuel_pct: number,
 *            dist_km: number, milestone: string} | null}
 */
export function measuresAt(plan, t) {
  const m = plan.materialisation;
  if (!m) return null;
  const st = stateAt(plan, t);
  const traj = m.trajectory;
  const visit = m.schedule.find((s) => s.kind === 'visit');
  const exfil = m.schedule.find((s) => s.kind === 'exfil');

  // Cumulative distance along the kernel's own trajectory, interpolating the
  // segment in progress.
  let dist = 0;
  for (let i = 1; i < traj.length; i++) {
    const a = traj[i - 1], b = traj[i];
    const seg = Math.hypot(b.x - a.x, b.y - a.y) * CELL_M;
    if (t >= b.t) { dist += seg; continue; }
    if (t > a.t) dist += seg * ((t - a.t) / (b.t - a.t));
    break;
  }

  let milestone;
  if (st.phase === 'transit') milestone = `OP in ${Math.round(Math.max(0, visit.start_min - t))} min`;
  else if (st.phase === 'hold') milestone = 'holding — window not open';
  else if (st.phase === 'visit') milestone = `observing · ${Math.round(Math.max(0, t - visit.start_min))} min`;
  else if (st.phase === 'exfil') milestone = `RV E in ${Math.round(Math.max(0, exfil.end_min - t))} min`;
  else milestone = exfil ? 'at RV East' : 'observation complete';

  return {
    phase: st.phase,
    x: st.x, y: st.y,
    fuel_pct: st.fuel_pct,
    dist_km: Math.round(dist / 100) / 10,
    milestone,
  };
}

/**
 * Live margin assessment of the OBSERVE commitment under an accumulated delay —
 * the wingman's live band monitor comes through here (NF1).
 * @param {any} plan
 * @param {any} commitment   the visit commitment
 * @param {number} unit       band unit (minutes)
 * @param {number} delayMin   accumulated execution delay
 */
export function assess(plan, commitment, unit, delayMin = 0) {
  if (!plan.materialisation) {
    return { projected_arrival: null, margin: -1, band: 'violated', verdict: 'violated' };
  }
  const window = commitment.activity.when.window;
  const duration = commitment.activity.duration.min_min;
  const plannedArrival = plan.materialisation.schedule[0].end_min;     // transit→OP end
  const projected = round1(plannedArrival + delayMin);
  const margin = round1((window.end_min - duration) - projected);
  const band = bandFor(margin, unit);
  return { projected_arrival: projected, margin, band, verdict: margin < 0 ? 'violated' : 'satisfied' };
}

/**
 * Margin assessment of the EXFIL commitment (deadline at RV East) under an
 * accumulated delay — the whole timeline shifts by the delay, so the RV
 * arrival does too.
 * @param {any} plan
 * @param {any} commitment   the exfil commitment (when.before_min)
 * @param {number} unit
 * @param {number} delayMin
 */
export function assessExfil(plan, commitment, unit, delayMin = 0) {
  const exfil = plan.materialisation?.schedule?.find((s) => s.kind === 'exfil');
  if (!exfil) return { projected_arrival: null, margin: -1, band: 'violated', verdict: 'violated' };
  const deadline = commitment.activity.when.before_min;
  const projected = round1(exfil.end_min + delayMin);
  const margin = round1(deadline - projected);
  const band = bandFor(margin, unit);
  return { projected_arrival: projected, margin, band, verdict: margin < 0 ? 'violated' : 'satisfied' };
}
