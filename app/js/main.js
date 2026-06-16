// @ts-check
// main.js — orchestration: the six-stage lap (world → … → learn), the
// persistent projection surface (map + timeline + shared playhead), stage
// gating, and the two transparency drawers (object store, seam traffic).

import { bandUnitFor, TIDE, fordOpenAt, nextFordOpen } from './kernel/world.js';
import { stateAt, measuresAt, KERNEL_VERSION } from './kernel/kernel.js';
import { mountCapture } from './capture/capture.js';
import { mountCompare } from './compare/compare.js';
import { mountWingman } from './wingman/wingman.js';
import { mountLearn } from './learn/learn.js';
import { STRAT_COLORS } from './views/render.js';
import { makeMap } from './views/map.js';
import { makeSyncMatrix } from './views/sync-matrix.js';
import { buildEntities, syncCatalogue, satOverhead, coincidenceRules, coincidenceWindows } from './entities/entities.js';
import { contentId, shortId } from './shapes/canonical.js';
import { getDraft, setDraft, subscribeDraft, reconcileOwnForce } from './orbat/orbat.js';
// The shared app context — one store/seam/world/playhead, shared with every
// other role surface (tab) so they all project the same objects (DEC-61).
import { objects, logs, seam, world, playhead } from './shell/context.js';

/** @typedef {import('../../schema/gen/remit').Requirement} Requirement */
/** @typedef {import('../../schema/gen/remit').Plan} Plan */
/** @typedef {import('../../schema/gen/remit').Constraint} Constraint */

const MISSION_ID = 'M-001';
const STRATEGY_SEED = 1337;

// World provisions the AO before Capture so command can point at features it can
// see on the map (the requirement stays the primary object — DEC-5 is about
// primacy, not tool order). Spine-order deviation noted for the DEC-47 gate.
const STAGES = [
  { key: 'world',   n: 1, label: 'World',   hat: 'provision' },
  { key: 'capture', n: 2, label: 'Capture', hat: 'command' },
  { key: 'plan',    n: 3, label: 'Plan',    hat: 'implementer' },
  { key: 'compare', n: 4, label: 'Compare', hat: 'implementer' },
  { key: 'execute', n: 5, label: 'Execute', hat: 'operator' },
  { key: 'learn',   n: 6, label: 'Learn',   hat: 'all hats' },
];

// --- infrastructure -------------------------------------------------------
// objects / logs / seam / world / playhead now live in ./shell/context.js so
// every tab shares one store; they are imported above.

/** Mission state accumulated along the lap. */
const state = {
  stage: 'world',
  unlocked: new Set(['world']),
  done: new Set(),
  requirement: /** @type {Requirement | null} */ (null),
  ids: { requirement: '', baseline: '', profile: '', configCore: '', stamp: '', rationale: '' },
  configCoreHash: '',
  bandUnit: bandUnitFor(world.baseline.channels[0]),
  appetites: { tempo: 'balanced', exposure: 'balanced' },
  steering: /** @type {Constraint[]} */ ([]),   // operator no-go constraints (Plan)
  handful: /** @type {Plan[]} */ ([]),
  selectedPlan: /** @type {Plan | null} */ (null),
  previewPlan: /** @type {Plan | null} */ (null),  // COA highlighted (radio) in Compare, before commit
  execPlan: /** @type {Plan | null} */ (null),   // live clone played back (and re-routed) in Execute
  execSummary: /** @type {unknown} */ (null),
  horizonMin: 180,
  lastPlanRequest: /** @type {unknown} */ (null),
  nextHint: /** @type {string|null} */ (null),
};

// Debug/test handle (read-only use; not part of any contract). The context
// module seeds window.__remit = {objects, logs, seam, world, playhead}; attach
// the Overview's mission state so existing tooling can read window.__remit.state.
window.__remit.state = state;

