// @ts-check
// orbat/orbat.js — the ORBAT model (DEC-60): a pure, deterministic module over the
// LinkML-generated Orbat/Asset shapes (schema/gen/remit.ts). It is the ONLY writer of
// the authored roster; the panel and the map read through it. Every operation returns a
// NEW draft (no in-place mutation), so identity stays stable and rendering reproducible
// (NF3). Display-only in v1 (NF9 honest floor): nothing here derives adversary behaviour
// or mutates a plan — blue availability/capabilities do not feed routing.
//
// The serialisable shapes are schema-defined and imported (Principle I); the asset→Entity
// adapter (assetToEntity) and the live-draft store below are the documented behaviour/UI
// carve-out and stay hand-written.

import { canonicalJSON, contentId } from '../shapes/canonical.js';

/** @typedef {import('../../../schema/gen/remit').Orbat} Orbat */
/** @typedef {import('../../../schema/gen/remit').Asset} Asset */
/** @typedef {import('../../../schema/gen/remit').BlueParams} BlueParams */
/** @typedef {import('../../../schema/gen/remit').RedParams} RedParams */
/** @typedef {import('../../../schema/gen/remit').GreenParams} GreenParams */
/** @typedef {import('../entities/entities.js').Entity} Entity */

/** localStorage key for the working draft (per mission). */
export const DRAFT_KEY = 'remit.orbat.M-001';

/** Stable id of the single canonical own-force asset (reconciled from ROVER-1). */
export const OWN_FORCE_ID = 'own-force';

/** The three allegiances (DEC-60). */
export const ALLEGIANCES = /** @type {const} */ (['blue', 'red', 'green']);

/** Allegiance display palette (mirrored in docs/project_notes/key_facts.md). */
export const ALLEGIANCE_COLOR = { blue: '#4493f8', red: '#ff7b72', green: '#38d39f' };

/** Tunable numeric bounds — clamped on add/tune (FR-004). */
export const BOUNDS = {
  extent_m: /** @type {[number, number]} */ ([100, 20000]),
  severity: /** @type {[number, number]} */ ([1, 5]),
  sensitivity: /** @type {[number, number]} */ ([1, 5]),
};

/** Allowed green protection rules (the Protection enum). */
export const PROTECTIONS = /** @type {const} */ (['keep_out', 'minimise_effect']);

/** Default extent (metres) per allegiance. */
const DEFAULT_EXTENT = { blue: 800, red: 1500, green: 1000 };

/** @param {number} v @param {[number, number]} bounds */
const clamp = (v, [lo, hi]) => Math.min(hi, Math.max(lo, v));

/** @param {number} v @param {[number, number]} bounds */
const clampInt = (v, bounds) => Math.round(clamp(v, bounds));

/** Default per-allegiance parameter group.
 *  @param {'blue'|'red'|'green'} allegiance */
function defaultParams(allegiance) {
  if (allegiance === 'blue') return { blue: { availability: 'available', capabilities: [] } };
  if (allegiance === 'red') return { red: { severity: 3, active_windows: [] } };
  return { green: { sensitivity: 3, protection: 'keep_out' } };
}

/** Default human label for a new asset of an allegiance.
 *  @param {'blue'|'red'|'green'} allegiance @param {string} id */
function defaultLabel(allegiance, id) {
  const n = id.replace(/^asset-/, '#');
  return { blue: `Own asset ${n}`, red: `Threat ${n}`, green: `Protected place ${n}` }[allegiance];
}

/** A fresh, deterministic, unique id within this orbat (asset-<n>, n = max+1).
 *  Deterministic (no time/random) so equal authoring ⇒ equal bytes (NF3).
 *  @param {Orbat} orbat */
