# REMIT — v1 Data Model (draft 0.4)

*Derived from Discussion Register v22. Per DEC-9 the model is a consequence of the decided capabilities; each object cites the decisions it falls out of. Notation is conceptual (language-neutral); `?` = optional, `[]` = list.*

*v0.3 adds: `Entity` + aspects/projection (DEC-52/53), `MovementModel` (DEC-49), provider-realisation of `Channel` (DEC-49), and the config world-core hash in `Stamp` (DEC-48).*

*Status note (DEC-57): **LinkML is now the source of truth** for these shapes — one schema generates JSON Schema, TypeScript, Pydantic and an HTML doc site. This markdown is the **interim hand-maintained reference** and becomes a generated view once the schema is authored; a cross-language (TS≡Python) canonical-serialisation/identity spec (DEC-35) is its companion. Service/function-valued fields (provider `f(cell,t)`, endpoints) stay in the seam contract, not LinkML.*

*v0.4 adds the **command-post layer** (DEC-59/60/61), all **designed-for slots** — present so the shapes do not preclude the stretch, trivially populated or absent in v1 (DEC-56 freeze guard): `Operation`, `EndState`/`Objective` (§1A) and `SchemeOfManoeuvre`; `Entity.allegiance` + optional `end_state` + the **asset** facet (§5A); `Role`, attributed cross-role `Delta` and **source-provider** ingress (§9). The typed-effect vocabulary (B3) is an open registry. These remain LinkML-targeted (DEC-57); function/endpoint fields stay in the seam contract.*

**Three universal rules.**
1. **Versioned objects are immutable.** Requirements, baselines, excursions and profiles never mutate; change = new version with lineage. (DEC-5/7/18; enables A3 stamps and NF2/NF8.)
2. **Everything decided is attributed.** Role-hat + author + time on every committing act. (DEC-15, NF2.)
3. **Identity is content.** Every immutable object's ID = hash of its canonical serialisation; names are aliases; lineage is hash-linked. (DEC-35; NF8 verifiable, NF2 tamper-evident, DEC-25 dedup.)

---

## 1. Requirement (the primary object) — DEC-5, DEC-18

```
Requirement {
  id, version                    // immutable; amendment → new version (B5)
  intent: text                   // command's narrative intent
  provenance: Attribution        // issuing role/authority, time
  commitments: [Commitment]
  lineage: { previous_version?, amending_order_ref? }
}
```

## 1A. Operation — the apex (designed-for; DEC-59)

```
Operation {                                   // distinct apex type ABOVE Requirement (D1)
  id, version                                 // immutable; amendment → new version, RE-SCORES Schemes (DEC-5/23)
  intent: text                                // commander's narrative intent
  provenance: Attribution
  end_state: EndState                         // what the Operation wants TRUE (A2)
  requirements: [requirement_id]              // owned tasks = the MEANS
  appetite?: { axis -> setting }              // CO's cross-objective priority — DEC-6 at this echelon
  lineage: { previous_version? }
}
EndState {
  objectives: [Objective]
  // typed-effect vocab (entity-condition|area-condition|posture|information) = OPEN registry seam (B3/NF7)
}
Objective {                                   // a.k.a. Decisive Condition
  id, kind?                                   // open typed-effect tag (B3); absent => generic predicate
  predicate: CellPredicate | EntityPredicate  // GRADED predicate over evaluated world+entity+plan state (NF1, B1)
  target?, window?                            // threshold / time window
  weight?                                     // soft priority (appetite-flavoured)
}
SchemeOfManoeuvre {                           // the Operation's PLAN = allocation across its Requirements ("complex COA")
  id = hash(SchemeStamp)                      // stamp-identity, parallels Plan (DEC-29)
  allocation: [ { requirement_id, plan_id?, assets: [entity_id] } ]   // which assets to which task
  effect_profile: [ { objective_id, band: robust|marginal|tight } ]   // scored vs End-State (A2 shape)
  cost_band, robustness_band
}
// TWO-LEVEL BANDING (NF10): Schemes banded by effect profile; mission Plans (§7) by cost.
// v1: absent or a single CANNED Scheme; portfolio search is a kernel-released discipline (DEC-51), H2/H3.
```

