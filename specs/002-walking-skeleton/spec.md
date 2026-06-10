# 002 — Walking skeleton (DEC-44)

**Status:** implemented · **Source of truth:** `docs/remit-register.md` DEC-44 (scope),
`docs/remit-build-plan.md` §4 (exit criteria), `docs/remit-architecture.md` §5 (module
boundaries), `docs/remit-seam-contract.md` (interface), `docs/remit-data-model.md` (shapes).

> Authored directly (no spec-kit run, by maintainer request): the register **is** the
> spec for this build; this file records scope, exit-criteria evidence, and the local
> deviations to reconcile at the skeleton gate (DEC-47).

## Scope (DEC-44, verbatim intent)

Spine end-to-end with trivial stubs — single user · land · vehicle:

| Stage | Stub | Where |
|---|---|---|
| Capture | one `visit` activity, one hard commitment, scripted echo-back (DEC-17) | `app/js/capture/` |
| World | single synthetic baseline, one channel, small static grid (28×18 < DEC-28) | `app/js/kernel/world.js` |
| Plan | mock kernel: real A* paths + canned/banded scores (honest non-planner, NF9) | `app/js/kernel/` |
| Compare | tiny A2 matrix + selection rationale (DEC-23) | `app/js/compare/` |
| Views | timeline + map, shared playhead (NF1: views project, never re-derive) | `app/js/views/` |
| Execute | simulated playback, one margin band, alert iff crossed, manual observation | `app/js/wingman/` |
| Learn | execution log → after-action record; perfect replay from stamp (NF3) | `app/js/learn/` |

Cross-cutting (threaded per step, DEC-44 choice B): content-addressed object store
(DEC-35), stamp on plan (DEC-29), in-browser mock seam endpoints (DEC-39/41/42),
config-core hash as a stamp axis (DEC-48), append-only log store.

## Exit criteria → evidence

Each build-plan §4 exit criterion is asserted by `e2e/skeleton.spec.ts` and captured in
`evidence/screenshots/`:

1. **World** (now first) — baseline + profile resolve to a searchable grid; config core
   canonicalises and hashes; the candidate OPs render on the AO map. `01-world.png`
2. **Capture** — with the AO on the map, the picked OP is highlighted (and follows the
   dropdown); committed `visit` is content-addressed, retrievable (round-trip ✓). `02-capture.png`
3. **Plan** — one stamped call yields a handful of 3 distinct banded plans; same stamp →
   same ids across a full page reload (NF3, decision-level). `03-plan.png`
4. **Compare** — comparability guard passes; one plan selected; rationale committed (NF2).
   `04-compare.png`
5. **Views** — timeline + map render the kernel's materialisation; scrubbing the playhead
   moves the map ghost (shown = optimised). `05-views.png`
6. **Execute** — playback against the live requirement; obstruction injections cross the
   margin band → alerts (E3); manual observation appends (E5). `06-execute.png`
7. **Learn** — after-action (log + rationale + stamp) read back entirely over the seam;
   replay from stamp reproduces identical plan ids. `07-learn.png`
8. **Substrate** — store inspector + seam traffic drawers make the contract visible.
   `08-substrate.png`

## Local deviations & build discoveries (hold for the gate, DEC-47)

0. **World provisioned before Capture (tool order).** The spine narrative is
   capture→model-world (DEC-2/5), but Capture points at map features, so the tool runs
   **World first** and renders the candidate OPs on the AO map for Capture to choose from.
   This doesn't demote the requirement — DEC-5 primacy is about the requirement being the
   durable object, not its position in the tool flow. Candidate register note for the gate.
1. **No-build ES modules instead of TypeScript** (vs DEC-41 "v1 = TypeScript in-browser").
   The deploy pipeline's contract here is *no build step* (`pages.config.yml`,
   ADR-0001/0005); modules are `// @ts-check` + JSDoc typed instead. The seam/data-shape
   discipline is unaffected. Revisit when the LinkML-generated TS types land (DEC-57).