function nextId(orbat) {
  let max = 0;
  for (const a of orbat.assets ?? []) {
    const m = /^asset-(\d+)$/.exec(a.id);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `asset-${max + 1}`;
}

/** A fresh empty ORBAT (version 1, no assets).
 *  @param {string} name @returns {Orbat} */
export function emptyOrbat(name = 'Scenario ORBAT') {
  return { id: '', name, version: 1, assets: [], lineage: {} };
}

/** Shallow-replace one asset by id, leaving the others byte-identical (FR-002/SC-003).
 *  @param {Orbat} orbat @param {string} id @param {(a: Asset) => Asset} fn @returns {Orbat} */
function replaceAsset(orbat, id, fn) {
  return { ...orbat, assets: (orbat.assets ?? []).map((a) => (a.id === id ? fn(a) : a)) };
}

/**
 * Add a default asset of an allegiance at `position`, with a fresh unique id.
 * Rejects an out-of-AO position when an `inAO` predicate is supplied (FR-001/003).
 * @param {Orbat} orbat
 * @param {{ allegiance: 'blue'|'red'|'green', position?: any, label?: string }} seed
 * @param {{ inAO?: (pos: any) => boolean }} [opts]
 * @returns {{ orbat: Orbat, id: string }}
 */
export function addAsset(orbat, { allegiance, position, label }, opts = {}) {
  if (!ALLEGIANCES.includes(allegiance)) throw new Error(`unknown allegiance: ${allegiance}`);
  if (position && opts.inAO && !opts.inAO(position)) throw new Error('position is outside the AO');
  const id = nextId(orbat);
  /** @type {Asset} */
  const asset = {
    id, allegiance, label: label ?? defaultLabel(allegiance, id),
    position: position ?? undefined, extent_m: DEFAULT_EXTENT[allegiance],
    ...defaultParams(allegiance),
  };
  return { orbat: { ...orbat, assets: [...(orbat.assets ?? []), asset] }, id };
}

/**
 * Duplicate an asset: a deep, independent copy under a NEW id; never copies the
 * canonical-own-force flag; the source is unchanged (FR-002/006).
 * @param {Orbat} orbat @param {string} id @returns {{ orbat: Orbat, id: string }}
 */
export function duplicateAsset(orbat, id) {
  const src = (orbat.assets ?? []).find((a) => a.id === id);
  if (!src) throw new Error(`no such asset: ${id}`);
  const newId = nextId(orbat);
  const copy = structuredClone(src);
  copy.id = newId;
  delete copy.canonical_own_force;            // a duplicate is never the canonical own force
  copy.label = `${src.label ?? 'Asset'} (copy)`;
  return { orbat: { ...orbat, assets: [...(orbat.assets ?? []), copy] }, id: newId };
}

/**
 * Apply `patch` to ONLY the targeted asset, clamping/validating its bounds (FR-004).
 * Other assets stay byte-identical (SC-003). Returns a new draft.
 * @param {Orbat} orbat @param {string} id @param {Partial<Asset>} patch
 * @param {{ inAO?: (pos: any) => boolean }} [opts]
 * @returns {Orbat}
 */
export function tuneAsset(orbat, id, patch, opts = {}) {
  return replaceAsset(orbat, id, (a) => {
    const next = structuredClone(a);
    if (patch.label !== undefined) next.label = String(patch.label);
    if (patch.position !== undefined) {
      if (opts.inAO && !opts.inAO(patch.position)) throw new Error('position is outside the AO');
      next.position = patch.position;
    }
    if (patch.extent_m !== undefined) next.extent_m = clamp(Number(patch.extent_m), BOUNDS.extent_m);
    if (patch.red && next.allegiance === 'red') {
      next.red = { ...next.red };
      if (patch.red.severity !== undefined) next.red.severity = clampInt(Number(patch.red.severity), BOUNDS.severity);
      if (patch.red.active_windows !== undefined) next.red.active_windows = sanitizeWindows(patch.red.active_windows);
    }
    if (patch.green && next.allegiance === 'green') {
      next.green = { ...next.green };
      if (patch.green.sensitivity !== undefined) next.green.sensitivity = clampInt(Number(patch.green.sensitivity), BOUNDS.sensitivity);
      if (patch.green.protection !== undefined && PROTECTIONS.includes(/** @type {any} */ (patch.green.protection)))
        next.green.protection = patch.green.protection;
    }
    if (patch.blue && next.allegiance === 'blue') {
      next.blue = { ...next.blue };
      if (patch.blue.availability !== undefined) next.blue.availability = String(patch.blue.availability);
      if (patch.blue.capabilities !== undefined)
        next.blue.capabilities = (patch.blue.capabilities ?? []).map(String).filter(Boolean);
      if ('availability_window' in patch.blue) {
        const w = /** @type {any} */ (patch.blue).availability_window;
        if (w && w.start_min != null && w.end_min != null) {
          const s = Math.round(Number(w.start_min)), e = Math.round(Number(w.end_min));
          /** @type {any} */ (next.blue).availability_window = { start_min: Math.min(s, e), end_min: Math.max(s, e) };
        } else {
          delete (/** @type {any} */ (next.blue).availability_window);
        }
      }
    }
    return next;
  });
}

/** Clamp a list of time windows to start ≤ end, dropping malformed entries (FR-004).
 *  @param {any[]} windows */
function sanitizeWindows(windows) {
  return (windows ?? [])
    .map((w) => ({ start_min: Math.round(Number(w.start_min)), end_min: Math.round(Number(w.end_min)) }))
    .filter((w) => Number.isFinite(w.start_min) && Number.isFinite(w.end_min))
    .map((w) => (w.start_min <= w.end_min ? w : { start_min: w.end_min, end_min: w.start_min }));
}

/**
 * Remove an asset. The canonical own-force asset is PROTECTED — removal is refused
 * so the plan stays valid (FR-012). Remaining assets are unaffected (FR-006).
 * @param {Orbat} orbat @param {string} id @returns {Orbat}
 */
export function removeAsset(orbat, id) {
  const target = (orbat.assets ?? []).find((a) => a.id === id);
  if (target?.canonical_own_force) throw new Error('the canonical own-force asset is protected from removal');
  return { ...orbat, assets: (orbat.assets ?? []).filter((a) => a.id !== id) };
}

/**
 * Surface the existing planned own-force (ROVER-1) as the single canonical blue asset.
 * Idempotent: re-running updates the canonical asset in place and guarantees exactly one
 * `canonical_own_force = true` (FR-012). The asset is reconciled, never duplicated — the
 * plan keeps driving from the pre-existing machinery.
 * @param {Orbat} orbat
 * @param {{ label?: string, position?: any }} self  the planned own-force entity/place
 * @returns {Orbat}
 */
export function reconcileOwnForce(orbat, self) {
  const assets = (orbat.assets ?? []).map((a) => {
    // Strip any stray canonical flag from non-canonical rows (exactly one survives).
    if (a.canonical_own_force && a.id !== OWN_FORCE_ID) {
      const { canonical_own_force, ...rest } = a;
      return /** @type {Asset} */ (rest);
    }
    return a;
  });
  /** @type {Asset} */
  const canonical = {
    id: OWN_FORCE_ID, allegiance: 'blue', canonical_own_force: true,
    label: self?.label ?? 'Own force · ROVER-1',
    position: self?.position ?? undefined, extent_m: DEFAULT_EXTENT.blue,
    blue: { availability: 'available', capabilities: ['recce'] },
  };
  const i = assets.findIndex((a) => a.id === OWN_FORCE_ID);
  if (i >= 0) {
    // Preserve any operator tuning of the pool params; refresh identity/position.
    const existing = assets[i];
    assets[i] = { ...canonical, blue: existing.blue ?? canonical.blue, extent_m: existing.extent_m ?? canonical.extent_m };
  } else {
    assets.unshift(canonical);
  }
  return { ...orbat, assets };
}

/**
 * Validate one asset: allegiance ∈ {blue,red,green}, the matching param group present,
 * bounds in range, window start ≤ end, and (when `inAO` is supplied) position in the AO.
 * @param {Asset} asset @param {{ inAO?: (pos: any) => boolean }} [opts]
 * @returns {{ ok: boolean, issues: string[] }}
 */
export function validate(asset, opts = {}) {
  const issues = [];
  if (!ALLEGIANCES.includes(/** @type {any} */ (asset.allegiance)))
    issues.push(`allegiance must be one of ${ALLEGIANCES.join('/')}`);
  else if (!asset[/** @type {'blue'|'red'|'green'} */ (asset.allegiance)])
    issues.push(`${asset.allegiance} asset is missing its ${asset.allegiance} parameter group`);
  if (asset.extent_m !== undefined && (asset.extent_m < BOUNDS.extent_m[0] || asset.extent_m > BOUNDS.extent_m[1]))
    issues.push(`extent_m out of bounds ${BOUNDS.extent_m.join('..')}`);
  if (asset.red?.severity !== undefined && (asset.red.severity < BOUNDS.severity[0] || asset.red.severity > BOUNDS.severity[1]))
    issues.push(`severity out of bounds ${BOUNDS.severity.join('..')}`);
  if (asset.green?.sensitivity !== undefined && (asset.green.sensitivity < BOUNDS.sensitivity[0] || asset.green.sensitivity > BOUNDS.sensitivity[1]))
    issues.push(`sensitivity out of bounds ${BOUNDS.sensitivity.join('..')}`);
  for (const w of asset.red?.active_windows ?? [])
    if (Number(w.start_min) > Number(w.end_min)) issues.push('active window start_min must be ≤ end_min');
  if (asset.position && opts.inAO && !opts.inAO(asset.position)) issues.push('position is outside the AO');
  return { ok: issues.length === 0, issues };
}

/**
 * Canonical serialisation: assets sorted by id, canonical JSON (DEC-35). The persistence
 * & identity form — equal rosters ⇒ equal bytes ⇒ equal content id (NF3). The transient
 * `id` field (a content id, derived) is excluded so identity keys off content only.
 * @param {Orbat} orbat @returns {string}
 */
export function canonical(orbat) {
  return canonicalJSON(canonicalForm(orbat));
}

/** The hashed/persisted body: id-free, assets sorted by id. @param {Orbat} orbat */
function canonicalForm(orbat) {
  const assets = [...(orbat.assets ?? [])].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return { name: orbat.name, version: orbat.version, assets, lineage: orbat.lineage ?? {} };
}

/**
 * Commit an immutable, content-addressed Orbat version into the shared ObjectStore, with
 * `lineage.previous_version` → the prior committed id (Principle V; idempotent re-PUT,
 * DEC-35). Identity is the store's content id over the canonical body.
 * @param {Orbat} orbat
 * @param {import('../stores/stores.js').ObjectStore} objects
 * @returns {Promise<{ id: string, existed: boolean }>}
 */
export async function commit(orbat, objects) {
  return objects.put('Orbat', canonicalForm(orbat));
}

// --- persistence (localStorage draft) -------------------------------------------
// Guarded so the pure model stays usable under `node --test` (no localStorage there).

const hasStorage = () => typeof localStorage !== 'undefined';

/** Mirror the draft to localStorage as canonical JSON (every mutating op, SC-004).
 *  @param {Orbat} orbat */
export function saveDraft(orbat) {
  if (hasStorage()) {
    try { localStorage.setItem(DRAFT_KEY, canonical(orbat)); } catch { /* quota/private mode — ignore */ }
  }
}

/** Restore the draft (or a fresh empty ORBAT when none is stored). @returns {Orbat} */
export function loadDraft() {
  if (hasStorage()) {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) return /** @type {Orbat} */ ({ id: '', ...JSON.parse(raw) });
    } catch { /* corrupt — fall through to empty */ }
  }
  return emptyOrbat();
}

