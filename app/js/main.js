// @ts-check
// main.js — orchestration: the seven-stage lap (capture → … → learn), the
// persistent projection surface (map + timeline + shared playhead), stage
// gating, and the two transparency drawers (object store, seam traffic).

import { ObjectStore, LogStore } from './stores/stores.js';
import { createSeamServer, SeamClient } from './seam/seam.js';
import { buildWorld, bandUnitFor, PLACES } from './kernel/world.js';
import { planHandful, stateAt, measuresAt, KERNEL_VERSION } from './kernel/kernel.js';
import { mountCapture } from './capture/capture.js';
import { mountCompare } from './compare/compare.js';
import { mountWingman } from './wingman/wingman.js';
import { mountLearn } from './learn/learn.js';
import { Playhead, makeMap, makeTimeline, STRAT_COLORS } from './views/render.js';
import { contentId, shortId } from './shapes/canonical.js';

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
  { key: 'views',   n: 5, label: 'Views',   hat: 'all hats' },
  { key: 'execute', n: 6, label: 'Execute', hat: 'operator' },
  { key: 'learn',   n: 7, label: 'Learn',   hat: 'all hats' },
];

// --- infrastructure -------------------------------------------------------
const objects = new ObjectStore();
const logs = new LogStore();
const seam = new SeamClient(createSeamServer({ objects, logs, planHandful }));
const world = buildWorld();
const playhead = new Playhead();

/** Mission state accumulated along the lap. */
const state = {
  stage: 'world',
  unlocked: new Set(['world']),
  done: new Set(),
  requirement: /** @type {any} */ (null),
  ids: { requirement: '', baseline: '', profile: '', configCore: '', stamp: '', rationale: '' },
  configCoreHash: '',
  bandUnit: bandUnitFor(world.baseline.channels[0]),
  appetites: { tempo: 'balanced', exposure: 'balanced' },
  handful: /** @type {any[]} */ ([]),
  selectedPlan: /** @type {any} */ (null),
  execSummary: /** @type {any} */ (null),
  horizonMin: 180,
  lastPlanRequest: /** @type {any} */ (null),
  nextHint: /** @type {string|null} */ (null),
};

// Debug/test handle (read-only use; not part of any contract).
/** @type {any} */ (window).__remit = { state, playhead, seam, objects };

// --- projection surface (map + timeline + playhead) ------------------------
const mapCanvas = /** @type {HTMLCanvasElement} */ (document.getElementById('map'));
const map = makeMap(mapCanvas, world.baseline, null);
let mapTarget = null;
let mapRv = null;
let mapCandidates = null;   // candidate OPs shown on the map during Capture
let mapHighlight = null;    // the OP currently picked in Capture (live)
const timelineHost = /** @type {HTMLElement} */ (document.getElementById('timeline-host'));
const timeline = makeTimeline(timelineHost, playhead);
const slider = /** @type {HTMLInputElement} */ (document.getElementById('playhead-slider'));
const readout = /** @type {HTMLElement} */ (document.getElementById('projection-readout'));

let worldProvisioned = false;
/** Set by the wingman while mounted; lets a slider grab pause live playback. */
let pausePlayback = null;

