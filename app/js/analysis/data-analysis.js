// @ts-check
// analysis/data-analysis.js — the Data Analysis surface: a read-only drill-down
// monitor over the shared content-addressed store (NF1 — it projects, it never
// re-derives). It is the first real "alternative projection" of the one store
// that DEC-61 anticipates: many role UIs, one set of objects.
//
// It is handed its context {objects, seam, world, playhead} rather than
// importing the singletons, so the SAME instance renders the SAME live store
// whether it runs inline (main window) or in a popped-out window (where the
// shell passes window.opener.__remit). Do NOT import ./shell/context.js here —
// that would bind a popped-out copy to a fresh, empty store.
//
// Change glow: REMIT objects are immutable and content-addressed, so "data
// changing" means new ids appended to the store. We diff objects.list() against
// what we've seen and glow newly-added rows + their type-group header (the
// parent, up the hierarchy). The same flash() is the hook a future mock
// source-provider (DEC-49/61 ingress) will call on each injection. Future
// stamped-delta writes (DEC-61) would arrive as seam.putObject('Delta', …) from
// a write-scoped role; this surface is read-only.

import { shortId } from '../shapes/canonical.js';

const BAND_FIELDS = new Set(['margin_band', 'cost_band', 'robustness_band']);
const KNOWN_REFS = new Set([
  'requirement_version', 'baseline_version', 'profile_version', 'config_core_hash',
  'previous_version', 'amending_order_ref', 'channel_ref', 'commitment_id',
  'from', 'to', 'chosen', 'rationale_ref',
]);
const REF_ARRAYS = new Set(['excursions', 'parties', 'beaten']);

/** A name/value substring match surfaced by the search (see `matchObject`). */
/** @typedef {{ key: string, value: string }} DaMatch */

/** An index row from `objects.list()`, annotated with a transient search hint. */
/** @typedef {{ id: string, type: string, bytes: number, _hint?: DaMatch | null }} DaRow */

/**
 * Tiny hyperscript helper.
 * @param {string} tag
 * @param {Record<string, string> | null} [attrs]
 * @param {...(Node | string | null | undefined)} kids
 */
