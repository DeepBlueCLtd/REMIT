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

const STAGES = [
  { key: 'capture', n: 1, label: 'Capture', hat: 'command' },
  { key: 'world',   n: 2, label: 'World',   hat: 'provision' },
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
  stage: 'capture',
  unlocked: new Set(['capture']),
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
const timelineHost = /** @type {HTMLElement} */ (document.getElementById('timeline-host'));
const timeline = makeTimeline(timelineHost, playhead);
const slider = /** @type {HTMLInputElement} */ (document.getElementById('playhead-slider'));
const readout = /** @type {HTMLElement} */ (document.getElementById('projection-readout'));

let worldProvisioned = false;
let execActual = null; // during playback: kernel-evaluated actual state

function renderProjection() {
  if (!worldProvisioned) return;
  const sel = state.selectedPlan;
  map.render({
    plans: state.handful, selected: sel, t: playhead.t, actual: execActual,
    target: mapTarget,
  });
  const ghost = execActual ?? (sel ? stateAt(sel, playhead.t) : null);
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
        <td>${m.to_arrival_min > 0 ? `OP in ${Math.round(m.to_arrival_min)} min` : `dwell ${Math.round(m.dwell_min)} min`}</td>
        <td>fuel ${m.fuel_pct}%</td>
      </tr>`;
    }).join('');
    readout.innerHTML =
      `<table class="cmp-live" data-testid="cmp-live"><tbody>${rows}</tbody></table>`
      + `<div class="muted cmp-live-caption">candidates at <b>H+${Math.round(playhead.t)}</b> — kernel evaluator, NF1</div>`;
  } else {
    readout.innerHTML = `<span class="muted">terrain provisioned — awaiting a plan</span>`;
  }
}

playhead.on((t) => {
  slider.value = String(t);
  renderProjection();
});
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
  document.getElementById('chips').innerHTML =
    chip('req', state.ids.requirement) + chip('baseline', state.ids.baseline)
    + chip('config-core', state.configCoreHash) + chip('stamp', state.ids.stamp)
    + (state.selectedPlan ? chip('plan', state.selectedPlan.id) : '');
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
  if (key === 'plan') mountPlan();
  if (key === 'compare') {
    mountCompare(panel('compare'), {
      seam, handful: state.handful, commitment: state.requirement.commitments[0],
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
    mountWingman(panel('execute'), {
      seam, missionId: MISSION_ID, plan: state.selectedPlan,
      commitment: state.requirement.commitments[0], bandUnit: state.bandUnit,
      playhead,
      resetLog: () => logs.reset(MISSION_ID),
      renderViews({ actual }) { execActual = actual; renderProjection(); },
      onComplete(summary) {
        state.execSummary = summary;
        advance('execute');
      },
    });
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
  }
}

function mountWorld() {
  const el = panel('world');
  el.innerHTML = `
    <p class="stage-intro">A single synthetic baseline — one <code>mobility</code> channel on a
    ${world.baseline.medium.grid.w}×${world.baseline.medium.grid.h} static grid — plus the own-force
    profile, provisioned as immutable, content-addressed objects. The world-defining
    <em>config core</em> canonicalises and hashes; that hash becomes a stamp axis (DEC-48).</p>
    <ul class="fact-list">
      <li>AO: <b>${world.baseline.name}</b> · land · ${world.baseline.medium.grid.cell_m} m cells</li>
      <li>Channel: <b>mobility</b> (raster · confidence high · static) → band unit <b>${state.bandUnit} min</b> (NF10: derived from confidence)</li>
      <li>Own force: <b>${world.profile.name}</b> · ${world.profile.speed_by_medium.land_kph} km/h · start ${PLACES.base.name} (${world.state.position.x},${world.state.position.y})</li>
      <li>Instance shell (branding/view defaults) stays out of the hash — identity-free (DEC-48)</li>
    </ul>
    <div class="row">
      <button id="world-provision" class="primary" data-testid="world-provision">Provision AO package</button>
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
    const t = state.requirement.commitments[0].activity.where;
    mapTarget = t;
    state.horizonMin = state.requirement.commitments[0].activity.when.window.end_min + 60;
    slider.max = String(state.horizonMin);
    renderProjection();
    el.querySelectorAll('button').forEach((n) => (n.disabled = true));
    /** @type {HTMLElement} */ (el.querySelector('#world-result')).innerHTML =
      `provisioned · baseline <code class="hash" data-testid="world-baseid">${shortId(b.id)}</code>`
      + ` · config-core hash <code class="hash">${shortId(state.configCoreHash)}</code>`;
    advance('world');
  });
}

