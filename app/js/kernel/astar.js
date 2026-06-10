// @ts-check
// kernel/astar.js — the trivial real path (DEC-44): deterministic A* over the
// small grid. 8-connected, octile heuristic, fixed tie-breaking so the same
// inputs always yield the same path (NF3, decision-level).

/**
 * @param {{w: number, h: number}} grid
 * @param {{x: number, y: number}} start
 * @param {{x: number, y: number}} goal
 * @param {(from: number, to: number, diag: boolean) => number} edgeCost
 *   cost of moving between cell indices (Infinity = impassable)
 * @param {number} hScale  admissible per-cell heuristic scale (best cost per orth step)
 * @returns {{x: number, y: number}[] | null}
 */
export function findPath(grid, start, goal, edgeCost, hScale) {
  const { w, h } = grid;
  const idx = (x, y) => y * w + x;
  const startI = idx(start.x, start.y);
  const goalI = idx(goal.x, goal.y);
  const SQRT2 = Math.SQRT2;

  const octile = (i) => {
    const dx = Math.abs((i % w) - goal.x);
    const dy = Math.abs(Math.floor(i / w) - goal.y);
    return (Math.max(dx, dy) + (SQRT2 - 1) * Math.min(dx, dy)) * hScale;
  };

  const g = new Float64Array(w * h).fill(Infinity);
  const parent = new Int32Array(w * h).fill(-1);
  const closed = new Uint8Array(w * h);
  g[startI] = 0;

  // Binary heap ordered by (f, then h, then index) — deterministic ties.
  /** @type {number[]} */
  const heap = [];
  const fOf = new Float64Array(w * h).fill(Infinity);
  fOf[startI] = octile(startI);
  const less = (a, b) =>
    fOf[a] !== fOf[b] ? fOf[a] < fOf[b] : (g[a] !== g[b] ? g[a] > g[b] : a < b);
  const push = (i) => {
    heap.push(i);
    let c = heap.length - 1;
    while (c > 0) {
      const p = (c - 1) >> 1;
      if (less(heap[c], heap[p])) { [heap[c], heap[p]] = [heap[p], heap[c]]; c = p; }
      else break;
    }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop();
    if (heap.length && last !== undefined) {
      heap[0] = last;
      let p = 0;
      for (;;) {
        const l = 2 * p + 1, r = l + 1;
        let m = p;
        if (l < heap.length && less(heap[l], heap[m])) m = l;
        if (r < heap.length && less(heap[r], heap[m])) m = r;
        if (m === p) break;
        [heap[p], heap[m]] = [heap[m], heap[p]];
        p = m;
      }
    }
    return top;
  };

  // Fixed neighbour order: N, NE, E, SE, S, SW, W, NW.
  const dirs = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];

  push(startI);
  while (heap.length) {
    const cur = pop();
    if (closed[cur]) continue;
    closed[cur] = 1;
    if (cur === goalI) break;
    const cx = cur % w, cy = Math.floor(cur / w);
    for (const [dx, dy] of dirs) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
      const ni = idx(nx, ny);
      if (closed[ni]) continue;
      const diag = dx !== 0 && dy !== 0;
      const c = edgeCost(cur, ni, diag);
      if (!Number.isFinite(c)) continue;
      const ng = g[cur] + c;
      if (ng < g[ni] - 1e-12) {
        g[ni] = ng;
        fOf[ni] = ng + octile(ni);
        parent[ni] = cur;
        push(ni);
      }
    }
  }

  if (!closed[goalI]) return null;
  const path = [];
  for (let i = goalI; i !== -1; i = parent[i]) path.push({ x: i % w, y: Math.floor(i / w) });
  return path.reverse();
}
