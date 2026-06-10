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
import { bandUnitFor, CELL_M, fordOpenAt, nextFordOpen } from './world.js';
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

// ---------------------------------------------------------------------------
// Tidal ford (increment A): the K-7 crossing is passable only inside the
// low-tide window, so an exfil leg that uses it is TIME-DEPENDENT. Rather than
// a full time-expanded search, the kernel weighs the two real alternatives —
// wait at the bank for the window, or detour via the K-9 bridge — and commits
// to whichever reaches the RV earlier. Both candidates are materialised with
// the real movement model, so the weighing is honest (NF9: real-but-trivial).

const isFord = (cells, idx) => cells[idx].terrain === 'ford';

/**
 * Materialise one exfil path with tide-aware timing: stepping INTO a ford cell
 * outside the low-tide window means holding at the bank until it opens.
 * Pure — returns points/legs to splice, does not mutate.
 */
function materialiseExfil(cells, grid, profile, path, t0, fuel0, suffix = '') {
  let t = t0, fuel = fuel0, waitMin = 0, bankMin = null, openMin = null, viaFord = false;
  const points = [];
  for (let i = 1; i < path.length; i++) {
    const from = path[i - 1].y * grid.w + path[i - 1].x;
    const to = path[i].y * grid.w + path[i].x;
    if (isFord(cells, to)) {
      viaFord = true;
      if (!fordOpenAt(t)) {                    // hold at the bank for the window
        const w = nextFordOpen(t);
        bankMin = round1(t); openMin = round1(w); waitMin = round1(waitMin + (w - t));
        points.push({ x: path[i - 1].x, y: path[i - 1].y, t: bankMin, fuel_pct: round1(fuel) });
        points.push({ x: path[i - 1].x, y: path[i - 1].y, t: openMin, fuel_pct: round1(fuel) });
        t = w;
      }
    }
    const diag = path[i].x !== path[i - 1].x && path[i].y !== path[i - 1].y;
    t += edgeMinutes(cells, profile, from, to, diag);
    fuel -= (diag ? Math.SQRT2 : 1) * 0.35;
    points.push({ x: path[i].x, y: path[i].y, t: round1(t), fuel_pct: round1(fuel) });
  }
  const end = round1(t);
  const legs = [];
  if (waitMin > 0) {
    legs.push({ kind: 'exfil', label: `Exfil E · move to K-7 ford${suffix}`, start_min: t0, end_min: bankMin });
    legs.push({ kind: 'hold', label: `Await low tide — ford opens H+${openMin}`, start_min: bankMin, end_min: openMin });
    legs.push({ kind: 'exfil', label: `Exfil E · cross K-7 ford → RV${suffix}`, start_min: openMin, end_min: end });
  } else {
    const how = viaFord ? 'ford K-7 (tide open)' : 'via K-9 bridge';
    legs.push({ kind: 'exfil', label: `Exfil E · ${how}${suffix}`, start_min: t0, end_min: end });
  }
  return { points, legs, end_min: end, fuel_end: round1(fuel), wait_min: waitMin, bank_min: bankMin, via_ford: viaFord };
}

/**
 * Choose the exfil route from `from` to `rv` departing at `departMin`:
 * the natural (search-optimal) path — waiting out the tide if it uses the
 * ford while closed — versus the ford-free detour. Returns the materialised
 * winner plus the weighing (`decision`), or null if no route exists at all.
 * `cost` carries the caller's biases/no-gos; `hScale` its heuristic scale.
 */
