// @ts-check
// compare/compare.js — Compare & decide (DEC-23, implementer hat).
//
// The A2 satisfaction matrix (COAs × hard commitments: verdict + margin band)
// for the command hat, plus the implementer's controls:
//   • risk APPETITES (DEC-6) — a ranking lens that recommends a COA; they do
//     not change feasibility (commitments do), they weight cost vs robustness.
//   • risk MITIGATIONS — buy down a risk for a cost (e.g. an armed escort:
//     +1 robustness band, −1 cost band). A new concept beyond the register;
//     logged for the DEC-47 gate.
// Comparability guard over the full stamp basis (DEC-23/48); selection rationale
// records chosen + beaten + axis + appetites + mitigations (NF2).

const AUTHOR = 'ian';
const AXES = ['time/speed', 'exposure', 'robustness', 'completeness'];
const ROB_ORDER = ['fragile', 'marginal', 'robust'];     // higher = more robust (better)
const COST_ORDER = ['fragile', 'marginal', 'robust'];    // higher = cheaper (better)

const stepUp = (order, b) => order[Math.min(order.length - 1, order.indexOf(b) + 1)];
const stepDown = (order, b) => order[Math.max(0, order.indexOf(b) - 1)];

/**
 * @param {HTMLElement} el
 * @param {{seam: import('../seam/seam.js').SeamClient,
 *          handful: any[], commitments: any[],
 *          onSelected: (planId: string, rationale: any, rationaleId: string) => void}} ctx
 */