function h(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  if (attrs) for (const k in attrs) {
    if (k === 'class') e.className = attrs[k];
    else e.setAttribute(k, attrs[k]);
  }
  for (const kid of kids) {
    if (kid == null) continue;
    e.append(typeof kid !== 'string' && kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return e;
}

/**
 * @param {HTMLElement} container  the view section (inline) or #popout-root (popped out)
 * @param {{objects:any, seam:any, world:any, playhead?:any}} ctx  shared context
 */
export function mountDataAnalysis(container, ctx) {
  const { objects, seam, world } = ctx;

  /** @type {{id:string, key:string|null}[]} */ let trail = [];
  let seenIds = new Set();
  let firstRefresh = true;
  let query = '';

  const root = h('div', { class: 'da', 'data-testid': 'data-analysis' });
  const searchEl = /** @type {HTMLInputElement} */ (h('input', {
    class: 'da-search', type: 'search', 'data-testid': 'da-search',
    placeholder: 'Search names or values…', 'aria-label': 'Search the store',
  }));
  const indexEl = h('div', { class: 'da-index', 'data-testid': 'da-index' });
  const crumbsEl = h('nav', { class: 'da-crumbs', 'data-testid': 'da-crumbs', 'aria-label': 'Drill path' });
  const detailEl = h('div', { class: 'da-body', 'data-testid': 'da-detail' });
  root.append(
    h('aside', { class: 'da-side' }, searchEl, indexEl),
    h('section', { class: 'da-detail' }, crumbsEl, detailEl),
  );
  container.replaceChildren(root);

  const currentId = () => (trail.length ? trail[trail.length - 1].id : null);

  // --- index pane ----------------------------------------------------------
  /** @param {DaRow} rec */
  function rowLabel(rec) {
    const b = objects.get(rec.id)?.body ?? {};
    const s = b.name || b.strategy?.label || b.intent || b.id || '';
    return typeof s === 'string' && s.length > 28 ? s.slice(0, 27) + '…' : s;
  }

  function renderIndex() {
    indexEl.replaceChildren();
    /** @type {DaRow[]} */ const list = objects.list();
    if (!list.length) { indexEl.append(emptyState()); renderDetail(); return; }

    /** @type {Map<string, DaRow[]>} */ const groups = new Map();
    for (const rec of list) {
      if (query) { const m = matchObject(rec, query); if (!m) continue; rec._hint = m; }
      else rec._hint = null;
      let bucket = groups.get(rec.type);
      if (!bucket) groups.set(rec.type, bucket = []);
      bucket.push(rec);
    }
    if (query && groups.size === 0) {
      indexEl.append(h('p', { class: 'muted' }, `No object matches “${query}”.`));
      return;
    }
    const cur = currentId();
    for (const [type, recs] of groups) {
      const g = h('div', { class: 'da-group' });
      g.setAttribute('data-group', type);
      g.append(h('h3', {}, `${type} · ${recs.length}`));
      for (const rec of recs) {
        const row = h('button', { class: 'da-row' + (rec.id === cur ? ' selected' : ''), type: 'button' });
        row.setAttribute('data-id', rec.id);
        row.setAttribute('data-testid', `da-row-${shortId(rec.id)}`);
        row.append(h('code', { class: 'hash' }, shortId(rec.id)));
        const label = rowLabel(rec);
        if (label) row.append(h('span', { class: 'da-rowlabel' }, label));
        if (rec._hint) row.append(h('span', { class: 'da-rowhint' }, rec._hint.key));
        row.addEventListener('click', () => openObject(rec.id));
        g.append(row);
      }
      indexEl.append(g);
    }
    applyGlow();
  }

  function emptyState() {
    const wrap = h('div', { class: 'da-empty', 'data-testid': 'da-empty' });
    wrap.append(
      h('h3', {}, 'No objects yet'),
      h('p', { class: 'muted' },
        'The shared store fills as you play the lifecycle. Switch to the Overview tab and run '
        + 'World → Capture → Plan to commit the first objects — or provision the area-of-operations objects now:'),
    );
    const btn = /** @type {HTMLButtonElement} */ (h('button', { class: 'primary', type: 'button', 'data-testid': 'da-provision' },
      'Provision area-of-operations objects'));
    btn.addEventListener('click', () => provision(btn));
    wrap.append(h('div', { class: 'row' }, btn),
      h('p', { class: 'muted' }, 'Same objects the World stage commits — content-addressed and idempotent.'));
    return wrap;
  }

  /** @param {HTMLButtonElement} btn */
  async function provision(btn) {
    btn.disabled = true;
    try {
      await Promise.all([
        seam.putObject('Baseline', world.baseline),
        seam.putObject('Profile', world.profile),
        seam.putObject('ConfigCore', world.configCore),
      ]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      window.__remitFault?.(`provisioning: ${msg}`);
    }
    refresh();
  }

  // --- detail pane (drill-down tree) --------------------------------------
  function renderDetail() {
    detailEl.replaceChildren();
    const id = currentId();
    if (!id) { detailEl.append(h('p', { class: 'muted' }, 'Select an object on the left to inspect it, then click any content-id reference to drill through the data.')); return; }
    const rec = objects.get(id);
    if (!rec) { detailEl.append(h('p', { class: 'muted' }, 'That object is not in the store.')); return; }
    detailEl.append(h('div', { class: 'da-detail-head' },
      h('b', {}, rec.type), ' ', h('code', { class: 'hash' }, shortId(id))));
    for (const k of Object.keys(rec.body)) detailEl.append(fieldNode(k, rec.body[k], 0));
  }

  /** @param {string} key @param {any} value */
  function isRef(key, value) {
    return typeof value === 'string' && (KNOWN_REFS.has(key) || value.startsWith('sha256:'));
  }

  /** @param {string} value  a content-id reference @param {string} viaKey */
  function refChip(value, viaKey) {
    const target = objects.get(value);
    if (target) {
      const chip = h('button', { class: 'hash da-ref', type: 'button', title: `${target.type} ${value}` },
        `${target.type} ${shortId(value)}`);
      chip.setAttribute('data-testid', `da-ref-${shortId(value)}`);
      chip.addEventListener('click', () => drillTo(value, viaKey));
      return chip;
    }
    return h('code', { class: 'hash da-ref-dead', title: 'referenced object is not in the store' },
      shortId(value));
  }

  /** @param {string} key @param {any} value */
  function valueInline(key, value) {
    if (isRef(key, value)) return refChip(value, key);
    if (BAND_FIELDS.has(key)) return h('span', { class: `band band-${value}` }, String(value));
    return h('span', { class: 'da-val' }, String(value));
  }

  /** @param {string} key @param {Node} valueNode */
  function leaf(key, valueNode) {
    return h('div', { class: 'da-leaf' }, h('span', { class: 'da-key' }, `${key}: `), valueNode);
  }

  /** @param {string} key @param {any} value @param {number} depth */
  function fieldNode(key, value, depth) {
    if (Array.isArray(value)) {
      const allRefs = value.length > 0 && value.every((v) => isRef('', v) || (typeof v === 'string' && v.startsWith('sha256:')));
      if (REF_ARRAYS.has(key) || allRefs) {
        const box = h('div', { class: 'da-leaf' }, h('span', { class: 'da-key' }, `${key}: `));
        value.forEach((v) => box.append(refChip(v, key), document.createTextNode(' ')));
        if (!value.length) box.append(h('span', { class: 'muted' }, '[]'));
        return box;
      }
      // Open small arrays at the top level; keep large ones (e.g. a baseline's
      // hundreds of cells) collapsed so the tree stays scannable.
      const d = h('details', depth < 1 && value.length <= 12 ? { open: '' } : {});
      d.append(h('summary', {}, h('span', { class: 'da-key' }, key), ` [${value.length}]`));
      value.forEach((v, i) => d.append(fieldNode(`${key}[${i}]`, v, depth + 1)));
      return d;
    }
    if (value && typeof value === 'object') {
      const keys = Object.keys(value);
      const d = h('details', depth < 1 ? { open: '' } : {});
      d.append(h('summary', {}, h('span', { class: 'da-key' }, key),
        h('span', { class: 'muted' }, ` {${keys.length}}`)));
      keys.forEach((k) => d.append(fieldNode(k, value[k], depth + 1)));
      return d;
    }
    return leaf(key, valueInline(key, value));
  }

  // --- navigation ----------------------------------------------------------
  /** @param {string} id */
  function openObject(id) { trail = [{ id, key: null }]; renderDetail(); renderCrumbs(); markSelected(); }
  /** @param {string} id @param {string} viaKey */
  function drillTo(id, viaKey) { trail.push({ id, key: viaKey }); renderDetail(); renderCrumbs(); markSelected(); }
  /** @param {number} i */
  function gotoCrumb(i) { trail = trail.slice(0, i + 1); renderDetail(); renderCrumbs(); markSelected(); }

  function markSelected() {
    const id = currentId();
    indexEl.querySelectorAll('.da-row').forEach((r) =>
      r.classList.toggle('selected', /** @type {HTMLElement} */ (r).getAttribute('data-id') === id));
  }

  function renderCrumbs() {
    crumbsEl.replaceChildren();
    trail.forEach((c, i) => {
      if (c.key) crumbsEl.append(h('span', { class: 'crumb-sep' }, ` ${c.key} ▸ `));
      const rec = objects.get(c.id);
      const label = `${rec?.type ?? '?'} ${shortId(c.id)}`;
      if (i === trail.length - 1) crumbsEl.append(h('span', { class: 'crumb-current' }, label));
      else {
        const b = h('button', { type: 'button' }, label);
        b.addEventListener('click', () => gotoCrumb(i));
        crumbsEl.append(b);
      }
    });
  }

  // --- search --------------------------------------------------------------
  /**
   * Deep-walk an object collecting a name/value substring match.
   * @param {DaRow} rec @param {string} q
   * @returns {DaMatch | null}
   */
  function matchObject(rec, q) {
    if (rec.type.toLowerCase().includes(q)) return { key: 'type', value: rec.type };
    if (shortId(rec.id).includes(q)) return { key: 'id', value: shortId(rec.id) };
    const full = objects.get(rec.id);
    if (!full) return null;
    /** @type {DaMatch | null} */ let hit = null;
    /** @param {any} value @param {string} path */
    const walk = (value, path) => {
      if (hit || value == null) return;
      const t = typeof value;
      if (t === 'string' || t === 'number' || t === 'boolean') {
        if (String(value).toLowerCase().includes(q)) hit = { key: path || '·', value: String(value) };
        return;
      }
      if (Array.isArray(value)) { for (let i = 0; i < value.length && !hit; i++) walk(value[i], `${path}[${i}]`); return; }
      if (t === 'object') {
        for (const k of Object.keys(value)) {
          if (hit) break;
          if (k.toLowerCase().includes(q)) { hit = { key: path ? `${path}.${k}` : k, value: '(name)' }; break; }
          walk(value[k], path ? `${path}.${k}` : k);
        }
      }
    };
    walk(full.body, '');
    return hit;
  }

  searchEl.addEventListener('input', () => { query = searchEl.value.trim().toLowerCase(); renderIndex(); });

  // --- change glow + live refresh -----------------------------------------
  // The glow is persistent: the most-recent change set stays lit until the next
  // change replaces it (left in place, not faded). Rapid successive writes — one
  // "generate" commits a Stamp + several Plans as separate calls — are coalesced
  // into a single batch via a short burst window so they light up together.
  /** @type {Set<string>} */ let glowingIds = new Set();
  /** @type {ReturnType<typeof setTimeout> | null} */ let glowBurst = null;

  /** @param {string[]} added */
  function noteChange(added) {
    if (!added.length) return;
    if (glowBurst === null) glowingIds = new Set(added);   // new batch → clears the old glow
    else for (const id of added) glowingIds.add(id);       // within a burst → accumulate
    clearTimeout(/** @type {ReturnType<typeof setTimeout>} */ (glowBurst));  // no-op when null
    glowBurst = setTimeout(() => { glowBurst = null; }, 600);
  }

  /** Re-apply the persistent glow after each index rebuild. */
  function applyGlow() {
    for (const id of glowingIds) {
      indexEl.querySelector(`[data-testid="da-row-${shortId(id)}"]`)?.classList.add('glow');
      const type = objects.get(id)?.type;
      if (type) indexEl.querySelector(`.da-group[data-group="${type}"] > h3`)?.classList.add('glow-soft');
    }
  }

  function refresh() {
    const cur = new Set(objects.list().map((/** @type {DaRow} */ o) => o.id));
    if (!firstRefresh) noteChange([...cur].filter((id) => !seenIds.has(id)));
    firstRefresh = false;
    seenIds = cur;
    renderIndex();   // re-applies the persistent glow via applyGlow()
    markSelected();
  }

  // Repaint only while actually visible: the tab-view is active, or we're in a
  // popped-out window (container is #popout-root, not a .tab-view).
  const isView = container.classList.contains('tab-view');
  const isVisible = () => (isView ? container.classList.contains('active') : true);

  const off = seam.onTraffic(() => {
    try {
      if (!root.isConnected) { off(); return; }   // unmounted (e.g. popped out) → drop the listener
      if (isVisible()) refresh();
    } catch (_) { off(); }
  });
  container.addEventListener('tab:activated', refresh);
  window.addEventListener('pagehide', off);

  refresh();   // first paint (seeds seenIds without glowing the initial load)
}