## 2. Commitment — DEC-16/17/18/22

```
Commitment {
  id
  activity: Activity
  criticality: hard | soft(priority)        // DEC-22; priority authority from provenance
  provenance: { issuing_role, authority, owner,
                waiver_authority, expiry?, rationale }   // B3
  capture: {                                  // DEC-17
    answers: [ { slot, value, status: confirmed|defaulted, by, at } ]
    echo_back: text                           // the canonical contract text
    ambiguities: [ { question, status: open|resolved, consequence? } ]  // resolvable-later
  }
  state: proposed | negotiated | committed |
         satisfied | violated | waived | superseded      // B4; at-risk is live-only (E2)
  waiver?: { by, authority, at, rationale }
}
```

## 3. Activity — DEC-16, DEC-21

```
Activity {
  type: visit | loiter | avoid | transit | maintain   // v1; pluggable registry (NF7)
  where: Waypoint | CellPredicate           // DEC-33: boolean tree
                                            // atom | and([]) | or([]) | not(p)
                                            // atoms (pluggable registry): land-cover,
                                            // elevation, slope, static-LOS, near(feature, dist)
  when:  { window(abs|anchored) | before | after | recurring(period, anchor) }
  duration?: { min?, max? }
  modifiers: { stationary?, be_at_role?: entry|exit|visit }
  effects: [Effect]                         // v1: self-state delta, persistent marker
  outcome_model: boolean | duration         // v1; pluggable (probabilistic = H3)
  relevant_channels: [channel_id]           // DEC-21 sampling/trigger scope
}
```

## 4. World model — DEC-7/11/19/20/21

```
Baseline {
  id, version
  medium: { domain: land|sea|air, grid: Grid2D, cell_attrs }   // DEC-20/28
  channels: [Channel]
  facts: FactLayer                          // one truth; observations append here
  forecast_changepoints: [time]
}
Channel {
  id, domain_type
  values: f(cell, t)                        // however realised — see realisation below
  realisation: raster | analytic | provider // DEC-49: provider = computed service behind the seam
  confidence, freshness                     // DEC-19; trivial defaults in v1
  sampling_step, predictability             // DEC-21 (tide coarse, cloud fine+wide)
}
// Provider channel (DEC-49): deterministic within a version; provider version ∈ config core (DEC-48).
//   contract: materialise(AO, window, step) + evaluate(cell,t) + evaluate_batch([(cell,t)])
//   kernel consumes materialise-by-default + lazy/sparse evaluate (route cells only), CA-cached.
MovementModel {                             // DEC-49: per-domain, ANISOTROPIC — an edge, not a cell, property
  domain
  cost_speed: f(cell_from → cell_to, t, profile)   // land slope-along-dir; sea/air current/wind vectors
  realisation: parametric(type, params) | provider // registry primary + provider escape hatch (DEC-34 pattern)
}                                           // networked `traverse` permitted but warned (inner loop, NF6)
Excursion { name, version, base: baseline_version, delta: [ChannelDelta] }   // DEC-7
ChannelDelta = ParametricDelta(type, params)   // DEC-34: pluggable registry —
             | CellPatch[(cell, t, value)]     //   time-shift / scale / mask…; patch = escape hatch
Effect    { source: (plan, activity), active_from: t, delta: ChannelDelta | StateDelta }
// Kernel always evaluates: baseline ⊕ excursion ⊕ plan-effects-to-date (DEC-19)
AOPackage { baseline_versions, excursions, profiles, entities? }   // the provisioned bundle (DEC-11/12; entities DEC-52)
```

## 5. Own force — DEC-19/20

