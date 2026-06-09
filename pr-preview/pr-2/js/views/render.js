// @ts-check
// views/render.js — the view layer (DEC-24, NF1): map + timeline as
// synchronised co-equal projections of one plan, joined by a shared playhead.
// Views PROJECT the kernel's materialisation (trajectory, schedule) through
// the kernel's own evaluator (`stateAt`) — they never re-derive.

import { TERRAIN, PLACES, GRID_W, GRID_H } from '../kernel/world.js';
import { stateAt } from '../kernel/kernel.js';

export const CELL_PX = 26;

/** Shared playhead — one t, many subscribers (map ghost, timeline cursor, readouts). */
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

const STRAT_COLORS = { direct: '#f0b429', tracked: '#4493f8', covered: '#38d39f' };

/** Draw the AO terrain + named places onto a canvas context. */
export function drawTerrain(g, baseline) {
  const cells = baseline.cells;
  for (let y = 0; y < GRID_H; y++) {
    for (let x = 0; x < GRID_W; x++) {
      g.fillStyle = TERRAIN[cells[y * GRID_W + x].terrain].color;
      g.fillRect(x * CELL_PX, y * CELL_PX, CELL_PX, CELL_PX);
    }
  }
  g.strokeStyle = 'rgba(255,255,255,.05)';
  g.lineWidth = 1;
  for (let x = 0; x <= GRID_W; x++) { g.beginPath(); g.moveTo(x * CELL_PX, 0); g.lineTo(x * CELL_PX, GRID_H * CELL_PX); g.stroke(); }
  for (let y = 0; y <= GRID_H; y++) { g.beginPath(); g.moveTo(0, y * CELL_PX); g.lineTo(GRID_W * CELL_PX, y * CELL_PX); g.stroke(); }
}

function drawMarker(g, x, y, kind) {
  const cx = (x + 0.5) * CELL_PX, cy = (y + 0.5) * CELL_PX;
  g.font = `${CELL_PX * 0.8}px system-ui`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  if (kind === 'base') { g.fillStyle = '#e6edf3'; g.fillText('▲', cx, cy); }
  if (kind === 'target') {
    g.strokeStyle = '#ff7b72'; g.lineWidth = 2.5;
    g.beginPath(); g.arc(cx, cy, CELL_PX * 0.38, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#ff7b72'; g.beginPath(); g.arc(cx, cy, 3, 0, Math.PI * 2); g.fill();
  }
}

export function drawPath(g, plan, { faint = false, color } = {}) {
  if (!plan.materialisation) return;
  const traj = plan.materialisation.trajectory;
  g.strokeStyle = color ?? STRAT_COLORS[plan.strategy.key] ?? '#fff';
  g.globalAlpha = faint ? 0.35 : 1;
  g.lineWidth = faint ? 2 : 3;
  g.lineJoin = 'round';
  g.beginPath();
  traj.forEach((p, i) => {
    const px = (p.x + 0.5) * CELL_PX, py = (p.y + 0.5) * CELL_PX;
    i ? g.lineTo(px, py) : g.moveTo(px, py);
  });
  g.stroke();
  g.globalAlpha = 1;
}

/**
 * The map view. Renders terrain + route(s) + the ghost vehicle at playhead t
 * (position via the kernel's `stateAt` — NF1).
 * @param {HTMLCanvasElement} canvas
 */
export function makeMap(canvas, baseline) {
  canvas.width = GRID_W * CELL_PX;
  canvas.height = GRID_H * CELL_PX;
  const g = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));

  return {
    /**
     * @param {{plans?: any[], selected?: any, t?: number,
     *          actual?: {x:number,y:number,phase:string}|null,
     *          target?: {x:number,y:number}|null}} opts
     */
    render({ plans = [], selected = null, t = 0, actual = null, target = null } = {}) {
      drawTerrain(g, baseline);
      drawMarker(g, PLACES.base.x, PLACES.base.y, 'base');
      if (target) drawMarker(g, target.x, target.y, 'target');
      // No selection yet: show the whole handful at full strength; once a plan
      // is chosen the rest fall back to faint context.
      for (const p of plans) if (p !== selected) drawPath(g, p, { faint: !!selected });
      if (selected) {
        drawPath(g, selected);
        const ghost = actual ?? stateAt(selected, t);
        if (ghost) {
          const cx = (ghost.x + 0.5) * CELL_PX, cy = (ghost.y + 0.5) * CELL_PX;
          g.fillStyle = '#e6edf3';
          g.strokeStyle = '#0d1117';
          g.lineWidth = 2;
          g.beginPath(); g.arc(cx, cy, 7, 0, Math.PI * 2); g.fill(); g.stroke();
          canvas.dataset.ghost = `${ghost.x.toFixed(2)},${ghost.y.toFixed(2)},${ghost.phase}`;
        }
      }
    },
  };
}

