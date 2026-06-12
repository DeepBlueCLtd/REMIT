// @ts-check
// capture/capture.js — Capture stage (DEC-17, command hat).
//
// Scripted type-driven interrogation for the one v1 activity (`visit`):
// a finite slot checklist with visible stamped defaults (confirmed vs
// defaulted is auditable), canonical echo-back as the committing act
// (the signed restatement IS the negotiated→committed transition), and
// ambiguities recorded as resolvable-later.

const AUTHOR = 'ian';
const EXFIL_DEADLINE_MIN = 180;   // command-fixed: be across the river by H+180

/**
 * @param {HTMLElement} el
 * @param {{seam: import('../seam/seam.js').SeamClient,
 *          places: { ops: {key: string, name: string, h3: string}[], rvEast: {name: string, h3: string} },
 *          onPick?: (op: {key: string, name: string, h3: string}) => void,
 *          onCommitted: (req: any, id: string) => void}} ctx
 */
export function mountCapture(el, ctx) {
  const PLACES = ctx.places;   // resolved named places (h3-anchored), from the world
  /** Slot state: value + capture status (DEC-17 stamped defaults). */
  const slots = {
    where:        { value: 'OP-A', status: 'defaulted' },
    window_start: { value: 30,     status: 'defaulted' },
    window_end:   { value: 120,    status: 'defaulted' },
    duration_min: { value: 25,     status: 'defaulted' },
  };
  const ambiguities = [{
    question: 'Is OP-A itself confirmed clear of civilian use?',
    status: 'open',
    consequence: 'If occupied, fallback OP shifts arrival ≈ +15 min.',
  }];

  el.innerHTML = `
    <p class="stage-intro">Command states the requirement; the system interrogates the
    <code>visit</code> activity type slot-by-slot. Untouched answers stay visibly
    <em>defaulted</em>; edits become <em>confirmed</em>. The canonical echo-back below is
    the committing act (DEC-17).</p>
    <div class="form-grid" id="cap-form">
      <label>Observe from
        <select data-slot="where" data-testid="cap-where">
          ${PLACES.ops.map((o) => `<option value="${o.key}">${o.name}</option>`).join('')}
        </select>
      </label>
      <label>Not before (H+ min)
        <input type="number" data-slot="window_start" data-testid="cap-start" value="30" step="15" min="0">
      </label>
      <label>Depart by (H+ min)
        <input type="number" data-slot="window_end" data-testid="cap-end" value="120" step="15" min="0">
      </label>
      <label>Dwell at least (min)
        <input type="number" data-slot="duration_min" data-testid="cap-dur" value="25" step="5" min="5">
      </label>
    </div>
    <div class="slot-audit" id="cap-audit"></div>
    <div class="ambiguity">
      <strong>Recorded ambiguity (resolvable later):</strong>
      ${ambiguities[0].question} — <em>${ambiguities[0].consequence}</em>
    </div>
    <div class="command-fixed">
      <strong>Command-fixed task (second commitment):</strong> on completion of the
      observation, <b>exfiltrate east across the tidal waths</b> to ${PLACES.rvEast.name},
      not later than H+${EXFIL_DEADLINE_MIN} min.
      Criticality HARD. <span class="muted">(The recce confirms the crossing; the team then wades it at low water.)</span>
    </div>
    <div class="echo-back card" id="cap-echo" data-testid="cap-echo"></div>
    <div class="row">
      <button id="cap-commit" data-testid="cap-commit" class="primary">Commit (sign the echo-back)</button>
      <span id="cap-result" class="result"></span>
    </div>`;

  const audit = /** @type {HTMLElement} */ (el.querySelector('#cap-audit'));
  const echo = /** @type {HTMLElement} */ (el.querySelector('#cap-echo'));

  const opFor = (/** @type {string} */ key) =>
    /** @type {{key: string, name: string, h3: string}} */ (PLACES.ops.find((o) => o.key === key));
  const echoText = () => {
    const op = opFor(slots.where.value);
    return `ROVER-1 will VISIT ${op.name}, arriving not before `
      + `H+${slots.window_start.value} min and departing not later than H+${slots.window_end.value} min, `
      + `holding observation for at least ${slots.duration_min.value} min. `
      + `Then EXFILTRATE east across the tidal waths to ${PLACES.rvEast.name} `
      + `not later than H+${EXFIL_DEADLINE_MIN} min. `
      + `Both commitments HARD — inviolable (command-issued).`;
  };

  const renderLive = () => {
    audit.innerHTML = Object.entries(slots).map(([k, s]) =>
      `<span class="chip ${s.status}">${k}: <b>${s.value}</b> · ${s.status}</span>`).join(' ');
    echo.innerHTML = `<div class="echo-label">Echo-back (canonical contract text)</div>${echoText()}`;
    ctx.onPick?.(opFor(slots.where.value));   // highlight the picked OP on the AO map
  };
  renderLive();

  el.querySelectorAll('[data-slot]').forEach((input) => {
    input.addEventListener('change', () => {
      const k = /** @type {keyof typeof slots} */ (/** @type {HTMLElement} */ (input).dataset.slot);
      const raw = /** @type {HTMLInputElement} */ (input).value;
      const slot = /** @type {{value: string | number, status: string}} */ (slots[k]);
      slot.value = k === 'where' ? raw : Number(raw);
      slot.status = 'confirmed';
      renderLive();
    });
  });

  el.querySelector('#cap-commit')?.addEventListener('click', async () => {
    const op = opFor(slots.where.value);
    const at = new Date().toISOString();
    const commitment = {
      id: 'cmt-1',
      activity: {
        type: 'visit',
        where: { h3: op.h3, alias: op.key },
        when: { window: { start_min: Number(slots.window_start.value), end_min: Number(slots.window_end.value) } },
        duration: { min_min: Number(slots.duration_min.value) },
        modifiers: { stationary: true, be_at_role: 'visit' },
        effects: [],
        outcome_model: 'boolean',
        relevant_channels: ['mobility'],
      },
      criticality: 'hard',
      provenance: {
        issuing_role: 'command', authority: AUTHOR, owner: AUTHOR,
        waiver_authority: 'command', rationale: 'Confirm crossing viability at K-7.',
      },
      capture: {
        answers: Object.entries(slots).map(([slot, s]) => ({
          slot, value: s.value, status: s.status, by: AUTHOR, at,
        })),
        echo_back: echoText(),
        ambiguities,
      },
      state: 'committed',
    };
    const exfil = {
      id: 'cmt-2',
      activity: {
        type: 'transit',
        where: { h3: PLACES.rvEast.h3, alias: 'RV-EAST' },
        when: { before_min: EXFIL_DEADLINE_MIN },
        modifiers: { after: 'cmt-1' },             // sequenced: only after the observation
        effects: [],
        outcome_model: 'boolean',
        relevant_channels: ['mobility'],
      },
      criticality: 'hard',
      provenance: {
        issuing_role: 'command', authority: AUTHOR, owner: AUTHOR,
        waiver_authority: 'command',
        rationale: 'Exfiltrate east across K-7 once the ford is confirmed viable by the recce.',
      },
      capture: { answers: [], echo_back: 'Exfil E across K-7 to RV EAST.', ambiguities: [] },
      state: 'committed',
    };
    const requirement = {
      version: 1,
      intent: 'Observe the K-7 tidal ford, confirm crossing viability, then exfiltrate east across it.',
      provenance: { issuing_role: 'command', authority: AUTHOR, at },
      commitments: [commitment, exfil],
      lineage: {},
    };

    const { id } = await ctx.seam.putObject('Requirement', requirement);
    // Round-trip proof: the committed object is retrievable by content id.
    const back = await ctx.seam.getObject(id);
    const ok = back?.body?.commitments?.[0]?.capture?.echo_back === commitment.capture.echo_back;

    el.querySelectorAll('input,select,button').forEach((n) => /** @type {any} */ (n).disabled = true);
    const result = /** @type {HTMLElement} */ (el.querySelector('#cap-result'));
    result.innerHTML = `committed · <code class="hash" data-testid="cap-reqid">${id.slice(7, 15)}</code>`
      + ` · round-trip ${ok ? '<span class="ok">✓</span>' : '<span class="bad">✗</span>'}`
      + ` <span class="muted">(immutable — amendment would be a new version)</span>`;
    ctx.onCommitted(requirement, id);
  });
}
