# REMIT — Concept Document
 
*REMIT — **R**equirement, **E**ffects & **M**ission **I**ntent **T**asking.*
 
*Distilled from Discussion Register v22. The register remains the source of truth; this document cites decisions as [DEC-n] so every claim is traceable to its rationale.*
 
*Update note (post-v3): the system is now **configurable per instance** behind a stable seam — risks, performance measures, mediums and movement models are config, some realised as **computed providers** (DEC-48…51, register §G; seam contract). Views are reframed as **projections of the plan-in-its-world**, projecting first-class **entities** alongside the plan (DEC-52/53). Detail in the register; the prose below carries the projection/entity reframe inline and points to §G for configuration.*

*Update note (command-post batch, DEC-59/60/61): a "grow the app" stretch adds an **Operation** apex above the requirement (an **End-State** of Objectives/Decisive Conditions; its plan a **Scheme of Manoeuvre**), an **ORBAT** of allegiance-typed forces (blue/red/green) under **one ontology, three stances** (plan-for / avoid-assess / respect), and **config-declared role interfaces** over a shared store with **writes-as-stamped-deltas** (the future distributed system, mocked). **Horizon is split** (DEC-56 guard): shape-scaffolding rides into v1, capability is designed-for (H2/H3). Detail in the register and Annex A.*
 
**Audience:** the development team, primarily. Each section carries a **Why** note so stakeholders — and developers — can see the reasoning, not just the conclusion. Capabilities are tagged **H1** (v1 / near), **H2** (mid), **H3** (far, designed-for).
 
---
 
## Executive narrative
 
Military-style mission planning is usually defended by experience and instinct. Our Blockbuster demonstrator showed that route planning can instead be defended by *measurement*: name the risks, weigh them, and optimise — so every choice can answer "why this and not that?" [DEC-8]
 
This project lifts that idea from routes to **missions**. A mission is not a line on a map; it is a set of *commitments* — visit this point in this window, check in every four hours, search this area, remain unobserved — issued by command and implemented under local judgement. The system we propose makes the **mission requirement** the primary object. Mission **plans** are candidate responses to it, generated as a *handful* of genuinely distinct, defensible options. The map, the schedule, the task board, the Gantt and the **Sync Matrix** are simply different lenses on the same plan **in its world** — they project the plan together with the entities around it (own force, other actors, features, phenomena), all on synchronised axes [DEC-5, DEC-52/53].
 
Two principles keep the system honest. First, **defensibility is not correctness**: the tool makes assumptions explicit, auditable and repeatable — it does not certify them. Second, **work in big handfuls**: forecasts are uncertain, so the system never pretends to rank plans on differences smaller than that uncertainty. The metrics find the right handful; human judgement chooses within it [DEC-14]. The same machinery then rides along on the mission as a live wingman, and everything it records becomes organisational memory.
 
It plans for land, sea or air forces (one domain at a time) [DEC-20], runs entirely on local hardware from a pre-provisioned area of operations, and remains fully functional at zero bandwidth [DEC-12, DEC-25].
 
---
 
## 1. The reframe: requirement → plans → projections
 
The **mission requirement** — the commitment set, with provenance and intent — is the primary, durable object. Multiple **mission plans** respond to it. Schedule and route are temporal and spatial *projections* of a plan, not objects in their own right [DEC-5]. More generally, every view is a synchronised projection of the **plan-in-its-world**: it projects the plan *and* the located **entities** around it — own force, other actors, features, phenomena — each a thing with its own spatial/temporal bounds (distinct from a *channel*, which is a field over the whole map) [DEC-52].
 
> **Why.** Privileging the route (or the schedule) bakes one perspective into the architecture and makes order changes destructive. With the requirement at the centre, requirements and plans have decoupled lifecycles: when orders change, existing plans are *re-scored* against the new requirement version rather than destroyed — yesterday's rejected plan may satisfy today's amendment best. This is also mission command in software: the requirement is directive control; everything below it is delegated.
 
