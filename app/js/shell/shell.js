// @ts-check
// shell/shell.js — the page entry + tab controller.
//
// Builds the role tab bar (DEC-61), switches views, and manages pop-out
// windows. Each surface is mounted lazily on first activation and handed the
// shared context {objects, logs, seam, world, playhead}; a popped-out surface
// gets the SAME context via window.opener (see popout.js), so it monitors the
// same live store while you drive the mission in the main window.

import { roles, STUB_BLURB } from './roles.js';
import { context } from './context.js';

/** @typedef {import('./roles.js').RoleTab} RoleTab */

const HASH_RE = /tab=([\w-]+)/;
const hashTab = () => location.hash.match(HASH_RE)?.[1] ?? null;
/** @param {string} id */
const setHash = (id) => history.replaceState(null, '', `#tab=${id}`);
/** @param {string} m */
const fault = (m) => /** @type {any} */ (window).__remitFault?.(m);
/** @param {unknown} err */
const msg = (err) => (err && /** @type {any} */ (err).message ? /** @type {any} */ (err).message : String(err));

const defs = roles();
const mounted = new Set();
/** @type {Map<string, Window>} */ const poppedOut = new Map();
/** @type {Map<string, number>} */ const childTimers = new Map();

/** @type {HTMLElement} */ let tabsHost;
/** @type {HTMLElement} */ let viewsHost;

export function boot() {
  tabsHost = /** @type {HTMLElement} */ (document.getElementById('tabbar'));
  viewsHost = /** @type {HTMLElement} */ (document.getElementById('views'));
  for (const r of defs) buildTab(r);
  tabsHost.addEventListener('keydown', onKeydown);
  window.addEventListener('hashchange', () => { const id = hashTab(); if (id) activate(id, false); });
  // Minimal API a popped-out child calls to pop itself back in on close.
  /** @type {any} */ (window).__remitShell = { popIn };
  activate(hashTab() ?? 'overview', false);
}

/** @param {RoleTab} r */
function buildTab(r) {
  const wrap = document.createElement('span');
  wrap.className = 'tab-wrap';

  const tab = document.createElement('button');
  tab.type = 'button';
  tab.className = 'tab' + (r.status === 'stub' ? ' tab-stub' : '');
  tab.id = `tab-${r.id}`;
  tab.setAttribute('role', 'tab');
  tab.setAttribute('aria-selected', 'false');
  tab.setAttribute('aria-controls', `view-${r.id}`);
  tab.tabIndex = -1;
  tab.dataset.tab = r.id;
  tab.dataset.testid = `tab-${r.id}`;
  tab.textContent = r.label;
  tab.addEventListener('click', () => activate(r.id, true));
  wrap.appendChild(tab);

  if (r.poppable) {
    const pop = document.createElement('button');
    pop.type = 'button';
    pop.className = 'tab-pop';
    pop.id = `popout-${r.id}`;
    pop.title = `Open ${r.label} in its own window`;
    pop.setAttribute('aria-label', `Pop out ${r.label}`);
    pop.dataset.testid = `popout-${r.id}`;
    pop.textContent = '⧉';
    pop.addEventListener('click', (e) => { e.stopPropagation(); popOut(r.id); });
    wrap.appendChild(pop);
  }
  tabsHost.appendChild(wrap);

  // Overview's view container is pre-populated in index.html; create the rest.
  let view = document.getElementById(`view-${r.id}`);
  if (!view) {
    view = document.createElement('section');
    view.id = `view-${r.id}`;
    view.className = 'tab-view';
    view.setAttribute('role', 'tabpanel');
    view.setAttribute('aria-labelledby', `tab-${r.id}`);
    view.dataset.testid = `view-${r.id}`;
    if (r.status === 'stub') view.innerHTML = stubPane(r);
    viewsHost.appendChild(view);
  }
}

/** @param {RoleTab} r */
function stubPane(r) {
  return `<div class="stub-pane" data-testid="stub-${r.id}">
    <h2>${r.label} <span class="chip">coming soon</span></h2>
    <p class="muted">${/** @type {Record<string, string>} */ (STUB_BLURB)[r.id] ?? 'Role surface to be built.'}</p>
    <p class="muted">A config-declared view over the shared store — read via projections,
       write only via scoped stamped deltas (DEC-61).</p>
  </div>`;
}