function mountPlan() {
  const el = panel('plan');
  el.innerHTML = `
    <p class="stage-intro">One stamped kernel call fans out the strategy axes and returns
    <em>a</em> handful — banded, distinct, reproducible (DEC-22/40-C). The mock kernel is an
    honest non-planner: real A* paths, illustrative scores (NF9).</p>
    <div class="form-grid">
      <label>Appetite · tempo
        <select id="plan-tempo"><option>deliberate</option><option selected>balanced</option><option>rapid</option></select>
      </label>
      <label>Appetite · exposure
        <select id="plan-exposure"><option>bold</option><option selected>balanced</option><option>cautious</option></select>
      </label>
      <label>strategy_seed <input value="${STRATEGY_SEED}" disabled></label>
      <label>kernel <input value="${KERNEL_VERSION}" disabled></label>
    </div>
    <div class="row">
      <button id="plan-run" class="primary" data-testid="plan-run">Request handful — POST /plan/handful</button>
      <span id="plan-result" class="result"></span>
    </div>
    <div id="plan-cards" class="plan-cards"></div>`;

  el.querySelector('#plan-run')?.addEventListener('click', async () => {
    state.appetites = {
      tempo: /** @type {HTMLSelectElement} */ (el.querySelector('#plan-tempo')).value,
      exposure: /** @type {HTMLSelectElement} */ (el.querySelector('#plan-exposure')).value,
    };
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
      `${res.plans.length} plans · stamp <code class="hash" data-testid="plan-stampid">${shortId(stampPut.id)}</code> committed`;

    const cards = /** @type {HTMLElement} */ (el.querySelector('#plan-cards'));
    cards.innerHTML = state.handful.map((p) => {
      const sat = p.scores.satisfaction[0];
      const arr = p.materialisation ? `H+${p.materialisation.schedule[0].end_min}` : '∅';
      return `<div class="plan-card" data-testid="plan-card-${p.strategy.key}">
        <h4 style="color:${({ direct: '#f0b429', tracked: '#4493f8', covered: '#38d39f' })[p.strategy.key]}">${p.strategy.label}</h4>
        <div class="muted">${p.strategy.blurb}</div>
        <div>arrival <b>${arr}</b> · margin <b>${sat.margin_min} min</b></div>
        <div><span class="band band-${sat.margin_band}">${sat.margin_band}</span>
             <span class="band band-${p.scores.cost_band}">cost ${p.scores.cost_band}</span></div>
        <div class="muted">plan id <code class="hash">${shortId(p.id)}</code> = hash(stamp ⊕ strategy)</div>
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
mountCapture(panel('capture'), {
  seam,
  onCommitted(requirement, id) {
    state.requirement = requirement;
    state.ids.requirement = id;
    advance('capture');
  },
});
renderRail();
showStage('capture');
refreshChips();

// Base-path-safe links back to the landing page / blog (works at /app/ and
// /pr-preview/pr-N/ alike).
const root = location.pathname.replace(/(?:app|pr-preview\/pr-\d+)\/(?:index\.html)?$/, '');
/** @type {HTMLAnchorElement} */ (document.getElementById('nav-landing')).href = root;
/** @type {HTMLAnchorElement} */ (document.getElementById('nav-blog')).href = root + 'blog/';
