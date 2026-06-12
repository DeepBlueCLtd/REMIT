// @ts-check
// shell/popout.js — entry for a popped-out role surface.
//
// A popped-out window is a separate document but the SAME origin, so it reaches
// the main window's live context through window.opener.__remit (one shared
// ObjectStore / seam / world). It mounts the requested poppable surface with
// that context, so the surface renders and glows from the main window's store
// as the mission is driven there.

import { roles } from './roles.js';

/** @param {string} m */
const fault = (m) => /** @type {any} */ (window).__remitFault?.(m);

export function boot() {
  const root = /** @type {HTMLElement} */ (document.getElementById('popout-root'));
  const id = location.hash.match(/tab=([\w-]+)/)?.[1] ?? null;
  const opener = /** @type {any} */ (window.opener);
  const ctx = opener && opener.__remit;

  if (!ctx) {
    root.innerHTML = `<div class="popped-placeholder">
      <h2>Disconnected</h2>
      <p class="muted">The main REMIT window is closed or unavailable. Re-open this
         view from the app's tab bar.</p></div>`;
    return;
  }

  const r = roles().find((d) => d.id === id);
  if (!r || !r.poppable || !r.mount) {
    root.innerHTML = `<div class="popped-placeholder">
      <h2>Unknown view</h2>
      <p class="muted">No poppable role “${id ?? ''}”.</p></div>`;
    return;
  }

  document.title = `REMIT — ${r.label}`;
  Promise.resolve(r.mount(root, ctx)).catch((err) => {
    fault(`mounting ${r.label}: ${err?.message ?? err}`);
    console.error(err);
  });

  // Ask the opener to pop us back in when this window closes.
  window.addEventListener('beforeunload', () => {
    try { opener.__remitShell?.popIn?.(id, true); } catch (_) { /* opener gone */ }
  });
}

boot();
