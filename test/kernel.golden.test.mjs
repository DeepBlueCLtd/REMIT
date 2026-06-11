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

test('A — 45-min dwell: direct & covered wait out the tide and ford; tracked detours via the causeway', async () => {
  const plans = await planFixture(45);
  assert.deepEqual(plans.map((p) => p.strategy.key), ['direct', 'tracked', 'covered']);
  assert.deepEqual(plans.map((p) => p.tide_decision.mode), ['wait', 'detour', 'wait']);

  const direct = byKey(plans, 'direct');
  assert.deepEqual(kinds(direct), ['transit', 'hold', 'visit', 'exfil', 'hold', 'exfil']);
  assert.equal(direct.materialisation.schedule.at(-1).end_min, 97.3);         // RV East
  assert.deepEqual(sat(direct, 'Exfil E'), { commitment_id: 'cmt-2', label: 'Exfil E', margin_min: 142.7, margin_band: 'robust', verdict: 'satisfied' });

  // Covered is slow too → it also waits and fords.
  const covered = byKey(plans, 'covered');
  assert.deepEqual(kinds(covered), ['transit', 'hold', 'visit', 'exfil', 'hold', 'exfil']);
  assert.equal(covered.tide_decision.via_ford, undefined);                    // decision carries mode/wait/rv
  assert.equal(covered.materialisation.schedule.at(-1).end_min, 99.8);

  // Golden ids (NF3 — content-addressed plan identity).
  assert.deepEqual(plans.map((p) => p.id), [
    'sha256:adb1449a8dfa17ef5d53ddeff91a0aba73324d509e32363801e699e7fa888113',
    'sha256:26344a2287ffb7919fdf6688392e80eec17badb04a296083584bd888c7751eb8',
    'sha256:968f640ae12f553d1636259ef12d8f93e40cbdabd2b5ff6189eab23154bd60e6',
  ]);
});

test('B — 15-min dwell: a short visit lets both plans detour via the causeway (no tide wait)', async () => {
  const plans = await planFixture(15);
  // Short dwell → direct and tracked converge to one route (content-deduped) → two COAs.
  assert.deepEqual(plans.map((p) => p.strategy.key), ['direct', 'covered']);
  assert.deepEqual(plans.map((p) => p.tide_decision.mode), ['detour', 'detour']);
  const direct = byKey(plans, 'direct');
  assert.deepEqual(kinds(direct), ['transit', 'hold', 'visit', 'exfil']);
  assert.equal(direct.materialisation.schedule.at(-1).end_min, 67.5);
  assert.equal(direct.id, 'sha256:c12feb67a33a9166da9c1dffa1db8c045e3a9443784cf40867908df1d46588ba');
});

test('C — a no-go cordon across the river makes exfil structurally infeasible', async () => {
  // A longitude wall around the river centreline cuts every crossing (fords + bridge).
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
  assert.equal(new Set(a.map((p) => p.id)).size, 3);
  assert.equal(KERNEL_VERSION, 'mock-0.2');
});