// --- live draft store (same-page surfaces share one draft) ----------------------
// The Overview map (main.js) and the ORBAT panel (orbat-panel.js) run in the same realm
// (role tabs), so they share this single live draft and a tiny subscription, rather than
// round-tripping through localStorage on every keystroke.

/** @type {Orbat | null} */ let _draft = null;
/** @type {Set<(o: Orbat) => void>} */ const _subs = new Set();

/** Current live draft (lazily loaded from storage on first read). @returns {Orbat} */
export function getDraft() {
  if (!_draft) _draft = loadDraft();
  return _draft;
}

/** Replace the live draft, persist it, and notify subscribers. The single writer used by
 *  the panel after each op and by main.js after reconciliation. @param {Orbat} orbat */
export function setDraft(orbat) {
  _draft = orbat;
  saveDraft(orbat);
  for (const fn of _subs) fn(orbat);
  return orbat;
}

/** Subscribe to live-draft changes; returns an unsubscribe fn. @param {(o: Orbat) => void} fn */
export function subscribeDraft(fn) {
  _subs.add(fn);
  return () => _subs.delete(fn);
}

// --- display adapter (hand-written carve-out) -----------------------------------

/**
 * Map an Asset → the buildEntities()-shaped Entity for the Sync Matrix (display-only).
 * Allegiance-typed; `provenance.kind` = `self` for the canonical own-force, else `actor`.
 * Any asset with a time-varying aspect (red `active_windows`, a blue availability window)
 * exposes a `window`-type aspect (reusing the satellite-pass render path) so it appears as
 * a Sync-Matrix track. Contains NO kernel reference and alters no plan (NF9).
 * @param {Asset} asset @returns {Entity & { allegiance: string, position?: any, asset: Asset }}
 */
