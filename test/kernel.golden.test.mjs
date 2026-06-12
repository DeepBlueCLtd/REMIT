// Golden-fixture tests for the mock kernel (kernel/kernel.js) on the H3 "Solway crossing"
// scenario (ADR-0016).
//
// A fast, browser-free guard on the deterministic planner that the e2e suite only
// exercises through the UI. The requirement geometry is the app's capture defaults
// (OP-A · window H+30–120 · RV EAST · deadline H+240 · seed 1337), resolved to H3 cells
// from the world's own places, minus the volatile capture timestamps so content ids are
// stable. The pinned plan ids are GOLDEN — regenerate them deliberately (and review why)
// if the stamp shape, scenario, or canonicalisation changes.
//
// Scenario note: the OPs sit on the contiguous south-shore arc (the only ground a dry,
// ford-free approach reaches — the northern waths are water-isolated), close to the
// all-tide causeway. With the fords shut at H+0 the cheapest exfil therefore *detours* to
// the causeway rather than waiting out the tide, and balanced appetites collapse the
// handful to two COAs (covered ≡ direct, content-deduped). See world.js PLACES.ops.
//
// Run: npm run test:unit

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildWorld } from '../app/js/kernel/world.js';
import { planHandful, KERNEL_VERSION } from '../app/js/kernel/kernel.js';
import { contentId } from '../app/js/shapes/canonical.js';

const world = buildWorld();
const OP = world.places.ops[0];          // OP-A
const RV = world.places.rvEast;

/** The app's requirement geometry at an arbitrary dwell (timestamp-free). */
function requirement(dwellMin) {
  return { commitments: [
    { id: 'cmt-1', activity: { type: 'visit', where: { h3: OP.h3, alias: 'OP-A' },
        when: { window: { start_min: 30, end_min: 120 } }, duration: { min_min: dwellMin } } },
    { id: 'cmt-2', activity: { type: 'transit', where: { h3: RV.h3, alias: 'RV-EAST' },
        when: { before_min: 240 } } },
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
    ao: world.ao,
  });
  return plans;
}

const byKey = (plans, k) => plans.find((p) => p.strategy.key === k);
const kinds = (p) => p.materialisation.schedule.map((s) => s.kind);
const sat = (p, label) => p.scores.satisfaction.find((s) => s.label === label);

test('A — 45-min dwell: both COAs detour via the causeway (fords shut at H+0)', async () => {
  const plans = await planFixture(45);
  assert.deepEqual(plans.map((p) => p.strategy.key), ['direct', 'tracked']);
  assert.deepEqual(plans.map((p) => p.tide_decision.mode), ['detour', 'detour']);

  const direct = byKey(plans, 'direct');
  assert.deepEqual(kinds(direct), ['transit', 'hold', 'visit', 'exfil']);
  assert.equal(direct.materialisation.schedule.at(-1).end_min, 90.4);          // RV East
  assert.deepEqual(sat(direct, 'Exfil E'), { commitment_id: 'cmt-2', label: 'Exfil E', margin_min: 149.6, margin_band: 'robust', verdict: 'satisfied' });

  const tracked = byKey(plans, 'tracked');
  assert.deepEqual(kinds(tracked), ['transit', 'hold', 'visit', 'exfil']);
  assert.equal(tracked.tide_decision.via_ford, undefined);                     // decision carries mode/wait/rv
  assert.equal(tracked.materialisation.schedule.at(-1).end_min, 91.3);

  // Golden ids (NF3 — content-addressed plan identity).
  assert.deepEqual(plans.map((p) => p.id), [
    'sha256:b44e3796567694067562084b7b45d873e6d69b908fecedbbefe701e47fedb2e7',
    'sha256:efe3f4dbb9b802714291773b2d54448f9237aa6f9a4fb5903c492790bf88ee01',
  ]);
});

test('B — 15-min dwell: the same causeway detour, an earlier RV, distinct ids (NF3)', async () => {
  const plans = await planFixture(15);
  assert.deepEqual(plans.map((p) => p.strategy.key), ['direct', 'tracked']);
  assert.deepEqual(plans.map((p) => p.tide_decision.mode), ['detour', 'detour']);
  const direct = byKey(plans, 'direct');
  assert.deepEqual(kinds(direct), ['transit', 'hold', 'visit', 'exfil']);
  assert.equal(direct.materialisation.schedule.at(-1).end_min, 60.4);
  assert.equal(direct.id, 'sha256:ec5a90442ed196b700915a185dcdb98e19a37d7ea790def602b9fc963e5a3bf3');
});

test('C — a no-go cordon over the crossing cuts off the OP, so every COA is infeasible', async () => {
  // A longitude wall around the river centreline cuts every crossing — and, because OP-A
  // overlooks the wath from that same band, the dry approach to the OP as well.
  const cordon = [];
  world.ao.centers.forEach(([, lng], id) => {
    if (Math.abs(lng - (-3.103)) < 0.013) cordon.push({ h3: world.ao.indexes[id] });
  });
  const plans = await planFixture(45, [{ type: 'no-go', cells: cordon }]);
  for (const p of plans) {
    assert.equal(p.materialisation, null);
    assert.equal(sat(p, 'Observe OP').verdict, 'violated');
    assert.equal(sat(p, 'Exfil E').verdict, 'violated');
    assert.equal(p.conflicts[0].kind, 'structural');
    assert.match(p.conflicts[0].narrative, /No route from start to OP-A/);
    assert.equal(p.scores.cost_band, 'fragile');
  }
});

test('NF3 — identical inputs reproduce identical ids; a geometry change changes them', async () => {
  const a = await planFixture(45);
  const b = await planFixture(45);
  assert.deepEqual(a.map((p) => p.id), b.map((p) => p.id));
  assert.notEqual(byKey(a, 'direct').id, byKey(await planFixture(15), 'direct').id);
  assert.equal(new Set(a.map((p) => p.id)).size, 2);
  assert.equal(KERNEL_VERSION, 'mock-0.2');
});