export function chooseExfilRoute(cells, grid, profile, opts) {
  const { from, rv, departMin, fuel0, cost, hScale, suffix = '', naturalPath = null } = opts;
  const natural = naturalPath ?? findPath(grid, from, rv, cost, hScale);
  if (!natural) return null;

  const matNat = materialiseExfil(cells, grid, profile, natural, departMin, fuel0, suffix);
  if (!matNat.via_ford) {
    // Already east of the river (e.g. a rebase after crossing): no tide story.
    if (from.x > 24) {
      matNat.legs[0].label = `Exfil E · continue to RV${suffix}`;
      return { ...matNat, decision: null };
    }
    return { ...matNat, decision: {
      mode: 'no-ford', wait_min: 0,
      narrative: 'route avoids the tidal ford — via K-9 bridge (no tide exposure)',
    } };
  }

  const noFordCost = (a, b, diag) =>
    (isFord(cells, a) || isFord(cells, b)) ? Infinity : cost(a, b, diag);
  const detour = findPath(grid, from, rv, noFordCost, hScale);
  const matDet = detour ? materialiseExfil(cells, grid, profile, detour, departMin, fuel0, suffix) : null;
  const detourExtra = matDet ? round1(matDet.end_min - (matNat.end_min - matNat.wait_min)) : null;

  if (matNat.wait_min === 0) {
    return { ...matNat, decision: {
      mode: 'open', wait_min: 0, ford_rv: matNat.end_min, detour_rv: matDet?.end_min ?? null,
      narrative: `K-7 ford open at the bank — cross now`
        + (matDet ? ` (K-9 detour would arrive H+${matDet.end_min}, +${detourExtra} min)` : ''),
    } };
  }
  if (!matDet || matNat.end_min <= matDet.end_min) {
    return { ...matNat, decision: {
      mode: 'wait', wait_min: matNat.wait_min, ford_rv: matNat.end_min, detour_rv: matDet?.end_min ?? null,
      narrative: `K-7 ford closed at the bank (H+${matNat.bank_min}) — wait ${matNat.wait_min} min for low water`
        + (matDet ? `; beats the K-9 detour (RV H+${matNat.end_min} vs H+${matDet.end_min}): WAIT` : ' (no ford-free detour exists): WAIT'),
    } };
  }
  return { ...matDet, decision: {
    mode: 'detour', wait_min: 0, ford_rv: matNat.end_min, detour_rv: matDet.end_min,
    narrative: `K-7 ford closed until H+${round1(nextFordOpen(matNat.bank_min))}`
      + ` — detour via K-9 (RV H+${matDet.end_min} vs H+${matNat.end_min} waiting): DETOUR`,
  } };
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
    let tideDecision = null;
    if (rv && leg2) {
      // Position holds at the OP through hold+dwell; one trajectory point at the
      // OP at dwellEnd makes interpolation stand still, then the exfil leg runs.
      trajectory.push({ x: op.x, y: op.y, t: dwellEnd, fuel_pct: round1(fuel) });
      // Exfil is time-dependent (tidal ford): weigh wait-for-tide vs K-9 detour.
      const ex = chooseExfilRoute(cells, grid, profile, {
        from: op, rv, departMin: dwellEnd, fuel0: fuel, cost, hScale, naturalPath: leg2,
      });
      trajectory.push(...ex.points);
      for (const leg of ex.legs) schedule.push({ ...leg, commitment_id: exfilC.id });
      rvArrival = ex.end_min;
      fuel = ex.fuel_end;
      tideDecision = ex.decision;
    }

    plans.push(await finalisePlan(stamp, strat, {
      schedule, trajectory,
      state_curves: { fuel_end_pct: round1(fuel) },
      tide: tideDecision,                       // live copy — rebases update it
      verified: true, kernel_version_verified: KERNEL_VERSION,
    }, { visitC, exfilC, unit, latestOkArrival, arrival, exfilDeadline, rvArrival, tideDecision }));
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

  // Cost × robustness: canned per strategy (illustrative, NF9) to present a
  // genuine three-way trade-off so the risk appetite has a real effect —
  // direct is cheap but exposed, covered is dear but safe, tracked is between.
  const cost_band = infeasible ? 'fragile'
    : { direct: 'robust', tracked: 'marginal', covered: 'fragile' }[strat.key];
  const robustness_band = infeasible ? 'fragile'
    : { direct: 'fragile', tracked: 'marginal', covered: 'robust' }[strat.key];

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
    tide_decision: ctx.tideDecision ?? null,   // how the exfil weighed wait vs detour
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
  const exfil = m.schedule.findLast((s) => s.kind === 'exfil');   // RV arrival leg

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
  else if (st.phase === 'hold') {
    const leg = m.schedule.find((s) => s.kind === 'hold' && t >= s.start_min && t < s.end_min);
    if (leg?.label?.includes('tide')) milestone = `awaiting low tide · ford opens in ${Math.round(Math.max(0, leg.end_min - t))} min`;
    else if (leg?.label?.startsWith('Obstruction')) milestone = `track blocked · clears in ${Math.round(Math.max(0, leg.end_min - t))} min`;
    else milestone = 'holding — window not open';
  }
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
  // OP arrival = end of the last transit leg (a rebase may split the transit
  // around obstruction holds; the final piece always ends at the OP).
  const plannedArrival = plan.materialisation.schedule.findLast((s) => s.kind === 'transit').end_min;
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
  // Last exfil leg: a tide wait splits exfil into move → hold → cross, and the
  // RV arrival is the end of the final one.
  const exfil = plan.materialisation?.schedule?.findLast((s) => s.kind === 'exfil');
  if (!exfil) return { projected_arrival: null, margin: -1, band: 'violated', verdict: 'violated' };
  const deadline = commitment.activity.when.before_min;
  const projected = round1(exfil.end_min + delayMin);
  const margin = round1(deadline - projected);
  const band = bandFor(margin, unit);
  return { projected_arrival: projected, margin, band, verdict: margin < 0 ? 'violated' : 'satisfied' };
}

// ---------------------------------------------------------------------------
// Mid-mission re-routing (DEC-24/25): the operator blocks a cell ahead, and the
// wingman re-plans locally from where the vehicle IS to the remaining objective.

/** A* leg between cells avoiding `blocked` (set of cell indices), real cost. */
export function routeLeg(cells, grid, profile, from, to, blocked) {
  const cost = (a, b, diag) =>
    (blocked.has(a) || blocked.has(b)) ? Infinity : edgeMinutes(cells, profile, a, b, diag);
  const bestStep = CELL_M / (profile.speed_by_medium.land_kph * 1000 / 60);
  return findPath(grid, from, to, cost, bestStep);
}

