// Golden-fixture tests for the mock kernel (kernel/kernel.js).
//
// A fast, browser-free guard on the deterministic planner that the e2e suite
// only exercises through the UI. Inputs mirror the app's capture defaults
// (docs/project_notes/key_facts.md: OP-A 21,3 · window H+30–120 · RV 27,8 ·
// deadline H+180 · seed 1337 · base 2,15), minus the volatile capture
// timestamps so content ids are stable. The three scenarios are the demo's
// tidal-ford set-pieces; the pinned plan ids are GOLDEN — regenerate them
// deliberately (and review why) if the stamp shape or canonicalisation changes.
//
// Run: npm run test:unit

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildWorld } from '../app/js/kernel/world.js';
import { planHandful, KERNEL_VERSION } from '../app/js/kernel/kernel.js';
import { contentId } from '../app/js/shapes/canonical.js';

const world = buildWorld();

/** The app's requirement geometry at an arbitrary dwell (timestamp-free). */
function requirement(dwellMin) {
  return { commitments: [
    { id: 'cmt-1', activity: { type: 'visit', where: { x: 21, y: 3, alias: 'OP-A' },
        when: { window: { start_min: 30, end_min: 120 } }, duration: { min_min: dwellMin } } },
    { id: 'cmt-2', activity: { type: 'transit', where: { x: 27, y: 8, alias: 'RV-EAST' },
        when: { before_min: 180 } } },
  ] };
}

/** Stamp axes are content ids, exactly as the app derives them (NF3). */
async function planFixture(dwellMin, steering = []) {
  const req = requirement(dwellMin);
  const { plans } = await planHandful({
    requirement: req, requirement_version: await contentId(req),
    baseline: world.baseline, baseline_version: await contentId(world.baseline),
    profile: world.profile, profile_version: await contentId(world.profile),
    state: world.state, config_core: await contentId(world.configCore),
    appetites: { tempo: 'balanced', exposure: 'balanced' }, steering, strategy_seed: 1337,
  });
  return plans;
}

const byKey = (plans, k) => plans.find((p) => p.strategy.key === k);
const kinds = (p) => p.materialisation.schedule.map((s) => s.kind);
const labels = (p) => p.materialisation.schedule.map((s) => s.label);
const sat = (p, label) => p.scores.satisfaction.find((s) => s.label === label);

test('A — 45-min dwell: the direct plan waits out the tide; the slower covered plan crosses on the open window', async () => {
  const plans = await planFixture(45);
  assert.deepEqual(plans.map((p) => p.strategy.key), ['direct', 'tracked', 'covered']);

  const direct = byKey(plans, 'direct');
  assert.equal(direct.tide_decision.mode, 'wait');
  // transit → hold (await window) → visit → exfil-to-bank → hold (await tide) → cross.
  assert.deepEqual(kinds(direct), ['transit', 'hold', 'visit', 'exfil', 'hold', 'exfil']);
  assert.ok(labels(direct).includes('Await low tide — ford opens H+88'));
  assert.equal(direct.materialisation.schedule.at(-1).end_min, 95.5);   // RV East
  assert.equal(direct.materialisation.state_curves.fuel_end_pct, 87.4);
  assert.deepEqual(sat(direct, 'Observe OP'), { commitment_id: 'cmt-1', label: 'Observe OP', margin_min: 48.9, margin_band: 'robust', verdict: 'satisfied' });
  assert.deepEqual(sat(direct, 'Exfil E'), { commitment_id: 'cmt-2', label: 'Exfil E', margin_min: 84.5, margin_band: 'robust', verdict: 'satisfied' });
  assert.equal(direct.scores.cost_band, 'robust');
  assert.equal(direct.scores.robustness_band, 'fragile');
  assert.equal(direct.conflicts.length, 0);

  // Covered is slow enough to reach the bank after the window opens → no wait.
  const covered = byKey(plans, 'covered');
  assert.equal(covered.tide_decision.mode, 'open');
  assert.deepEqual(kinds(covered), ['transit', 'visit', 'exfil']);
  assert.ok(labels(covered).some((l) => l.includes('ford K-7 (tide open)')));

  // Golden ids (NF3 — content-addressed plan identity).
  assert.deepEqual(plans.map((p) => p.id), [
    'sha256:f0fc74b2ca04127f4c513e94aa4233790e3e02bfc55fef6d97fa5cd2a620e2ae',
    'sha256:7bca8334b4ee7dda8d0c04648a67ae296b4cfc8d83eb54fc69cde70c0aae9321',
    'sha256:6b90e43a1121e92aae9ef2bd5060556f2184de76b96db3cd3f06213e2753005f',
  ]);
});

test('B — 15-min dwell: the early bank arrival flips every plan to the K-9 detour', async () => {
  const plans = await planFixture(15);
  assert.deepEqual(plans.map((p) => p.tide_decision.mode), ['detour', 'detour', 'detour']);

  const direct = byKey(plans, 'direct');
  assert.ok(labels(direct).some((l) => l.includes('via K-9 bridge')));
  assert.ok(!labels(direct).some((l) => l.includes('Await low tide')));
  assert.deepEqual(kinds(direct), ['transit', 'hold', 'visit', 'exfil']);
  assert.equal(direct.materialisation.schedule.at(-1).end_min, 66.1);
  assert.equal(direct.id, 'sha256:2d1c5985d79dde202f10434b492903836194060ed1cefaeb978c2c0567f6e0a8');
});

test('C — no-go on both river crossings: exfil is structurally infeasible for every COA', async () => {
  const plans = await planFixture(45, [{ type: 'no-go', cells: [{ x: 23, y: 5 }, { x: 23, y: 15 }] }]);
  for (const p of plans) {
    assert.equal(p.materialisation, null);
    assert.equal(sat(p, 'Observe OP').verdict, 'violated');
    assert.equal(sat(p, 'Exfil E').verdict, 'violated');
    assert.equal(p.conflicts[0].kind, 'structural');
    assert.match(p.conflicts[0].narrative, /No exfil route OP → RV 27,8/);
    assert.equal(p.scores.cost_band, 'fragile');
  }
  assert.equal(byKey(plans, 'direct').id, 'sha256:39f806905ff343b2cce82588380ab9c49a8d0068ca7da68d5359209f1371d709');
});

test('NF3 — identical inputs reproduce identical ids; a geometry change changes them', async () => {
  const a = await planFixture(45);
  const b = await planFixture(45);
  assert.deepEqual(a.map((p) => p.id), b.map((p) => p.id));        // same body → same ids
  assert.notEqual(byKey(a, 'direct').id, byKey(await planFixture(15), 'direct').id);
  assert.equal(new Set(a.map((p) => p.id)).size, 3);               // the handful is distinct
  assert.equal(KERNEL_VERSION, 'mock-0.1');
});