export function assetToEntity(asset) {
  const windows = activeWindowsOf(asset);
  /** @type {Record<string, any>} */
  const aspects = {};
  if (windows.length) {
    aspects.active = {
      type: 'window',
      at: (/** @type {any} */ _plan, /** @type {number} */ t) => windows.some((w) => t >= w.start && t <= w.end),
      windows: (/** @type {number} */ h) => windows
        .filter((w) => w.end >= 0 && w.start <= h)
        .map((w) => ({ start: Math.max(0, w.start), end: Math.min(h, w.end), center: (w.start + w.end) / 2 })),
    };
  }
  return {
    id: `ent-${asset.id}`,
    label: asset.label ?? asset.id,
    allegiance: asset.allegiance,
    provenance: { kind: asset.canonical_own_force ? 'self' : 'actor' },
    position: asset.position,
    asset,
    aspects,
  };
}

/** The time windows an asset is "active": red active_windows, or a blue availability
 *  window if one is authored. Display-only timing (NF9). @param {Asset} asset */
function activeWindowsOf(asset) {
  if (asset.allegiance === 'red')
    return (asset.red?.active_windows ?? []).map((w) => ({ start: Number(w.start_min), end: Number(w.end_min) }));
  if (asset.allegiance === 'blue') {
    const w = /** @type {any} */ (asset.blue)?.availability_window;
    if (w && w.start_min != null && w.end_min != null) return [{ start: Number(w.start_min), end: Number(w.end_min) }];
  }
  return [];
}

/** Does an asset project a Sync-Matrix track (i.e. carry a time-varying aspect)?
 *  @param {Asset} asset */
export function hasTrack(asset) {
  return activeWindowsOf(asset).length > 0;
}
