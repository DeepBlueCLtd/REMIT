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
// Scenario note: OP-A sits on the designed tidal islet beside Sandywath (ADR-0021), reached
// dry along the spit from the southern base. With the fords shut at H+0 the exfil FORKS —
// ford Sandywath at low water, or drive the longer all-tide road south to the causeway. A
// short watch (25 min) makes the fork bite: `direct` drives the road (fast, no wait) while
// `tracked` LEAVES BASE LATE to reach the wath at low water — a just-in-time departure that
// waits out the tide at base, not the exposed bank (ADR-0023), so the two COAs' departures
// stagger. A longer watch (45 min) lands `direct` at the wath after low water (it just fords);
// `tracked` still times its departure. See world.js PLACES.ops + kernel.js materialise().
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

test('A — 25-min dwell: the fork — direct drives the road; tracked leaves base late to ford at low water', async () => {
  const plans = await planFixture(25);
  assert.deepEqual(plans.map((p) => p.strategy.key), ['direct', 'tracked']);
  assert.deepEqual(plans.map((p) => p.tide_decision.mode), ['detour', 'wait']);

  // Direct takes the all-tide road south to the causeway — one exfil leg, no tidal hold.
  const direct = byKey(plans, 'direct');
  assert.deepEqual(kinds(direct), ['transit', 'hold', 'visit', 'exfil']);
  assert.equal(direct.materialisation.schedule.at(-1).end_min, 85.8);          // RV East — the fast road
  assert.deepEqual(sat(direct, 'Exfil E'), { commitment_id: 'cmt-2', label: 'Exfil E', margin_min: 154.2, margin_band: 'robust', verdict: 'satisfied' });

  // Tracked LEAVES BASE LATE (the leading hold) so it reaches the wath exactly at low water —
  // it waits out the tide at base, not the exposed bank, then fords in one leg. Same RV.
  const tracked = byKey(plans, 'tracked');
  assert.deepEqual(kinds(tracked), ['hold', 'transit', 'visit', 'exfil']);
  assert.equal(tracked.tide_decision.wait_min, 51.3);            // the delay at base (no bank-wait)
  assert.equal(tracked.materialisation.schedule[0].label, 'Delay departure — cross at low water');
  assert.equal(tracked.materialisation.schedule.at(-1).end_min, 98.5);

  // Golden ids (NF3 — content-addressed plan identity).
  assert.deepEqual(plans.map((p) => p.id), [
    'sha256:9f435715c0f3313ac1dad2e22a18a06dd6ec9f8b6e769055b7ad3d9b820da7d2',
    'sha256:49c2f87af82ef88f39a31e148fc63845e52afdcc2ad3eebcf09ef7898ec74b63',
  ]);
});

test('B — 45-min dwell: a longer watch lands the team at low water, so both COAs ford (no drive)', async () => {
  const plans = await planFixture(45);
  assert.deepEqual(plans.map((p) => p.strategy.key), ['direct', 'tracked']);
  // Direct now arrives after the wath has opened (crosses without waiting); tracked waits a little.
  assert.deepEqual(plans.map((p) => p.tide_decision.mode), ['open', 'wait']);
  const direct = byKey(plans, 'direct');
  assert.deepEqual(kinds(direct), ['transit', 'hold', 'visit', 'exfil']);
  assert.equal(direct.materialisation.schedule.at(-1).end_min, 99.9);
  assert.equal(direct.id, 'sha256:e89ddc86c5328303d10b76e345c341b9b81a05c408e66800e89ac859d56945e0');
});

test('C — a no-go cordon across the river makes exfil structurally infeasible', async () => {
  // A longitude wall around the river centreline cuts every crossing (fords + causeway).
  const cordon = [];
  world.ao.centers.forEach(([, lng], id) => {
    if (Math.abs(lng - (-3.103)) < 0.013) cordon.push({ h3: world.ao.indexes[id] });
  });
  const plans = await planFixture(25, [{ type: 'no-go', cells: cordon }]);
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
  const a = await planFixture(25);
  const b = await planFixture(25);
  assert.deepEqual(a.map((p) => p.id), b.map((p) => p.id));
  assert.notEqual(byKey(a, 'direct').id, byKey(await planFixture(45), 'direct').id);
  assert.equal(new Set(a.map((p) => p.id)).size, 2);
  assert.equal(KERNEL_VERSION, 'mock-0.2');
});