/** @param {string} id @param {boolean} viaUser */
async function activate(id, viaUser) {
  const r = defs.find((d) => d.id === id) ?? defs[0];
  for (const d of defs) {
    const cur = d.id === r.id;
    const tab = document.getElementById(`tab-${d.id}`);
    const view = document.getElementById(`view-${d.id}`);
    if (tab) { tab.setAttribute('aria-selected', String(cur)); tab.tabIndex = cur ? 0 : -1; tab.classList.toggle('active', cur); }
    if (view) view.classList.toggle('active', cur);
  }
  if (viaUser) setHash(r.id);
  if (poppedOut.has(r.id)) return;   // showing the placeholder; nothing to mount
  if (r.mount && !mounted.has(r.id)) {
    mounted.add(r.id);
    const view = /** @type {HTMLElement} */ (document.getElementById(`view-${r.id}`));
    try { await r.mount(view, context); }
    catch (err) { mounted.delete(r.id); fault(`mounting ${r.label}: ${msg(err)}`); console.error(err); }
  } else if (r.mount && mounted.has(r.id)) {
    document.getElementById(`view-${r.id}`)?.dispatchEvent(new CustomEvent('tab:activated'));
  }
}

/** @param {KeyboardEvent} e */
function onKeydown(e) {
  const order = defs.map((d) => d.id);
  const cur = order.findIndex((id) =>
    document.getElementById(`tab-${id}`)?.getAttribute('aria-selected') === 'true');
  let next = cur;
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (cur + 1) % order.length;
  else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (cur - 1 + order.length) % order.length;
  else if (e.key === 'Home') next = 0;
  else if (e.key === 'End') next = order.length - 1;
  else return;
  e.preventDefault();
  document.getElementById(`tab-${order[next]}`)?.focus();
  activate(order[next], true);
}

// --- pop-out / pop-in -------------------------------------------------------

/** @param {string} id */
function popOut(id) {
  const existing = poppedOut.get(id);
  if (existing && !existing.closed) { existing.focus(); return; }
  const child = window.open(`popout.html#tab=${id}`, `remit-${id}`, 'popup,width=560,height=780');
  if (!child) { fault('pop-out blocked — allow popups for this site, then try again'); return; }
  poppedOut.set(id, child);

  // Unmount the inline instance so exactly one live surface exists, and show a
  // placeholder with a "pop back in" affordance.
  const view = /** @type {HTMLElement} */ (document.getElementById(`view-${id}`));
  if (view) {
    view.innerHTML = poppedPlaceholder(id);
    mounted.delete(id);
    view.querySelector(`#popin-${id}`)?.addEventListener('click', () => popIn(id, false));
  }
  document.getElementById(`tab-${id}`)?.classList.add('popped');

  // Fallback to polling in case the child closes without notifying us.
  const timer = window.setInterval(() => {
    if (child.closed) { window.clearInterval(timer); childTimers.delete(id); popIn(id, true); }
  }, 700);
  childTimers.set(id, timer);

  activate('overview', true);   // free the main window to drive the mission
}

/** @param {string} id */
function poppedPlaceholder(id) {
  const r = defs.find((d) => d.id === id);
  return `<div class="popped-placeholder" data-testid="popped-${id}">
    <h2>${r?.label ?? id} <span class="muted">— popped out ⧉</span></h2>
    <p class="muted">Open in a separate window. Monitor the data there while you drive the
       mission here; changes glow as they land.</p>
    <button type="button" class="primary" id="popin-${id}" data-testid="popin-${id}">Pop back in</button>
  </div>`;
}

/** @param {string} id @param {boolean} fromClose — true when the child closed itself */
function popIn(id, fromClose) {
  if (!poppedOut.has(id)) return;
  const child = poppedOut.get(id);
  poppedOut.delete(id);
  const t = childTimers.get(id);
  if (t) { window.clearInterval(t); childTimers.delete(id); }
  if (!fromClose && child && !child.closed) child.close();
  document.getElementById(`tab-${id}`)?.classList.remove('popped');
  const view = document.getElementById(`view-${id}`);
  if (view) view.innerHTML = '';
  mounted.delete(id);
  activate(id, true);   // re-mount inline and select the tab
}

boot();
