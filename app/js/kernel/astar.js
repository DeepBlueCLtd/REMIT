// @ts-check
// kernel/astar.js — deterministic search over the H3 hex AO (ADR-0016). Operates on
// stable integer ids with the frozen, bearing-sorted adjacency, so the same inputs
// always yield the same path (NF3). Two searches:
//   findPath      — spatial A* (strategy-weighted cost), for tide-free legs.
//   findPathTimed — time-dependent A* over (cell, minute) states: tidal fords are
//                   traversable only while open, and waiting at a dry bank is allowed,
//                   so multiple fords + a ford-free bridge detour are weighed in one
//                   search (supersedes ADR-0006's leg-level chooser).

/** Deterministic binary min-heap keyed by a caller `less` predicate. */
function makeHeap(less) {
  const heap = [];
  return {
    get size() { return heap.length; },
    push(k) {
      heap.push(k);
      let c = heap.length - 1;
      while (c > 0) {
        const p = (c - 1) >> 1;
        if (less(heap[c], heap[p])) { [heap[c], heap[p]] = [heap[p], heap[c]]; c = p; } else break;
      }
    },
    pop() {
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
    },
  };
}

/**
 * Spatial A* over hex ids. Tie-break: (f, then higher-g, then lower-id) — identical to
 * the old square-grid kernel, the NF3 guarantee.
 * @param {{N:number, adj:number[][]}} ao
 * @param {number} start
 * @param {number} goal
 * @param {(from:number, to:number) => number} edgeCost  Infinity = impassable
 * @param {(id:number) => number} h  admissible heuristic to goal (cost units)
 * @returns {number[] | null}  path of ids start..goal, or null
 */
export function findPath(ao, start, goal, edgeCost, h) {
  const { N, adj } = ao;
  const g = new Float64Array(N).fill(Infinity);
  const fOf = new Float64Array(N).fill(Infinity);
  const parent = new Int32Array(N).fill(-1);
  const closed = new Uint8Array(N);
  g[start] = 0; fOf[start] = h(start);
  const heap = makeHeap((a, b) => (fOf[a] !== fOf[b] ? fOf[a] < fOf[b] : (g[a] !== g[b] ? g[a] > g[b] : a < b)));

  heap.push(start);
  while (heap.size) {
    const cur = heap.pop();
    if (closed[cur]) continue;
    closed[cur] = 1;
    if (cur === goal) break;
    for (const ni of adj[cur]) {
      if (closed[ni]) continue;
      const c = edgeCost(cur, ni);
      if (!Number.isFinite(c)) continue;
      const ng = g[cur] + c;
      if (ng < g[ni] - 1e-12) { g[ni] = ng; fOf[ni] = ng + h(ni); parent[ni] = cur; heap.push(ni); }
    }
  }
  if (!closed[goal]) return null;
  const path = [];
  for (let i = goal; i !== -1; i = parent[i]) path.push(i);
  return path.reverse();
}

/**
 * Time-dependent A* over (cell, minute) states. Minimises strategy-weighted cost (in
 * minute-equivalents, so waiting is comparable); a ford cell can be entered only while
 * open, and a dry bank cell may wait for the next open window. Deterministic: canonical
 * adjacency + 1-minute state bucketing + (f, g, stateKey) tie-break.
 * @param {{N:number, adj:number[][]}} ao
 * @param {number} start
 * @param {number} goal
 * @param {number} t0  departure minute
 * @param {{
 *   edgeCost:(from:number,to:number)=>number,
 *   edgeMin:(from:number,to:number)=>number,
 *   isFord:(id:number)=>boolean, isBank:(id:number)=>boolean,
 *   fordOpen:(t:number)=>boolean, nextOpen:(t:number)=>number,
 *   h:(id:number)=>number, tMax?:number
 * }} opts
 * @returns {{ steps: {id:number, t:number}[], cost:number } | null}
 */
export function findPathTimed(ao, start, goal, t0, opts) {
  const { adj } = ao;
  const { edgeCost, edgeMin, isFord, isBank, fordOpen, nextOpen, h, tMax = 1000 } = opts;
  const T = Math.max(1, Math.ceil(tMax));
  const keyOf = (id, t) => id * (T + 1) + Math.min(T, Math.max(0, Math.round(t)));

  const g = new Map();      // stateKey -> best cost
  const fOf = new Map();    // stateKey -> f
  const node = new Map();   // stateKey -> {id, t}  (actual fractional t)
  const parent = new Map(); // stateKey -> predecessor stateKey
  const closed = new Set();

  const startK = keyOf(start, t0);
  g.set(startK, 0); fOf.set(startK, h(start)); node.set(startK, { id: start, t: t0 });
  const heap = makeHeap((a, b) => {
    const fa = fOf.get(a), fb = fOf.get(b);
    if (fa !== fb) return fa < fb;
    const ga = g.get(a), gb = g.get(b);
    if (ga !== gb) return ga > gb;
    return a < b;
  });

  const relax = (sk, nid, nt, addCost) => {
    if (nt > tMax) return;
    const nk = keyOf(nid, nt);
    if (closed.has(nk)) return;
    const ng = g.get(sk) + addCost;
    const cur = g.get(nk);
    if (cur === undefined || ng < cur - 1e-9) {
      g.set(nk, ng); node.set(nk, { id: nid, t: nt }); parent.set(nk, sk);
      fOf.set(nk, ng + h(nid)); heap.push(nk);
    }
  };

  heap.push(startK);
  let goalK;
  while (heap.size) {
    const sk = heap.pop();
    if (closed.has(sk)) continue;
    closed.add(sk);
    const s = node.get(sk);
    if (s.id === goal) { goalK = sk; break; }
    for (const v of adj[s.id]) {
      const cE = edgeCost(s.id, v);
      if (!Number.isFinite(cE)) continue;
      const tau = edgeMin(s.id, v);
      if (!Number.isFinite(tau)) continue;
      if (isFord(v) && (!fordOpen(s.t) || !fordOpen(s.t + tau))) continue; // can't enter a closed ford
      relax(sk, v, s.t + tau, cE);
    }
    if (isBank(s.id) && !fordOpen(s.t)) {       // wait at a dry bank for the tide
      const w = nextOpen(s.t);
      if (w > s.t) relax(sk, s.id, w, w - s.t);
    }
  }
  if (goalK === undefined) return null;
  const steps = [];
  for (let k = goalK; k !== undefined; k = parent.get(k)) steps.push(node.get(k));
  steps.reverse();
  return { steps, cost: g.get(goalK) };
}