// --- projection surface (map + timeline + playhead) ------------------------
const mapEl = /** @type {HTMLElement} */ (document.getElementById('map'));
const map = makeMap(mapEl, world.baseline, world.ao, world.places);
/** @type {any} */ let mapTarget = null;
/** @type {any} */ let mapRv = null;
/** @type {any} */ let mapCandidates = null;   // candidate OPs shown on the map during Capture
/** @type {any} */ let mapHighlight = null;    // the OP currently picked in Capture (live)
/** @type {any[]} */ let mapObstructions = [];   // mid-mission obstruction markers (Execute)
/** @type {any[]} */ let mapBlocked = [];        // mid-mission blocked cells that forced a re-route (Execute)
/** @type {{h3: string}[]} */ let mapNogo = [];           // operator no-go cells (Plan steering)
/** @type {((cell: {h3: string, id: number}) => void) | null} */ let mapOnCellClick = null;  // active map-click handler (set by Plan in no-go mode)
const syncHost = /** @type {HTMLElement} */ (document.getElementById('sync-matrix-host'));
const syncMatrix = makeSyncMatrix(syncHost, playhead);
// Authored ORBAT assets (DEC-60) fold into the entity set + Sync-Matrix catalogue. They are
// rebuilt whenever the live draft changes (panel edits, own-force reconciliation), and the
// projection re-renders — display-only, so no asset ever touches the kernel/plan (NF9).
/** @type {any[]} */ let orbatAssets = (getDraft().assets ?? []);
/** @type {string|null} */ let selectedAsset = null;
let entities = buildEntities(orbatAssets);
let catalogue = syncCatalogue(orbatAssets);
const coincRules = coincidenceRules();

/** Rebuild entities/catalogue from the current ORBAT draft and re-project. */
function refreshOrbat(/** @type {any} */ draft) {
  orbatAssets = draft?.assets ?? [];
  entities = buildEntities(orbatAssets);
  catalogue = syncCatalogue(orbatAssets);
  renderProjection();
}
subscribeDraft(refreshOrbat);
// Panel → map/Sync-Matrix selection highlight (US5): a selected row glows in both views.
window.addEventListener('remit:orbat-select', (/** @type {any} */ e) => {
  selectedAsset = e.detail?.id ?? null;
  renderProjection();
});
const slider = /** @type {HTMLInputElement} */ (document.getElementById('playhead-slider'));
const readout = /** @type {HTMLElement} */ (document.getElementById('projection-readout'));

let worldProvisioned = false;
/** Set by the wingman while mounted; lets a slider grab pause live playback.
 *  @type {(() => void) | null} */
let pausePlayback = null;

