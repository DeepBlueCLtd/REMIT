// test/orbat.test.mjs — unit tests for the ORBAT model (DEC-60), spec 004.
// node --test, build-free: imports app/js/orbat/orbat.js directly (no h3-js / DOM).
// Covers determinism (NF3), per-asset isolation (SC-003), clamping (FR-004), the
// canonical-own-force reconciliation (FR-012), and commit immutability/lineage.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  emptyOrbat, addAsset, tuneAsset, duplicateAsset, removeAsset,
  reconcileOwnForce, validate, canonical, commit, hasTrack, normalize,
  symbolOf, confidenceOpacity, GENERIC_SYMBOL, SYMBOLS, BOUNDS, OWN_FORCE_ID,
} from '../app/js/orbat/orbat.js';
import { ObjectStore } from '../app/js/stores/stores.js';

const pos = (n = 0) => ({ h3: `cell-${n}`, lat: 54.96 + n * 0.001, lng: -3.1 });

// --- US1: red add/tune/isolation/determinism --------------------------------

test('addAsset mints a fresh unique id and seeds red defaults', () => {
  let o = emptyOrbat('s');
  const r1 = addAsset(o, { allegiance: 'red', position: pos(1) });
  const r2 = addAsset(r1.orbat, { allegiance: 'red', position: pos(2) });
  assert.notEqual(r1.id, r2.id);
  assert.equal(r2.orbat.assets.length, 2);
  const a = r2.orbat.assets.find((x) => x.id === r1.id);
  assert.equal(a.allegiance, 'red');
  assert.equal(a.red.severity, 3);
  assert.ok(Array.isArray(a.red.active_windows));
  assert.equal(a.extent_m > 0, true);
});

test('tuneAsset clamps red extent_m and severity to bounds (FR-004)', () => {
  let o = addAsset(emptyOrbat('s'), { allegiance: 'red', position: pos(1) });
  const id = o.id;
  o = tuneAsset(o.orbat, id, { extent_m: 9_999_999, red: { severity: 99 } });
  const a = o.assets.find((x) => x.id === id);
  assert.equal(a.extent_m, BOUNDS.extent_m[1]);
  assert.equal(a.red.severity, BOUNDS.severity[1]);
  o = tuneAsset(o, id, { extent_m: -50, red: { severity: -3 } });
  const b = o.assets.find((x) => x.id === id);
  assert.equal(b.extent_m, BOUNDS.extent_m[0]);
  assert.equal(b.red.severity, BOUNDS.severity[0]);
});

test('tuning one asset leaves the others byte-identical (SC-003 isolation)', () => {
  let r = addAsset(emptyOrbat('s'), { allegiance: 'red', position: pos(1) });
  r = addAsset(r.orbat, { allegiance: 'red', position: pos(2) });
  const [id1, id2] = r.orbat.assets.map((a) => a.id);
  const before2 = JSON.stringify(r.orbat.assets.find((a) => a.id === id2));
  const next = tuneAsset(r.orbat, id1, { label: 'changed', red: { severity: 5 } });
  const after2 = JSON.stringify(next.assets.find((a) => a.id === id2));
  assert.equal(after2, before2);
  assert.equal(next.assets.find((a) => a.id === id1).label, 'changed');
});

test('canonical is stable and order-independent (NF3 determinism)', () => {
  let a = addAsset(emptyOrbat('s'), { allegiance: 'red', position: pos(1) });
  a = addAsset(a.orbat, { allegiance: 'green', position: pos(2) });
  // Same content, assets inserted in the opposite order ⇒ identical canonical bytes.
  let b = addAsset(emptyOrbat('s'), { allegiance: 'red', position: pos(1) });
  b = addAsset(b.orbat, { allegiance: 'green', position: pos(2) });
  // canonical() sorts assets by id, so reversing the array must not change the bytes.
  const reordered = { ...b.orbat, assets: [...b.orbat.assets].reverse() };
  assert.equal(canonical(a.orbat), canonical(reordered));
});

// --- US2: green defaults / clamp / isolation --------------------------------

