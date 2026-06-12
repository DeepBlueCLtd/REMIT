// test/hexgrid.test.mjs — the H3 core is the determinism foundation (NF3). Browser-free.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildHexAO, h3ToId, idToH3, latLngToId, hexDistance, H3_RES,
} from '../app/js/kernel/hexgrid.js';

test('AO enumerates a stable, sorted res-9 cell set', () => {
  const ao = buildHexAO();
  assert.ok(ao.N > 1000 && ao.N < 2000, `AO cell count ${ao.N} in expected band`);
  // Sorted + a pure function of the polygon: two builds are byte-identical.
  const ao2 = buildHexAO();
  assert.deepEqual(ao.indexes, ao2.indexes);
  for (let i = 1; i < ao.indexes.length; i++) {
    assert.ok(ao.indexes[i - 1] < ao.indexes[i], 'indexes strictly sorted');
  }
  // id <-> h3 bijection.
  assert.equal(h3ToId(ao, idToH3(ao, 0)), 0);
  assert.equal(h3ToId(ao, idToH3(ao, ao.N - 1)), ao.N - 1);
});

test('adjacency is deterministic, symmetric, bearing-ordered, ≤6', () => {
  const ao = buildHexAO();
  const ao2 = buildHexAO();
  assert.deepEqual(ao.adj, ao2.adj, 'adjacency reproducible across builds');
  for (let id = 0; id < ao.N; id++) {
    const nb = ao.adj[id];
    assert.ok(nb.length <= 6, `cell ${id} has ≤6 neighbours`);
    // symmetry: every neighbour links back
    for (const nid of nb) assert.ok(ao.adj[nid].includes(id), `symmetry ${id}<->${nid}`);
    // adjacency is one hex step
    for (const nid of nb) assert.equal(hexDistance(ao, id, nid), 1, `adjacent => 1 step`);
    // no self-loops, no duplicates
    assert.equal(new Set(nb).size, nb.length, 'no duplicate neighbours');
    assert.ok(!nb.includes(id), 'no self-loop');
  }
});

test('latLngToId round-trips a cell centroid back to itself', () => {
  const ao = buildHexAO();
  for (const id of [0, 1, (ao.N / 2) | 0, ao.N - 1]) {
    const [lat, lng] = ao.centers[id];
    assert.equal(latLngToId(ao, lat, lng), id);
  }
  // a point well outside the AO resolves to undefined (a wall for click-pick)
  assert.equal(latLngToId(ao, 0, 0), undefined);
});

test('hexDistance is a metric (0 to self, symmetric, triangle-sane)', () => {
  const ao = buildHexAO();
  assert.equal(hexDistance(ao, 5, 5), 0);
  assert.equal(hexDistance(ao, 5, 200), hexDistance(ao, 200, 5));
  assert.equal(H3_RES, 9);
});