/**
 * The timeline view (SVG): schedule bars + commitment window band + playhead.
 * Clicking/dragging sets the shared playhead.
 * @param {HTMLElement} host
 * @param {Playhead} playhead
 */
export function makeTimeline(host, playhead) {
  const W = 720, H = 92, PAD = 34;

  return {
    /** @param {{plan: any, commitment: any, horizonMin: number}} opts */
    render({ plan, commitment, horizonMin }) {
      const window_ = commitment.activity.when.window;
      const tx = (t) => PAD + (t / horizonMin) * (W - PAD - 8);
      const sched = plan.materialisation?.schedule ?? [];
      const barColors = { transit: '#4493f8', hold: '#6e7681', visit: '#38d39f' };

      host.innerHTML = `
        <svg viewBox="0 0 ${W} ${H}" class="timeline" data-testid="timeline">
          <rect x="${tx(window_.start_min)}" y="16" width="${tx(window_.end_min) - tx(window_.start_min)}"
                height="56" fill="rgba(255,123,114,.12)" stroke="rgba(255,123,114,.45)"
                stroke-dasharray="3 3"/>
          <text x="${tx(window_.start_min) + 4}" y="13" class="tl-label">commitment window</text>
          ${sched.map((leg) => `
            <rect x="${tx(leg.start_min)}" y="34" width="${Math.max(2, tx(leg.end_min) - tx(leg.start_min))}"
                  height="20" rx="4" fill="${barColors[leg.kind]}"/>
            <text x="${tx(leg.start_min) + 3}" y="66" class="tl-label">${leg.label}</text>`).join('')}
          ${[0, 60, 120, 180].filter((t) => t <= horizonMin).map((t) => `
            <line x1="${tx(t)}" y1="72" x2="${tx(t)}" y2="78" stroke="#6e7681"/>
            <text x="${tx(t)}" y="89" text-anchor="middle" class="tl-tick">H+${t}</text>`).join('')}
          <line id="tl-cursor" x1="${tx(playhead.t)}" y1="8" x2="${tx(playhead.t)}" y2="78"
                stroke="#e6edf3" stroke-width="2"/>
        </svg>`;

      const svg = /** @type {SVGSVGElement} */ (host.querySelector('svg'));
      const cursor = /** @type {SVGLineElement} */ (host.querySelector('#tl-cursor'));
      const toT = (clientX) => {
        const r = svg.getBoundingClientRect();
        const x = ((clientX - r.left) / r.width) * W;
        return Math.max(0, Math.min(horizonMin, ((x - PAD) / (W - PAD - 8)) * horizonMin));
      };
      let dragging = false;
      svg.addEventListener('pointerdown', (e) => { dragging = true; playhead.set(toT(e.clientX)); });
      svg.addEventListener('pointermove', (e) => { if (dragging) playhead.set(toT(e.clientX)); });
      window.addEventListener('pointerup', () => { dragging = false; });

      playhead.on((t) => {
        const x = tx(Math.min(t, horizonMin));
        cursor.setAttribute('x1', String(x));
        cursor.setAttribute('x2', String(x));
      });
    },
  };
}
