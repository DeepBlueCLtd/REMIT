// @ts-check
// kernel/kernel.js — the mock kernel (DEC-44, NF9): an honest non-planner, on the H3
// hex grid (ADR-0016).
//
// Real but trivial: each strategy bias runs a deterministic A* over the hex AO (DEC-22
// fan-out), the movement model is trivially parametric (uniform hex steps, no diagonal),
// and scores are banded by a unit derived from channel confidence (NF10). The tidal exfil
// is a genuine time-dependent search (findPathTimed) that weighs waiting for a wath
// window against the all-tide bridge detour — multiple fords in one search.
//
// NF1 lives here: `stateAt` and `assess` are the single evaluation surface. Views project
// through them; the wingman re-anchors through them; nothing else re-derives.

import { findPath, findPathTimed } from './astar.js';
import { bandUnitFor, fordOpenAt, nextFordOpen } from './world.js';
import { hexDistance, haversineM } from './hexgrid.js';
import { contentId } from '../shapes/canonical.js';

export const KERNEL_VERSION = 'mock-0.2';

/** DEC-22 v1 strategy axes (the fan-out that makes a handful). */
const STRATEGIES = [
  { key: 'direct',  label: 'Direct',  axis: 'time/speed',   blurb: 'shortest time, cuts cross-country' },
  { key: 'tracked', label: 'Tracked', axis: 'completeness', blurb: 'hugs roads — predictable, fast, exposed' },
  { key: 'covered', label: 'Covered', axis: 'exposure',     blurb: 'maximises cover — slow, concealed' },
];

const round1 = (n) => Math.round(n * 10) / 10;
const isFord = (cells, id) => cells[id].terrain === 'ford';
const isBank = (cells, ao, id) =>
  !isFord(cells, id) && cells[id].mobility > 0 && ao.adj[id].some((n) => isFord(cells, n));
/** Trajectory point for a hex id: the H3 string (identity) + centroid lat/lng (render/interp). */
const pt = (ao, id) => ({ h3: ao.indexes[id], lat: ao.centers[id][0], lng: ao.centers[id][1] });

/**
 * Minutes to traverse between two adjacent hexes (uniform parametric MovementModel:
 * speed = profile speed × mean mobility; one isotropic hex step, no diagonal).
 */
function edgeMinutes(cells, profile, ao, from, to) {
  if (cells[from].mobility === 0 || cells[to].mobility === 0) return Infinity;
  const m = (cells[from].mobility + cells[to].mobility) / 2;
  return ao.stepM / (profile.speed_by_medium.land_kph * m * 1000 / 60);
}

/** Strategy-biased search cost (minute-equivalents). The bias warps the SEARCH metric only;
 *  materialised time always uses the real movement model. `nogo` is the set of operator
 *  no-go hex ids (steering, DEC-24): impassable to the search. */
