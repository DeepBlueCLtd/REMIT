// @ts-check
// views/render.js — the view layer (DEC-24, NF1): map + timeline as
// synchronised co-equal projections of one plan, joined by a shared playhead.
// Views PROJECT the kernel's materialisation (trajectory, schedule) through
// the kernel's own evaluator (`stateAt`) — they never re-derive.

import { TERRAIN, PLACES, GRID_W, GRID_H, fordOpenAt } from '../kernel/world.js';
import { stateAt } from '../kernel/kernel.js';

export const CELL_PX = 26;
export const STRAT_COLORS = { direct: '#f0b429', tracked: '#4493f8', covered: '#38d39f' };

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
  if (kind === 'rv') {
    // Exfil rendezvous — a diamond.
    g.strokeStyle = '#e3b341'; g.lineWidth = 2.5; g.fillStyle = 'rgba(227,179,65,.25)';
    const r = CELL_PX * 0.36;
    g.beginPath();
    g.moveTo(cx, cy - r); g.lineTo(cx + r, cy); g.lineTo(cx, cy + r); g.lineTo(cx - r, cy);
    g.closePath(); g.fill(); g.stroke();
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
    render({ plans = [], selected = null, t = 0, actual = null, target = null, rv = null,
             candidates = null, highlight = null, obstructions = [], nogo = [], blocked = [] } = {}) {
      drawTerrain(g, baseline);
      // Tidal ford state at the projected time t: closed → drawn as water with
      // wave dashes; open → its sandy crossing colour with a low-water shore line.
      const fordOpen = fordOpenAt(t);
      baseline.cells.forEach((c, i) => {
        if (c.terrain !== 'ford') return;
        const fx = (i % GRID_W) * CELL_PX, fy = Math.floor(i / GRID_W) * CELL_PX;
        if (!fordOpen) {
          g.fillStyle = TERRAIN.water.color;
          g.fillRect(fx, fy, CELL_PX, CELL_PX);
          g.strokeStyle = 'rgba(255,255,255,.45)'; g.lineWidth = 1;
          for (const dy of [0.35, 0.7]) {
            g.beginPath();
            g.moveTo(fx + 3, fy + CELL_PX * dy);
            g.quadraticCurveTo(fx + CELL_PX * 0.5, fy + CELL_PX * dy - 4, fx + CELL_PX - 3, fy + CELL_PX * dy);
            g.stroke();
          }
        } else {
          g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 1;
          g.setLineDash([3, 3]);
          g.strokeRect(fx + 1.5, fy + 1.5, CELL_PX - 3, CELL_PX - 3);
          g.setLineDash([]);
        }
      });
      canvas.dataset.fordState = fordOpen ? 'open' : 'closed';
      // Operator no-go cells (Plan steering) — a red hatched overlay.
      for (const c of nogo) {
        g.fillStyle = 'rgba(255,123,114,.32)';
        g.fillRect(c.x * CELL_PX, c.y * CELL_PX, CELL_PX, CELL_PX);
        g.strokeStyle = 'rgba(255,123,114,.8)'; g.lineWidth = 1;
        g.beginPath();
        g.moveTo(c.x * CELL_PX, (c.y + 1) * CELL_PX); g.lineTo((c.x + 1) * CELL_PX, c.y * CELL_PX);
        g.stroke();
      }
      canvas.dataset.nogo = nogo.length ? nogo.map((c) => `${c.x},${c.y}`).join('|') : '';
      // Mid-mission blocked cells (Execute re-route) — a solid red wall block.
      for (const c of blocked) {
        g.fillStyle = 'rgba(255,123,114,.5)';
        g.fillRect(c.x * CELL_PX + 1, c.y * CELL_PX + 1, CELL_PX - 2, CELL_PX - 2);
        g.strokeStyle = '#ff7b72'; g.lineWidth = 2;
        g.strokeRect(c.x * CELL_PX + 1.5, c.y * CELL_PX + 1.5, CELL_PX - 3, CELL_PX - 3);
      }
      canvas.dataset.blocked = blocked.length ? blocked.map((c) => `${c.x},${c.y}`).join('|') : '';
      drawMarker(g, PLACES.base.x, PLACES.base.y, 'base');
      // Capture: candidate OPs labelled on the map, the picked one emphasised.
      if (candidates) {
        for (const c of candidates) {
          const cx = (c.x + 0.5) * CELL_PX, cy = (c.y + 0.5) * CELL_PX;
          const isHi = highlight && highlight.x === c.x && highlight.y === c.y;
          g.strokeStyle = isHi ? '#ff7b72' : 'rgba(230,237,243,.55)';
          g.lineWidth = isHi ? 3 : 1.5;
          g.beginPath(); g.arc(cx, cy, CELL_PX * 0.34, 0, Math.PI * 2); g.stroke();
          g.fillStyle = isHi ? '#ff7b72' : 'rgba(230,237,243,.8)';
          g.font = `${CELL_PX * 0.5}px system-ui`; g.textAlign = 'center'; g.textBaseline = 'middle';
          g.fillText(c.key ?? '', cx, cy - CELL_PX * 0.72);
        }
        canvas.dataset.highlight = highlight ? `${highlight.x},${highlight.y}` : '';
      }
      if (target) drawMarker(g, target.x, target.y, 'target');
      if (rv) drawMarker(g, rv.x, rv.y, 'rv');
      // No selection yet: show the whole handful at full strength; once a plan
      // is chosen the rest fall back to faint context.
      for (const p of plans) if (p !== selected) drawPath(g, p, { faint: !!selected });
      // Vehicle marker: a high-contrast layered dot (coloured glow halo + ring +
      // white core + dark outline) so it stays easy to spot on any terrain.
      const drawVehicle = (x, y, color, big) => {
        const cx = (x + 0.5) * CELL_PX, cy = (y + 0.5) * CELL_PX;
        const r = big ? 9 : 6.5;
        g.beginPath(); g.arc(cx, cy, r + (big ? 9 : 5), 0, Math.PI * 2);
        g.fillStyle = color + '2e'; g.fill();                       // soft glow halo
        g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2);
        g.fillStyle = color; g.fill();
        g.lineWidth = big ? 3 : 2; g.strokeStyle = '#0d1117'; g.stroke();
        g.beginPath(); g.arc(cx, cy, r * (big ? 0.5 : 0.42), 0, Math.PI * 2);
        g.fillStyle = '#fff'; g.fill();
      };
      if (selected) {
        drawPath(g, selected);
        const ghost = actual ?? stateAt(selected, t);
        if (ghost) {
          drawVehicle(ghost.x, ghost.y, STRAT_COLORS[selected.strategy.key] ?? '#4493f8', true);
          canvas.dataset.ghost = `${ghost.x.toFixed(2)},${ghost.y.toFixed(2)},${ghost.phase}`;
        }
      } else if (plans.length) {
        // Compare mode: one racing vehicle per candidate, in its strategy colour.
        const marks = [];
        for (const p of plans) {
          const ghost = p.materialisation && stateAt(p, t);
          if (!ghost) continue;
          drawVehicle(ghost.x, ghost.y, STRAT_COLORS[p.strategy.key] ?? '#e6edf3', false);
          marks.push(`${p.strategy.key}:${ghost.x.toFixed(2)},${ghost.y.toFixed(2)}`);
        }
        canvas.dataset.ghost = marks.join('|');
      }

      // Mid-mission obstruction markers (Execute) — a red ✕ on the track.
      for (const o of obstructions) {
        const ox = (o.x + 0.5) * CELL_PX, oy = (o.y + 0.5) * CELL_PX, r = CELL_PX * 0.32;
        g.strokeStyle = '#ff7b72'; g.lineWidth = 3; g.lineCap = 'round';
        g.beginPath();
        g.moveTo(ox - r, oy - r); g.lineTo(ox + r, oy + r);
        g.moveTo(ox + r, oy - r); g.lineTo(ox - r, oy + r);
        g.stroke(); g.lineCap = 'butt';
      }
      canvas.dataset.obstructions = obstructions.length ? obstructions.map((o) => `${o.x},${o.y}`).join('|') : '';
    },
  };
}

// The temporal projection is the D6 Sync Matrix (views/sync-matrix.js) — it
// supersedes the skeleton's single timeline strip, which was one of its tracks.
