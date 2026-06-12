// @ts-check
// shell/overview.js — the Overview tab is the original walking-skeleton UI.
//
// Its markup is static in index.html (inside #view-overview); main.js owns all
// of its behaviour and boots itself at import time (it queries #map, #rail,
// #playhead-slider, … by id). So we import main.js lazily here — only once the
// Overview container is in the DOM — rather than at the top of shell.js. main.js
// imports the shared context directly, so it ignores the injected ctx.

let booted = false;

/** @param {HTMLElement} _container — Overview markup is static in index.html. */
export async function mountOverview(_container) {
  if (booted) return;
  booted = true;
  await import('../main.js');
}