function strategyCost(strategy, cells, profile, ao, nogo) {
  const roadlike = (c) => c.terrain === 'road' || c.terrain === 'track';
  return (from, to) => {
    if (nogo.has(to) || nogo.has(from)) return Infinity;
    const t = edgeMinutes(cells, profile, ao, from, to);
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
// Tidal exfil (ADR-0016): the river is crossed by several waths (tidal fords, open only
// within the low-tide window) and one all-tide road bridge. A time-dependent A* over
// (cell, minute) states finds the earliest/cheapest crossing — waiting at a dry bank for
// a window, or detouring via the bridge — in a single search. We then read back the
// trajectory points, schedule legs, and a tide decision.

/**
 * Materialise the exfil from `fromId` to `rvId` departing at `departMin` with the real
 * movement model and tide. Returns null only if there is no crossing at all.
 */
function materialiseExfil(cells, ao, profile, fromId, rvId, departMin, fuel0, cost, suffix = '') {
  const edgeMin = (a, b) => edgeMinutes(cells, profile, ao, a, b);
  const stepMin = (ao.stepM / 1000 / profile.speed_by_medium.land_kph) * 60;
  const res = findPathTimed(ao, fromId, rvId, departMin, {
    edgeCost: cost, edgeMin,
    isFord: (id) => isFord(cells, id),
    isBank: (id) => isBank(cells, ao, id),
    fordOpen: (t) => fordOpenAt(t),
    nextOpen: (t) => nextFordOpen(t),
    h: (id) => hexDistance(ao, id, rvId) * stepMin,
    tMax: 1000,
  });
  if (!res) return null;

  const steps = res.steps;
  const points = [];
  const legs = [];
  let fuel = fuel0, segStartT = departMin, moved = false, viaFord = false, waited = false, waitTotal = 0;

  for (let i = 1; i < steps.length; i++) {
    const prev = steps[i - 1], cur = steps[i];
    if (cur.id === prev.id) {                                    // wait at a dry bank
      if (moved) {
        legs.push({ kind: 'exfil', label: `Exfil · move to crossing${suffix}`, start_min: round1(segStartT), end_min: round1(prev.t) });
        moved = false;
      }
      legs.push({ kind: 'hold', label: `Await low tide — waths open H+${round1(cur.t)}`, start_min: round1(prev.t), end_min: round1(cur.t) });
      waited = true; waitTotal += cur.t - prev.t;
      points.push({ ...pt(ao, prev.id), t: round1(prev.t), fuel_pct: round1(fuel) });
      points.push({ ...pt(ao, cur.id), t: round1(cur.t), fuel_pct: round1(fuel) });
      segStartT = cur.t;
    } else {                                                     // move one hex
      fuel -= 0.35;
      if (isFord(cells, cur.id)) viaFord = true;
      points.push({ ...pt(ao, cur.id), t: round1(cur.t), fuel_pct: round1(fuel) });
      moved = true;
    }
  }
  const end = round1(steps[steps.length - 1].t);
  if (moved) legs.push({ kind: 'exfil', label: `Exfil · cross to RV${suffix}`, start_min: round1(segStartT), end_min: end });
  if (legs.length === 0) legs.push({ kind: 'exfil', label: `Exfil · to RV${suffix}`, start_min: round1(departMin), end_min: end });

  const mode = !viaFord ? 'detour' : (waited ? 'wait' : 'open');
  const narrative = !viaFord
    ? 'route avoids the tidal fords — crosses by the all-tide bridge'
    : waited
      ? `wath shut at the bank — wait ${round1(waitTotal)} min for low water, then cross (RV H+${end})`
      : `wath open at the bank — cross now (RV H+${end})`;

  return { points, legs, end_min: end, fuel_end: round1(fuel), via_ford: viaFord, wait_min: round1(waitTotal),
           decision: { mode, wait_min: round1(waitTotal), rv_min: end, narrative } };
}

/**
 * The kernel call behind POST /plan/handful. Pure function of its inputs: same body →
 * same plans, ids included (NF3, decision-level). `input.ao` is the hex AO (by reference;
 * not part of the content-addressed baseline).
 */
export async function planHandful(input) {
  const { baseline, profile, state, ao } = input;
  const cells = baseline.cells;
  const grid = baseline.medium.grid;
  const unit = bandUnitFor(baseline.channels[0]);
  const commitments = input.requirement.commitments;
  const visitC = commitments[0];
  const exfilC = commitments[1];
  const op = visitC.activity.where;                       // { h3, alias }
  const opId = ao.idOf.get(op.h3);
  const window = visitC.activity.when.window;
  const duration = visitC.activity.duration.min_min;
  const latestOkArrival = window.end_min - duration;
  const rv = exfilC?.activity?.where ?? null;             // { h3 }
  const rvId = rv ? ao.idOf.get(rv.h3) : null;
  const exfilDeadline = exfilC?.activity?.when?.before_min ?? null;

  const stamp = {
    requirement_version: input.requirement_version,
    baseline_version: input.baseline_version,
    excursions: [],
    config_core_hash: input.config_core,
    profile_version: input.profile_version,
    start: { h3: state.position.h3, clock_min: state.clock_min },
    appetites: input.appetites,
    steering: input.steering ?? [],
    kernel_version: KERNEL_VERSION,
    strategy_seed: input.strategy_seed,
  };

  const startId = ao.idOf.get(state.position.h3);
  const stepMin = (ao.stepM / 1000 / profile.speed_by_medium.land_kph) * 60;
  const plans = [];
  const seenTrajectories = new Set();

  // Operator steering (DEC-24): no-go hexes the search must route around.
  const nogo = new Set();
  for (const c of (input.steering ?? [])) {
    if (c.type === 'no-go') for (const cell of (c.cells ?? [])) {
      const id = ao.idOf.get(cell.h3);
      if (id !== undefined) nogo.add(id);
    }
  }

  for (const strat of STRATEGIES) {
    const cost = strategyCost(strat.key, cells, profile, ao, nogo);
    const hScale = stepMin * (strat.key === 'tracked' ? 0.65 : 1);
    const hTo = (goal) => (id) => hexDistance(ao, id, goal) * hScale;
    const leg1 = findPath(ao, startId, opId, cost, hTo(opId));            // base → OP (dry)

    if (leg1 === null) {
      plans.push(await finalisePlan(stamp, strat, null, {
        conflicts: [{
          id: `conflict-${strat.key}`, kind: 'structural', parties: [visitC.id],
          narrative: `No route from start to ${op.alias ?? 'OP'}.`,
        }],
        visitC, exfilC, unit, latestOkArrival, exfilDeadline,
      }));
      continue;
    }

    // Materialise the OP leg with the REAL movement model (bias was search-only).
    let t = state.clock_min;
    let fuel = state.endurance_fuel_pct;
    const trajectory = [{ ...pt(ao, startId), t: round1(t), fuel_pct: round1(fuel) }];
    for (let i = 1; i < leg1.length; i++) {
      t += edgeMinutes(cells, profile, ao, leg1[i - 1], leg1[i]);
      fuel -= 0.35;
      trajectory.push({ ...pt(ao, leg1[i]), t: round1(t), fuel_pct: round1(fuel) });
    }
    const arrival = round1(t);
    const visitStart = Math.max(arrival, window.start_min);
    const dwellEnd = round1(visitStart + duration);

    const schedule = [{ kind: 'transit', label: 'Transit to OP', start_min: state.clock_min, end_min: arrival }];
    if (visitStart > arrival) schedule.push({ kind: 'hold', label: 'Hold (await window)', start_min: arrival, end_min: visitStart });
    schedule.push({ kind: 'visit', label: 'Observe OP', commitment_id: visitC.id, start_min: visitStart, end_min: dwellEnd });

    let exfil = null;
    if (rvId != null) {
      // Position holds at the OP through hold+dwell; one point at the OP at dwellEnd makes
      // interpolation stand still, then the time-dependent exfil runs.
      trajectory.push({ ...pt(ao, opId), t: dwellEnd, fuel_pct: round1(fuel) });
      exfil = materialiseExfil(cells, ao, profile, opId, rvId, dwellEnd, fuel, cost);
      if (exfil === null) {
        plans.push(await finalisePlan(stamp, strat, null, {
          conflicts: [{
            id: `conflict-${strat.key}`, kind: 'structural', parties: [exfilC.id],
            narrative: 'No exfil route OP → RV (no crossing of the river).',
          }],
          visitC, exfilC, unit, latestOkArrival, exfilDeadline,
        }));
        continue;
      }
      trajectory.push(...exfil.points);
      for (const leg of exfil.legs) schedule.push({ ...leg, commitment_id: exfilC.id });
      fuel = exfil.fuel_end;
    }

    // Within-band duplicate rejection (DEC-22): identical trajectories collapse.
    const sig = trajectory.map((p) => p.h3).join(';');
    if (seenTrajectories.has(sig)) continue;
    seenTrajectories.add(sig);

    plans.push(await finalisePlan(stamp, strat, {
      schedule, trajectory,
      state_curves: { fuel_end_pct: round1(fuel) },
      tide: exfil?.decision ?? null,
      verified: true, kernel_version_verified: KERNEL_VERSION,
    }, { visitC, exfilC, unit, latestOkArrival, arrival, exfilDeadline,
         rvArrival: exfil?.end_min ?? null, tideDecision: exfil?.decision ?? null }));
  }

  return { plans, kernel_version: KERNEL_VERSION };
}

/** Assemble Plan with id = hash({stamp, strategy}) and banded scores over every
 *  commitment (visit + optional exfil). */
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
    tide_decision: ctx.tideDecision ?? null,
    conflicts,
  };
}

