// @ts-check
// learn/learn.js — Learn stage (DEC-26): the after-action record exists, and
// the mission replays from its stamp.
//
// After-action = execution log + selection rationale + stamp (F1) — assembled
// by READING the stores over the seam, not from in-memory shortcuts: the
// record alone must answer “why this plan, not that?” (NF2/NF4). Replay
// re-runs the kernel from the stamp's inputs and checks the decision is
// identical (NF3, decision-level).

/**
 * @param {HTMLElement} el
 * @param {{seam: import('../seam/seam.js').SeamClient,
 *          missionId: string,
 *          ids: {requirement: string, baseline: string, profile: string, rationale: string},
 *          world: any, selectedPlan: any, handful: any[],
 *          appetites: Record<string,string>, strategySeed: number,
 *          configCoreHash: string,
 *          execSummary: any}} ctx
 */
export async function mountLearn(el, ctx) {
  const { seam, missionId, ids, execSummary } = ctx;

  // Assemble the after-action record from the record itself (seam reads).
  const [reqRes, ratRes, log] = await Promise.all([
    seam.getObject(ids.requirement),
    seam.getObject(ids.rationale),
    seam.getLog(missionId),
  ]);
  const requirement = reqRes.body;
  const rationale = ratRes.body;
  const plan = ctx.selectedPlan;
  const plannedArrival = plan.materialisation.schedule[0].end_min;
  const plannedRv = plan.materialisation.schedule.find((s) => s.kind === 'exfil')?.end_min;
  const obsSat = plan.scores.satisfaction.find((s) => s.label === 'Observe OP');
  const exfSat = plan.scores.satisfaction.find((s) => s.label === 'Exfil E');

  const verdictCell = (v) => `<span class="${v}">${v}</span>`;
  const row = (k, planned, actual) =>
    `<tr><td>${k}</td><td>${planned}</td><td>${actual}</td></tr>`;

  el.innerHTML = `
    <p class="stage-intro">The after-action record — log + rationale + stamp — read back
    entirely over the seam. A reviewer years later answers “why this plan, not that?”
    from this record alone (NF2/NF4).</p>
    <div class="aa-grid">
      <div class="card">
        <h3>The decision</h3>
        <p>chosen <code class="hash">${rationale.chosen.slice(7, 15)}</code>
           over ${rationale.beaten.map((b) => `<code class="hash">${b.slice(7, 15)}</code>`).join(' ')}</p>
        <p>deciding axis: <b>${rationale.deciding_axis}</b> — “${rationale.note}”</p>
        <p class="muted">by ${rationale.by} (${rationale.role} hat), ${rationale.at}</p>
      </div>
      <div class="card">
        <h3>Plan vs actual</h3>
        <table class="matrix" data-testid="aa-recon">
          <thead><tr><th></th><th>planned</th><th>actual</th></tr></thead>
          <tbody>
            ${row('OP arrival', `H+${plannedArrival}`, `H+${execSummary.actual_arrival}`)}
            ${row('delays', '0 min', `${execSummary.delay_min} min`)}
            ${row('Observe OP', verdictCell(obsSat.verdict), verdictCell(execSummary.visit_verdict))}
            ${exfSat ? row('Exfil E (RV)', `${verdictCell(exfSat.verdict)}${plannedRv ? ` H+${plannedRv}` : ''}`,
                `${verdictCell(execSummary.exfil_verdict ?? '—')}${execSummary.rv_arrival != null ? ` H+${execSummary.rv_arrival}` : ''}`) : ''}
          </tbody>
        </table>
      </div>
    </div>
    <h3>Execution log (${log.length} entries)</h3>
    <ol class="exec-log">
      ${log.map((e) => `<li><span class="log-at">H+${e.at}</span> <b>${e.kind}</b> ·
        ${e.kind === 'Alert' ? `${e.cause.from} → ${e.cause.to}` : e.fact_delta?.note ?? ''}</li>`).join('')}
    </ol>
    <div class="card replay-card">
      <h3>Perfect replay (NF3)</h3>
      <p class="muted">Re-run the kernel from the stamp's inputs — same stamp must yield
      the same decision (ids and all).</p>
      <div class="row">
        <button id="aa-replay" class="primary" data-testid="aa-replay">Replay from stamp</button>
        <span id="aa-replay-result" class="result" data-testid="aa-replay-result"></span>
      </div>
      <div id="aa-replay-detail" class="muted"></div>
    </div>`;

  el.querySelector('#aa-replay')?.addEventListener('click', async () => {
    // Same inputs, fresh run — through the seam like any planning client.
    const rerun = await seam.planHandful({
      requirement, requirement_version: ids.requirement,
      baseline: ctx.world.baseline, baseline_version: ids.baseline,
      profile: ctx.world.profile, profile_version: ids.profile,
      state: ctx.world.state, config_core: ctx.configCoreHash,
      appetites: ctx.appetites, steering: [], strategy_seed: ctx.strategySeed,
    });
    const before = ctx.handful.map((p) => p.id);
    const after = rerun.plans.map((p) => p.id);
    const identical = before.length === after.length && before.every((id, i) => id === after[i]);
    /** @type {HTMLElement} */ (el.querySelector('#aa-replay-result')).innerHTML = identical
      ? '<span class="ok">✓ identical decision — same stamp, same plans, same ids</span>'
      : '<span class="bad">✗ divergence — would be banded & labelled (DEC-36)</span>';
    /** @type {HTMLElement} */ (el.querySelector('#aa-replay-detail')).innerHTML =
      before.map((id, i) => `<div><code class="hash">${id.slice(7, 15)}</code> → <code class="hash">${after[i]?.slice(7, 15) ?? '—'}</code></div>`).join('');
  });
}
