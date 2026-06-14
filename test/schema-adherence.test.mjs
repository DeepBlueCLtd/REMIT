// Schema-adherence guard (ADR-0011/0012, Principle I / DEC-57).
//
// Real skeleton instances — a committed ORBAT and a kernel Plan — are validated
// against the GENERATED JSON Schema (schema/gen/remit.schema.json). This proves
// the constitution's "schema ≡ code" for the serialisable object core, and fails
// the build the moment code or schema drift apart (the gap a hand-written type
// would hide). Build-free: imports the pure app modules directly, like the other
// node --test suites.
//
// Known, pre-existing drifts are listed in DRIFT (each tracked in
// docs/project_notes/bugs.md) and stripped before strict validation, so the guard
// stays green while still catching any NEW drift in the surrounding fields. Drop
// an entry here when its schema fix lands — the two open ones are:
//   • Waypoint/StartState/TrajectoryPoint are still square-grid {x,y}; the app is
//     hex {h3,lat,lng} since ADR-0016 (the Waypoint→HexCell migration).
//   • the kernel carries appetites as a {axis:setting} map; the schema models
//     Appetite[] {axis,setting}. TideDecision likewise shapes differently.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import Ajv from 'ajv/dist/2019.js';

import { emptyOrbat, addAsset, reconcileOwnForce, canonical, commit } from '../app/js/orbat/orbat.js';
import { ObjectStore } from '../app/js/stores/stores.js';
import { buildWorld } from '../app/js/kernel/world.js';
import { planHandful } from '../app/js/kernel/kernel.js';
import { contentId } from '../app/js/shapes/canonical.js';

const schema = JSON.parse(readFileSync(new URL('../schema/gen/remit.schema.json', import.meta.url), 'utf8'));
const ajv = new Ajv({ strict: false, allErrors: true });
ajv.addSchema(schema, 'remit');

function validatorFor(cls) {
  const v = ajv.getSchema(`remit#/$defs/${cls}`);
  assert.ok(v, `generated schema has no class ${cls}`);
  return v;
}

// Documented schema↔code drifts (docs/project_notes/bugs.md), stripped per class.
const DRIFT = {
  Asset: ['position'],
  Stamp: ['start', 'appetites'],
  Materialisation: ['trajectory', 'tide'],
  Plan: ['tide_decision'],
};

const clone = (x) => JSON.parse(JSON.stringify(x));
function strip(cls, inst) {
  const c = clone(inst);
  for (const f of DRIFT[cls] ?? []) delete c[f];
  return c;
}

/** Assert `instance` validates against `#/$defs/<cls>` once documented drift is stripped. */
function adheres(cls, instance) {
  const v = validatorFor(cls);
  const ok = v(strip(cls, instance));
  const detail = ok ? '' : '\n' + v.errors.map((e) => `  ${e.instancePath || '(root)'} ${e.message}`).join('\n');
  assert.ok(ok, `${cls} does not adhere to the generated JSON Schema:${detail}`);
}

// ---- ORBAT serialisable core (spec 004/005) -------------------------------------

test('ORBAT — a committed Orbat (red + green + own-force blue) adheres to the schema', async () => {
  let r = addAsset(emptyOrbat('Adherence'), { allegiance: 'red', position: { h3: 'c1', lat: 54.9, lng: -3.1 } });
  r = addAsset(r.orbat, { allegiance: 'green', position: { h3: 'c2', lat: 54.9, lng: -3.1 } });
  const o = reconcileOwnForce(r.orbat, { h3: 'c0', lat: 54.96, lng: -3.1 });
  const { id } = await commit(o, new ObjectStore());

  // The full Orbat (content id reattached to the id-free canonical body, DEC-35),
  // with each asset's drifting position stripped, must validate strictly.
  const orbat = { id, ...JSON.parse(canonical(o)) };
  orbat.assets = orbat.assets.map((a) => strip('Asset', a));
  const v = validatorFor('Orbat');
  assert.ok(v(orbat), 'Orbat: ' + (v.errors || []).map((e) => `${e.instancePath} ${e.message}`).join(' | '));

  assert.equal(o.assets.length, 3);
  for (const a of o.assets) adheres('Asset', a); // red, green, blue individually
});

// ---- Plan / kernel output (spec 002/003) ----------------------------------------

test('Plan — a kernel plan, its Stamp, Scores and Materialisation adhere to the schema', async () => {
  const world = buildWorld();
  const OP = world.places.ops[0];
  const RV = world.places.rvEast;
  const req = { commitments: [
    { id: 'cmt-1', activity: { type: 'visit', where: { h3: OP.h3, alias: 'OP-A' }, when: { window: { start_min: 30, end_min: 120 } }, duration: { min_min: 25 } } },
    { id: 'cmt-2', activity: { type: 'transit', where: { h3: RV.h3, alias: 'RV-EAST' }, when: { before_min: 240 } } },
  ] };
  const { plans } = await planHandful({
    requirement: req, requirement_version: await contentId(req),
    baseline: world.baseline, baseline_version: await contentId(world.baseline),
    profile: world.profile, profile_version: await contentId(world.profile),
    state: world.state, config_core: await contentId(world.configCore),
    appetites: { tempo: 'balanced', exposure: 'balanced' }, steering: [], strategy_seed: 1337, ao: world.ao,
  });
  const p = plans[0];

  adheres('Stamp', p.stamp);
  adheres('Scores', p.scores);
  adheres('Materialisation', p.materialisation);

  // The whole Plan, with drift stripped from its nested Stamp + Materialisation.
  const plan = strip('Plan', p);
  plan.stamp = strip('Stamp', plan.stamp);
  plan.materialisation = strip('Materialisation', plan.materialisation);
  const v = validatorFor('Plan');
  assert.ok(v(plan), 'Plan: ' + (v.errors || []).map((e) => `${e.instancePath} ${e.message}`).join(' | '));

  // The guard guards: corrupting a clean object with an undeclared field must fail
  // (additionalProperties:false), so NEW drift cannot slip past.
  assert.equal(validatorFor('Scores')({ ...p.scores, undeclared_field: 1 }), false);
});
