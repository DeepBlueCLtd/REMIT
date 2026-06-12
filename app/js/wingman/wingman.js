// @ts-check
// wingman/wingman.js — Execute stage (DEC-25, operator hat).
//
// Execution is a mode, not a subsystem: simulated clock/position playback of
// the selected plan, the SAME kernel evaluator re-anchored to here-now (NF1),
// one live margin band with an alert iff the band is crossed (E3, NF10 gives
// the threshold), optional manual observation (E5), and an append-only
// execution log (the after-action record, → Learn). Local loop — never over
// the seam for the live monitor (DEC-40-D); log writes go via the seam.

import { assess, assessExfil, stateAt, rerouteExecution } from '../kernel/kernel.js';

/**
 * @param {HTMLElement} el
 * @param {{seam: import('../seam/seam.js').SeamClient,
 *          missionId: string, plan: any, commitment: any, exfilCommitment?: any,
 *          bandUnit: number,
 *          playhead: import('../views/render.js').Playhead,
 *          resetLog?: () => void,
 *          world?: {cells: any[], ao: any, profile: any},
 *          onObstructions?: (list: {tau: number, h3: string, lat: number, lng: number}[]) => void,
 *          onBlocked?: (cells: {h3: string}[]) => void,
 *          onComplete: (summary: any) => void}} ctx
 * @returns {{ pause: () => void }} handle so the host can pause live playback
 *          (e.g. when the user grabs the scrubber to review).
 */