Two ownership rules complete the ontology. **Risk appetites belong to the implementer**, never the requirement: anything command insists on must be typed as a commitment; preferences never flow down the chain [DEC-6]. And every plan carries an **assumption stamp** — the appetites, world version and requirement version it was built under — enabling honest re-scoring and honest comparison [DEC-23].

**Above the requirement: the Operation (H2/H3, scaffolded in v1).** A CO does not respond to one tasking but **allocates finite force across competing taskings toward an intent**. So the stretch adds a distinct apex object, the **Operation**, which carries an **End-State** — the commander's intent, decomposed into **Objectives / Decisive Conditions** — and **owns a set of requirements as the means** to it [DEC-59]. Its plan is a **Scheme of Manoeuvre**: an allocation across those requirements, offered as a banded handful and **scored by the effect profile it produces against the End-State**, so the CO can juggle priority and risk and drill into the same temporal/spatial projections. Forces are typed by **allegiance** — blue / red / green — on an **ORBAT** that opens the process [DEC-60]; one intent ontology serves all three, the kernel's *stance* differing only by colour (**plan-for** own force, **avoid-assess** the adversary, **respect** the neutral). And each role — CO, duty officer, SMEs, execute-watch — gets a **bespoke interface** declared in config, all writing to one shared store as **stamped deltas**, which mocks the future distributed command post [DEC-61].

> **Why.** This is mission command one echelon up: the Operation is directive control over a *set* of delegated requirements, exactly as a requirement is directive control over a plan. Making *effects and intent* the apex (not a bare container) keeps the **E** and **I** of REMIT first-class and gives the portfolio something principled to optimise against. Per the staging pattern, only the shape-scaffolding ships in v1 (allegiance, End-State slots, delta-writes, role presets); the capability — portfolio search, capability-matched allocation, bespoke surfaces, live feeds, a reactive adversary — is architected now and shipped later, under the shape-freeze guard [DEC-56].
 
## 2. Capture: commitments, negotiated
 
**The Activity model (H1).** A commitment is an **Activity = {type, where, when/recurrence, duration, constraints, effects, outcome-model}** [DEC-16]. The v1 vocabulary is deliberately modest — types {visit, loiter/observe-lite, avoid, transit, maintain}; constraints from a four-slot sub-language (WHAT / WHERE-predicates / WHEN-windows-and-recurrence / modifiers); effects limited to own-state consumption and a simple persistent marker; boolean outcomes. But the *abstraction* already accommodates the hard cases — evasive search (probabilistic outcomes), barrier emplacement (world-mutating effects), covert observation (concealment), environmental appreciation (effects that shrink forecast uncertainty) — so they slot in later without redesign (H2/H3).
 
> **Why.** Real tasking ("search for the escaped convict", "set up a barrier from the West") is richer than waypoints. Designing the abstraction for the hard activities now, while shipping only tractable ones, is the same architect-now/ship-simple pattern used throughout — and honesty (NF9/NF10) forbids pretending to solve evasive search precisely.
 
**Capture as negotiation (H1).** The capture interface *interrogates* rather than records: each activity type carries a finite checklist of known ambiguities (recurrence anchor? miss-behaviour? tolerance?). Unasked items take **visible, stamped defaults** — confirmed and defaulted answers are distinguishable forever in the audit trail. A **canonical echo-back** of the interpreted commitment is the committing act: the signed restatement is the contract [DEC-17]. At H2, clarification becomes *lazy*: the kernel evaluates both readings of an ambiguity and asks only when they diverge by more than an uncertainty band — the question arrives with its consequence attached.
 
> **Why.** Ambiguity surfaced at capture time is cheap; ambiguity surfaced at failure time, mid-mission, is not. But interrogating everything causes form fatigue, and silently defaulting recreates the assumption problem this system exists to kill. Visible stamped defaults are the honest middle.
 