function renderProjection() {
  if (!worldProvisioned) return;
  const sel = state.selectedPlan;
  // The playhead is the single authority for "what time we're viewing": the map
  // ghost is the kernel's evaluator at that time (NF1). During execution the
  // wingman advances the playhead; the user can also scrub it to review.
  map.render({
    plans: state.handful, selected: sel, t: playhead.t,
    target: mapTarget, rv: mapRv,
    candidates: mapCandidates, highlight: mapHighlight,
  });
  const ghost = sel ? stateAt(sel, playhead.t) : null;
  if (sel && ghost) {
    readout.innerHTML =
      `t <b>H+${Math.round(playhead.t)}</b> · cell <b>${Math.round(ghost.x)},${Math.round(ghost.y)}</b>`
      + ` · phase <b>${ghost.phase}</b> · fuel <b>${ghost.fuel_pct ?? '—'}%</b>`
      + ` <span class="muted">— projected via the kernel's evaluator (NF1)</span>`;
  } else if (state.handful.length) {
    // Compare mode: live per-candidate measures at the playhead, all from the
    // kernel's evaluator (NF1) — scrub to race the ghosts.
    const rows = state.handful.map((p) => {
      const m = measuresAt(p, playhead.t);
      const c = STRAT_COLORS[p.strategy.key] ?? '#e6edf3';
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
      + `<div class="muted cmp-live-caption">COAs at <b>H+${Math.round(playhead.t)}</b> — kernel evaluator, NF1</div>`;
  } else {
    readout.innerHTML = `<span class="muted">terrain provisioned — awaiting a plan</span>`;
  }
}

playhead.on((t) => {
  slider.value = String(t);
  renderProjection();
});
slider.addEventListener('pointerdown', () => pausePlayback?.());  // grabbing the scrubber pauses live play
slider.addEventListener('input', () => playhead.set(Number(slider.value)));

// --- drawers ---------------------------------------------------------------
const storeList = /** @type {HTMLElement} */ (document.getElementById('store-list'));
const trafficList = /** @type {HTMLElement} */ (document.getElementById('seam-list'));
function refreshDrawers() {
  const objs = objects.list();
  storeList.innerHTML = objs.length
    ? objs.map((o) => `<li><code class="hash">${shortId(o.id)}</code> <b>${o.type}</b> <span class="muted">${o.bytes} B canonical</span></li>`).join('')
    : '<li class="muted">empty — nothing committed yet</li>';
  document.getElementById('store-count').textContent = String(objs.length);
}
seam.onTraffic((traffic) => {
  trafficList.innerHTML = traffic.slice(-14).map((t) =>
    `<li><span class="muted">#${t.n}</span> <b>${t.method}</b> ${t.path} <span class="muted">${t.note}</span></li>`).join('');
  document.getElementById('seam-count').textContent = String(traffic.length);
  refreshDrawers();
});
refreshDrawers();

// --- hash chips -------------------------------------------------------------
function chip(label, id) {
  return id ? `<span class="idchip">${label} <code class="hash">${shortId(id)}</code></span>` : '';
}
function refreshChips() {
  const ids = [
    ['req', state.ids.requirement], ['baseline', state.ids.baseline],
    ['config-core', state.configCoreHash], ['stamp', state.ids.stamp],
    ['plan', state.selectedPlan ? state.selectedPlan.id : ''],
  ];
  document.getElementById('chips').innerHTML =
    ids.map(([label, id]) => chip(label, id)).join('') || '<span class="muted">nothing committed yet</span>';
  document.getElementById('chips-count').textContent = String(ids.filter(([, id]) => id).length);
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
    b.addEventListener('click', () => showStage(/** @type {HTMLElement} */ (b).dataset.stage)));
}

function showStage(key) {
  if (!state.unlocked.has(key)) return;
  state.stage = key;
  if (state.nextHint === key) state.nextHint = null;
  document.querySelectorAll('.stage-panel').forEach((p) =>
    p.classList.toggle('active', /** @type {HTMLElement} */ (p).dataset.panel === key));
  renderRail();
}

/** Surface a failure in the banner — nothing fails silently. */
function showFault(msg) {
  /** @type {any} */ (window).__remitFault?.(msg);
}

/**
 * Mark a stage done and unlock + mount the next — without leaving the current
 * panel, so the committing act's result stays on screen. An explicit
 * “Continue →” button lands in the completed panel (the rail pulse alone
 * proved too subtle), and it is injected *before* the next stage mounts so a
 * mount failure can never strand the user without a path or an error.
 */
function advance(fromKey) {
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
      showFault(`mounting ${next.label}: ${err?.message ?? err}`);
      console.error(err);
    }
  }
  renderRail();
  refreshChips();
}

const panel = (key) => /** @type {HTMLElement} */ (document.querySelector(`[data-panel="${key}"] .panel-body`));