export function mountWingman(el, ctx) {
  const { plan, commitment, exfilCommitment, bandUnit, missionId, world } = ctx;
  const ao = world?.ao;
  const shortH3 = (/** @type {string} */ h) => h.slice(-6);
  const sched = plan.materialisation.schedule;
  let missionEnd = sched[sched.length - 1].end_min;     // exfil arrival (or visit end)

  // Objectives the re-router needs (DEC-24/25), as hex ids.
  const opId = ao ? ao.idOf.get(commitment.activity.where.h3) : null;
  const rvId = ao && exfilCommitment ? ao.idOf.get(exfilCommitment.activity.where.h3) : null;
  const dwellMin = commitment.activity.duration.min_min;
  const windowStart = commitment.activity.when.window.start_min;

  const exec = {
    simT: 0,
    delayMin: 0,
    lastTau: 0,                                          // monotonic plan-time (see tick)
    lastBand: assess(plan, commitment, bandUnit, 0).band,
    lastLabel: 'observe',                                // which commitment the band tracks
    visitVerdict: /** @type {string|null} */ (null),     // locked once past the OP
    obstructions: /** @type {{tau:number, h3:string, lat:number, lng:number}[]} */ ([]),
    blocked: new Set(),                                  // mid-mission blocked cell indices
    complete: false,
  };
  // Pristine route to restore on Restart (re-routes mutate plan.materialisation).
  const pristineMat = structuredClone(plan.materialisation);

  el.innerHTML = `
    <p class="stage-intro">Simulated playback against the live requirement: the wingman
    re-runs the <em>same</em> margin assessment the kernel scored with (NF1), and speaks
    only when the band is crossed (E3).</p>
    <div class="row exec-controls">
      <button id="wx-play" class="primary" data-testid="wx-play">▶ Play 2 min/s</button>
      <label class="speed-ctl">speed
        <input id="wx-speed" data-testid="wx-speed" type="range" min="1" max="9" step="1" value="1"
               aria-label="time acceleration">
        <b id="wx-speed-label">2 min/s</b>
      </label>
      <button id="wx-restart" data-testid="wx-restart">↺ Restart</button>
      <button id="wx-step10" data-testid="wx-step10">Step +10 min</button>
      <button id="wx-step" data-testid="wx-step">Step +30 min</button>
      <button id="wx-delay5" class="warn" data-testid="wx-delay5">Obstruction +5 min</button>
      <button id="wx-delay" class="warn" data-testid="wx-delay">Obstruction +25 min</button>
      <button id="wx-block" class="warn" data-testid="wx-block">Block next cell ✕ → re-route</button>
    </div>
    <div class="exec-readouts">
      <span class="readout">sim clock <b id="wx-clock" data-testid="wx-clock">H+0</b></span>
      <span class="readout">margin <b id="wx-margin" data-testid="wx-margin">—</b></span>
      <span class="readout">band <b id="wx-band" data-testid="wx-band">—</b></span>
      <span class="readout">phase <b id="wx-phase">—</b></span>
    </div>
    <div class="row">
      <input id="wx-obs" data-testid="wx-obs" placeholder="manual observation (E5) — e.g. ‘track flooded at culvert’">
      <select id="wx-obs-tag"><option>track-state</option><option>sighting</option><option>weather</option></select>
      <button id="wx-obs-add" data-testid="wx-obs-add">Record</button>
    </div>
    <div id="wx-alerts" class="alerts" aria-live="polite"></div>
    <h3>Execution log <span class="muted">(append-only, via the seam)</span></h3>
    <ol id="wx-log" class="exec-log" data-testid="wx-log"></ol>
    <div class="row"><span id="wx-final" class="result" data-testid="wx-final"></span></div>`;

  const $ = (/** @type {string} */ sel) => /** @type {HTMLElement} */ (el.querySelector(sel));

  async function refreshLog() {
    const entries = await ctx.seam.getLog(missionId);
    $('#wx-log').innerHTML = entries.map((/** @type {any} */ e) => {
      const kind = e.kind;
      const body = kind === 'Alert'
        ? `band crossing on <b>${e.cause.commitment ?? e.cause.commitment_id ?? e.cause.type}</b>: ${e.cause.from} → <b>${e.cause.to}</b>`
        : kind === 'Observation' ? `“${e.fact_delta.note}” <span class="muted">[${e.fact_delta.tag}, ${e.source}]</span>`
        : JSON.stringify(e);
      return `<li class="log-${kind.toLowerCase()}"><span class="log-at">H+${e.at}</span> <b>${kind}</b> · ${body}</li>`;
    }).join('');
  }

  async function tick(/** @type {number} */ stepMin) {
    if (exec.complete) return;
    exec.simT = Math.round((exec.simT + stepMin) * 10) / 10;
    // Plan-time ≡ sim-time: an obstruction is a LOCAL RE-PLAN (a hold leg is
    // spliced in where the vehicle is, the remainder re-timed through the
    // tide-aware chooser), so the plan itself carries every disturbance and no
    // separate delay offset is needed — downstream holds absorb delays in the
    // plan, not in the assessment.
    const tau = exec.simT;
    exec.lastTau = tau;
    const ghost = stateAt(plan, tau);

    // The live band tracks the phase-relevant commitment: the observation until
    // the vehicle leaves the OP, then the exfil deadline. Lock the observe
    // verdict at the hand-off so later (exfil) delays don't rewrite it.
    // Keyed off the visit's end (not the phase) so a tide hold at the ford —
    // phase 'hold' mid-exfil — doesn't flip the band back to the observation.
    const visitLeg = plan.materialisation.schedule.find((/** @type {any} */ s) => s.kind === 'visit');
    const inExfil = tau >= visitLeg.end_min;
    if (inExfil && exec.visitVerdict == null) {
      exec.visitVerdict = assess(plan, commitment, bandUnit).verdict;
    }
    const live = inExfil && exfilCommitment
      ? assessExfil(plan, exfilCommitment, bandUnit)
      : assess(plan, commitment, bandUnit);
    const label = inExfil && exfilCommitment ? 'exfil' : 'observe';

    $('#wx-clock').textContent = `H+${Math.round(exec.simT)}`;
    $('#wx-margin').textContent = `${live.margin} min`;
    $('#wx-band').textContent = `${live.band} · ${label}`;
    $('#wx-band').className = `band-${live.band}`;
    $('#wx-phase').textContent = ghost?.phase ?? '—';

    // E3: alert iff the band is crossed (per monitored commitment). Switching
    // commitment (observe → exfil) re-seats the baseline without an alert.
    if (label !== exec.lastLabel) {
      exec.lastLabel = label; exec.lastBand = live.band;
    } else if (live.band !== exec.lastBand) {
      const cause = { type: live.band === 'violated' ? 'hard_infeasible' : 'band_crossing',
                      commitment: label, from: exec.lastBand, to: live.band };
      await ctx.seam.appendLog(missionId, { kind: 'Alert', at: Math.round(exec.simT), cause });
      $('#wx-alerts').innerHTML +=
        `<div class="alert band-${live.band}" data-testid="wx-alert">⚠ H+${Math.round(exec.simT)} — ${label} band ${exec.lastBand} → <b>${live.band}</b></div>`;
      exec.lastBand = live.band;
      await refreshLog();
    }

    ctx.playhead.set(tau);   // drives the shared projection (map ghost + readout)

    if (tau >= missionEnd) {
      exec.complete = true;
      stopPlay();
      const visitVerdict = exec.visitVerdict ?? assess(plan, commitment, bandUnit).verdict;
      const eRes = exfilCommitment ? assessExfil(plan, exfilCommitment, bandUnit) : null;
      const overall = (visitVerdict === 'violated' || eRes?.verdict === 'violated') ? 'violated' : 'satisfied';
      $('#wx-final').innerHTML = `mission playback complete — <b class="${overall}">${overall}</b>`
        + ` <span class="muted">(observe: ${visitVerdict}${eRes ? `, exfil: ${eRes.verdict}` : ''}`
        + `${exec.delayMin ? `, +${exec.delayMin} min obstruction` : ''})</span>`;
      ctx.onComplete({
        // The rebased plan IS the actual: the last pre-OP transit ends at the OP.
        actual_arrival: plan.materialisation.schedule.findLast((/** @type {any} */ s) => s.kind === 'transit').end_min,
        delay_min: exec.delayMin,
        visit_verdict: visitVerdict,
        exfil_verdict: eRes?.verdict ?? null,
        rv_arrival: eRes?.projected_arrival ?? null,
        final_verdict: overall,
        ended_at: Math.round(exec.simT),
      });
    }
  }

  /** @type {number | undefined} */
  let playTimer;
  /** Sim-minutes per real second from the slider: 2 … 512 (powers of two).
   *  Labelled "N min/s", not "×N" — 2 min/s is 120× real time. */
  const speedOf = () => 2 ** Number(/** @type {HTMLInputElement} */ ($('#wx-speed')).value);
  const refreshSpeedUI = () => {
    $('#wx-speed-label').textContent = `${speedOf()} min/s`;
    $('#wx-play').textContent = playTimer ? `⏸ Pause (${speedOf()} min/s)` : `▶ Play ${speedOf()} min/s`;
  };
  const stopPlay = () => {
    if (playTimer) { clearInterval(playTimer); playTimer = undefined; }
    refreshSpeedUI();
  };

  $('#wx-speed').addEventListener('input', refreshSpeedUI);
  $('#wx-step10').addEventListener('click', () => tick(10));
  $('#wx-step').addEventListener('click', () => tick(30));
  $('#wx-play').addEventListener('click', () => {
    if (playTimer) { stopPlay(); return; }
    // 100 ms ticks; speed read per tick, so dragging the slider mid-play works.
    playTimer = /** @type {any} */ (setInterval(() => tick(speedOf() / 10), 100));
    refreshSpeedUI();
  });
  $('#wx-restart').addEventListener('click', async () => {
    stopPlay();
    exec.simT = 0;
    exec.delayMin = 0;
    exec.lastTau = 0;
    exec.complete = false;
    plan.materialisation = structuredClone(pristineMat);   // restore the original route
    missionEnd = plan.materialisation.schedule[plan.materialisation.schedule.length - 1].end_min;
    exec.lastBand = assess(plan, commitment, bandUnit).band; // re-seat AFTER the restore
    exec.lastLabel = 'observe';
    exec.visitVerdict = null;
    exec.obstructions = [];
    exec.blocked.clear();
    ctx.onObstructions?.([]);                // clear the track markers
    ctx.onBlocked?.([]);                     // clear the blocked-cell markers
    $('#wx-alerts').innerHTML = '';
    $('#wx-final').textContent = '';
    // A restart discards the previous simulated run and begins a fresh one; the
    // execution log is append-only *within* a run (DEC-25/26), so the new run
    // starts from an empty log.
    ctx.resetLog?.();
    await refreshLog();
    await tick(0);
  });
  /** Alert when a rebase changed the live tide decision (e.g. wait → open,
   *  open → detour after the window is forfeited). */
  async function maybeTideAlert(/** @type {any} */ oldMode) {
    const cur = plan.materialisation.tide;
    if (!cur || !oldMode || cur.mode === oldMode) return;
    await ctx.seam.appendLog(missionId, {
      kind: 'Alert', at: Math.round(exec.simT),
      cause: { type: 'tide_reassessment', from: oldMode, to: cur.mode },
    });
    $('#wx-alerts').innerHTML +=
      `<div class="alert" data-testid="wx-tide-alert">≋ H+${Math.round(exec.simT)} — tide re-assessed: <b>${oldMode} → ${cur.mode}</b> · ${cur.narrative}</div>`;
  }

  async function addObstruction(/** @type {number} */ mins) {
    if (exec.complete || !world) return;
    const tau = exec.lastTau;
    const pos = stateAt(plan, tau);
    if (!pos) return;
    // An obstruction is a LOCAL RE-PLAN: splice a hold where the vehicle is and
    // re-time the remainder through the tide-aware chooser — so downstream holds
    // (tide, OP window) absorb the delay in the plan itself. Allowed while
    // moving, or while already stopped by an obstruction (which it extends).
    const activeHold = plan.materialisation.schedule.find((/** @type {any} */ s) =>
      s.kind === 'hold' && s.label.startsWith('Obstruction') && tau >= s.start_min && tau < s.end_min);
    if (pos.phase !== 'transit' && pos.phase !== 'exfil' && !activeHold) {
      $('#wx-alerts').innerHTML +=
        `<div class="alert"><span class="muted">vehicle is static (OP dwell or tide hold) — obstructions apply while on the move</span></div>`;
      return;
    }
    const holdMin = Math.round((mins + (activeHold ? activeHold.end_min - tau : 0)) * 10) / 10;
    const cell = { h3: pos.h3, lat: pos.lat, lng: pos.lng };
    const oldEnd = missionEnd;
    const oldMode = plan.materialisation.tide?.mode ?? null;
    const ok = rerouteExecution(plan, {
      cells: world.cells, ao, profile: world.profile,
      tau, blocked: exec.blocked, opId, rvId, dwellMin, windowStart,
      holdMin, holdLabel: `Obstruction — track blocked (+${mins} min)`,
    });
    if (!ok) {
      $('#wx-alerts').innerHTML +=
        `<div class="alert band-violated">⚠ H+${Math.round(exec.simT)} — no viable re-plan around the obstruction</div>`;
      return;
    }
    missionEnd = plan.materialisation.schedule[plan.materialisation.schedule.length - 1].end_min;
    exec.delayMin = Math.round((exec.delayMin + mins) * 10) / 10;
    exec.obstructions.push({ tau, ...cell });
    ctx.onObstructions?.(exec.obstructions);
    const absorbed = Math.round((oldEnd + mins - missionEnd) * 10) / 10;
    await ctx.seam.appendLog(missionId, {
      kind: 'Observation', at: Math.round(exec.simT),
      fact_delta: {
        note: `Obstruction at cell ${shortH3(cell.h3)} (H+${Math.round(exec.simT)}) — +${mins} min; `
          + `re-planned, RV H+${missionEnd}${absorbed > 0 ? ` (holds absorbed ${absorbed} min)` : ''}`,
        tag: 'track-state',
      },
      source: 'operator', confidence: 'reported',
    });
    await maybeTideAlert(oldMode);
    await refreshLog();
    await tick(0);
  }
  $('#wx-delay5').addEventListener('click', () => addObstruction(5));
  $('#wx-delay').addEventListener('click', () => addObstruction(25));

  $('#wx-block').addEventListener('click', async () => {
    if (exec.complete || !world) return;
    const tau = exec.lastTau;
    const cur = stateAt(plan, tau);
    if (!cur) return;
    // The next cell on the route ahead (first that differs from the current one).
    const next = plan.materialisation.trajectory.find((/** @type {any} */ p) => p.t > tau + 0.01 && p.h3 !== cur.h3);
    if (!next) {
      $('#wx-alerts').innerHTML += `<div class="alert"><span class="muted">no next cell to block — at the objective</span></div>`;
      return;
    }
    const blockedId = ao.idOf.get(next.h3);
    exec.blocked.add(blockedId);
    const oldMode = plan.materialisation.tide?.mode ?? null;
    // A pending obstruction hold is an exogenous fact — carry its remainder
    // through the rebase (planned tide/window holds are re-derived instead).
    const pendingHold = plan.materialisation.schedule.find((/** @type {any} */ s) =>
      s.kind === 'hold' && s.label.startsWith('Obstruction') && tau >= s.start_min && tau < s.end_min);
    const ok = rerouteExecution(plan, {
      cells: world.cells, ao, profile: world.profile,
      tau, blocked: exec.blocked, opId, rvId, dwellMin, windowStart,
      holdMin: pendingHold ? Math.round((pendingHold.end_min - tau) * 10) / 10 : 0,
      holdLabel: pendingHold?.label,
    });
    if (!ok) {
      exec.blocked.delete(blockedId);        // keep the route; report being boxed in
      $('#wx-alerts').innerHTML +=
        `<div class="alert band-violated" data-testid="wx-block-fail">⚠ H+${Math.round(exec.simT)} — blocked in: no route around ${shortH3(next.h3)}</div>`;
      return;
    }
    missionEnd = plan.materialisation.schedule[plan.materialisation.schedule.length - 1].end_min;
    ctx.onBlocked?.([...exec.blocked].map((i) => ({ h3: ao.indexes[i] })));
    await ctx.seam.appendLog(missionId, {
      kind: 'Observation', at: Math.round(exec.simT),
      fact_delta: { note: `Cell ${shortH3(next.h3)} blocked — re-routed in flight`, tag: 'track-state' },
      source: 'operator', confidence: 'reported',
    });
    await maybeTideAlert(oldMode);
    await refreshLog();
    await tick(0);
  });
  $('#wx-obs-add').addEventListener('click', async () => {
    const note = /** @type {HTMLInputElement} */ ($('#wx-obs')).value.trim();
    if (!note) return;
    await ctx.seam.appendLog(missionId, {
      kind: 'Observation', at: Math.round(exec.simT),
      fact_delta: { note, tag: /** @type {HTMLSelectElement} */ ($('#wx-obs-tag')).value },
      source: 'operator', confidence: 'reported',
    });
    /** @type {HTMLInputElement} */ ($('#wx-obs')).value = '';
    await refreshLog();
  });

  tick(0);
  return { pause: stopPlay };
}
