// @ts-check
// shell/orbat-panel.js — the ORBAT authoring surface (DEC-60/61). A config-declared
// role-tab (home: the `sme-int` role — "red/green entities and threat"). It mounts with the
// shared context and reads/writes the roster ONLY through app/js/orbat/orbat.js (contract:
// orbat-store.md). Display-only (NF9): nothing here alters a route or plan — including blue
// availability/capability tuning. Every mutating affordance mirrors to the live draft
// (persisted to localStorage), which the Overview map + Sync Matrix project.
//
// UI-only render closures (the roster rows, the per-allegiance tuners) are the documented
// behaviour/UI carve-out (ADR-0012 §2) and stay hand-written; the serialisable Asset/Orbat
// shapes are schema-generated and reached through the model module.

import {
  getDraft, setDraft, subscribeDraft, reconcileOwnForce,
  addAsset, tuneAsset, duplicateAsset, removeAsset, validate, commit,
  ALLEGIANCES, BOUNDS, PROTECTIONS, ALLEGIANCE_COLOR,
} from '../orbat/orbat.js';
import { latLngToId } from '../kernel/hexgrid.js';
import { shortId } from '../shapes/canonical.js';

/** Selection bus — panel → map/Sync-Matrix highlight (US5). main.js listens. */
const SELECT_EVENT = 'remit:orbat-select';
/** @param {string|null} id */
function broadcastSelection(id) {
  window.dispatchEvent(new CustomEvent(SELECT_EVENT, { detail: { id } }));
}

const GROUPS = /** @type {const} */ ([
  { allegiance: 'blue', title: 'Blue (own force)' },
  { allegiance: 'red', title: 'Red (hostile)' },
  { allegiance: 'green', title: 'Green (neutral)' },
]);