function renderProjection() {
  if (!worldProvisioned) return;
  // During/after execution the live (re-routable) plan is what's shown. A committed
  // COA (selectedPlan) — or, before commit, the COA merely highlighted (radio) in
  // Compare — projects identically: map ghost, own-force tracks, coincidences.
  const committed = state.execPlan ?? state.selectedPlan;
  const sel = committed ?? state.previewPlan;
  // The playhead is the single authority for "what time we're viewing": the map
  // ghost is the kernel's evaluator at that time (NF1). During execution the
  // wingman advances the playhead; the user can also scrub it to review.
  map.render({
    plans: state.handful, selected: sel, t: playhead.t,
    target: mapTarget, rv: mapRv,
    candidates: mapCandidates, highlight: mapHighlight,
    obstructions: mapObstructions, nogo: mapNogo, blocked: mapBlocked,
    assets: orbatAssets, selectedAsset,   // authored ORBAT roster (display-only, DEC-60)
    follow: state.stage === 'execute',   // Execute follow-cam: pan to keep the vehicle in view
  });
  // The Sync Matrix (D6) is the temporal projection — tide + satellite tracks
  // appear from the World step on; own-force tracks fill in once a COA exists.
  // Coincidence windows (H1-lite) are advisory only — they never alter the plan.
  const coincidences = coincidenceWindows(coincRules, entities, sel, state.horizonMin);
  syncMatrix.render({
    sel, commitment: state.requirement?.commitments?.[0],
    exfilCommitment: state.requirement?.commitments?.[1],
    horizonMin: state.horizonMin, entities, catalogue, coincidences,
  });
  // Coincidence at the cursor (forecast tide + provider satellite, NF1 reads of
  // each aspect) — the operator's vertical scan, surfaced as plain state. Any
  // advisory window the cursor sits inside is named (H1-lite, never decides).
  const t = playhead.t;
  const hits = coincidences.filter((c) => t >= c.start && t <= c.end);
  const advisory = hits.length
    ? `<span class="sm-cue adv" data-testid="sm-advisory">⌖ ${hits.map((c) => c.label).join(' + ')} (advisory)</span>`
    : '';
  const coincidence =
    `<span class="sm-cue ${fordOpenAt(t) ? 'on' : ''}">≋ ford ${fordOpenAt(t) ? 'open' : 'closed'}</span>`
    + `<span class="sm-cue ${satOverhead(t) ? 'on' : ''}">🛰 sat ${satOverhead(t) ? 'overhead' : 'below horizon'}</span>`
    + advisory;
  // The single-ghost readout is for a *committed* COA; while merely previewing in
  // Compare we keep the "race the ghosts" comparison table (below) live.
  const ghost = committed ? stateAt(committed, playhead.t) : null;
  if (committed && ghost) {
    readout.innerHTML =
      `t <b>H+${Math.round(playhead.t)}</b> · cell <b>${ghost.h3 ? ghost.h3.slice(-6) : '—'}</b>`
      + ` · phase <b>${ghost.phase}</b> · fuel <b>${ghost.fuel_pct ?? '—'}%</b>`
      + ` <span class="sm-coincide" data-testid="sm-coincide">${coincidence}</span>`;
  } else if (state.handful.length) {
    // Compare mode: live per-candidate measures at the playhead, all from the
    // kernel's evaluator (NF1) — scrub to race the ghosts.
    const rows = state.handful.map((p) => {
      const m = measuresAt(p, playhead.t);
      const c = STRAT_COLORS[/** @type {keyof typeof STRAT_COLORS} */ (p.strategy.key)] ?? '#e6edf3';
      if (!m) {
        return `<tr><td><i class="dot" style="background:${c}"></i><b style="color:${c}">${p.strategy.label}</b></td>
          <td colspan="5" class="muted">no traversable route</td></tr>`;
      }
      return `<tr>
        <td><i class="dot" style="background:${c}"></i><b style="color:${c}">${p.strategy.label}</b></td>
        <td>${m.phase}</td>
        <td>${m.dist_km} km</td>
        <td>${m.milestone}</td>
        <td>fuel ${m.fuel_pct}%</td>
      </tr>`;
    }).join('');
    readout.innerHTML =
      `<table class="cmp-live" data-testid="cmp-live"><tbody>${rows}</tbody></table>`
      + `<div class="muted cmp-live-caption">COAs at <b>H+${Math.round(playhead.t)}</b> — kernel evaluator, NF1`
      + ` · <span class="sm-coincide" data-testid="sm-coincide">${coincidence}</span></div>`;
  } else {
    readout.innerHTML =
      `<span class="muted">terrain provisioned — awaiting a plan</span>`
      + ` · <span class="sm-coincide" data-testid="sm-coincide">${coincidence}</span>`;
  }
}

playhead.on((/** @type {number} */ t) => {
  slider.value = String(t);
  renderProjection();
});
slider.addEventListener('pointerdown', () => pausePlayback?.());  // grabbing the scrubber pauses live play
slider.addEventListener('input', () => playhead.set(Number(slider.value)));

// Map clicks → hex, dispatched to the active handler (Plan no-go mode).
map.onCellClick((cell) => {
  if (mapOnCellClick && worldProvisioned) mapOnCellClick(cell);
});

