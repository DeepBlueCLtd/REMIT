# 004 — Capture execution-phase edits in the model (issue #7)

**Status:** implemented · **Source of truth:** [issue #7](https://github.com/DeepBlueCLtd/REMIT/issues/7)
(maintainer), `docs/remit-data-model.md` (object shapes), `docs/project_notes/decisions.md`
ADR-0011/0012 (LinkML source-of-truth + the attributed-delta write path, ADR-0022).

> Maintainer-raised: *"in execute phase, when I insert obstructions or delays they aren't
> captured in the model. Should they be?"* — **Yes.** This spec makes each in-flight
> perturbation a first-class, content-addressed store object.

## Problem

During Execute, the operator can perturb the live run two ways:

- **Obstruction** (`+5` / `+25 min`) — a hold spliced at the vehicle's current cell, the
  remainder re-timed through the tide-aware chooser (ADR-0006/0007).
- **Block next cell** — a cell ahead declared impassable, forcing an in-flight re-route.

Both already appended a prose `Observation` to the append-only **execution log** — but
their *structured* inputs (which cell, how many minutes, the resulting RV) lived only in
transient wingman UI state. Nothing landed in the **content-addressed object store**, so —
unlike `SteeringDelta` (the first DEC-61 write) — the perturbations:

1. were **invisible** to the Data Analysis monitor (which browses store objects), and
2. carried **no structured inputs** for replay (NF3) — only a human-readable note.

## Scope

Model execution-phase perturbations as a typed delta and write them to the store.

| Piece | What | Where |
|---|---|---|
| Schema — enum | `ExecutionEventKind` (`obstruction` \| `block`) | `schema/common.yaml` |
| Schema — value object | `HexCell` (`h3` + optional `lat`/`lng`) — the hex successor to `Waypoint` | `schema/common.yaml` |
| Schema — delta | `ExecutionDelta (is_a: Delta)` — `event`, `at_min`, `cell`, `delay_min`, `rv_min`, `absorbed_min` | `schema/records.yaml` |
| App write | `shareExecutionDelta()` → `seam.putObject('ExecutionDelta', …)` on each obstruction/block | `app/js/wingman/wingman.js` |

Cross-cutting: re-uses the DEC-61 attributed-delta write path (`scope`/`by`/`role`/`at`,
operator wearing the **Ops** hat) exactly as `SteeringDelta` does; the prose log entry is
**kept** (it reads well in the after-action record) — the delta is the structured sibling,
not a replacement. The share is **non-fatal**: a failed write never breaks the live loop,
because the append-only log already recorded the event.

## Out of scope

- **Replay re-application** — re-running a stamp does not yet *re-apply* the captured
  perturbations (they are exogenous operator acts). Capturing the structured inputs is the
  prerequisite; automatic re-application is a noted follow-up.
- Resolving the documented square-vs-hex `Constraint.cells` drift in `SteeringDelta`
  (bugs.md) — `HexCell` is introduced here and is the natural type to migrate it onto later.

## Exit criteria → evidence

Asserted by `e2e/skeleton.spec.ts` ("an obstruction is captured in the model as a typed
ExecutionDelta"), captured in `evidence/screenshots/`:

1. **Captured** — after a `+25 min` obstruction on the exfil drive, an `ExecutionDelta`
   lands in the store with `event: 'obstruction'`, `delay_min: 25`, and a `cell.h3`.
2. **Visible** — the object appears in the Data Analysis monitor index and drills down to
   its structured fields. `01-execution-delta.png`
3. **Generated, not hand-shaped** — the TypeScript type the app imports comes from LinkML
   (`schema/generate.sh` → `schema/gen/remit.ts`); no hand-authored shape (ADR-0012).

## Verification

- `npm run typecheck` — 0 errors (the imported `ExecutionDelta` type resolves from `gen/`).
- `npm run test:unit` — 12 golden/unit tests green (kernel set-pieces unchanged).
- `node run-playwright.mjs` — e2e lap + the new capture test green.