2. **Stamp lacks a profile/start-state axis** (data-model §6). Plans depend on the
   profile and start state, so identical stamps with different profiles would violate
   NF3. The skeleton stamp adds `profile_version` + `start{x,y,clock_min}`. Candidate
   register amendment.
3. **Plan identity needs a within-handful discriminator.** `Plan.id = hash(Stamp)`
   (DEC-29) collides across the handful that one stamp legitimately produces. Skeleton
   uses `id = hash({stamp, strategy})`. Candidate register clarification.
4. **Band widths**: unit derives from channel confidence via a lookup
   (high→20 min) — structurally NF10, but the mapping itself is mock calibration;
   the DEC-46 band-calibration test remains real-kernel work.
5. **Robustness bands are canned per strategy** (single baseline, no sampling) and the
   store's object ids for `Plan` records cover the materialisation cache, while the
   decision identity remains `plan.id` (stamp ⊕ strategy) — both labelled in-app (NF9).

## Post-skeleton extensions (maintainer-directed, on this branch)

Built on top of the skeleton in the same PR, at the maintainer's request:

- **Two-commitment requirement (exfil East).** The requirement now carries a second
  hard commitment: after the observation, exfiltrate east across the **K-7 bridge** to
  **RV EAST**, by a deadline (H+180). The kernel routes a two-leg path (start→OP→RV)
  through the only river crossing (the bridge), scores both commitments, and Execute
  completes at the RV with a combined verdict. Sets up the DEC-54 tidal slice (next).
- **Mid-mission obstructions.** Obstruction buttons (**+5** / **+25 min**) insert the delay
  where the vehicle *is now* — plan-time is monotonic, so the vehicle freezes in place
  rather than jumping back to the start — and drop a marker (red ✕) on the track. Works
  through the exfil leg; the live band is phase-aware (observe → exfil), and the observe
  verdict locks when the vehicle leaves the OP.