// --- drawers ---------------------------------------------------------------
const storeList = /** @type {HTMLElement} */ (document.getElementById('store-list'));
const trafficList = /** @type {HTMLElement} */ (document.getElementById('seam-list'));
function refreshDrawers() {
  const objs = objects.list();
  storeList.innerHTML = objs.length
    ? objs.map((o) => `<li><code class="hash">${shortId(o.id)}</code> <b>${o.type}</b> <span class="muted">${o.bytes} B canonical</span></li>`).join('')
    : '<li class="muted">empty — nothing committed yet</li>';
  /** @type {HTMLElement} */ (document.getElementById('store-count')).textContent = String(objs.length);
}
seam.onTraffic((traffic) => {
  trafficList.innerHTML = traffic.slice(-14).map((t) =>
    `<li><span class="muted">#${t.n}</span> <b>${t.method}</b> ${t.path} <span class="muted">${t.note}</span></li>`).join('');
  /** @type {HTMLElement} */ (document.getElementById('seam-count')).textContent = String(traffic.length);
  refreshDrawers();
});
refreshDrawers();

// --- hash chips -------------------------------------------------------------
function chip(/** @type {string} */ label, /** @type {string} */ id) {
  return id ? `<span class="idchip">${label} <code class="hash">${shortId(id)}</code></span>` : '';
}
function refreshChips() {
  const ids = [
    ['req', state.ids.requirement], ['baseline', state.ids.baseline],
    ['config-core', state.configCoreHash], ['stamp', state.ids.stamp],
    ['plan', state.selectedPlan ? state.selectedPlan.id : ''],
  ];
  /** @type {HTMLElement} */ (document.getElementById('chips')).innerHTML =
    ids.map(([label, id]) => chip(label, id)).join('') || '<span class="muted">nothing committed yet</span>';
  /** @type {HTMLElement} */ (document.getElementById('chips-count')).textContent = String(ids.filter(([, id]) => id).length);
}

// --- stage rail + gating -----------------------------------------------------
const rail = /** @type {HTMLElement} */ (document.getElementById('rail'));
function renderRail() {
  rail.innerHTML = STAGES.map((s) => {
    const cls = [
      'rail-btn',
      state.stage === s.key ? 'current' : '',
      state.done.has(s.key) ? 'done' : '',
      state.unlocked.has(s.key) ? '' : 'locked',
      state.nextHint === s.key ? 'hint' : '',
    ].join(' ');
    return `<button class="${cls}" data-stage="${s.key}" data-testid="rail-${s.key}"
      ${state.unlocked.has(s.key) ? '' : 'disabled'}>
      <span class="rail-n">${state.done.has(s.key) ? '✓' : s.n}</span>
      <span>${s.label}</span><span class="hat">${s.hat}</span></button>`;
  }).join('');
  rail.querySelectorAll('[data-stage]').forEach((b) =>
    b.addEventListener('click', () => showStage(/** @type {string} */ (/** @type {HTMLElement} */ (b).dataset.stage))));
}

function showStage(/** @type {string} */ key) {
  if (!state.unlocked.has(key)) return;
  state.stage = key;
  if (state.nextHint === key) state.nextHint = null;
  if (key !== 'plan') mapOnCellClick = null;   // map-painting is a Plan-only mode
  document.querySelectorAll('.stage-panel').forEach((p) =>
    p.classList.toggle('active', /** @type {HTMLElement} */ (p).dataset.panel === key));
  renderRail();
}

/** Surface a failure in the banner — nothing fails silently. */
function showFault(/** @type {string} */ msg) {
  window.__remitFault?.(msg);
}

/**
 * Mark a stage done and unlock + mount the next — without leaving the current
 * panel, so the committing act's result stays on screen. An explicit
 * “Continue →” button lands in the completed panel (the rail pulse alone
 * proved too subtle), and it is injected *before* the next stage mounts so a
 * mount failure can never strand the user without a path or an error.
 */