// --- stage mounting -----------------------------------------------------------
function mountStage(key) {
  if (key === 'world') mountWorld();
  if (key === 'capture') mountCaptureStage();
  if (key === 'plan') mountPlan();
  if (key === 'compare') {
    mountCompare(panel('compare'), {
      seam, handful: state.handful, commitments: state.requirement.commitments,
      onSelected(planId, _rationale, rationaleId) {
        state.selectedPlan = state.handful.find((p) => p.id === planId);
        state.ids.rationale = rationaleId;
        renderTimeline();
        renderProjection();
        advance('compare');
      },
    });
  }
  if (key === 'views') mountViews();
  if (key === 'execute') {
    const wm = mountWingman(panel('execute'), {
      seam, missionId: MISSION_ID, plan: state.selectedPlan,
      commitment: state.requirement.commitments[0],
      exfilCommitment: state.requirement.commitments[1],
      bandUnit: state.bandUnit,
      playhead,
      resetLog: () => logs.reset(MISSION_ID),
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
      appetites: state.appetites, strategySeed: STRATEGY_SEED,
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
      <li>Area of operations: <b>${world.baseline.name}</b> · land · ${world.baseline.medium.grid.cell_m} m cells</li>
      <li>Conditions: <b>mobility</b> map (how fast each cell is to cross) → margin band unit <b>${state.bandUnit} min</b></li>
      <li>Own force: <b>${world.profile.name}</b> · ${world.profile.speed_by_medium.land_kph} km/h · start ${PLACES.base.name} (${world.state.position.x},${world.state.position.y})</li>
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
    // With the AO on the map, show the candidate OPs so Capture can point at
    // features it can see; the chosen target/RV are set when Capture commits.
    mapCandidates = PLACES.ops;
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
    seam,
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

function mountPlan() {
  const el = panel('plan');
  el.innerHTML = `
    <p class="stage-intro">One stamped kernel call fans out the strategy axes and returns
    a set of distinct <b>courses of action (COAs)</b> — banded, reproducible (DEC-22/40-C).
    Each COA routes to the OP, holds the observation, then exfils east across K-7. The
    mock kernel is an honest non-planner: real A* paths, illustrative scores (NF9).
    <em>Next: this is where the operator will add intelligence as spatial/temporal
    constraints (steering, DEC-24) that bend the routes.</em></p>
    <div class="form-grid">
      <label>strategy_seed <input value="${STRATEGY_SEED}" disabled></label>
      <label>kernel <input value="${KERNEL_VERSION}" disabled></label>
    </div>
    <div class="row">
      <button id="plan-run" class="primary" data-testid="plan-run">Generate courses of action — POST /plan/handful</button>
      <span id="plan-result" class="result"></span>
    </div>
    <div id="plan-cards" class="plan-cards"></div>`;

  el.querySelector('#plan-run')?.addEventListener('click', async () => {
    const body = {
      requirement: state.requirement, requirement_version: state.ids.requirement,
      baseline: world.baseline, baseline_version: state.ids.baseline,
      profile: world.profile, profile_version: state.ids.profile,
      state: world.state, config_core: state.configCoreHash,
      appetites: state.appetites, steering: [], strategy_seed: STRATEGY_SEED,
    };
    state.lastPlanRequest = body;
    const res = await seam.planHandful(body);
    state.handful = res.plans;

    // The stamp and each plan are written to the store (DEC-29: stamp is the
    // identity; the materialisation rides as a verified, regenerable cache).
    const stampPut = await seam.putObject('Stamp', res.plans[0].stamp);
    state.ids.stamp = stampPut.id;
    for (const p of res.plans) await seam.putObject('Plan', p);

    el.querySelectorAll('select,button').forEach((n) => /** @type {any} */ (n).disabled = true);
    /** @type {HTMLElement} */ (el.querySelector('#plan-result')).innerHTML =
      `${res.plans.length} COAs · stamp <code class="hash" data-testid="plan-stampid">${shortId(stampPut.id)}</code> committed`;

    const cards = /** @type {HTMLElement} */ (el.querySelector('#plan-cards'));
    cards.innerHTML = state.handful.map((p) => {
      const obs = p.scores.satisfaction.find((s) => s.label === 'Observe OP');
      const exf = p.scores.satisfaction.find((s) => s.label === 'Exfil E');
      const rv = p.materialisation?.schedule.find((s) => s.kind === 'exfil');
      return `<div class="plan-card" data-testid="plan-card-${p.strategy.key}">
        <h4 style="color:${STRAT_COLORS[p.strategy.key]}">${p.strategy.label}</h4>
        <div class="muted">${p.strategy.blurb}</div>
        <div>observe <span class="band band-${obs.margin_band}">${obs.margin_band} ${obs.margin_min}m</span></div>
        <div>exfil ${rv ? `H+${rv.end_min} ` : ''}<span class="band band-${exf?.margin_band ?? 'crossed'}">${exf?.margin_band ?? 'n/a'}${exf ? ` ${exf.margin_min}m` : ''}</span>
             <span class="band band-${p.scores.cost_band}">cost ${p.scores.cost_band}</span></div>
        <div class="muted">id <code class="hash">${shortId(p.id)}</code> = hash(stamp ⊕ strategy)</div>
      </div>`;
    }).join('');

    renderProjection();
    advance('plan');
  });
}

function mountViews() {
  const el = panel('views');
  const sel = state.selectedPlan;
  const legs = sel.materialisation.schedule.map((l) =>
    `<li><b>${l.label}</b> — H+${l.start_min} → H+${l.end_min}</li>`).join('');
  el.innerHTML = `
    <p class="stage-intro">Timeline and map are co-equal projections of the selected plan,
    rendered from the kernel's own materialisation and evaluator — <em>shown = optimised</em>
    (NF1). Scrub the playhead (slider or drag the timeline): the map ghost and the
    timeline cursor move together.</p>
    <ul class="fact-list">${legs}</ul>
    <div class="row">
      <button id="views-continue" class="primary" data-testid="views-continue">Proceed to execution →</button>
    </div>`;
  renderTimeline();
  playhead.set(0);
  renderProjection();
  el.querySelector('#views-continue')?.addEventListener('click', () => {
    advance('views');
    showStage('execute');
  });
}

function renderTimeline() {
  if (!state.selectedPlan) return;
  timeline.render({
    plan: state.selectedPlan,
    commitment: state.requirement.commitments[0],
    horizonMin: state.horizonMin,
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