```
Profile { id, version, domain, speed_by_medium, endurance, sensors, dynamics }  // F5 varies this
State   { position: cell, clock: t, endurance_fuel, availability }              // v1 set
```
// Own-force is the privileged **self-entity** (DEC-52): State's fields are its dynamic *aspects*
//   (position → map/distance-along-track; endurance/availability → state-curves D4).

## 5A. Entities & projections — DEC-52/53

```
Entity {                                    // a LOCATED thing with identity (DEC-52); cf. Channel = field
  id, version?
  kind: self | actor | feature | phenomenon // self = own force; feature replaces DEC-33 `feature`
  allegiance?: blue | red | green           // ORBAT typing (DEC-60); selects kernel STANCE: plan-for|avoid-assess|respect
  end_state?: EndState                       // red/green may carry intent of their own (one ontology, three stances) — designed-for
  asset?: { available:[window], capability:[tag] }  // BLUE only: allocatable by a Scheme; capability matched to Activity needs; consumption/sharing = designed-for
  provenance: planned | forecast | observed  // + confidence, freshness (DEC-19); collapse via E5
  aspects: [ Aspect ]
}
// GREEN projects ROE (DEC-60, J3): each green rule -> a hard Commitment (DEC-16) AND/OR a soft Objective (§1A) — the generator emits BOTH.
Aspect {
  name
  type: cell | scalar | window | status     // position | altitude/dist | time-window | up/down
  value: f(t)                               // a time-function; bounds DERIVED from aspects
  unit?, channel_ref?                        // scalar aspects may carry a unit / source channel
}
// PROJECTION (DEC-53): a view renders (Entity.aspect → render-type) on a shared axis.
//   render-types: scalar→line, window→band, status→ticks, cell→map-glyph &/or distance-along-track
//   catalogue (entity types · aspects · render-types · role view-presets) is CONFIG (DEC-48/49/50).
// To affect the plan, an entity is CAST to a Channel/Commitment (DEC-52):
//   actor/phenomenon → moving risk Channel ; window → timing Commitment.
//   Full planning-AGAINST entities (multi-actor) = C9/H3; v1 entities are display-only.
```

## 6. Stamp (plan identity) — DEC-23/24/29/62

```
Stamp {
  requirement_version
  baseline_version, excursions: [excursion_version]
  config_core_hash                          // DEC-48: world-defining config core (medium/channels/
                                            //   movement-model/providers/vocabulary); instance shell excluded
  profile_version, start: { x, y, clock_min } // DEC-62: own-force profile (DEC-19) + start state — the plan
                                            //   depends on both, so both are identity inputs (NF3)
  appetites: { axis → setting }             // implementer's, DEC-6
  steering: [Constraint]                    // interpreted gestures, DEC-24
  kernel_version, strategy_seed             // DEC-29: part of identity
}
```

## 7. Plan — DEC-5/22/29/62

```
Plan {
  id = hash(Stamp, strategy)                // stamp ⊕ strategy: one stamp yields a handful (DEC-62/29)
  strategy: Strategy                        // the candidate's axis within the handful (the discriminator)
  stamp: Stamp                              // authoritative — the comparability basis (A3)
  materialisation: {                        // cached, regenerable
    schedule: [ { activity_ref | leg, start: t, end: t } ]
    trajectory: [ (cell, t) ]
    state_curves: f(t)
    verified: bool, verified_at, kernel_version_verified
  }
  scores: {
    satisfaction: [ { commitment_id, verdict: satisfied|violated|waived,
                      margin_band: robust|marginal|tight } ]      // A2, NF10
    cost_band, robustness_band: robust|marginal|fragile           // C2/C6
  }
  conflicts: [Conflict]                     // C1: first-class, named
}
Conflict { id, kind: structural|emergent, parties: [commitment_id], narrative }
```

## 8. Decision & execution records — DEC-23/25/26