// ---------------------------------------------------------------------------
// NF1 — the single evaluation surface. Views and wingman both project through these.

/**
 * Where the vehicle is at plan-time τ (minutes), interpolated in lat/lng along the
 * kernel's own trajectory (the dwell is two same-position points, so it stands still).
 * Returns lat/lng for rendering plus the nearest discrete hex (`h3`) for re-routing.
 * @param {any} plan
 * @param {number} tau
 */
export function stateAt(plan, tau) {
  const m = plan.materialisation;
  if (!m) return null;
  const traj = m.trajectory;
  const sched = m.schedule;
  const last = traj[traj.length - 1];

  let lat, lng, fuel, h3;
  if (tau <= traj[0].t) { ({ lat, lng } = traj[0]); fuel = traj[0].fuel_pct; h3 = traj[0].h3; }
  else if (tau >= last.t) { ({ lat, lng } = last); fuel = last.fuel_pct; h3 = last.h3; }
  else {
    let i = 1;
    while (traj[i].t < tau) i++;
    const a = traj[i - 1], b = traj[i];
    const f = (b.t - a.t) ? (tau - a.t) / (b.t - a.t) : 0;
    lat = a.lat + (b.lat - a.lat) * f;
    lng = a.lng + (b.lng - a.lng) * f;
    fuel = round1(a.fuel_pct + (b.fuel_pct - a.fuel_pct) * f);
    h3 = f < 0.5 ? a.h3 : b.h3;
  }

  let phase = sched[0].kind;
  if (tau >= sched[sched.length - 1].end_min) phase = 'complete';
  else for (const leg of sched) {
    if (tau >= leg.start_min && tau < leg.end_min) { phase = leg.kind; break; }
  }
  return { lat, lng, h3, phase, fuel_pct: fuel };
}

