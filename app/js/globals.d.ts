// Ambient declarations for the app's debug/test global handles and the shared
// cross-window context (DEC-61). Typing them here — at their origin — is what
// lets the use sites drop their `/** @type {any} */ (window)` casts.

type RemitContext = typeof import('./shell/context.js').context;

declare global {
  interface Window {
    /** The shared app context (DEC-61); the Overview lap attaches `.state`. Debug/test handle. */
    __remit: RemitContext & { state?: unknown };
    /** Surface a failure in the banner — nothing fails silently. Seeded by the Overview lap. */
    __remitFault?: (msg: string) => void;
    /** Minimal API a popped-out child calls to pop itself back in on close. */
    __remitShell?: { popIn: (id: string, fromClose: boolean) => void };
    /** Author-time terrain-sampling flag (views/map.js + tools/sample-terrain.mjs). */
    __REMIT_SAMPLE?: boolean;
    /** The live MapLibre map, exposed only while sampling terrain. */
    __map?: unknown;
  }

  // context.js seeds globalThis.__remit so it exists regardless of which tab boots first.
  // eslint-disable-next-line no-var
  var __remit: RemitContext & { state?: unknown };
}

export {};