function advance(/** @type {string} */ fromKey) {
  state.done.add(fromKey);
  const i = STAGES.findIndex((s) => s.key === fromKey);
  const next = STAGES[i + 1];
  if (next) {
    state.unlocked.add(next.key);
    state.nextHint = next.key;
    const body = panel(fromKey);
    if (body && !body.querySelector('.continue-row')) {
      const row = document.createElement('div');
      row.className = 'row continue-row';
      const btn = document.createElement('button');
      btn.className = 'primary';
      btn.dataset.testid = `continue-${next.key}`;
      btn.textContent = `Continue → ${next.n} · ${next.label}`;
      btn.addEventListener('click', () => showStage(next.key));
      row.appendChild(btn);
      body.appendChild(row);
    }
    try {
      mountStage(next.key);
    } catch (err) {
      showFault(`mounting ${next.label}: ${err instanceof Error ? err.message : err}`);
      console.error(err);
    }
  }
  renderRail();
  refreshChips();
}

const panel = (/** @type {string} */ key) => /** @type {HTMLElement} */ (document.querySelector(`[data-panel="${key}"] .panel-body`));

// --- stage mounting -----------------------------------------------------------
function mountStage(/** @type {string} */ key) {
  if (key === 'world') mountWorld();
  if (key === 'capture') mountCaptureStage();
  if (key === 'plan') mountPlan();
  if (key === 'compare') {
    if (!state.requirement) return;
    mountCompare(panel('compare'), {
      seam, handful: state.handful, commitments: state.requirement.commitments,
      onPreview(planId) {
        // Highlighting a COA (radio) previews it everywhere — map + Sync Matrix
        // own-force tracks — before the rationale is committed.
        state.previewPlan = state.handful.find((p) => p.id === planId) ?? null;
        renderProjection();
      },
      onSelected(planId, _rationale, rationaleId) {
        state.selectedPlan = state.handful.find((p) => p.id === planId) ?? null;
        state.ids.rationale = rationaleId;
        renderProjection();
        advance('compare');
      },
    });
  }
  if (key === 'execute') {
    if (!state.requirement) return;
    // The wingman plays back (and may re-route) a live clone, so the committed
    // plan stays immutable. Reset the shared playhead to H+0 (the removed Views
    // interstitial used to do this on the way through).
    playhead.set(0);
    state.execPlan = structuredClone(state.selectedPlan);
    mapBlocked = [];
    const wm = mountWingman(panel('execute'), {
      seam, missionId: MISSION_ID, plan: state.execPlan,
      commitment: state.requirement.commitments[0],
      exfilCommitment: state.requirement.commitments[1],
      bandUnit: state.bandUnit,
      playhead,
      resetLog: () => logs.reset(MISSION_ID),
      world: { cells: world.baseline.cells, ao: world.ao, profile: world.profile },
      onObstructions(list) { mapObstructions = list.slice(); renderProjection(); },
      onBlocked(cells) { mapBlocked = cells; renderProjection(); },
      onComplete(summary) {
        state.execSummary = summary;
        advance('execute');
      },
    });
    pausePlayback = wm.pause;
  }
  if (key === 'learn') {
    mountLearn(panel('learn'), {
      seam, missionId: MISSION_ID, ids: state.ids, world,
      selectedPlan: state.selectedPlan, handful: state.handful,
      appetites: state.appetites, steering: state.steering, strategySeed: STRATEGY_SEED,
      configCoreHash: state.configCoreHash, execSummary: state.execSummary,
    }).then(() => {
      state.done.add('learn');
      renderRail();
    }).catch((err) => {
      showFault(`assembling the after-action record: ${err?.message ?? err}`);
      console.error(err);
    });
    playhead.set(0);   // scrubber starts at the route's beginning in Learn
  }
}

