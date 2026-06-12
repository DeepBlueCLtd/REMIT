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
// Scenario note: the OPs sit on the north-head land overlooking Bowness Wath, reachable
// dry from the base along the north shore. The north-head walk-around is closed (ADR-0020),
// so with the fords shut at H+0 the exfil must *hold at the bank for low water* and then
// ford — both dwells therefore WAIT, and a shorter visit means a LONGER hold for the same
// tide-bound RV (the tide, not the dwell, sets the exfil). See world.js PLACES.ops.
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

test('A — 45-min dwell: both COAs hold at the bank for the tide, then ford the wath', async () => {
  const plans = await planFixture(45);
  assert.deepEqual(plans.map((p) => p.strategy.key), ['direct', 'covered']);
  assert.deepEqual(plans.map((p) => p.tide_decision.mode), ['wait', 'wait']);

  const direct = byKey(plans, 'direct');
  assert.deepEqual(kinds(direct), ['transit', 'hold', 'visit', 'exfil', 'hold', 'exfil']);
  assert.equal(direct.tide_decision.wait_min, 9.8);                            // held at the bank for low water
  assert.equal(direct.materialisation.schedule.at(-1).end_min, 102.6);         // RV East
  assert.deepEqual(sat(direct, 'Exfil E'), { commitment_id: 'cmt-2', label: 'Exfil E', margin_min: 137.4, margin_band: 'robust', verdict: 'satisfied' });

  const covered = byKey(plans, 'covered');
  assert.deepEqual(kinds(covered), ['transit', 'hold', 'visit', 'exfil', 'hold', 'exfil']);
  assert.equal(covered.tide_decision.via_ford, undefined);                     // decision carries mode/wait/rv
  assert.equal(covered.materialisation.schedule.at(-1).end_min, 104.2);

  // Golden ids (NF3 — content-addressed plan identity).
  assert.deepEqual(plans.map((p) => p.id), [
    'sha256:1cc2a7e684124006e6f200ec52be37eac542fdfbfc058c1ec2952d7772814c0e',
    'sha256:d2d862ef64665bbdd3526a099cca58399c7b30e14379b9c2b1585f97d88f3ece',
  ]);
});

test('B — 15-min dwell: a shorter visit means a LONGER tidal hold (the tide sets the RV)', async () => {
  const plans = await planFixture(15);
  assert.deepEqual(plans.map((p) => p.strategy.key), ['direct', 'covered']);
  assert.deepEqual(plans.map((p) => p.tide_decision.mode), ['wait', 'wait']);
  const direct = byKey(plans, 'direct');
  assert.deepEqual(kinds(direct), ['transit', 'hold', 'visit', 'exfil', 'hold', 'exfil']);
  assert.equal(direct.tide_decision.wait_min, 39.8);                           // 30 min more hold than at dwell 45…
  assert.equal(direct.materialisation.schedule.at(-1).end_min, 102.6);         // …yet the same tide-bound RV
  assert.equal(direct.id, 'sha256:73d59c23d478ed4d1bc4646aaa52c86b6505477a3683d2b5a84bd5f383827603');
});

test('C — a no-go cordon across the river makes exfil structurally infeasible', async () => {
  // A longitude wall around the river centreline cuts every crossing (fords + causeway).
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
    assert.match(p.conflicts[0].narrative, /No exfil route/);
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