test('green defaults + GreenParams clamp (sensitivity, protection)', () => {
  let o = addAsset(emptyOrbat('s'), { allegiance: 'green', position: pos(1) });
  const id = o.id;
  const a0 = o.orbat.assets[0];
  assert.equal(a0.green.sensitivity, 3);
  assert.equal(a0.green.protection, 'keep_out');
  let next = tuneAsset(o.orbat, id, { green: { sensitivity: 42, protection: 'minimise_effect' } });
  let a = next.assets.find((x) => x.id === id);
  assert.equal(a.green.sensitivity, BOUNDS.sensitivity[1]);
  assert.equal(a.green.protection, 'minimise_effect');
  // An unknown protection value is ignored (stays the last valid one).
  next = tuneAsset(next, id, { green: { protection: 'nonsense' } });
  assert.equal(next.assets.find((x) => x.id === id).green.protection, 'minimise_effect');
});

// --- US3: blue defaults / clamp / reconciliation ----------------------------

test('blue defaults + BlueParams tuning (availability, capabilities)', () => {
  let o = addAsset(emptyOrbat('s'), { allegiance: 'blue', position: pos(1) });
  const id = o.id;
  assert.equal(o.orbat.assets[0].blue.availability, 'available');
  const next = tuneAsset(o.orbat, id, { blue: { availability: 'down', capabilities: ['recce', 'comms'] } });
  const a = next.assets.find((x) => x.id === id);
  assert.equal(a.blue.availability, 'down');
  assert.deepEqual(a.blue.capabilities, ['recce', 'comms']);
});

test('blue availability_window persists through tuneAsset and projects a track', () => {
  let o = addAsset(emptyOrbat('s'), { allegiance: 'blue', position: pos(1) });
  const id = o.id;
  assert.equal(hasTrack(o.orbat.assets[0]), false);            // no window yet → no track
  let next = tuneAsset(o.orbat, id, { blue: { availability_window: { start_min: 60, end_min: 30 } } });
  const a = next.assets.find((x) => x.id === id);
  // Window is persisted and normalised to start ≤ end.
  assert.deepEqual(a.blue.availability_window, { start_min: 30, end_min: 60 });
  assert.equal(hasTrack(a), true);
  // Clearing it removes the field (and the track).
  next = tuneAsset(next, id, { blue: { availability_window: undefined } });
  assert.equal(next.assets.find((x) => x.id === id).blue.availability_window, undefined);
  assert.equal(hasTrack(next.assets.find((x) => x.id === id)), false);
});

test('reconcileOwnForce is idempotent and yields exactly one canonical own-force (FR-012)', () => {
  let o = reconcileOwnForce(emptyOrbat('s'), { label: 'ROVER-1', position: pos(0) });
  o = reconcileOwnForce(o, { label: 'ROVER-1', position: pos(0) });
  const canon = o.assets.filter((a) => a.canonical_own_force);
  assert.equal(canon.length, 1);
  assert.equal(canon[0].id, OWN_FORCE_ID);
  assert.equal(canon[0].allegiance, 'blue');
  // Reconciling again after adding pool assets keeps exactly one canonical.
  o = addAsset(o, { allegiance: 'blue', position: pos(3) }).orbat;
  o = reconcileOwnForce(o, { label: 'ROVER-1', position: pos(0) });
  assert.equal(o.assets.filter((a) => a.canonical_own_force).length, 1);
});

// --- US4: duplicate / remove / commit --------------------------------------

test('duplicateAsset mints a new id, deep-copies params, drops the canonical flag', () => {
  let o = reconcileOwnForce(emptyOrbat('s'), { label: 'ROVER-1', position: pos(0) });
  const dup = duplicateAsset(o, OWN_FORCE_ID);
  const copy = dup.orbat.assets.find((a) => a.id === dup.id);
  assert.notEqual(dup.id, OWN_FORCE_ID);
  assert.equal(copy.canonical_own_force, undefined);    // a duplicate is never the canonical
  assert.equal(copy.allegiance, 'blue');
  // Independent copy: tuning the copy does not touch the source.
  const tuned = tuneAsset(dup.orbat, dup.id, { extent_m: 1234 });
  assert.equal(tuned.assets.find((a) => a.id === OWN_FORCE_ID).extent_m,
    dup.orbat.assets.find((a) => a.id === OWN_FORCE_ID).extent_m);
});