```
SelectionRationale { chosen: plan_id, beaten: [plan_id],
                     deciding_axis: tag, note, by, role, at }     // DEC-23
ExecutionLog: append-only [
  Alert       { at, cause: band_crossing(commitment_id | plan_score | hard_infeasible) } // E3
  Observation { at, fact_delta, source, confidence }              // E5 → FactLayer
  Waiver      { commitment_id, by, authority, at, rationale }
  Replan      { from: plan_id, to: plan_id, rationale_ref }
]
// Log + rationales + stamps = after-action record with perfect replay (F1, DEC-26)
```

---

## 9. Roles, attributed deltas & ingress — the command-post seam (designed-for; DEC-61)

```
Role {                                        // config-DECLARED bundle; rides the DEC-48 instance SHELL (identity-free)
  id
  view_preset: preset_ref                     // which projections/surfaces it sees (DEC-53)
  write_scope: [delta_type]                   // which deltas it may author — ENFORCED + ATTRIBUTED (DEC-15/NF2)
  modes: [ plan | execute ]                   // active in which mode (DEC-25)
  surface?: component_ref                      // optional BESPOKE registered render-component (config-bound; release-then-compose)
}
// Every cross-role write is a stamped Delta carrying its authoring role — the SAME path that serialises over /sync later (DEC-25).
SourceProviderDelta {                         // DEC-49 provider seam run as INGRESS: external feed -> stamped facts
  source, at, role,                           //   live in field / mock on bench, swapped with no surface change
  delta: Observation | EntityDelta            //   becomes a stamped Observation/Entity fact (collapses excursions; updates confidence/freshness)
}
// NF3 holds: determinism is over STAMPED inputs; the feed adds latency-of-truth, not non-determinism.
// v1: roles = view-presets + write-scopes over the single shared store (sequential; concurrency deferred with multi-node).
```

## Relationships (one paragraph)

A **Requirement** version owns **Commitments**, each wrapping an **Activity**. The kernel — a pure function (NF3) — takes a **Stamp**'s inputs (requirement version, **Baseline** ⊕ **Excursions**, the **config core hash**, appetites, steering, seed) plus a **Profile** and the domain **MovementModel**, and emits the handful of **Plans**; each plan's identity *is* its stamp, with materialisation cached and verified (DEC-29). Comparison reads plans' **scores** under the comparability guard (same stamp basis — now including the config core, DEC-48). Committing writes a **SelectionRationale**. Execution re-anchors the same kernel to live **State** (the self-**Entity**'s aspects); **Observations** append to the baseline's **FactLayer** (collapsing excursions and forecast entities), and the **ExecutionLog** accumulates the after-action record. **Entities** (self/actor/feature/phenomenon) are projected across synchronised **views** (map, Sync-Matrix, state-curves — all the same mechanism, DEC-52/53) and *cast* to channels/commitments where they must affect the plan. Learning proposes new *versions* (baseline, templates, appetite suggestions) — never mutations (DEC-26).

## Open items (v0.2 → v0.3)

- Where C10 suitability surfaces sit (derived artefact of Channel + window; likely not stored).
- ~~Schema/kernel migration~~ → DEC-36: migrate-and-flag (record permanent; replay best-effort on current kernel, divergence banded & labelled).
- **Entity cast-to-channel/commitment** concrete mechanics (actor→moving channel; window→commitment) — interface decided (DEC-52), internals not.
- **Render-type registry** contents + role **view-preset** defaults (DEC-53).
- **Config core/shell field inventory** — exact split of what feeds `config_core_hash` (DEC-48); default-profile placement (inline vs CA-referenced).
- Coincidence **Opportunity** object (dual to `Conflict`) — designed-for, H3 (DEC-53).
- **Command-post slots (DEC-59/60/61, designed-for):** `SchemeStamp` field inventory (what makes a Scheme's identity); whether `Operation.appetite` is hashed; the typed-effect vocabulary (B3) registry contents; `asset` capability↔Activity-need matching shape; `Delta`/`write_scope` enumeration; `SourceProviderDelta` vs the §8 `/sync` Observation shape (reconcile, do not duplicate).
