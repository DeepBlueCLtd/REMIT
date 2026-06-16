// Schema-adherence guard (ADR-0011/0012, Principle I / DEC-57).
//
// Real skeleton instances — a committed ORBAT and the kernel's Plan handful — are
// validated against the GENERATED JSON Schema (schema/gen/remit.schema.json). This
// proves the constitution's "schema ≡ code" for the serialisable object core and
// fails the build the moment code or schema drift apart (the gap a hand-written
// type would hide). Build-free: imports the pure app modules directly, like the
// other node --test suites.
//
// History: the first cut of this guard had to strip documented drifts (square-grid
// Waypoint vs hex; appetites map-vs-list; TideDecision). The Waypoint→HexCell
// migration (ADR-0030) closed them, so it now validates the instances whole.

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

/** Assert `instance` validates against `#/$defs/<cls>`. */
function adheres(cls, instance) {
  const v = validatorFor(cls);
  const ok = v(instance);
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
  // hex positions and all.
  adheres('Orbat', { id, ...JSON.parse(canonical(o)) });

  assert.equal(o.assets.length, 3);
  for (const a of o.assets) adheres('Asset', a); // red, green, blue individually
});

// ---- Plan / kernel output (spec 002/003) ----------------------------------------

test('Plan — the kernel handful, its Stamp, Scores and Materialisation adhere to the schema', async () => {
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

  // Every plan in the handful — exercises both tide modes (detour + wait).
  for (const p of plans) adheres('Plan', p);

  const p = plans[0];
  adheres('Stamp', p.stamp);                     // hex start + axis→setting appetites map
  adheres('Scores', p.scores);
  adheres('Materialisation', p.materialisation); // hex trajectory

  // A no-go steering constraint — its cells are HexCells since ADR-0030.
  adheres('Constraint', { type: 'no-go', cells: [{ h3: '89195436313ffff' }] });

  // The guard guards: corrupting a clean object with an undeclared field must fail
  // (additionalProperties:false), so NEW drift cannot slip past.
  assert.equal(validatorFor('Scores')({ ...p.scores, undeclared_field: 1 }), false);
});