/**
 * Re-route / re-time the in-flight plan from the vehicle's current cell to the
 * remaining objective(s), avoiding `blocked`. Keeps everything already
 * travelled (t < tau, the in-progress leg truncated at tau — except a visit in
 * progress, which is a commitment and stays whole), optionally inserts a hold
 * of `holdMin` at the current cell (an obstruction = a local re-plan, so
 * plan-time stays equal to sim-time and downstream holds absorb the delay),
 * then splices a fresh, re-timed tail; exfil legs go through the same
 * tide-aware wait-vs-detour chooser as planning, evaluated at the new absolute
 * times. Mutates `plan.materialisation` (and records the live tide decision on
 * it as `m.tide`). Returns true, or false if the vehicle is blocked in (no
 * route) — plan left unchanged.
 * @returns {boolean}
 */
export function rerouteExecution(plan, opts) {
  const { cells, grid, profile, tau, blocked, opCell, rvCell, dwellMin, windowStart,
          holdMin = 0, holdLabel = 'Obstruction — track blocked' } = opts;
  const m = plan.materialisation;
  const visit = m.schedule.find((s) => s.kind === 'visit');
  const exfilCid = m.schedule.find((s) => s.kind === 'exfil')?.commitment_id;
  const reachedOP = tau >= visit.start_min;
  const cur = stateAt(plan, tau);
  const curCell = { x: Math.round(cur.x), y: Math.round(cur.y) };

  const cost = (a, b, diag) =>
    (blocked.has(a) || blocked.has(b)) ? Infinity : edgeMinutes(cells, profile, a, b, diag);
  const hScale = CELL_M / (profile.speed_by_medium.land_kph * 1000 / 60);

  const t0 = round1(tau + holdMin);
  let t = t0, fuel = cur.fuel_pct;
  const traj = m.trajectory.filter((p) => p.t < tau);
  traj.push({ x: curCell.x, y: curCell.y, t: round1(tau), fuel_pct: round1(fuel) });
  if (holdMin > 0) traj.push({ x: curCell.x, y: curCell.y, t: t0, fuel_pct: round1(fuel) });
  const advance = (path) => {
    for (let i = 1; i < path.length; i++) {
      const from = path[i - 1].y * grid.w + path[i - 1].x;
      const to = path[i].y * grid.w + path[i].x;
      const diag = path[i].x !== path[i - 1].x && path[i].y !== path[i - 1].y;
      t += edgeMinutes(cells, profile, from, to, diag);
      fuel -= (diag ? Math.SQRT2 : 1) * 0.35;
      traj.push({ x: path[i].x, y: path[i].y, t: round1(t), fuel_pct: round1(fuel) });
    }
  };

  // Past legs survive verbatim; the in-progress one is truncated at tau (a
  // visit in progress survives whole — the dwell is a commitment, not routing).
  const schedule = [];
  let keptVisitWhole = false;
  for (const leg of m.schedule) {
    if (leg.end_min <= tau) schedule.push(leg);
    else if (leg.start_min < tau) {
      if (leg.kind === 'visit') { schedule.push(leg); keptVisitWhole = true; }
      else schedule.push({ ...leg, end_min: round1(tau) });
    }
  }
  if (holdMin > 0) schedule.push({ kind: 'hold', label: holdLabel, start_min: round1(tau), end_min: t0 });

  const spliceExfil = (from, departMin) => {
    const ex = chooseExfilRoute(cells, grid, profile, {
      from, rv: rvCell, departMin, fuel0: fuel, cost, hScale, suffix: ' (re-routed)',
    });
    if (!ex) return false;
    traj.push(...ex.points);
    for (const leg of ex.legs) schedule.push({ ...leg, commitment_id: exfilCid });
    m.tide = ex.decision;
    return true;
  };

  if (!reachedOP) {
    const toOP = routeLeg(cells, grid, profile, curCell, opCell, blocked);
    if (!toOP) return false;                          // blocked in
    advance(toOP);
    const arrival = round1(t);
    if (arrival > t0) schedule.push({ kind: 'transit', label: 'Transit to OP (re-routed)', start_min: t0, end_min: arrival });
    const visitStart = Math.max(arrival, windowStart);
    if (visitStart > arrival) schedule.push({ kind: 'hold', label: 'Hold (await window)', start_min: arrival, end_min: visitStart });
    const dwellEnd = round1(visitStart + dwellMin);
    schedule.push({ kind: 'visit', label: 'Observe OP', commitment_id: visit.commitment_id, start_min: visitStart, end_min: dwellEnd });
    traj.push({ x: opCell.x, y: opCell.y, t: dwellEnd, fuel_pct: round1(fuel) });
    if (rvCell && !spliceExfil(opCell, dwellEnd)) return false;   // no way across at all
  } else {
    // A block during the dwell re-routes the exfil but still finishes the dwell.
    const depart = keptVisitWhole ? Math.max(t0, visit.end_min) : t0;
    if (depart > t0) traj.push({ x: curCell.x, y: curCell.y, t: depart, fuel_pct: round1(fuel) });
    t = depart;
    if (!spliceExfil(curCell, depart)) return false;  // blocked in
  }

  m.trajectory = traj;
  m.schedule = schedule;
  return true;
}
