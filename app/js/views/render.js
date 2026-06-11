// @ts-check
// views/render.js — shared view primitives kept after the H3 migration (ADR-0016): the
// playhead (one t, many subscribers) and the strategy colour map. The map renderer now
// lives in views/map.js (MapLibre + deck.gl); this module no longer draws to a canvas.

export const STRAT_COLORS = { direct: '#f0b429', tracked: '#4493f8', covered: '#38d39f' };

/** Shared playhead — one t, many subscribers (map ghost, matrix cursor, readouts). */
export class Playhead {
  constructor() {
    this.t = 0;
    /** @type {((t: number) => void)[]} */
    this.listeners = [];
  }
  set(t) {
    this.t = Math.max(0, t);
    for (const fn of this.listeners) fn(this.t);
  }
  on(fn) { this.listeners.push(fn); fn(this.t); }
}