- **Mid-mission re-routing (DEC-24/25).** A **Block next cell** button blocks the cell
  ahead and the wingman re-plans *locally* — from where the vehicle is, to the remaining
  objective(s), avoiding the block — splicing a fresh, re-timed tail onto everything
  already travelled (so it can't un-travel). If boxed in, it reports "blocked in" and keeps
  the route. Restart restores the original. Evidence: `10-execute-reroute.png`.
- **Stakeholder wording.** "handful" → **courses of action (COAs)**; "AO Package" →
  **"Load the operating area"** with plain-language gloss (the register keeps its
  deliberate terms; only the UI is plain).

### Plan/Compare role split (maintainer-directed)

Sharpened what each stage is *for* (not merged — the kernel-generates / human-decides
boundary is load-bearing, DEC-14/22/23):

- **Plan = shape the problem.** Where the operator adds intelligence as **constraints**
  (steering, DEC-24). *Built:* paint **no-go cells** on the map; they enter the stamp's
  `steering` and the kernel's A* routes around them; re-generate to see the COAs bend.
  Blocking the K-7 bridge detours the routes south to the highway crossing; blocking both
  river crossings makes exfil infeasible (a real, deterministic result). Evidence:
  `09-plan-steering.png`. *Temporal bounds* on constraints come with the tide (shared
  time-varying-passability machinery).
- **Compare = tune the response.** Risk **appetites** (DEC-6) moved here as a ranking
  lens that highlights a **★ recommended** COA; plus risk **mitigations** that buy down
  a risk for a cost — an **Armed Escort** toggle (+1 robustness band, −1 cost band,
  shown inline). The rationale records appetites + mitigations.
- **New concept for the gate (DEC-47):** *mitigations* (buy-down-risk-for-cost) are not
  in the register. v1 models the escort as a comparison-layer band modifier (NF9-labelled);
  a fuller model would make it a profile/steering input that re-plans. Also: appetites are
  a stamp input (DEC-6/29) — v1 treats the Compare appetites as a ranking lens only.

### Tidal ford — increment A (mudflat slice, G6/DEC-54) ✅

K-7 is now a tidal **ford**, wadeable only within ±3 h of low tide. The tide is a
second baseline **channel** (parametric, periodic: period 745 min, first low tide
H+268 → window opens H+88), and its open/close edges populate the baseline's
`forecast_changepoints` — forecastable, not surprises.

- **Time-dependent exfil, honestly trivial.** Instead of a time-expanded A*, the
  kernel weighs the two real alternatives at the moment of departure: *wait at the
  bank for the window, then wade K-7* vs *detour via the always-open K-9 highway
  bridge*. Both candidates are materialised with the real movement model; the
  earlier RV arrival wins, and the weighing is published on the plan
  (`tide_decision`, shown on Plan/Compare cards: e.g. "wait 11.1 min beats the
  K-9 detour, RV H+95.5 vs H+96.1: WAIT").
- **The handful diverges on the tide.** At the default 45-min dwell, direct and
  tracked reach the bank ~11 min early and **hold for low water** (a visible
  `Await low tide` leg — the vehicle pauses at the bank in playback, phase
  `hold`); covered arrives after H+88 and crosses on the **open** tide. Shorten
  the dwell to 15 min and all three flip to the **K-9 detour** — the capture
  sliders genuinely steer the optimiser's choice.
- **Map + execution.** The ford renders by tide state at the projected time
  (closed → water with wave dashes; open → dashed low-water outline); scrubbing
  the playhead across H+88 flips it live. Mid-mission re-routes go through the
  same wait-vs-detour chooser, so blocking cells near the ford detours honestly.
- Evidence: `11-tide-plan-weighing.png`, `12-tide-hold-at-bank.png`,
  `13-tide-detour-flip.png`.

### Tidal ford — increment B: execution-time re-assessment ✅

Increment A left one dishonesty: execution delays shifted the whole timeline
uniformly, though a delay before the bank is really absorbed by the tide wait.
Increment B removes the delay offset entirely — **an obstruction is now a local
re-plan** (ADR-0007): the wingman splices a hold leg where the vehicle is and
re-times the remainder through the same tide-aware chooser, so plan-time stays
equal to sim-time and the *plan itself* carries every disturbance.

- **Absorption is real and visible.** +5 min in transit leaves RV unchanged at
  H+95.5 (the tide hold shrinks); the log says "re-planned, RV H+95.5 (holds
  absorbed 5 min)". Both the OP-window hold and the tide hold absorb.
- **The tide decision is re-assessed on every disturbance.** When a rebase
  changes the chooser's verdict the wingman raises a distinct ≋ alert: +30 total
  flips **wait → open** (bank reached after H+88, no hold needed); piling on
  ~+375 pushes the bank past the window close (H+448) — the ford is **forfeited**
  and the re-plan flips **open → detour** via K-9, with the deadline consequences
  showing in the exfil band (violated).
- **Repeated obstructions extend the standing blockage** (clicking +25 during an
  obstruction hold lengthens it); blocks during a hold carry its remainder
  through the rebase. A visit in progress survives rebases whole — the dwell is
  a commitment, not routing.
- Evidence: `14-tide-reassessment.png`.

### Planned next (DEC-54 first slices)

- **Sync Matrix temporal plot (entity slice, D6/DEC-53).** Expand the timeline into
  time-aligned tracks: tide curve + crossing-window band, fuel line, mission outer
  bounds, and the current plan's phases. Tide appears from the World step on.

## Out of scope (per DEC-44)

Steering gestures, excursions, providers, Sync Matrix/entities, multi-channel worlds,
waiting-as-a-move beyond the trivial hold leg, any real planning quality. First
post-skeleton slices are DEC-54 (mudflat + entity/Sync-Matrix).
