---
layout: default
title: "Execution edits, captured in the model"
---

> **At a glance —** Obstructions and blocks inserted during Execute now land in the shared
> object store as typed `ExecutionDelta` records — structured inputs, not just a prose log
> line — so they show up in the Data Analysis monitor and are kept for replay.

![An obstruction captured as a typed ExecutionDelta in the Data Analysis monitor](screenshots/01-execution-delta.png)

## The problem

REMIT's Execute phase lets the operator perturb a live run: drop a `+25 min` **obstruction**
in the vehicle's path, or **block** the next cell and force an in-flight re-route. The
wingman handled both correctly — splicing a hold, re-timing the tail through the tide-aware
chooser, bending the route around the block.

But the maintainer noticed something on the way home ([issue #7](https://github.com/DeepBlueCLtd/REMIT/issues/7)):
*"when I insert obstructions or delays they aren't captured in the model."* Each edit
appended a human-readable note to the execution log — but its **structured** facts (which
cell, how many minutes, the resulting RV) lived only in transient UI state. Nothing reached
the content-addressed **object store**. So unlike `SteeringDelta` — the operator's denied
cells, already a first-class shared write — the perturbations were invisible to the Data
Analysis monitor and carried no structured inputs for replay (NF3).

## Options

- **Richer log entries.** Pack the structured fields into the prose `Observation`. Cheap,
  but the log is append-only history keyed by mission, not the content-addressed store the
  monitor and replay read from — it would still be invisible there.
- **A bespoke UI-state object.** Hand-write a perturbation shape in the wingman. Fast, but
  it violates the LinkML one-source-of-truth rule (ADR-0012) the moment it crosses a
  boundary — and this one crosses straight into the shared store.
- **A typed delta, mirroring `SteeringDelta`** *(chosen)*. Model the perturbation in LinkML,
  generate the type, and write it via the existing DEC-61 attributed-delta path.

## The strategy

Model the data, re-use the seam. Two additions to the schema:

- a `HexCell` value object (`h3` + optional `lat`/`lng`) — the hex-grid successor to the
  square-grid `Waypoint`, and
- an `ExecutionDelta` (an `is_a: Delta`) carrying `event` (`obstruction` | `block`),
  `at_min`, `cell`, `delay_min`, `rv_min`, and `absorbed_min`.

`schema/generate.sh` regenerates the JSON Schema, the TypeScript types, and the HTML
reference. The wingman then calls `seam.putObject('ExecutionDelta', …)` on each edit — the
same write path `SteeringDelta` uses, attributed to the operator wearing the **Ops** hat.
The prose log entry stays (it still reads well in the after-action record); the delta is its
structured sibling. The share is non-fatal — the append-only log already recorded the event,
so a failed write never breaks the live loop.

## The results

Insert a `+25 min` obstruction on the exfil drive and an `ExecutionDelta` lands in the store
with `event: 'obstruction'`, `delay_min: 25`, and the vehicle's `cell.h3` — and it appears
in the Data Analysis index alongside every other object, drilling down to its fields. A new
e2e test pins this; `npm run typecheck` stays at 0 errors (the imported type is generated,
not hand-shaped) and the 12 golden/unit tests are unchanged.

One thing this does **not** do yet: re-running a stamp does not automatically *re-apply* the
captured perturbations — they're exogenous operator acts. Capturing their structured inputs
is the prerequisite; automatic re-application is the natural next step.

## Screenshots

![An obstruction captured as a typed ExecutionDelta, drilled down in the Data Analysis monitor](screenshots/01-execution-delta.png)