export function mountCompare(el, ctx) {
  const { handful } = ctx;

  // Comparability guard (DEC-23/48): objective comparison is valid only across
  // COAs sharing the full stamp basis.
  const basisOf = (p) => JSON.stringify([
    p.stamp.requirement_version, p.stamp.baseline_version, p.stamp.excursions,
    p.stamp.config_core_hash, p.stamp.kernel_version,
  ]);
  const comparable = new Set(handful.map(basisOf)).size === 1;

  const bandChip = (band) => `<span class="band band-${band}">${band}</span>`;
  const commitCols = handful[0].scores.satisfaction.map((s) => s.label);
  const satCell = (p, label) => {
    const s = p.scores.satisfaction.find((x) => x.label === label);
    return s
      ? `<td class="${s.verdict}">${s.verdict}<div class="muted">${s.margin_min} min ${bandChip(s.margin_band)}</div></td>`
      : `<td class="muted">—</td>`;
  };

  // Implementer state (DEC-6): appetites rank, the escort mitigation modifies.
  const appetites = { tempo: 'balanced', exposure: 'balanced' };
  const mitigations = { escort: false };
  let selectedId = null;

  const feasible = (p) => p.scores.satisfaction.every((s) => s.verdict !== 'violated');

  /** Displayed bands after applying the chosen mitigations. */
  const displayedBands = (p) => {
    let cost = p.scores.cost_band, rob = p.scores.robustness_band;
    if (mitigations.escort) { rob = stepUp(ROB_ORDER, rob); cost = stepDown(COST_ORDER, cost); }
    return { cost, rob };
  };

  /** Appetite-weighted "implementer fit" (DEC-6 ranking): how well a COA suits
   *  the current risk appetite. Infeasible COAs score 0. */
  const fitOf = (p) => {
    if (!feasible(p)) return 0;
    const wCost = { rapid: 2, balanced: 1, deliberate: 0.5 }[appetites.tempo];
    const wRob = { bold: 0.5, balanced: 1, cautious: 2 }[appetites.exposure];
    const { cost, rob } = displayedBands(p);
    return wCost * (COST_ORDER.indexOf(cost) + 1) + wRob * (ROB_ORDER.indexOf(rob) + 1);
  };
  const recommendedId = () => {
    let best = null, bestScore = -Infinity;
    for (const p of handful) {
      if (feasible(p) && fitOf(p) > bestScore) { bestScore = fitOf(p); best = p.id; }
    }
    return best;
  };

  el.innerHTML = `
    <p class="stage-intro">Per the command hat, every hard commitment (observe, exfil) is
    scored per course of action. Per the implementer hat (DEC-6): set the <b>risk appetites</b>
    to rank the COAs, and apply <b>mitigations</b> that buy down a risk for a cost. The
    decision and its reasons are recorded (DEC-23/NF2).
    <em>Tip: scrub the playhead to race the COA ghosts along their routes.</em></p>
    <div class="guard ${comparable ? 'ok-line' : 'bad-line'}" data-testid="cmp-guard">
      Comparability guard: ${comparable
        ? '✓ all COAs share the stamp basis (requirement · baseline · excursions · config-core · kernel)'
        : '✗ stamp mismatch — objective comparison would mislead (warning, not a matrix)'}
    </div>
    <div class="implementer-controls">
      <label>Appetite · tempo
        <select id="cmp-tempo" data-testid="cmp-tempo">
          <option value="deliberate">deliberate</option>
          <option value="balanced" selected>balanced</option>
          <option value="rapid">rapid</option>
        </select>
      </label>
      <label>Appetite · exposure
        <select id="cmp-exposure" data-testid="cmp-exposure">
          <option value="bold">bold</option>
          <option value="balanced" selected>balanced</option>
          <option value="cautious">cautious</option>
        </select>
      </label>
      <label class="mitigation">
        <input type="checkbox" id="cmp-escort" data-testid="cmp-escort">
        Armed escort
        <span class="mit-cost">−1 ambush risk · +1 cost</span>
      </label>
    </div>
    <div class="appetite-note" id="cmp-appetite-note" data-testid="cmp-appetite-note"></div>
    <table class="matrix" data-testid="cmp-matrix">
      <thead><tr>
        <th></th><th>Course of action</th>
        ${commitCols.map((c) => `<th>${c} (hard)</th>`).join('')}
        <th>cost</th><th>robustness</th><th>conflicts</th>
      </tr></thead>
      <tbody id="cmp-body"></tbody>
    </table>
    <div class="form-grid">
      <label>Deciding axis
        <select id="cmp-axis" data-testid="cmp-axis">${AXES.map((a) => `<option>${a}</option>`).join('')}</select>
      </label>
      <label>Note
        <input id="cmp-note" data-testid="cmp-note" placeholder="why this COA, not that"
               value="Margin headroom matters more than concealment tonight.">
      </label>
    </div>
    <div class="row">
      <button id="cmp-commit" class="primary" data-testid="cmp-commit" disabled>Commit selection</button>
      <span id="cmp-result" class="result"></span>
    </div>`;

  const commitBtn = /** @type {HTMLButtonElement} */ (el.querySelector('#cmp-commit'));
  const tbody = /** @type {HTMLElement} */ (el.querySelector('#cmp-body'));
  const stratColor = { direct: '#f0b429', tracked: '#4493f8', covered: '#38d39f' };

  function renderMatrix() {
    const rec = recommendedId();
    const esc = mitigations.escort ? ' <span class="band-mod" data-testid="band-mod">+esc</span>' : '';
    const maxFit = Math.max(1, ...handful.map(fitOf));
    tbody.innerHTML = handful.map((p) => {
      const { cost, rob } = displayedBands(p);
      const isRec = p.id === rec;
      const fitPct = Math.round(fitOf(p) / maxFit * 100);
      return `<tr class="${isRec ? 'recommended' : ''}">
        <td><input type="radio" name="cmp-pick" value="${p.id}" data-testid="pick-${p.strategy.key}" ${selectedId === p.id ? 'checked' : ''}></td>
        <td><b style="color:${stratColor[p.strategy.key]}">${p.strategy.label}</b>
            ${isRec ? '<span class="rec-tag" data-testid="rec-tag">★ recommended</span>' : ''}
            <div class="muted">${p.strategy.blurb}</div>
            <div class="fit" title="implementer fit for the current appetite (DEC-6)">
              <span class="fit-lbl">fit</span>
              <span class="fit-bar"><i data-testid="fit-${p.strategy.key}" style="width:${fitPct}%;background:${stratColor[p.strategy.key]}"></i></span>
            </div></td>
        ${commitCols.map((c) => satCell(p, c)).join('')}
        <td>${bandChip(cost)}${esc}</td>
        <td>${bandChip(rob)}${esc}</td>
        <td>${p.conflicts.length ? p.conflicts.map((c) => c.narrative).join('; ') : '—'}</td>
      </tr>`;
    }).join('');
    tbody.querySelectorAll('input[name=cmp-pick]').forEach((r) =>
      r.addEventListener('change', () => {
        selectedId = /** @type {HTMLInputElement} */ (r).value;
        commitBtn.disabled = false;
      }));
    renderAppetiteNote(rec);
  }

  function renderAppetiteNote(rec) {
    const recP = handful.find((p) => p.id === rec);
    const lean = appetites.exposure === 'cautious' || appetites.tempo === 'deliberate' ? 'robustness'
      : appetites.exposure === 'bold' || appetites.tempo === 'rapid' ? 'speed / low cost' : 'a balance';
    /** @type {HTMLElement} */ (el.querySelector('#cmp-appetite-note')).innerHTML = recP
      ? `Appetite <b>${appetites.tempo}</b> tempo · <b>${appetites.exposure}</b> exposure → leaning to <b>${lean}</b>;
         recommended COA <b style="color:${stratColor[recP.strategy.key]}">${recP.strategy.label}</b>.
         <span class="muted">Appetites rank the options for the implementer — they don't change mission
         <em>success</em> (commitment satisfaction is objective, DEC-6).</span>`
      : `<span class="muted">No feasible COA to recommend (all violate a hard commitment).</span>`;
  }
  renderMatrix();

  el.querySelector('#cmp-tempo')?.addEventListener('change', (e) => {
    appetites.tempo = /** @type {HTMLSelectElement} */ (e.target).value; renderMatrix();
  });
  el.querySelector('#cmp-exposure')?.addEventListener('change', (e) => {
    appetites.exposure = /** @type {HTMLSelectElement} */ (e.target).value; renderMatrix();
  });
  el.querySelector('#cmp-escort')?.addEventListener('change', (e) => {
    mitigations.escort = /** @type {HTMLInputElement} */ (e.target).checked; renderMatrix();
  });

  commitBtn.addEventListener('click', async () => {
    const picked = selectedId;
    const chosen = handful.find((p) => p.id === picked);
    const rationale = {
      chosen: picked,
      beaten: handful.filter((p) => p.id !== picked).map((p) => p.id),
      deciding_axis: /** @type {HTMLSelectElement} */ (el.querySelector('#cmp-axis')).value,
      note: /** @type {HTMLInputElement} */ (el.querySelector('#cmp-note')).value,
      appetites: { ...appetites },
      mitigations: mitigations.escort ? ['armed-escort'] : [],
      chosen_bands: displayedBands(chosen),
      by: AUTHOR, role: 'implementer', at: new Date().toISOString(),
    };
    const { id } = await ctx.seam.putObject('SelectionRationale', rationale);
    el.querySelectorAll('input,select,button').forEach((n) => /** @type {any} */ (n).disabled = true);
    /** @type {HTMLElement} */ (el.querySelector('#cmp-result')).innerHTML =
      `selected · rationale <code class="hash" data-testid="cmp-ratid">${id.slice(7, 15)}</code> committed (NF2)`;
    ctx.onSelected(picked, rationale, id);
  });
}