const esc = (/** @type {any} */ s) => String(s ?? '').replace(/[<&"]/g, (c) => ({ '<': '&lt;', '&': '&amp;', '"': '&quot;' }[c] ?? c));

/**
 * Mount the ORBAT authoring panel.
 * @param {HTMLElement} container
 * @param {{ objects: import('../stores/stores.js').ObjectStore, world: any, playhead: any }} ctx
 */
export function mountOrbatPanel(container, ctx) {
  const { objects, world } = ctx;
  let selected = /** @type {string|null} */ (null);

  // A position is valid if it resolves to a cell inside the AO (FR-001/003 + edge).
  const inAO = (/** @type {any} */ pos) => {
    if (!pos) return false;
    if (pos.h3) return world.ao.idOf.has(pos.h3);
    if (typeof pos.lat === 'number' && typeof pos.lng === 'number')
      return latLngToId(world.ao, pos.lat, pos.lng) !== undefined;
    return false;
  };

  // Default placement: a deterministic in-AO cell, spread by roster size so successive
  // adds don't stack (no map-click needed across tabs — the contract's "default AO-centre
  // position"). The user re-places via the position tuner.
  const defaultPosition = (/** @type {number} */ seq) => {
    const ao = world.ao;
    const idx = (Math.floor(ao.N / 2) + seq * 11) % ao.N;
    const [lat, lng] = ao.centers[idx];
    return { h3: ao.indexes[idx], lat, lng };
  };

  // Surface the existing planned own-force (ROVER-1) as the canonical blue asset (idempotent).
  const base = world.places?.base;
  setDraft(reconcileOwnForce(getDraft(), {
    label: 'Own force · ROVER-1',
    position: base ? { h3: base.h3, lat: base.lat, lng: base.lng } : undefined,
  }));

  /** Apply an op that returns a new draft, persist+broadcast, then re-render. */
  const apply = (/** @type {() => any} */ fn, /** @type {(HTMLElement|null)} */ msgEl = null) => {
    try {
      const result = fn();
      const next = result && result.orbat ? result.orbat : result;
      setDraft(next);
      render();
      return result;
    } catch (err) {
      if (msgEl) { msgEl.textContent = `⚠ ${err instanceof Error ? err.message : String(err)}`; msgEl.classList.add('orbat-msg-err'); }
      return null;
    }
  };

  function render() {
    const draft = getDraft();
    const assets = draft.assets ?? [];
    container.innerHTML = `
      <div class="orbat-panel" data-testid="orbat-panel">
        <header class="orbat-head">
          <h2>ORBAT <span class="muted">— authoring (display-only, NF9)</span></h2>
          <p class="muted">Add, tune, duplicate and remove the scenario's own-force, threat and
            neutral assets. Authoring never changes the route or plan; the planned own-force
            (ROVER-1) is reconciled as the canonical blue asset and protected from removal.</p>
          <div class="row orbat-actions">
            <button class="primary" data-testid="orbat-commit" id="orbat-commit">Commit ORBAT</button>
            <span class="result" id="orbat-commit-result" data-testid="orbat-commit-result"></span>
          </div>
        </header>
        ${GROUPS.map((g) => groupHtml(g, assets)).join('')}
      </div>`;

    // Add buttons.
    for (const g of GROUPS) {
      container.querySelector(`#orbat-add-${g.allegiance}`)?.addEventListener('click', () => {
        const seq = (getDraft().assets ?? []).length;
        apply(() => addAsset(getDraft(), { allegiance: g.allegiance, position: defaultPosition(seq) }, { inAO }));
      });
    }

    // Per-row wiring.
    for (const a of assets) wireRow(a);

    // Commit.
    container.querySelector('#orbat-commit')?.addEventListener('click', async () => {
      const res = await commit(getDraft(), objects);
      // Link the next commit to this version (lineage chain, Principle V).
      setDraft({ ...getDraft(), lineage: { previous_version: res.id } });
      const out = /** @type {HTMLElement} */ (container.querySelector('#orbat-commit-result'));
      out.innerHTML = `committed <code class="hash">${shortId(res.id)}</code>${res.existed ? ' (unchanged)' : ''}`;
    });
  }

  /** @param {{ allegiance: string, title: string }} g @param {any[]} assets */
  function groupHtml(g, assets) {
    const rows = assets.filter((a) => a.allegiance === g.allegiance);
    const color = ALLEGIANCE_COLOR[/** @type {keyof typeof ALLEGIANCE_COLOR} */ (g.allegiance)];
    return `
      <section class="orbat-group" data-testid="orbat-group-${g.allegiance}" data-allegiance="${g.allegiance}">
        <div class="orbat-group-head">
          <h3><i class="dot" style="background:${color}"></i>${g.title}</h3>
          <button data-testid="orbat-add-${g.allegiance}" id="orbat-add-${g.allegiance}">+ Add ${g.allegiance}</button>
        </div>
        ${rows.length
          ? `<ul class="orbat-rows">${rows.map(rowHtml).join('')}</ul>`
          : `<p class="muted orbat-none" data-testid="orbat-none-${g.allegiance}">none</p>`}
      </section>`;
  }

  /** @param {any} a */
  function rowHtml(a) {
    const cano = !!a.canonical_own_force;
    const sel = selected === a.id ? ' orbat-row-sel' : '';
    return `
      <li class="orbat-row${sel}" data-testid="orbat-row-${a.id}" data-id="${a.id}" data-allegiance="${a.allegiance}">
        <div class="orbat-row-top">
          <button class="orbat-select" data-act="select" title="Highlight on the map / Sync Matrix">◎</button>
          <input class="orbat-label" data-act="label" type="text" value="${esc(a.label)}"
            data-testid="orbat-label-${a.id}" aria-label="label" />
          ${cano ? '<span class="chip orbat-canon" data-testid="orbat-canon">canonical own-force</span>' : ''}
          <button class="orbat-dup" data-act="dup" data-testid="orbat-dup-${a.id}" title="Duplicate">⧉</button>
          <button class="orbat-remove" data-act="remove" data-testid="orbat-remove-${a.id}"
            title="${cano ? 'the canonical own-force cannot be removed' : 'Remove'}" ${cano ? 'disabled' : ''}>✕</button>
        </div>
        <div class="orbat-tuners">
          <label>extent
            <input data-act="extent" type="range" min="${BOUNDS.extent_m[0]}" max="${BOUNDS.extent_m[1]}" step="50"
              value="${a.extent_m ?? 800}" data-testid="orbat-extent-${a.id}" />
            <span class="orbat-extent-val">${a.extent_m ?? 800} m</span>
          </label>
          ${a.allegiance === 'red' ? redTuners(a) : ''}
          ${a.allegiance === 'green' ? greenTuners(a) : ''}
          ${a.allegiance === 'blue' ? blueTuners(a) : ''}
        </div>
        <div class="orbat-msg" data-testid="orbat-msg-${a.id}"></div>
      </li>`;
  }

  /** @param {any} a */
  function redTuners(a) {
    const w = (a.red?.active_windows ?? [])[0];
    return `
      <label>severity
        <input data-act="severity" type="range" min="${BOUNDS.severity[0]}" max="${BOUNDS.severity[1]}" step="1"
          value="${a.red?.severity ?? 3}" data-testid="orbat-severity-${a.id}" />
        <span class="orbat-sev-val">${a.red?.severity ?? 3}</span>
      </label>
      <label class="orbat-window">
        <input data-act="redwin-on" type="checkbox" ${w ? 'checked' : ''} data-testid="orbat-redwin-${a.id}" /> active window
        <input data-act="redwin-start" type="number" placeholder="H+start" value="${w?.start_min ?? ''}" class="orbat-win-num" ${w ? '' : 'disabled'} />
        <input data-act="redwin-end" type="number" placeholder="H+end" value="${w?.end_min ?? ''}" class="orbat-win-num" ${w ? '' : 'disabled'} />
      </label>`;
  }

  /** @param {any} a */
  function greenTuners(a) {
    return `
      <label>sensitivity
        <input data-act="sensitivity" type="range" min="${BOUNDS.sensitivity[0]}" max="${BOUNDS.sensitivity[1]}" step="1"
          value="${a.green?.sensitivity ?? 3}" data-testid="orbat-sensitivity-${a.id}" />
        <span class="orbat-sens-val">${a.green?.sensitivity ?? 3}</span>
      </label>
      <label>protection
        <select data-act="protection" data-testid="orbat-protection-${a.id}">
          ${PROTECTIONS.map((p) => `<option value="${p}" ${a.green?.protection === p ? 'selected' : ''}>${p}</option>`).join('')}
        </select>
      </label>`;
  }

  /** @param {any} a */
  function blueTuners(a) {
    const win = /** @type {any} */ (a.blue)?.window;
    return `
      <label>availability
        <select data-act="availability" data-testid="orbat-availability-${a.id}">
          ${['available', 'down'].map((v) => `<option value="${v}" ${a.blue?.availability === v ? 'selected' : ''}>${v}</option>`).join('')}
        </select>
      </label>
      <label>capabilities
        <input data-act="capabilities" type="text" value="${esc((a.blue?.capabilities ?? []).join(', '))}"
          placeholder="recce, comms" data-testid="orbat-capabilities-${a.id}" />
      </label>
      <label class="orbat-window">
        <input data-act="bluewin-on" type="checkbox" ${win ? 'checked' : ''} data-testid="orbat-bluewin-${a.id}" /> availability window
        <input data-act="bluewin-start" type="number" placeholder="H+start" value="${win?.start_min ?? ''}" class="orbat-win-num" ${win ? '' : 'disabled'} />
        <input data-act="bluewin-end" type="number" placeholder="H+end" value="${win?.end_min ?? ''}" class="orbat-win-num" ${win ? '' : 'disabled'} />
      </label>`;
  }

  /** @param {any} a */
  function wireRow(a) {
    const row = /** @type {HTMLElement} */ (container.querySelector(`[data-testid="orbat-row-${a.id}"]`));
    if (!row) return;
    const msg = /** @type {HTMLElement} */ (row.querySelector('.orbat-msg'));
    const on = (/** @type {string} */ act, /** @type {string} */ evt, /** @type {(el: any) => void} */ fn) =>
      row.querySelector(`[data-act="${act}"]`)?.addEventListener(evt, (e) => fn(e.currentTarget));

    row.querySelector('[data-act="select"]')?.addEventListener('click', () => {
      selected = selected === a.id ? null : a.id;
      broadcastSelection(selected);
      render();
    });
    on('label', 'change', (el) => apply(() => tuneAsset(getDraft(), a.id, { label: el.value }), msg));
    on('extent', 'change', (el) => apply(() => tuneAsset(getDraft(), a.id, { extent_m: Number(el.value) }), msg));
    on('dup', 'click', () => apply(() => duplicateAsset(getDraft(), a.id), msg));
    on('remove', 'click', () => apply(() => removeAsset(getDraft(), a.id), msg));

    if (a.allegiance === 'red') {
      on('severity', 'change', (el) => apply(() => tuneAsset(getDraft(), a.id, { red: { severity: Number(el.value) } }), msg));
      const winFromRow = () => {
        const onEl = /** @type {HTMLInputElement} */ (row.querySelector('[data-act="redwin-on"]'));
        if (!onEl.checked) return [];
        const s = Number(/** @type {HTMLInputElement} */ (row.querySelector('[data-act="redwin-start"]')).value || 0);
        const e = Number(/** @type {HTMLInputElement} */ (row.querySelector('[data-act="redwin-end"]')).value || 0);
        return [{ start_min: s, end_min: e }];
      };
      for (const act of ['redwin-on', 'redwin-start', 'redwin-end'])
        on(act, 'change', () => apply(() => tuneAsset(getDraft(), a.id, { red: { active_windows: winFromRow() } }), msg));
    }
    if (a.allegiance === 'green') {
      on('sensitivity', 'change', (el) => apply(() => tuneAsset(getDraft(), a.id, { green: { sensitivity: Number(el.value) } }), msg));
      on('protection', 'change', (el) => apply(() => tuneAsset(getDraft(), a.id, { green: { protection: el.value } }), msg));
    }
    if (a.allegiance === 'blue') {
      on('availability', 'change', (el) => apply(() => tuneAsset(getDraft(), a.id, { blue: { availability: el.value } }), msg));
      on('capabilities', 'change', (el) => apply(() => tuneAsset(getDraft(), a.id, { blue: { capabilities: el.value.split(',').map((/** @type {string} */ s) => s.trim()).filter(Boolean) } }), msg));
      const bwin = () => {
        const onEl = /** @type {HTMLInputElement} */ (row.querySelector('[data-act="bluewin-on"]'));
        if (!onEl.checked) return undefined;
        const s = Number(/** @type {HTMLInputElement} */ (row.querySelector('[data-act="bluewin-start"]')).value || 0);
        const e = Number(/** @type {HTMLInputElement} */ (row.querySelector('[data-act="bluewin-end"]')).value || 0);
        return { start_min: Math.min(s, e), end_min: Math.max(s, e) };
      };
      for (const act of ['bluewin-on', 'bluewin-start', 'bluewin-end'])
        on(act, 'change', () => apply(() => {
          const draft = getDraft();
          const asset = (draft.assets ?? []).find((x) => x.id === a.id);
          const blue = { ...(asset?.blue ?? {}), window: bwin() };
          if (blue.window === undefined) delete blue.window;
          return tuneAsset(draft, a.id, { blue });
        }, msg));
    }

    // Show any standing validation issues (display feedback; never blocks).
    const asset = (getDraft().assets ?? []).find((x) => x.id === a.id);
    if (asset) {
      const v = validate(asset, { inAO });
      if (!v.ok) { msg.textContent = `⚠ ${v.issues.join('; ')}`; msg.classList.add('orbat-msg-err'); }
    }
  }

  // Re-render if the draft changes elsewhere (e.g. main.js reconciliation).
  const unsub = subscribeDraft(() => { if (container.isConnected) render(); });
  container.addEventListener('tab:activated', render);
  // Best-effort cleanup if the container is torn down (pop-in/out).
  const obs = new MutationObserver(() => { if (!container.isConnected) { unsub(); obs.disconnect(); } });
  if (container.parentNode) obs.observe(container.parentNode, { childList: true });

  render();
}
