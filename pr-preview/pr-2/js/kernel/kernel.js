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
 *  materialised time always uses the real movement model. */
function strategyCost(strategy, cells, profile) {
  const roadlike = (c) => c.terrain === 'road' || c.terrain === 'track';
  return (from, to, diag) => {
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
  const commitment = input.requirement.commitments[0];
  const target = commitment.activity.where;
  const window = commitment.activity.when.window;
  const duration = commitment.activity.duration.min_min;
  const latestOkArrival = window.end_min - duration;

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

  const plans = [];
  const seenTrajectories = new Set();

  for (const strat of STRATEGIES) {
    const cost = strategyCost(strat.key, cells, profile);
    // Admissible heuristic scale: best possible minutes per orthogonal step,
    // tightened by the strategy's own minimum multiplier.
    const bestStep = CELL_M / (profile.speed_by_medium.land_kph * 1000 / 60);
    const hScale = bestStep * (strat.key === 'tracked' ? 0.65 : 1);
    const path = findPath(grid, state.position, target, cost, hScale);

    if (!path) {
      plans.push(await finalisePlan(stamp, strat, null, {
        conflicts: [{
          id: `conflict-${strat.key}`, kind: 'structural',
          parties: [commitment.id],
          narrative: `No traversable route from start to ${target.x},${target.y}.`,
        }],
        commitment, unit, latestOkArrival,
      }));
      continue;
    }

    // Within-band duplicate rejection (DEC-22): identical trajectories collapse.
    const sig = path.map((p) => p.x + ',' + p.y).join(';');
    if (seenTrajectories.has(sig)) continue;
    seenTrajectories.add(sig);

    // Materialise with the REAL movement model (bias was search-only).
    let t = state.clock_min;
    let fuel = state.endurance_fuel_pct;
    const trajectory = [{ x: path[0].x, y: path[0].y, t: round1(t), fuel_pct: round1(fuel) }];
    for (let i = 1; i < path.length; i++) {
      const from = path[i - 1].y * grid.w + path[i - 1].x;
      const to = path[i].y * grid.w + path[i].x;
      const diag = path[i].x !== path[i - 1].x && path[i].y !== path[i - 1].y;
      t += edgeMinutes(cells, profile, from, to, diag);
      fuel -= (diag ? Math.SQRT2 : 1) * 0.35;       // toy consumption: %/cell
      trajectory.push({ x: path[i].x, y: path[i].y, t: round1(t), fuel_pct: round1(fuel) });
    }
    const arrival = round1(t);
    const visitStart = Math.max(arrival, window.start_min);
    const schedule = [{ kind: 'transit', label: 'Transit to OP', start_min: state.clock_min, end_min: arrival }];
    if (visitStart > arrival) {
      schedule.push({ kind: 'hold', label: 'Hold (await window)', start_min: arrival, end_min: visitStart });
    }
    schedule.push({
      kind: 'visit', label: 'Observe (visit)', commitment_id: commitment.id,
      start_min: visitStart, end_min: visitStart + duration,
    });

    plans.push(await finalisePlan(stamp, strat, {
      schedule, trajectory,
      state_curves: { fuel_end_pct: round1(fuel) },
      verified: true, kernel_version_verified: KERNEL_VERSION,
    }, { commitment, unit, latestOkArrival, arrival }));
  }

  return { plans, kernel_version: KERNEL_VERSION };
}

/** Assemble Plan with id = hash({stamp, strategy}) and banded scores. */
async function finalisePlan(stamp, strat, materialisation, ctx) {
  const { commitment, unit, latestOkArrival, arrival } = ctx;
  const infeasible = !materialisation;
  const margin = infeasible ? -1 : round1(latestOkArrival - arrival);
  const band = bandFor(margin, unit);
  const verdict = infeasible || margin < 0 ? 'violated' : 'satisfied';

  // Cost: time-bucketed (canned thresholds — illustrative, NF9).
  const totalMin = infeasible ? Infinity : arrival;
  const cost_band = totalMin <= 35 ? 'robust' : totalMin <= 50 ? 'marginal' : 'fragile';
  // Robustness: canned per strategy — single baseline, no real sampling (NF9).
  const robustness_band = { tracked: 'robust', direct: 'marginal', covered: 'marginal' }[strat.key];

  const conflicts = ctx.conflicts ?? (verdict === 'violated' && !infeasible ? [{
    id: `conflict-${strat.key}-window`, kind: 'emergent', parties: [commitment.id],
    narrative: 'Window unachievable at profile speed.',
  }] : []);

  return {
    id: await contentId({ stamp, strategy: strat.key }),
    strategy: strat,
    stamp,
    materialisation,
    scores: {
      satisfaction: [{
        commitment_id: commitment.id, verdict,
        margin_min: margin, margin_band: band === 'violated' ? 'crossed' : band,
      }],
      cost_band, robustness_band,
    },
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
  const visit = m.schedule[m.schedule.length - 1];
  const last = traj[traj.length - 1];
  if (tau <= traj[0].t) return { x: traj[0].x, y: traj[0].y, phase: 'transit', fuel_pct: traj[0].fuel_pct };
  if (tau >= last.t) {
    const phase = tau >= visit.end_min ? 'complete' : tau >= visit.start_min ? 'visit' : 'hold';
    return { x: last.x, y: last.y, phase, fuel_pct: last.fuel_pct };
  }
  let i = 1;
  while (traj[i].t < tau) i++;
  const a = traj[i - 1], b = traj[i];
  const f = (tau - a.t) / (b.t - a.t);
  return {
    x: a.x + (b.x - a.x) * f,
    y: a.y + (b.y - a.y) * f,
    phase: 'transit',
    fuel_pct: round1(a.fuel_pct + (b.fuel_pct - a.fuel_pct) * f),
  };
}

/**
 * Live margin assessment for one commitment under an accumulated delay —
 * the wingman's band monitor and Compare's matrix both come through here.
 * @param {any} plan
 * @param {any} commitment
 * @param {number} unit       band unit (minutes)
 * @param {number} delayMin   accumulated execution delay
 */
export function assess(plan, commitment, unit, delayMin = 0) {
  if (!plan.materialisation) {
    return { projected_arrival: null, margin: -1, band: 'violated', verdict: 'violated' };
  }
  const window = commitment.activity.when.window;
  const duration = commitment.activity.duration.min_min;
  const plannedArrival = plan.materialisation.schedule[0].end_min;
  const projected = round1(plannedArrival + delayMin);
  const margin = round1((window.end_min - duration) - projected);
  const band = bandFor(margin, unit);
  return { projected_arrival: projected, margin, band, verdict: margin < 0 ? 'violated' : 'satisfied' };
}
