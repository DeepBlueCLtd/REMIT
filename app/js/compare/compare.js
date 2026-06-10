// @ts-check
// compare/compare.js — Compare & decide (DEC-23, implementer hat).
//
// The tiny A2 satisfaction matrix (plans × the one commitment: verdict +
// margin band), the comparability guard over the full stamp basis (incl.
// config core, DEC-48), and selection-rationale capture: chosen + beaten +
// deciding axis, attributed. Within-band plans are co-equal (NF10) — the
// human chooses, and the record says why.

const AUTHOR = 'ian';
const AXES = ['time/speed', 'exposure', 'robustness', 'completeness'];

/**
 * @param {HTMLElement} el
 * @param {{seam: import('../seam/seam.js').SeamClient,
 *          handful: any[], commitments: any[],
 *          onSelected: (planId: string, rationale: any, rationaleId: string) => void}} ctx
 */
export function mountCompare(el, ctx) {
  const { handful } = ctx;

  // Comparability guard (DEC-23/48): objective comparison is valid only across
  // plans sharing the full stamp basis. One kernel call → trivially true here,
  // but the check is real and would catch a mixed handful.
  const basisOf = (p) => JSON.stringify([
    p.stamp.requirement_version, p.stamp.baseline_version, p.stamp.excursions,
    p.stamp.config_core_hash, p.stamp.kernel_version,
  ]);
  const comparable = new Set(handful.map(basisOf)).size === 1;

  const bandChip = (band) => `<span class="band band-${band}">${band}</span>`;
  // Commitment columns, derived from the first plan's satisfaction rows.
  const commitCols = handful[0].scores.satisfaction.map((s) => s.label);
  const satCell = (p, label) => {
    const s = p.scores.satisfaction.find((x) => x.label === label);
    return s
      ? `<td class="${s.verdict}">${s.verdict}<div class="muted">${s.margin_min} min ${bandChip(s.margin_band)}</div></td>`
      : `<td class="muted">—</td>`;
  };

  el.innerHTML = `
    <p class="stage-intro">Objective satisfaction matrix for the command hat — every
    hard commitment (observe, exfil) scored per course of action; banded cost × robustness
    for the implementer. Within a band, COAs are co-equal — the deciding axis is judgement,
    and it is recorded (DEC-23).
    <em>Tip: scrub the playhead (right) to race the COA ghosts along their routes, with
    live measures beneath the map.</em></p>
    <div class="guard ${comparable ? 'ok-line' : 'bad-line'}" data-testid="cmp-guard">
      Comparability guard: ${comparable
        ? '✓ all COAs share the stamp basis (requirement · baseline · excursions · config-core · kernel)'
        : '✗ stamp mismatch — objective comparison would mislead (warning, not a matrix)'}
    </div>
    <table class="matrix" data-testid="cmp-matrix">
      <thead><tr>
        <th></th><th>Course of action</th>
        ${commitCols.map((c) => `<th>${c} (hard)</th>`).join('')}
        <th>cost</th><th>robustness</th><th>conflicts</th>
      </tr></thead>
      <tbody>
        ${handful.map((p) => `<tr>
            <td><input type="radio" name="cmp-pick" value="${p.id}" data-testid="pick-${p.strategy.key}"></td>
            <td><b style="color:${({direct:'#f0b429',tracked:'#4493f8',covered:'#38d39f'})[p.strategy.key]}">${p.strategy.label}</b>
                <div class="muted">${p.strategy.blurb}</div></td>
            ${commitCols.map((c) => satCell(p, c)).join('')}
            <td>${bandChip(p.scores.cost_band)}</td>
            <td>${bandChip(p.scores.robustness_band)} <span class="muted">(canned — NF9)</span></td>
            <td>${p.conflicts.length ? p.conflicts.map((c) => c.narrative).join('; ') : '—'}</td>
          </tr>`).join('')}
      </tbody>
    </table>
    <div class="form-grid">
      <label>Deciding axis
        <select id="cmp-axis" data-testid="cmp-axis">
          ${AXES.map((a) => `<option>${a}</option>`).join('')}
        </select>
      </label>
      <label>Note
        <input id="cmp-note" data-testid="cmp-note" placeholder="why this plan, not that"
               value="Margin headroom matters more than concealment tonight.">
      </label>
    </div>
    <div class="row">
      <button id="cmp-commit" class="primary" data-testid="cmp-commit" disabled>Commit selection</button>
      <span id="cmp-result" class="result"></span>
    </div>`;

  const commitBtn = /** @type {HTMLButtonElement} */ (el.querySelector('#cmp-commit'));
  el.querySelectorAll('input[name=cmp-pick]').forEach((r) =>
    r.addEventListener('change', () => { commitBtn.disabled = false; }));

  commitBtn.addEventListener('click', async () => {
    const picked = /** @type {HTMLInputElement} */ (el.querySelector('input[name=cmp-pick]:checked')).value;
    const rationale = {
      chosen: picked,
      beaten: handful.filter((p) => p.id !== picked).map((p) => p.id),
      deciding_axis: /** @type {HTMLSelectElement} */ (el.querySelector('#cmp-axis')).value,
      note: /** @type {HTMLInputElement} */ (el.querySelector('#cmp-note')).value,
      by: AUTHOR, role: 'implementer', at: new Date().toISOString(),
    };
    const { id } = await ctx.seam.putObject('SelectionRationale', rationale);
    el.querySelectorAll('input,select,button').forEach((n) => /** @type {any} */ (n).disabled = true);
    /** @type {HTMLElement} */ (el.querySelector('#cmp-result')).innerHTML =
      `selected · rationale <code class="hash" data-testid="cmp-ratid">${id.slice(7, 15)}</code> committed (NF2)`;
    ctx.onSelected(picked, rationale, id);
  });
}
