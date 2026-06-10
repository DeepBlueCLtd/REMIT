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
 *          world?: {cells: any[], grid: any, profile: any},
 *          onObstructions?: (list: {tau: number, x: number, y: number}[]) => void,
 *          onBlocked?: (cells: {x: number, y: number}[]) => void,
 *          onComplete: (summary: any) => void}} ctx
 * @returns {{ pause: () => void }} handle so the host can pause live playback
 *          (e.g. when the user grabs the scrubber to review).
 */
export function mountWingman(el, ctx) {
  const { plan, commitment, exfilCommitment, bandUnit, missionId, world } = ctx;
  const sched = plan.materialisation.schedule;
  let missionEnd = sched[sched.length - 1].end_min;     // exfil arrival (or visit end)

  // Objectives the re-router needs (DEC-24/25).
  const opCell = commitment.activity.where;
  const rvCell = exfilCommitment?.activity?.where ?? null;
  const dwellMin = commitment.activity.duration.min_min;
  const windowStart = commitment.activity.when.window.start_min;
  const startMin = sched[0].start_min;

  const exec = {
    simT: 0,
    delayMin: 0,
    lastTau: 0,                                          // monotonic plan-time (see tick)
    lastBand: assess(plan, commitment, bandUnit, 0).band,
    lastLabel: 'observe',                                // which commitment the band tracks
    visitVerdict: /** @type {string|null} */ (null),     // locked once past the OP
    obstructions: /** @type {{tau:number,x:number,y:number}[]} */ ([]),
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
      <button id="wx-play" class="primary" data-testid="wx-play">▶ Play ×64</button>
      <label class="speed-ctl">speed
        <input id="wx-speed" data-testid="wx-speed" type="range" min="1" max="9" step="1" value="6"
               aria-label="time acceleration">
        <b id="wx-speed-label">×64</b>
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

  const $ = (sel) => /** @type {HTMLElement} */ (el.querySelector(sel));

  async function refreshLog() {
    const entries = await ctx.seam.getLog(missionId);
    $('#wx-log').innerHTML = entries.map((e) => {
      const kind = e.kind;
      const body = kind === 'Alert'
        ? `band crossing on <b>${e.cause.commitment ?? e.cause.commitment_id ?? e.cause.type}</b>: ${e.cause.from} → <b>${e.cause.to}</b>`
        : kind === 'Observation' ? `“${e.fact_delta.note}” <span class="muted">[${e.fact_delta.tag}, ${e.source}]</span>`
        : JSON.stringify(e);
      return `<li class="log-${kind.toLowerCase()}"><span class="log-at">H+${e.at}</span> <b>${kind}</b> · ${body}</li>`;
    }).join('');
  }

  async function tick(stepMin) {
    if (exec.complete) return;
    exec.simT = Math.round((exec.simT + stepMin) * 10) / 10;
    // Monotonic plan-time: an obstruction adds delay, which freezes the vehicle
    // *in place* (τ never jumps backward) until sim time catches up — so a
    // mid-mission obstruction halts where the vehicle is, it doesn't restart it.
    const tau = Math.max(exec.lastTau, Math.round((exec.simT - exec.delayMin) * 10) / 10);
    exec.lastTau = tau;
    const ghost = stateAt(plan, tau);

    // The live band tracks the phase-relevant commitment: the observation until
    // the vehicle leaves the OP, then the exfil deadline. Lock the observe
    // verdict at the hand-off so later (exfil) delays don't rewrite it.
    const inExfil = ghost.phase === 'exfil' || ghost.phase === 'complete';
    if (inExfil && exec.visitVerdict == null) {
      exec.visitVerdict = assess(plan, commitment, bandUnit, exec.delayMin).verdict;
    }
    const live = inExfil && exfilCommitment
      ? assessExfil(plan, exfilCommitment, bandUnit, exec.delayMin)
      : assess(plan, commitment, bandUnit, exec.delayMin);
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
      const visitVerdict = exec.visitVerdict ?? assess(plan, commitment, bandUnit, exec.delayMin).verdict;
      const eRes = exfilCommitment ? assessExfil(plan, exfilCommitment, bandUnit, exec.delayMin) : null;
      const overall = (visitVerdict === 'violated' || eRes?.verdict === 'violated') ? 'violated' : 'satisfied';
      $('#wx-final').innerHTML = `mission playback complete — <b class="${overall}">${overall}</b>`
        + ` <span class="muted">(observe: ${visitVerdict}${eRes ? `, exfil: ${eRes.verdict}` : ''}`
        + `${exec.delayMin ? `, +${exec.delayMin} min delay` : ''})</span>`;
      ctx.onComplete({
        actual_arrival: Math.round((plan.materialisation.schedule[0].end_min + exec.delayMin) * 10) / 10,
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
  /** Time acceleration from the slider: ×2 … ×512 (powers of two). */
  const speedOf = () => 2 ** Number(/** @type {HTMLInputElement} */ ($('#wx-speed')).value);
  const refreshSpeedUI = () => {
    $('#wx-speed-label').textContent = `×${speedOf()}`;
    $('#wx-play').textContent = playTimer ? `⏸ Pause (×${speedOf()})` : `▶ Play ×${speedOf()}`;
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
    exec.lastBand = assess(plan, commitment, bandUnit, 0).band;
    exec.lastLabel = 'observe';
    exec.visitVerdict = null;
    exec.obstructions = [];
    exec.blocked.clear();
    plan.materialisation = structuredClone(pristineMat);   // restore the original route
    missionEnd = plan.materialisation.schedule[plan.materialisation.schedule.length - 1].end_min;
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
  async function addObstruction(mins) {
    if (exec.complete) return;
    // Mid-mission obstruction: insert it where the vehicle is *now* (it freezes
    // in place for the delay), and drop a marker on the track there. At the very
    // start this lands at the departure point.
    const pos = stateAt(plan, exec.lastTau);
    if (pos.phase !== 'transit' && pos.phase !== 'exfil') {
      $('#wx-alerts').innerHTML +=
        `<div class="alert"><span class="muted">vehicle is static at the OP — obstructions apply while on the move</span></div>`;
      return;
    }
    const cell = { x: Math.round(pos.x), y: Math.round(pos.y) };
    exec.obstructions.push({ tau: exec.lastTau, ...cell });
    ctx.onObstructions?.(exec.obstructions);
    exec.delayMin += mins;
    await ctx.seam.appendLog(missionId, {
      kind: 'Observation', at: Math.round(exec.simT),
      fact_delta: { note: `Obstruction at cell ${cell.x},${cell.y} (H+${Math.round(exec.simT)}) — +${mins} min`, tag: 'track-state' },
      source: 'operator', confidence: 'reported',
    });
    await refreshLog();
    await tick(0);
  }
  $('#wx-delay5').addEventListener('click', () => addObstruction(5));
  $('#wx-delay').addEventListener('click', () => addObstruction(25));

  $('#wx-block').addEventListener('click', async () => {
    if (exec.complete || !world) return;
    const tau = exec.lastTau;
    const cur = stateAt(plan, tau);
    const curCell = { x: Math.round(cur.x), y: Math.round(cur.y) };
    // The next cell on the route ahead (first that differs from the current one).
    const next = plan.materialisation.trajectory.find((p) =>
      p.t > tau + 0.01 && (Math.round(p.x) !== curCell.x || Math.round(p.y) !== curCell.y));
    if (!next) {
      $('#wx-alerts').innerHTML += `<div class="alert"><span class="muted">no next cell to block — at the objective</span></div>`;
      return;
    }
    const bx = Math.round(next.x), by = Math.round(next.y);
    const idx = by * world.grid.w + bx;
    exec.blocked.add(idx);
    const ok = rerouteExecution(plan, {
      cells: world.cells, grid: world.grid, profile: world.profile,
      tau, blocked: exec.blocked, opCell, rvCell, dwellMin, windowStart, startMin,
    });
    if (!ok) {
      exec.blocked.delete(idx);              // keep the route; report being boxed in
      $('#wx-alerts').innerHTML +=
        `<div class="alert band-violated" data-testid="wx-block-fail">⚠ H+${Math.round(exec.simT)} — blocked in: no route around ${bx},${by}</div>`;
      return;
    }
    missionEnd = plan.materialisation.schedule[plan.materialisation.schedule.length - 1].end_min;
    ctx.onBlocked?.([...exec.blocked].map((i) => ({ x: i % world.grid.w, y: Math.floor(i / world.grid.w) })));
    await ctx.seam.appendLog(missionId, {
      kind: 'Observation', at: Math.round(exec.simT),
      fact_delta: { note: `Cell ${bx},${by} blocked — re-routed in flight`, tag: 'track-state' },
      source: 'operator', confidence: 'reported',
    });
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
