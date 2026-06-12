// @ts-check
// shell/context.js — the ONE shared app context.
//
// Every role surface (tab) projects the SAME content-addressed store, seam,
// world and playhead. This is the concrete v1 seed of DEC-61: roles are
// config-declared bundles over one shared store. Extracting these singletons
// out of main.js (they used to live there) lets the Data Analysis surface —
// and any future role surface — read the very same objects the Overview lap
// commits, whether it runs inline or in a popped-out window.

import { ObjectStore, LogStore } from '../stores/stores.js';
import { createSeamServer, SeamClient } from '../seam/seam.js';
import { buildWorld } from '../kernel/world.js';
import { planHandful } from '../kernel/kernel.js';
import { Playhead } from '../views/render.js';

export const objects = new ObjectStore();
export const logs = new LogStore();
export const seam = new SeamClient(createSeamServer({ objects, logs, planHandful }));
export const world = buildWorld();
export const playhead = new Playhead();

/**
 * The shared context, as one object — what a surface's `mount(container, ctx)`
 * receives. A popped-out window reaches the SAME live instances via
 * `window.opener.__remit` (same-origin), so its surface renders and updates
 * from the main window's store with no serialisation.
 */
export const context = { objects, logs, seam, world, playhead };

// Debug/test handle (read-only use; not part of any contract). Seeded here so
// it exists regardless of which tab boots first; main.js attaches `.state`.
/** @type {any} */ (globalThis).__remit = context;
