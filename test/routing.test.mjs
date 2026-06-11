// test/routing.test.mjs — proves the hex + time-dependent routing core on the real
// "Solway crossing" scenario, browser-free (the kernel re-host builds on these).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildWorld, fordOpenAt, nextFordOpen } from '../app/js/kernel/world.js';
import { findPath, findPathTimed } from '../app/js/kernel/astar.js';
import { hexDistance } from '../app/js/kernel/hexgrid.js';

const w = buildWorld();
const { ao, places } = w;
const cells = w.baseline.cells;
const kph = w.profile.speed_by_medium.land_kph;
const stepMin = (ao.stepM / 1000 / kph) * 60;            // minutes per hex step at mobility 1

const edgeMin = (a, b) => {
  if (cells[a].mobility === 0 || cells[b].mobility === 0) return Infinity;
  return stepMin / ((cells[a].mobility + cells[b].mobility) / 2);
};
const isFord = (id) => cells[id].terrain === 'ford';
const isBank = (id) => !isFord(id) && cells[id].mobility > 0 && ao.adj[id].some(isFord);
const hTo = (goal) => (id) => hexDistance(ao, id, goal) * stepMin;
const timedOpts = (goal) => ({
  edgeCost: edgeMin, edgeMin, isFord, isBank,
  fordOpen: fordOpenAt, nextOpen: nextFordOpen, h: hTo(goal), tMax: 1000,
});

test('spatial A* routes base -> OP on passable terrain', () => {
  const goal = places.ops[0].id;
  const path = findPath(ao, places.base.id, goal, edgeMin, hTo(goal));
  assert.ok(path, 'a route exists');
  assert.equal(path[0], places.base.id);
  assert.equal(path.at(-1), goal);
  for (const id of path) assert.ok(cells[id].mobility > 0, 'no impassable cell on the path');
});

test('time-dependent A* reaches RV across the river, respecting the tide', () => {
  const goal = places.rvEast.id;
  assert.equal(fordOpenAt(0), false, 'fords are shut at H+0 (window is [88,448])');
  const res = findPathTimed(ao, places.ops[0].id, goal, 0, timedOpts(goal));
  assert.ok(res, 'a timed route to the RV exists (wait-and-cross or bridge detour)');
  assert.equal(res.steps.at(-1).id, goal);
  // Any ford cell is entered only inside an open window; times never run backwards.
  for (const s of res.steps) if (isFord(s.id)) assert.ok(fordOpenAt(s.t), `ford step @H+${s.t} open`);
  for (let i = 1; i < res.steps.length; i++) {
    assert.ok(res.steps[i].t >= res.steps[i - 1].t - 1e-9, 'times non-decreasing');
  }
});

test('departing inside the window crosses a ford without waiting', () => {
  const goal = places.rvEast.id;
  assert.equal(fordOpenAt(120), true, 'fords open at H+120');
  const res = findPathTimed(ao, places.ops[0].id, goal, 120, timedOpts(goal));
  assert.ok(res && res.steps.at(-1).id === goal);
});

test('routing is deterministic (NF3)', () => {
  const goal = places.rvEast.id;
  const a = findPathTimed(ao, places.ops[0].id, goal, 0, timedOpts(goal));
  const b = findPathTimed(ao, places.ops[0].id, goal, 0, timedOpts(goal));
  assert.deepEqual(a.steps, b.steps);
  assert.equal(a.cost, b.cost);
});