/**
 * Time-varying measures for one plan at plan-time t (NF1).
 * @param {any} plan
 * @param {number} t
 */
export function measuresAt(plan, t) {
  const m = plan.materialisation;
  if (!m) return null;
  const st = stateAt(plan, t);
  const traj = m.trajectory;
  const visit = m.schedule.find((s) => s.kind === 'visit');
  const exfil = m.schedule.findLast((s) => s.kind === 'exfil');

  let dist = 0;
  for (let i = 1; i < traj.length; i++) {
    const a = traj[i - 1], b = traj[i];
    const seg = haversineM(a.lat, a.lng, b.lat, b.lng);
    if (t >= b.t) { dist += seg; continue; }
    if (t > a.t) dist += seg * ((t - a.t) / (b.t - a.t));
    break;
  }

  let milestone;
  if (st.phase === 'transit') milestone = `OP in ${Math.round(Math.max(0, visit.start_min - t))} min`;
  else if (st.phase === 'hold') {
    const leg = m.schedule.find((s) => s.kind === 'hold' && t >= s.start_min && t < s.end_min);
    if (leg?.label?.includes('tide') || leg?.label?.includes('wath')) milestone = `awaiting low tide · waths open in ${Math.round(Math.max(0, leg.end_min - t))} min`;
    else if (leg?.label?.startsWith('Obstruction')) milestone = `track blocked · clears in ${Math.round(Math.max(0, leg.end_min - t))} min`;
    else milestone = 'holding — window not open';
  }
  else if (st.phase === 'visit') milestone = `observing · ${Math.round(Math.max(0, t - visit.start_min))} min`;
  else if (st.phase === 'exfil') milestone = `RV E in ${Math.round(Math.max(0, exfil.end_min - t))} min`;
  else milestone = exfil ? 'at RV East' : 'observation complete';

  return { phase: st.phase, lat: st.lat, lng: st.lng, fuel_pct: st.fuel_pct,
           dist_km: Math.round(dist / 100) / 10, milestone };
}

/**
 * Live margin assessment of the OBSERVE commitment under an accumulated delay (NF1).
 */
export function assess(plan, commitment, unit, delayMin = 0) {
  if (!plan.materialisation) {
    return { projected_arrival: null, margin: -1, band: 'violated', verdict: 'violated' };
  }
  const window = commitment.activity.when.window;
  const duration = commitment.activity.duration.min_min;
  const plannedArrival = plan.materialisation.schedule.findLast((s) => s.kind === 'transit').end_min;
  const projected = round1(plannedArrival + delayMin);
  const margin = round1((window.end_min - duration) - projected);
  const band = bandFor(margin, unit);
  return { projected_arrival: projected, margin, band, verdict: margin < 0 ? 'violated' : 'satisfied' };
}

/** Margin assessment of the EXFIL commitment (deadline at RV East) under a delay. */
export function assessExfil(plan, commitment, unit, delayMin = 0) {
  const exfil = plan.materialisation?.schedule?.findLast((s) => s.kind === 'exfil');
  if (!exfil) return { projected_arrival: null, margin: -1, band: 'violated', verdict: 'violated' };
  const deadline = commitment.activity.when.before_min;
  const projected = round1(exfil.end_min + delayMin);
  const margin = round1(deadline - projected);
  const band = bandFor(margin, unit);
  return { projected_arrival: projected, margin, band, verdict: margin < 0 ? 'violated' : 'satisfied' };
}