**The commitment register (H1).** Every commitment carries provenance — issuing role and authority, owner, waiver authority, expiry, rationale [DEC-18]. Lifecycle: *proposed → negotiated → committed → {satisfied | violated | waived | superseded}*; waivers are attributed, auditable events. Requirement amendments create new versions; superseded commitments keep their history.
 
> **Why.** Half of conflict resolution dissolves once provenance exists — you know which commitment bends because you know whose it is and on what authority. The plan becomes a contract between command levels, and deviations become records, not arguments.
 
**Roles (H1).** Command authority, implementer/planner, operator/crew — modelled as *hats with attribution*; v1 is single-user wearing all hats, multi-user later [DEC-15].
 
## 3. The world: one baseline, named futures, honest precision
 
**Environment model (H1).** Three parts: the **medium** (terrain — land, sea or air, behind one interface [DEC-20]); pluggable **risk/benefit channels** (each carrying value, confidence/freshness, and *its own sampling resolution*); and the time-varying **forecast** [DEC-19, DEC-21]. Real terrain is draped onto the grid (elevation + land cover) and delivered as a **pre-provisioned, bounded area of operations**; synthetic terrain is a first-class mode and ships first [DEC-11].
 
**One delta engine (H1 design, H2 full).** The kernel always evaluates **baseline ⊕ excursion ⊕ plan-effects-to-date**. *Excursions* are named alternative futures ("storm-early", "ford-blocked") — exogenous deltas authored by uncertainty. *Effects* are endogenous deltas authored by the plan itself (the barrier you emplaced). Same mechanism, two directions; v1 ships single-baseline, with excursions designed-for [DEC-7, DEC-19]. During execution, an observation *collapses* an excursion into fact, and every plan re-scores.
 
> **Why.** Plans must hedge across futures without ever privately disagreeing about facts. Named, shared excursions keep plans comparable ("both tested under storm-early") while making contingency planning first-class — and the collapse mechanism means planning-time hedging and execution-time learning are one machine, not two.
 
**Time (H1).** Hybrid model: an event-driven backbone (activity events, forecast change-points) plus **multi-rate sampling** of the channels, where a sampled threshold-crossing *injects* a new event — that is how the world, not just the agent, generates triggers. Each channel samples at a resolution matched to its predictability: tide coarsely (near-analytic), point cloud-cover finely but with wide uncertainty bands. Activities consider only their *relevant* channels. State is (cell, continuous time); hierarchical search handles multi-day horizons [DEC-21].
 
> **Why.** Activities span thirty minutes to fourteen days; no fixed tick covers that range. And sampling cloud cover to the minute when it is barely forecastable is false precision — resolution proportional to predictability is the "big handfuls" principle applied per phenomenon.
 
**Own-force model (H1).** Static **profile** (speed-by-medium, endurance, sensor fit — domain-typed) split from dynamic **state** (v1: position, clock, endurance/fuel, availability), consumed and restored by movement and activities [DEC-19]. The profile is also the lever the procurement use-case varies (H3).
 
## 4. Planning: a handful, not an optimum
 
The kernel is a **pure function of its stamped inputs** producing a *handful* of distinct, defensible plans [DEC-22]:
 
1. **Generate diversity** — strategy-biased fan-out (v1 axes: time/speed, exposure, robustness, completeness), rejecting within-band near-duplicates. **Waiting is a move**: under (cell, time) state a wait is just a time-advancing self-loop, with candidates generated at event boundaries — the cheapest plan may include doing nothing.
2. **Score** — satisfaction (objective), cost (appetite-dependent), and robustness across excursions, expressed as a **banded label** (robust/marginal/fragile).
3. **Detect conflicts** — structurally and emergently; conflicts are first-class, named objects.
4. **Organise** the survivors into the **non-dominated set in banded space**: plan A dominates B only if better by more than an uncertainty band without being worse by more than a band elsewhere. Within-band plans are co-equal.
**Hard and soft commitments.** Each commitment carries a *criticality*: hard ones are inviolable constraints; soft ones are priority-weighted, banded penalties (priorities from register provenance). Least-worst plans, minimal-relaxation reporting and the handful itself all emerge from this one mechanism. When nothing satisfies everything, v1 reports exactly which commitments the best partial plans sacrifice; H2 adds active suggestions ("relax the midday window by ~40 minutes") [DEC-22].
 