test('removeAsset drops the target, protects the canonical own-force (FR-012)', () => {
  let o = reconcileOwnForce(emptyOrbat('s'), { label: 'ROVER-1', position: pos(0) });
  const r = addAsset(o, { allegiance: 'red', position: pos(1) });
  o = r.orbat;
  const after = removeAsset(o, r.id);
  assert.equal(after.assets.find((a) => a.id === r.id), undefined);
  assert.equal(after.assets.find((a) => a.id === OWN_FORCE_ID) !== undefined, true);
  assert.throws(() => removeAsset(o, OWN_FORCE_ID), /protected/);
});

test('commit mints an immutable content-addressed version with lineage', async () => {
  const store = new ObjectStore();
  let o = emptyOrbat('s');
  const c1 = await commit(o, store);
  // Re-commit of identical content is idempotent (DEC-35).
  const c1again = await commit(o, store);
  assert.equal(c1.id, c1again.id);
  assert.equal(c1again.existed, true);
  // A changed roster, linked to the prior version, mints a new id + a 2-long lineage chain.
  o = addAsset(o, { allegiance: 'red', position: pos(1) }).orbat;
  o = { ...o, lineage: { previous_version: c1.id } };
  const c2 = await commit(o, store);
  assert.notEqual(c2.id, c1.id);
  assert.deepEqual(store.lineage(c2.id), [c2.id, c1.id]);
});

// --- validation ------------------------------------------------------------

test('validate flags an out-of-AO position and a malformed window', () => {
  const inAO = (p) => p?.h3 === 'in';
  const bad = { id: 'x', allegiance: 'red', position: { h3: 'out' },
                red: { severity: 3, active_windows: [{ start_min: 90, end_min: 30 }] } };
  const v = validate(bad, { inAO });
  assert.equal(v.ok, false);
  assert.ok(v.issues.some((i) => /AO/.test(i)));
  assert.ok(v.issues.some((i) => /start_min/.test(i)));
  const good = { id: 'y', allegiance: 'red', position: { h3: 'in' }, extent_m: 1000, red: { severity: 3, active_windows: [] } };
  assert.equal(validate(good, { inAO }).ok, true);
});

// --- spec 005 enrichment ---------------------------------------------------

// US1 — kind + symbols
test('symbolOf resolves override > kind glyph > generic dot (FR-002/003)', () => {
  assert.equal(symbolOf({ id: 'a', allegiance: 'red' }), GENERIC_SYMBOL);     // unset → generic
  assert.equal(symbolOf({ id: 'a', allegiance: 'red', kind: 'aircraft' }), SYMBOLS.aircraft);
  assert.equal(symbolOf({ id: 'a', allegiance: 'red', kind: 'aircraft', symbol: '★' }), '★'); // override wins
});

test('kind/symbol round-trip through tuneAsset; unknown kind ignored; cleared override drops (FR-014)', () => {
  let o = addAsset(emptyOrbat('s'), { allegiance: 'red', position: pos(1) });
  const id = o.id;
  o = tuneAsset(o.orbat, id, { kind: 'emplacement', symbol: '✷' });
  let a = o.assets.find((x) => x.id === id);
  assert.equal(a.kind, 'emplacement');
  assert.equal(a.symbol, '✷');
  // unknown kind is rejected (stays the last valid one)
  o = tuneAsset(o, id, { kind: 'nonsense' });
  assert.equal(o.assets.find((x) => x.id === id).kind, 'emplacement');
  // clearing the override removes the field entirely
  o = tuneAsset(o, id, { symbol: '' });
  assert.equal('symbol' in o.assets.find((x) => x.id === id), false);
});