function mountWorld() {
  const el = panel('world');
  el.innerHTML = `
    <p class="stage-intro">Load the <b>area of operations</b> — the ground the team will
    work in: the terrain/mobility map, the own-force vehicle, and the conditions that
    define this world. Each is stored as an immutable, content-addressed object; the
    world-defining settings (the <em>config core</em>) are hashed, and that hash becomes
    part of every plan's identity so plans built for different worlds can't be confused
    (DEC-48).</p>
    <ul class="fact-list">
      <li>Area of operations: <b>${world.baseline.name}</b> · land · H3 res ${world.baseline.medium.grid.res} hexes (~344 m)</li>
      <li>Conditions: <b>mobility</b> map (how fast each cell is to cross) → margin band unit <b>${state.bandUnit} min</b></li>
      <li data-testid="world-tide">Conditions: <b>tide</b> — semidiurnal, period ${TIDE.period_min} min; the
          <b>tidal waths</b> are wadeable only within ±${TIDE.open_half_width_min / 60} h of low tide.
          At H+0 they are <b>${fordOpenAt(0) ? 'open' : 'closed'}</b>${fordOpenAt(0) ? '' : ` — open H+${nextFordOpen(0)}`}
          (forecast changepoints, not surprises)</li>
      <li>Own force: <b>${world.profile.name}</b> · ${world.profile.speed_by_medium.land_kph} km/h · start ${world.places.base.name}</li>
      <li>Branding/view defaults stay out of the world's identity hash (DEC-48)</li>
    </ul>
    <div class="row">
      <button id="world-provision" class="primary" data-testid="world-provision">Load the operating area</button>
      <span id="world-result" class="result"></span>
    </div>`;
  el.querySelector('#world-provision')?.addEventListener('click', async () => {
    const [b, p, c] = await Promise.all([
      seam.putObject('Baseline', world.baseline),
      seam.putObject('Profile', world.profile),
      seam.putObject('ConfigCore', world.configCore),
    ]);
    state.ids.baseline = b.id;
    state.ids.profile = p.id;
    state.ids.configCore = c.id;
    state.configCoreHash = await contentId(world.configCore);
    worldProvisioned = true;
    // Surface the planned own-force (ROVER-1) as the canonical blue ORBAT asset (idempotent,
    // display-only): it keeps driving the plan via the pre-existing machinery (NF9/FR-012).
    const ownBase = world.places.base;
    setDraft(reconcileOwnForce(getDraft(), {
      label: 'Own force · ROVER-1', position: { h3: ownBase.h3, lat: ownBase.lat, lng: ownBase.lng },
    }));
    // With the AO on the map, show the candidate OPs so Capture can point at
    // features it can see; the chosen target/RV are set when Capture commits.
    mapCandidates = world.places.ops;
    renderProjection();
    el.querySelectorAll('button').forEach((n) => (n.disabled = true));
    /** @type {HTMLElement} */ (el.querySelector('#world-result')).innerHTML =
      `provisioned · baseline <code class="hash" data-testid="world-baseid">${shortId(b.id)}</code>`
      + ` · config-core hash <code class="hash">${shortId(state.configCoreHash)}</code>`;
    advance('world');
  });
}

/** Capture is mounted on demand (after World), so the AO map is already shown. */
function mountCaptureStage() {
  mountCapture(panel('capture'), {
    seam, places: world.places,
    onPick(op) { mapHighlight = op; renderProjection(); },
    onCommitted(requirement, id) {
      state.requirement = requirement;
      state.ids.requirement = id;
      const cmts = requirement.commitments;
      mapTarget = cmts[0].activity.where;
      mapRv = cmts[1]?.activity?.where ?? null;
      mapCandidates = null;   // committed — stop offering the alternatives
      mapHighlight = null;
      // Horizon spans the whole mission: the exfil deadline if present, else the
      // observation window, plus headroom for execution delay.
      state.horizonMin = (cmts[1]?.activity?.when?.before_min ?? cmts[0].activity.when.window.end_min) + 60;
      slider.max = String(state.horizonMin);
      renderProjection();
      advance('capture');
    },
  });
}