> **Why.** Forecast uncertainty dwarfs the differences a precise optimiser would rank on. Pretending otherwise is false precision and an overclaim — the failure mode Blockbuster's own review identified. The honest design: metrics narrow the field to genuinely distinct, defensible options; the implementer's judgement — which owns the appetites anyway — chooses within the handful. Determinism is retained for audit, testing and sharing, *not* as a tiebreaker.
 
Designed-for, deferred: adversarial reasoning and concealment (H3), value-of-information reconnaissance (H3), multi-vehicle and heterogeneous teams (H3).
 
## 5. Comparing & deciding
 
Two comparison layers, deliberately separate [DEC-23]:
 
- The **commitment-satisfaction matrix** — plans × commitments, verdicts plus *margin bands* (robust/marginal/tight, never false decimals). Appetite-independent: the objective layer, shareable with the command hat.
- The **banded cost × robustness handful** — the implementer's layer, meaningful only under their appetites.
A **comparability guard** enforces honesty at the point of comparison: plans are objectively comparable only if their stamps share a baseline/excursion and requirement version; mismatches produce a warning, not a misleading matrix. Requirement amendments produce **plan diffs** (commitment verdicts, activities/legs, cost/robustness deltas) traceable to the amending order. Committing to a plan records a **selection rationale** — the chosen plan, the handful it beat, the deciding axis, a note, and who/when — completing the audit trail from order to decision.
 
> **Why.** "Why this plan?" must be answerable years later from the record alone. The matrix answers it to command; the rationale answers it for the implementer; the guard prevents the most seductive lie, an apples-to-oranges comparison.
 
## 6. Seeing the plan
 
All views are **synchronised, co-equal projections of the plan-in-its-world**, rendered through the *same* evaluation code that planned it — what you see is what was optimised [NF1, restated DEC-52]. Each view projects an **entity's aspect** onto an axis: the map projects the *position* aspect spatially; the **Sync Matrix** projects any aspect — own altitude, distance-along-track (its gradient is speed), a satellite's overhead window, a convoy's pass-time, a friendly submarine's surface window — onto a shared, scrolling, zoomable time axis; the state curves project the self-entity's endurance and availability. Own force is simply the one entity we *plan*; others (actors, features, phenomena) we forecast or observe and plan *around*. A shared playhead and selection bind them: scrub the timeline and the map ghost moves and the curves track. There is **no privileged view**; defaults are role-shaped — implementer: timeline + map; command: matrix + task board; operator: the wingman card [DEC-24].
 
v1 ships the **timeline/Gantt** (activities and legs as bars, slack visible), the **map**, the **task board** (the live face of the commitment register, carrying conflict display), lite **state curves**, and the **Sync Matrix** (DEC-53) — which generalises timeline and curves: they are now *presets* of one projection mechanism, not separate constructs. The tension matrix arrives at H2. **Reading the Sync Matrix vertically** — scanning up and down at one instant across disparate tracks — is how a planner spots opportunities and risks (a surface window that coincides with darkness and no satellite overhead). In v1 that scan is the human's; the system aligns the tracks but does not yet detect the coincidence — automation of that (advisory, banded — the temporal sibling of the suitability surface) is designed-for, not claimed [DEC-53, NF9]. The **track/entity catalogue is configurable** [DEC-48…50], so the range of concepts a Sync Matrix can show grows with the config, not the codebase.
 
