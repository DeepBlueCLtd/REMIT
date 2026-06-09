// @ts-check
// wingman/wingman.js — Execute stage (DEC-25, operator hat).
//
// Execution is a mode, not a subsystem: simulated clock/position playback of
// the selected plan, the SAME kernel evaluator re-anchored to here-now (NF1),
// one live margin band with an alert iff the band is crossed (E3, NF10 gives
// the threshold), optional manual observation (E5), and an append-only
// execution log (the after-action record, → Learn). Local loop — never over
// the seam for the live monitor (DEC-40-D); log writes go via the seam.

import { assess, stateAt } from '../kernel/kernel.js';

/**
 * @param {HTMLElement} el
 * @param {{seam: import('../seam/seam.js').SeamClient,
 *          missionId: string, plan: any, commitment: any, bandUnit: number,
 *          playhead: import('../views/render.js').Playhead,
 *          renderViews: (opts: {t: number, actual: any}) => void,
 *          onComplete: (summary: any) => void}} ctx
 */
export function mountWingman(el, ctx) {
  const { plan, commitment, bandUnit, missionId } = ctx;
  const visitEnd = plan.materialisation.schedule.at(-1).end_min;

  const exec = {
    simT: 0,
    delayMin: 0,
    lastBand: assess(plan, commitment, bandUnit, 0).band,
    complete: false,
    /** plan-time τ: sim time minus accumulated delay (vehicle halted while obstructed) */
    tau() { return Math.max(0, this.simT - this.delayMin); },
  };

  el.innerHTML = `
    <p class="stage-intro">Simulated playback against the live requirement: the wingman
    re-runs the <em>same</em> margin assessment the kernel scored with (NF1), and speaks
    only when the band is crossed (E3).</p>
    <div class="row exec-controls">
      <button id="wx-step10" data-testid="wx-step10">Step +10 min</button>
      <button id="wx-step" data-testid="wx-step">Step +30 min</button>
      <button id="wx-play" data-testid="wx-play">Play ×64</button>
      <button id="wx-delay" class="warn" data-testid="wx-delay">Obstruction +25 min</button>
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
        ? `band crossing on <b>${e.cause.commitment_id ?? e.cause.type}</b>: ${e.cause.from} → <b>${e.cause.to}</b>`
        : kind === 'Observation' ? `“${e.fact_delta.note}” <span class="muted">[${e.fact_delta.tag}, ${e.source}]</span>`
        : JSON.stringify(e);
      return `<li class="log-${kind.toLowerCase()}"><span class="log-at">H+${e.at}</span> <b>${kind}</b> · ${body}</li>`;
    }).join('');
  }

  async function tick(stepMin) {
    if (exec.complete) return;
    exec.simT = Math.round((exec.simT + stepMin) * 10) / 10;
    const tau = exec.tau();
    const a = assess(plan, commitment, bandUnit, exec.delayMin);
    const ghost = stateAt(plan, tau);

    $('#wx-clock').textContent = `H+${Math.round(exec.simT)}`;
    $('#wx-margin').textContent = `${a.margin} min`;
    $('#wx-band').textContent = a.band;
    $('#wx-band').className = `band-${a.band}`;
    $('#wx-phase').textContent = ghost?.phase ?? '—';

    // E3: alert iff the band is crossed — once per crossing, not per tick.
    if (a.band !== exec.lastBand) {
      const cause = a.band === 'violated'
        ? { type: 'hard_infeasible', commitment_id: commitment.id, from: exec.lastBand, to: a.band }
        : { type: 'band_crossing', commitment_id: commitment.id, from: exec.lastBand, to: a.band };
      await ctx.seam.appendLog(missionId, { kind: 'Alert', at: Math.round(exec.simT), cause });
      $('#wx-alerts').innerHTML +=
        `<div class="alert band-${a.band}" data-testid="wx-alert">⚠ H+${Math.round(exec.simT)} — margin band ${exec.lastBand} → <b>${a.band}</b></div>`;
      exec.lastBand = a.band;
      await refreshLog();
    }

    ctx.playhead.set(tau);
    ctx.renderViews({ t: tau, actual: ghost });

    if (tau >= visitEnd) {
      exec.complete = true;
      stopPlay();
      const finalVerdict = a.verdict;
      $('#wx-final').innerHTML = `mission playback complete — commitment <b class="${finalVerdict}">${finalVerdict}</b>`
        + (exec.delayMin ? ` <span class="muted">(after ${exec.delayMin} min accumulated delay)</span>` : '');
      ctx.onComplete({
        actual_arrival: Math.round((plan.materialisation.schedule[0].end_min + exec.delayMin) * 10) / 10,
        delay_min: exec.delayMin,
        final_verdict: finalVerdict,
        ended_at: Math.round(exec.simT),
      });
    }
  }

  /** @type {number | undefined} */
  let playTimer;
  const stopPlay = () => {
    if (playTimer) { clearInterval(playTimer); playTimer = undefined; $('#wx-play').textContent = 'Play ×64'; }
  };

  $('#wx-step10').addEventListener('click', () => tick(10));
  $('#wx-step').addEventListener('click', () => tick(30));
  $('#wx-play').addEventListener('click', () => {
    if (playTimer) { stopPlay(); return; }
    $('#wx-play').textContent = 'Pause';
    playTimer = /** @type {any} */ (setInterval(() => tick(64 / 10), 100)); // ×64 sim speed
  });
  $('#wx-delay').addEventListener('click', async () => {
    if (exec.complete) return;
    const phase = stateAt(plan, exec.tau())?.phase;
    if (phase !== 'transit') {
      $('#wx-alerts').innerHTML +=
        `<div class="alert"><span class="muted">already at the OP — obstruction has no effect</span></div>`;
      return;
    }
    exec.delayMin += 25;
    await ctx.seam.appendLog(missionId, {
      kind: 'Observation', at: Math.round(exec.simT),
      fact_delta: { note: `Route obstruction — estimated +25 min`, tag: 'track-state' },
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
}