// US2 — confidence
test('confidence round-trips and drives opacity; absent ⇒ full emphasis (FR-004)', () => {
  let o = addAsset(emptyOrbat('s'), { allegiance: 'green', position: pos(1) });
  const id = o.id;
  assert.equal(confidenceOpacity(o.orbat.assets[0]), 1);                      // absent → full
  o = tuneAsset(o.orbat, id, { confidence: 'low' });
  const a = o.assets.find((x) => x.id === id);
  assert.equal(a.confidence, 'low');
  assert.equal(confidenceOpacity(a) < 1, true);
  // unknown confidence ignored
  o = tuneAsset(o, id, { confidence: 'bogus' });
  assert.equal(o.assets.find((x) => x.id === id).confidence, 'low');
});

// US3 — red dual range
test('red dual-range clamps and reconciles engagement ≤ detection (FR-005/006)', () => {
  let o = addAsset(emptyOrbat('s'), { allegiance: 'red', position: pos(1) });
  const id = o.id;
  // engagement set larger than detection → reconciled down to detection
  o = tuneAsset(o.orbat, id, { red: { detection_range_m: 3000, engagement_range_m: 9999 } });
  let a = o.assets.find((x) => x.id === id);
  assert.equal(a.red.detection_range_m, 3000);
  assert.equal(a.red.engagement_range_m, 3000);                              // reconciled ≤ detection
  // out-of-bounds detection clamps
  o = tuneAsset(o, id, { red: { detection_range_m: 9_999_999 } });
  assert.equal(o.assets.find((x) => x.id === id).red.detection_range_m, BOUNDS.extent_m[1]);
});

test('normalize migrates a spec-004 red draft (extent_m → detection) and is idempotent (FR-010)', () => {
  // A spec-004-shaped red asset: single extent, no dual range.
  const legacy = { id: '', name: 's', version: 1, assets: [
    { id: 'asset-1', allegiance: 'red', extent_m: 2400, red: { severity: 4, active_windows: [] } },
    { id: 'asset-2', allegiance: 'green', extent_m: 1000, green: { sensitivity: 3, protection: 'keep_out' } },
  ], lineage: {} };
  const n1 = normalize(legacy);
  const red = n1.assets.find((a) => a.id === 'asset-1');
  assert.equal(red.red.detection_range_m, 2400);                             // migrated from extent_m
  assert.equal(red.red.engagement_range_m <= 2400, true);
  // green untouched (still single extent, no dual range)
  assert.equal(n1.assets.find((a) => a.id === 'asset-2').red, undefined);
  // idempotent: re-normalising yields identical canonical bytes
  assert.equal(canonical(n1), canonical(normalize(n1)));
});

// US4 — descriptive detail
test('descriptive fields round-trip, trim, and drop when empty; category vocab-checked (FR-012/013/014)', () => {
  let o = addAsset(emptyOrbat('s'), { allegiance: 'red', position: pos(1) });
  const rid = o.id;
  o = tuneAsset(o.orbat, rid, { strength: '  ×2  ', notes: 'dug in', red: { threat_type: ' SAM ' } });
  let r = o.assets.find((x) => x.id === rid);
  assert.equal(r.strength, '×2');                                            // trimmed
  assert.equal(r.notes, 'dug in');
  assert.equal(r.red.threat_type, 'SAM');
  // clearing notes drops the key
  o = tuneAsset(o, rid, { notes: '   ' });
  assert.equal('notes' in o.assets.find((x) => x.id === rid), false);

  // green category (vocab) + blue role
  let g = addAsset(o, { allegiance: 'green', position: pos(2) });
  o = tuneAsset(g.orbat, g.id, { green: { category: 'hospital' } });
  assert.equal(o.assets.find((x) => x.id === g.id).green.category, 'hospital');
  o = tuneAsset(o, g.id, { green: { category: 'not-a-category' } });        // ignored
  assert.equal(o.assets.find((x) => x.id === g.id).green.category, 'hospital');

  let b = addAsset(o, { allegiance: 'blue', position: pos(3) });
  o = tuneAsset(b.orbat, b.id, { blue: { role: 'recce' } });
  assert.equal(o.assets.find((x) => x.id === b.id).blue.role, 'recce');
});