**Direct manipulation — as constraints, never mutations.** Dragging the route through a gap becomes a *via/pin constraint*; dragging an activity bar becomes a *timing preference*; the kernel immediately re-plans around the steering, which is recorded in the stamp. Infeasible gestures surface as conflicts. Steering a plan (implementer's local control) and editing a commitment (a requirement change, routed through capture with command attribution) remain visibly different acts [DEC-24].
 
> **Why.** Planners think with their hands; but a hand-mutated plan is no longer a kernel response — its scores and defensibility evaporate. Interpreting gestures as constraints gives the fingers-on-the-map feel while every plan remains generated, scored, stamped and arguable.
 
## 7. Executing: the wingman
 
Execution is a **mode, not a subsystem**: the same kernel re-anchored to *here and now* [DEC-25]. A rolling horizon evaluates the chosen plan against the requirement continuously: per-commitment **margin bands** turn amber before red. The alert policy is principled, not tuned: **alert if and only if a band is crossed** — a margin band degrades, the plan's banded score shifts, or a hard commitment becomes infeasible. Data wobbling within a band never speaks.
 
Observations from the team are compact **fact-layer deltas**: they update channel confidence and freshness, collapse excursions into facts, and trigger re-scoring; planned-versus-observed divergence is itself displayable. Re-planning mid-mission holds the requirement fixed and presents alternatives as diffs; at H2, **warm branches** — plans pre-built against the named excursions, kept scored in idle compute — collapse decision latency to a glance. The operator face is one glanceable card: next commitment, next threat, plan health.
 
**Comms reality.** The design point is *fully functional at zero bandwidth, opportunistic at a trickle* [DEC-25]. Only compact deltas transit: observations, amendments, verdicts, alerts. Bulk data was provisioned beforehand — and **plans themselves transit as stamps**: because the kernel is deterministic, HQ regenerates the identical plan from the stamped inputs in a few hundred bytes. Workstation-class local compute is assumed throughout, which is what makes the fan-out, robustness sampling and warm branches realistic.
 
> **Why.** The moment of need is exactly the moment connectivity fails. Everything above — provisioned AO, local compute, banded alerts, stamp-as-transmission — exists so the wingman's value survives the silence.
 
## 8. Learning
 
One rule governs the whole stage: **learning proposes stamped versions; humans adopt them** — nothing learned ever silently mutates the system [DEC-26].
 
The execution log plus selection rationales *are* the **after-action record** (H1, essentially free), and determinism makes it a **perfect replay** of plan versus actual. From there: channel **recalibration** from observed-versus-forecast residuals, reviewed and published as new baseline versions (H2/H3); **playbooks** — requirement templates that carry their *negotiated semantics*, so the next mission inherits resolved ambiguity, not just structure (H2); **inferred appetites** suggested from the record of choices the implementer actually made (H3); and **procurement studies** that vary the platform profile over a mission set on the same kernel (H3).
 
> **Why.** The organisation, not just the plan, should get smarter — but a planning tool that quietly rewrites its own assumptions would destroy the very auditability it sells. Versioned, attributed adoption keeps the learning loop inside the trust model.
 
## 9. Cross-cutting qualities
 
| # | Quality | Essence |
|---|---------|---------|
| NF1 | Single source of evaluation | Optimiser and every view score via the same code — shown = optimised; scope is the *evaluated world+plan state*, entity tracks included [DEC-52] |
| NF2 | End-to-end auditability | Order → commitment → plan element → decision → execution event, all attributed |
| NF3 | Determinism (kernel-scoped) | Pure function of stamped inputs; for audit/testing/sharing, *not* discrimination |
| NF4 | Explainability | "Why this plan, not that" answerable at decision time |
| NF5 | Client-side, zero-bandwidth capable | Provisioned AO; trickle-comms opportunistic; plans transit as stamps |
| NF6 | Performance | Planning in seconds; wingman near-instant; high local compute assumed |
| NF7 | Extensibility | Pluggable activity types, effects, outcome-models, channels, domains, views |
| NF8 | Shareability | A stamped artifact reproduces exactly on handoff (conditional on Q15 security) |
| NF9 | Honesty | Satisfaction ≠ cost; confidence surfaced; "optimal *under these assumptions*" |
| NF10 | Big handfuls | Bands sized to uncertainty; within-band = equivalent; judgement picks within |
| NF11 | Multi-domain | Land, sea or air behind one medium interface; one domain per plan in v1 |
| NF12 | Multi-echelon *(command-post, designed-for)* | An **Operation** owns requirements as means and is planned by a **Scheme of Manoeuvre** banded on its End-State; appetite recurses by echelon (DEC-6/59) |
| NF13 | Multi-force *(command-post, designed-for)* | Blue/red/green entities under one intent ontology, three kernel stances; ROE as hard constraints + soft objectives; roles as config-declared surfaces writing stamped deltas (DEC-60/61) |
 
## 10. What this is not
 
- **Not an extension of Blockbuster.** Blockbuster remains a standalone demonstrator and idea source; this is a greenfield build that inherits its *lessons* (NF1, NF3, NF5, the fan-out) and corrects its anti-patterns (per-leg independence, static-only optimality claims) [DEC-8].
- **Not an oracle.** It makes judgement explicit, auditable and repeatable; it does not certify that the encoded judgements are true.
- **Not (yet) multi-vehicle, multi-user, or cross-domain simultaneous** — all designed-for, all deferred [DEC-15, DEC-20, Q3].
- **Not a precision ranking machine.** Within-uncertainty differences are ties, by design [DEC-14].
## 11. Open questions
 
v1 scale/performance targets (Q11) · security & classification scope (Q15) · spatial dimensionality for air/sea (Q17) · multi-vehicle staging (Q3) · register process & cadence with the dev team (Q5) · depth of doctrine alignment in external framing (Q6). All tracked in the Discussion Register, which remains the living source of truth.
 
---
 
## Annex A — Maturity layers roadmap
 
**Layer 0 — the demonstrator (exists).** Blockbuster: risk-channel cost model, deterministic A\*, COA fan-out, shared cost code, client-side delivery. Role: stakeholder on-ramp and idea source; not a component [DEC-8].
 
**Layer 1 — v1 core (H1).** Single domain, single vehicle, single user (all hats), single world baseline, synthetic terrain. Activity model with the tractable vocabulary; scripted negotiated capture with stamped defaults; commitment register and lifecycle; hybrid event/sampled time on (cell, continuous-time); the banded handful with hard/soft commitments and waiting-as-a-move; two-layer comparison with comparability guard and selection rationale; four synchronised views with constraint-based direct manipulation; wingman in simulated-playback mode with banded alerts and manual observations; after-action record with perfect replay. **Command-post scaffolding (not-preclude):** Entity `allegiance`, Operation/End-State/Scheme *slots*, role view-presets + write-scopes, and cross-role **writes-as-stamped-deltas** are present so v1 cannot wall out the stretch. *Every Layer-2/3 interface present but trivially populated.*
 
**Layer 2 — depth (H2).** Real-terrain provisioned AOs; named excursions + robustness labels + warm branches; lazy kernel-in-the-loop clarification; minimal-relaxation suggestions; tension view; GPS/live position; trickle-comms delta & stamp sync; assisted channel recalibration; playbooks; multi-user roles; **the command-post layer** — Operation→Scheme portfolio planning, capability-matched force allocation, the ORBAT authoring page, bespoke registered role surfaces, and source-provider ingress for near-real-time feeds (DEC-59/60/61).
 
**Layer 3 — reach (H3).** Probabilistic/evasive search, concealment and adversarial reasoning; world-mutating effects; value-of-information reconnaissance; information-to-forecast activities; NL tasking and LLM-assisted capture; inferred appetites; multi-vehicle and heterogeneous teams; cross-domain coordination; procurement/digital-twin studies; automated recalibration; **a reactive/adversarial red force** (wargaming, via the DEC-51 discipline promotion path), **full multi-echelon Operations**, and **live multi-node role distribution** over the trickle-comms delta path (DEC-61).
 
*The staging pattern is uniform: architect the interface now, ship the simple case first — terrain, excursions, activities, effects, comms and learning all follow it.*