// --- live steering share (the first DEC-61 write) --------------------------
// Denying cells is the application of intel, so — unlike the local risk
// appetites — it is *shared across the system*: the no-go set is written to the
// shared store as a stamped delta (debounced), where every other surface (e.g.
// the Data Analysis monitor, including a popped-out one) sees it land live. The
// `constraints` payload is the schema's Constraint shape (DEC-24); the delta
// envelope (scope + attribution) is the DEC-61 stamped-delta scaffolding that
// becomes a first-class Delta type in the writes phase.
/** @type {ReturnType<typeof setTimeout> | undefined} */ let steeringShareTimer;
let lastSharedNogoKey = '';
function shareSteering() {
  // Hex world: no-go cells are H3 ids (the kernel reads `cell.h3`), not square x/y.
  const cells = mapNogo.map((c) => ({ h3: c.h3 }));
  const key = cells.map((c) => c.h3).sort().join('|');
  if (key === lastSharedNogoKey) return;   // nothing net-new since the last share
  lastSharedNogoKey = key;
  // Shape is the LinkML-generated SteeringDelta (records.yaml → schema/gen/remit.ts),
  // not hand-shaped: scope + Constraint[] payload + flat attribution (by/role/at).
  /** @type {import('../../schema/gen/remit').SteeringDelta} */
  const delta = {
    scope: 'steering',
    // The generated Constraint.cells is HexCell[] (h3) since the Waypoint→HexCell
    // migration (ADR-0030), so the app's hex no-go cells fit directly — no cast.
    constraints: cells.length ? [{ type: 'no-go', cells }] : [],
    by: 'operator',
    role: 'duty-officer-plans',
    at: new Date().toISOString(),
  };
  seam.putObject('SteeringDelta', delta).catch((err) => showFault(`sharing steering: ${err?.message ?? err}`));
}
function scheduleShareSteering() {
  clearTimeout(steeringShareTimer);
  steeringShareTimer = setTimeout(shareSteering, 450);
}