// ---------------------------------------------------------------------------
// Mid-mission re-routing (DEC-24/25): the operator blocks a hex ahead, and the wingman
// re-plans locally from where the vehicle IS to the remaining objective.

/** Spatial A* leg between hexes avoiding `blocked` (set of hex ids), real cost. */
export function routeLeg(cells, ao, profile, fromId, toId, blocked) {
  const cost = (a, b) => (blocked.has(a) || blocked.has(b)) ? Infinity : edgeMinutes(cells, profile, ao, a, b);
  const stepMin = (ao.stepM / 1000 / profile.speed_by_medium.land_kph) * 60;
  return findPath(ao, fromId, toId, cost, (id) => hexDistance(ao, id, toId) * stepMin);
}

/**
 * Re-route / re-time the in-flight plan from the vehicle's current hex to the remaining
 * objective(s), avoiding `blocked`. Keeps everything already travelled, optionally inserts
 * a hold of `holdMin`, then splices a fresh, re-timed tail; the exfil goes through the same
 * time-dependent crossing search as planning. Mutates `plan.materialisation`. Returns true,
 * or false if the vehicle is blocked in.
 * @returns {boolean}
 */
export function rerouteExecution(plan, opts) {
  const { cells, ao, profile, tau, blocked, opId, rvId, dwellMin, windowStart,
          holdMin = 0, holdLabel = 'Obstruction — track blocked' } = opts;
  const m = plan.materialisation;
  const visit = m.schedule.find((s) => s.kind === 'visit');
  const exfilCid = m.schedule.find((s) => s.kind === 'exfil')?.commitment_id;
  const reachedOP = tau >= visit.start_min;
  const cur = stateAt(plan, tau);
  const curId = ao.idOf.get(cur.h3);

  const cost = (a, b) => (blocked.has(a) || blocked.has(b)) ? Infinity : edgeMinutes(cells, profile, ao, a, b);

  const t0 = round1(tau + holdMin);
  let t = t0, fuel = cur.fuel_pct;
  const traj = m.trajectory.filter((p) => p.t < tau);
  traj.push({ ...pt(ao, curId), t: round1(tau), fuel_pct: round1(fuel) });
  if (holdMin > 0) traj.push({ ...pt(ao, curId), t: t0, fuel_pct: round1(fuel) });
  const advance = (path) => {
    for (let i = 1; i < path.length; i++) {
      t += edgeMinutes(cells, profile, ao, path[i - 1], path[i]);
      fuel -= 0.35;
      traj.push({ ...pt(ao, path[i]), t: round1(t), fuel_pct: round1(fuel) });
    }
  };

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

  const spliceExfil = (fromId, departMin) => {
    const ex = materialiseExfil(cells, ao, profile, fromId, rvId, departMin, fuel, cost, ' (re-routed)');
    if (!ex) return false;
    traj.push(...ex.points);
    for (const leg of ex.legs) schedule.push({ ...leg, commitment_id: exfilCid });
    m.tide = ex.decision;
    fuel = ex.fuel_end;
    return true;
  };

  if (!reachedOP) {
    const toOP = routeLeg(cells, ao, profile, curId, opId, blocked);
    if (!toOP) return false;
    advance(toOP);
    const arrival = round1(t);
    if (arrival > t0) schedule.push({ kind: 'transit', label: 'Transit to OP (re-routed)', start_min: t0, end_min: arrival });
    const visitStart = Math.max(arrival, windowStart);
    if (visitStart > arrival) schedule.push({ kind: 'hold', label: 'Hold (await window)', start_min: arrival, end_min: visitStart });
    const dwellEnd = round1(visitStart + dwellMin);
    schedule.push({ kind: 'visit', label: 'Observe OP', commitment_id: visit.commitment_id, start_min: visitStart, end_min: dwellEnd });
    traj.push({ ...pt(ao, opId), t: dwellEnd, fuel_pct: round1(fuel) });
    if (rvId != null && !spliceExfil(opId, dwellEnd)) return false;
  } else {
    const depart = keptVisitWhole ? Math.max(t0, visit.end_min) : t0;
    if (depart > t0) traj.push({ ...pt(ao, curId), t: depart, fuel_pct: round1(fuel) });
    t = depart;
    if (!spliceExfil(curId, depart)) return false;
  }

  m.trajectory = traj;
  m.schedule = schedule;
  return true;
}
