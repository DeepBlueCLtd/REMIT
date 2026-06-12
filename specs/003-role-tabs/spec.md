# 003 — Role tabs + Data Analysis monitor (DEC-61 seed)

**Status:** in development · **Source of truth:** `docs/remit-register.md` DEC-59/60/61
(rationale), `docs/remit-architecture.md` §8 (command-post layer), `docs/remit-data-model.md`
(object shapes), `docs/project_notes/decisions.md` ADR-0005 (no-build ES modules),
ADR-0012 (schema source-of-truth + UI-only exemption).

> Maintainer-directed: move REMIT toward **role-specific UIs over one central data store**.
> The current single UI becomes the **Overview** tab; further role tabs project the same
> shared content-addressed store. This phase ships the **tab shell** and the first real
> alternative projection — a **Data Analysis** drill-down monitor — plus labelled
> placeholders for the remaining roles. It is the concrete v1 seed of DEC-61.

## Scope

A v1 realisation of DEC-61's "config-declared role surfaces over one shared store" — read-only
projections plus the first shared *write* (live steering):

| Piece | What | Where |
|---|---|---|
| Shared context | the one `ObjectStore`/`seam`/`world`/`playhead`, extracted so every surface projects the same objects | `app/js/shell/context.js` |
| Roles config | `{id,label,status,poppable,mount}` — DEC-61 bundle in read-only form | `app/js/shell/roles.js` |
| Tab shell | tab bar (ARIA tablist, keyboard nav, `#tab=` deep-link), lazy mount, pop-out handoff | `app/js/shell/shell.js` |
| Overview | the entire existing walking-skeleton UI, unchanged, lazy-booted | `app/js/shell/overview.js` + `app/js/main.js` |
| Data Analysis | drill-down object/graph browser: index · detail tree · breadcrumb · search · change-glow | `app/js/analysis/data-analysis.js` |
| Pop-out | a surface in its own window sharing the opener's live store (`window.opener.__remit`) | `app/popout.html` + `app/js/shell/popout.js` |
| Stubs | CO · Duty Officer (Plans) · SME Env · SME Int · Duty Office (Ops) as "coming soon" panes | `app/js/shell/shell.js` |

Cross-cutting: surfaces receive their context by injection (`mount(container, ctx)`) so the
**same** surface renders the **same** live store inline or popped-out; reads only (NF1 — it
projects, never re-derives); the change-glow diffs `objects.list()` and is the hook future
mock feeds will reuse.

## Exit criteria → evidence

Asserted by `e2e/shell.spec.ts`, captured in `evidence/screenshots/`:

1. **Tab bar** — seven role tabs render; Overview is default and behaves exactly as before;
   switching toggles views + `aria-selected`; a stub shows a "coming soon" placeholder.
   `01-tabbar.png`
2. **Data Analysis index** — empty store shows an empty state; provisioning the AO objects
   (idempotent, same as the World stage) populates the index grouped by type. `02-data-analysis-index.png`
3. **Drill-down** — opening a Plan and clicking its stamp's `baseline_version` content-id
   reference navigates the detail pane to the Baseline; the breadcrumb records the path and
   a crumb click returns. `03-data-analysis-drilldown.png`
4. **Pop-out** — the monitor opens in its own window reading the opener's live store; a
   change committed in the main window appears (and glows) live in the popped-out window;
   closing it pops the view back in. `04-popout-main.png`
5. **Search + glow** — the search box filters the index by entity name or value; newly
   committed objects glow yellow (row + type-group header). (asserted in-suite)
6. **Live steering write** — denying a cell in Plan writes a `SteeringDelta` (with the no-go
   `Constraint` and `provenance`) to the shared store, which surfaces in the monitor.
   `05-steering-delta.png`
7. **No regression** — the full `e2e/skeleton.spec.ts` lap passes unchanged (Overview is the
   default tab; `window.__remit.state/seam/objects` preserved).

## Notes & deviations

- **No schema change (ADR-0012 §2).** The roles list is UI-only discrete config; the
  Operation/Scheme/Role/Delta LinkML classes remain designed-for (DEC-59/60/61), not built.
- **First write — live steering (maintainer-directed extension).** Denying cells in Plan is
  the *application of intel*, so it is shared across the system: a `SteeringDelta`
  (`{scope, constraints: Constraint[], provenance}`) is written to the store on each no-go
  change (debounced) and surfaces in the monitor like any other object. The shape is
  **LinkML-modeled, not hand-shaped** (ADR-0011/0012): `Delta` (abstract) + `SteeringDelta`
  in `schema/records.yaml`, generated to `schema/gen/remit.{ts,schema.json}` and the HTML
  reference; the payload reuses the schema's `Constraint` (DEC-24). Write-scope *enforcement*
  (which role may write what) still follows in the writes phase. Risk appetites stay **local**
  (a ranking lens), by the maintainer's call.
- **Pop-out shares the opener's in-memory store** (same-origin `window.opener.__remit`): it
  lives only while the main window is open and does not survive a main-window reload (the
  child shows a recovery message). The future-proof path for feeds/multi-window writes is a
  `BroadcastChannel` carrying stamped deltas (the `/sync` path, DEC-25) — noted, not built.
- **Module entry** is now `js/shell/shell.js`; `main.js` is imported lazily by Overview
  (it auto-boots on import and queries DOM ids that must already exist).
- **`onTraffic` gained an unsubscribe return** (backward-compatible) so popped-out/unmounted
  surfaces drop their listener.

## Out of scope (this phase)

The five role surfaces' actual content; **write-scope enforcement** (the steering write is
attributed but not yet scope-checked) and a first-class `Delta` type; allegiance
(blue/red/green); Operation/End-State/Scheme; registered bespoke render-components;
source-provider ingress / live feeds; multi-node distribution.