function mountPlan() {
  const el = panel('plan');
  el.innerHTML = `
    <p class="stage-intro">This is where the operator shapes the problem: add intelligence
    as <b>no-go constraints</b> (steering, DEC-24) by painting cells on the map, then a
    stamped kernel call fans out the strategy axes and returns a set of distinct
    <b>courses of action (COAs)</b> that route <em>around</em> them (DEC-22/40-C). The mock
    kernel is an honest non-planner: real A* paths, illustrative scores (NF9).</p>
    <div class="row steer-controls">
      <button id="plan-nogo" data-testid="plan-nogo">✏ Paint no-go zone</button>
      <span class="muted" id="plan-nogo-count" data-testid="plan-nogo-count">0 cells</span>
      <button id="plan-nogo-clear" data-testid="plan-nogo-clear">Clear</button>
      <span class="muted">— click map cells to block; the routes bend around them</span>
    </div>
    <div class="row">
      <button id="plan-run" class="primary" data-testid="plan-run">Generate courses of action — POST /plan/handful</button>
      <span id="plan-result" class="result"></span>
    </div>
    <div id="plan-cards" class="plan-cards"></div>`;

  const nogoBtn = /** @type {HTMLButtonElement} */ (el.querySelector('#plan-nogo'));
  const countEl = /** @type {HTMLElement} */ (el.querySelector('#plan-nogo-count'));
  const updateCount = () => { countEl.textContent = `${mapNogo.length} cells`; };
  updateCount();

  const toggleCell = (/** @type {{h3: string, id: number}} */ cell) => {
    const i = mapNogo.findIndex((c) => c.h3 === cell.h3);
    if (i >= 0) mapNogo.splice(i, 1); else mapNogo.push({ h3: cell.h3 });
    updateCount();
    renderProjection();
    scheduleShareSteering();   // applied intel → shared store (DEC-61)
  };
  nogoBtn.addEventListener('click', () => {
    const on = nogoBtn.classList.toggle('active');
    mapOnCellClick = on ? toggleCell : null;
    nogoBtn.textContent = on ? '✏ Painting — click map cells' : '✏ Paint no-go zone';
  });
  el.querySelector('#plan-nogo-clear')?.addEventListener('click', () => {
    mapNogo.length = 0; updateCount(); renderProjection();
    scheduleShareSteering();   // a cleared no-go set is shared too (intel retracted)
  });

  el.querySelector('#plan-run')?.addEventListener('click', async () => {
    state.steering = mapNogo.length ? [{ type: 'no-go', cells: mapNogo.map((c) => ({ h3: c.h3 })) }] : [];
    const body = {
      requirement: state.requirement, requirement_version: state.ids.requirement,
      baseline: world.baseline, baseline_version: state.ids.baseline,
      profile: world.profile, profile_version: state.ids.profile,
      state: world.state, config_core: state.configCoreHash,
      appetites: state.appetites, steering: state.steering, strategy_seed: STRATEGY_SEED,
      ao: world.ao,
    };
    state.lastPlanRequest = body;
    const res = await seam.planHandful(body);
    state.handful = res.plans;

    // The stamp and each plan are written to the store (DEC-29: stamp is the
    // identity; the materialisation rides as a verified, regenerable cache).
    const stampPut = await seam.putObject('Stamp', res.plans[0].stamp);
    state.ids.stamp = stampPut.id;
    for (const p of res.plans) await seam.putObject('Plan', p);

    // Stay interactive: you can paint more no-go and re-generate (the loop).
    /** @type {HTMLButtonElement} */ (el.querySelector('#plan-run')).textContent =
      'Re-generate COAs — POST /plan/handful';
    /** @type {HTMLElement} */ (el.querySelector('#plan-result')).innerHTML =
      `${res.plans.length} COAs · stamp <code class="hash" data-testid="plan-stampid">${shortId(stampPut.id)}</code> committed`
      + (state.steering.length ? ` · routed around ${mapNogo.length} no-go cells` : '');

    const cards = /** @type {HTMLElement} */ (el.querySelector('#plan-cards'));
    cards.innerHTML = state.handful.map((p) => {
      const obs = p.scores.satisfaction.find((/** @type {any} */ s) => s.label === 'Observe OP');
      const exf = p.scores.satisfaction.find((/** @type {any} */ s) => s.label === 'Exfil E');
      const rv = p.materialisation?.schedule.findLast((/** @type {any} */ s) => s.kind === 'exfil');
      return `<div class="plan-card" data-testid="plan-card-${p.strategy.key}">
        <h4 style="color:${STRAT_COLORS[/** @type {keyof typeof STRAT_COLORS} */ (p.strategy.key)]}">${p.strategy.label}</h4>
        <div class="muted">${p.strategy.blurb}</div>
        ${p.tide_decision ? `<div class="tide-note" data-testid="tide-${p.strategy.key}">≋ ${p.tide_decision.narrative}</div>` : ''}
        <div>observe <span class="band band-${obs?.margin_band ?? 'crossed'}">${obs?.margin_band ?? 'n/a'}${obs ? ` ${obs.margin_min}m` : ''}</span></div>
        <div>exfil ${rv ? `H+${rv.end_min} ` : ''}<span class="band band-${exf?.margin_band ?? 'crossed'}">${exf?.margin_band ?? 'n/a'}${exf ? ` ${exf.margin_min}m` : ''}</span>
             <span class="band band-${p.scores.cost_band}">cost ${p.scores.cost_band}</span></div>
        <div class="muted">id <code class="hash">${shortId(p.id)}</code> = hash(stamp ⊕ strategy)</div>
      </div>`;
    }).join('');

    renderProjection();
    advance('plan');
  });
}

// --- boot ----------------------------------------------------------------------
mountWorld();           // World is the first stage now (provision the AO, then Capture)
renderRail();
showStage('world');
refreshChips();

// Base-path-safe links back to the landing page / blog (works at /app/ and
// /pr-preview/pr-N/ alike).
const root = location.pathname.replace(/(?:app|pr-preview\/pr-\d+)\/(?:index\.html)?$/, '');
/** @type {HTMLAnchorElement} */ (document.getElementById('nav-landing')).href = root;
/** @type {HTMLAnchorElement} */ (document.getElementById('nav-blog')).href = root + 'blog/';
