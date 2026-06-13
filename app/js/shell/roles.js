// @ts-check
// shell/roles.js — config-declared role bundles (DEC-61 seed).
//
// Each tab is a role: {id, label, status, poppable, mount}. This is the
// simplest read-only form of DEC-61's "config-declared bundle
// {view-preset + write-scope + mode}". When stamped-delta writes land, add
// {writeScope, mode} here and a delta path in the surface; for now every
// surface is a read-only projection (NF1).
//
// UI-only discrete config — exempt from the LinkML source-of-truth rule
// (ADR-0012 §2). `mount` is called once, on first activation, with the tab's
// view container and the shared context {objects, logs, seam, world, playhead}.

/**
 * @typedef {Object} RoleTab
 * @property {string} id        kebab id; also the location.hash token (#tab=<id>)
 * @property {string} label     human label on the tab
 * @property {'active'|'stub'} status  'stub' renders a built-in "coming soon" pane
 * @property {boolean} [poppable]      may open in its own window (monitor mode)
 * @property {(container: HTMLElement, ctx: any) => (void | Promise<void>)} [mount]
 */

/** @returns {RoleTab[]} */
export function roles() {
  return [
    { id: 'overview', label: 'Overview', status: 'active', poppable: false,
      mount: (c) => import('./overview.js').then((m) => m.mountOverview(c)) },
    { id: 'co', label: 'CO', status: 'stub' },
    { id: 'duty-plans', label: 'Duty Officer (Plans)', status: 'stub' },
    { id: 'sme-env', label: 'SME Env', status: 'stub' },
    { id: 'sme-int', label: 'SME Int', status: 'active', poppable: false,
      mount: (c, ctx) => import('./orbat-panel.js').then((m) => m.mountOrbatPanel(c, ctx)) },
    { id: 'duty-ops', label: 'Duty Office (Ops)', status: 'stub' },
    { id: 'data-analysis', label: 'Data Analysis', status: 'active', poppable: true,
      mount: (c, ctx) => import('../analysis/data-analysis.js').then((m) => m.mountDataAnalysis(c, ctx)) },
  ];
}

/** A short blurb for each stub role's placeholder pane (the role vision). */
export const STUB_BLURB = {
  co: 'Commanding Officer — End-State and Scheme-of-Manoeuvre selection (DEC-59).',
  'duty-plans': 'Duty Officer (Plans) — requirement and plan lifecycle transitions.',
  'sme-env': 'SME (Environment) — channel/forecast writes: tide, mobility, weather.',
  'sme-int': 'SME (Intel) — red/green entities and threat, via a bespoke intel stream.',
  'duty-ops': 'Duty Office (Ops) — execution observations and the live wingman loop.',
};
