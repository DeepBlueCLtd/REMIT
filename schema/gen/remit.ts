export type RequirementId = string;
export type CommitmentId = string;
export type BaselineId = string;
export type ChannelId = string;
export type ExcursionId = string;
export type ProfileId = string;
export type EntityId = string;
export type AspectName = string;
export type OrbatId = string;
export type AssetId = string;
export type PlanId = string;
export type ConflictId = string;
export type SelectionRationaleId = string;
/**
* Whether a commitment must hold or is best-effort (DEC-22).
*/
export enum Criticality {
    
    /** must hold */
    hard = "hard",
    /** best-effort; carries a priority, with authority from provenance */
    soft = "soft",
};
/**
* The verb of an activity (DEC-16); v1 set, pluggable registry (NF7).
*/
export enum ActivityType {
    
    visit = "visit",
    loiter = "loiter",
    avoid = "avoid",
    transit = "transit",
    maintain = "maintain",
};
/**
* The lifecycle state of a commitment (B4). `at-risk` is live-only (E2) and not stored.
*/
export enum CommitmentState {
    
    proposed = "proposed",
    negotiated = "negotiated",
    committed = "committed",
    satisfied = "satisfied",
    violated = "violated",
    waived = "waived",
    superseded = "superseded",
};

export enum AnswerStatus {
    
    /** answered by the operator */
    confirmed = "confirmed",
    /** filled from a stamped default */
    defaulted = "defaulted",
};

export enum AmbiguityStatus {
    
    open = "open",
    resolved = "resolved",
};
/**
* The medium a baseline / profile / movement model operates in (DEC-20).
*/
export enum Domain {
    
    land = "land",
    sea = "sea",
    air = "air",
};
/**
* Per-cell land-cover class used by the skeleton's mobility raster.
*/
export enum Terrain {
    
    road = "road",
    track = "track",
    open = "open",
    rough = "rough",
    forest = "forest",
    marsh = "marsh",
    ford = "ford",
    water = "water",
};
/**
* How a channel or movement model is realised (DEC-49). `provider` = a computed service behind the seam.
*/
export enum Realisation {
    
    raster = "raster",
    analytic = "analytic",
    parametric = "parametric",
    provider = "provider",
};
/**
* How predictable a channel is over time (DEC-21) — drives sampling.
*/
export enum Predictability {
    
    static = "static",
    periodic = "periodic",
    dynamic = "dynamic",
};

export enum ConfidenceLevel {
    
    high = "high",
    medium = "medium",
    low = "low",
};
/**
* Side typing on an entity (DEC-60). Selects the kernel STANCE — plan-for (blue) / avoid-assess (red) / respect (green). v1 is display-only (NF9 honest floor).
*/
export enum Allegiance {
    
    /** own force */
    blue = "blue",
    /** hostile / adversary (threat source; passive in v1) */
    red = "red",
    /** neutral / host-nation / civilian (ROE & collateral; inert in v1) */
    green = "green",
};
/**
* The render-class of one time-varying facet of an entity (DEC-52/53).
*/
export enum AspectType {
    
    /** a position → map glyph / distance-along-track */
    cell = "cell",
    /** a numeric value → a line (altitude, fuel, distance) */
    scalar = "scalar",
    /** a time interval → a band */
    window = "window",
    /** an up/down or phase value → ticks */
    status = "status",
};
/**
* The skeleton's three candidate strategies (the "handful" of plans).
*/
export enum StrategyKey {
    
    /** fastest by time/speed */
    direct = "direct",
    /** keeps to tracked/road surfaces */
    tracked = "tracked",
    /** favours exposure-reducing cover */
    covered = "covered",
};
/**
* A coarse three-level qualitative band for cost / robustness (C2/C6, NF10).
*/
export enum Band {
    
    robust = "robust",
    marginal = "marginal",
    fragile = "fragile",
};
/**
* The slack band on a single commitment's satisfaction (A2, NF10). `crossed` = violated.
*/
export enum MarginBand {
    
    robust = "robust",
    marginal = "marginal",
    tight = "tight",
    crossed = "crossed",
};
/**
* A commitment's verdict in a plan's scores.
*/
export enum Verdict {
    
    satisfied = "satisfied",
    violated = "violated",
    waived = "waived",
};
/**
* The kind of one leg in a plan's schedule.
*/
export enum ScheduleLegKind {
    
    transit = "transit",
    /** a wait — e.g. "await low-tide window" at a tidal ford */
    hold = "hold",
    visit = "visit",
    exfil = "exfil",
};
/**
* The outcome of the tidal-ford wait-vs-detour weighing (ADR-0006).
*/
export enum TideMode {
    
    /** no tidal ford on the route */
    no_ford = "no-ford",
    /** ford open at the bank — cross now */
    open = "open",
    /** hold at the bank for the low-tide window, then cross */
    wait = "wait",
    /** ford-free detour reaches the RV sooner */
    detour = "detour",
};
/**
* Whether a clash is built into the request or emerges from the schedule (C1).
*/
export enum ConflictKind {
    
    /** e.g. no route exists */
    structural = "structural",
    /** e.g. the schedule is infeasible */
    emergent = "emergent",
};
/**
* Why the wingman raised an execution alert (E3).
*/
export enum AlertCauseType {
    
    hard_infeasible = "hard_infeasible",
    band_crossing = "band_crossing",
    /** a re-plan changed the tide decision's mode (ADR-0007) */
    tide_reassessment = "tide_reassessment",
};

export enum LogEntryKind {
    
    Alert = "Alert",
    Observation = "Observation",
    Waiver = "Waiver",
    Replan = "Replan",
};
/**
* The kind of in-flight operator perturbation applied during Execute (issue
*/
export enum ExecutionEventKind {
    
    /** a +N min hold spliced at the vehicle's current cell, re-timed through the tide-aware chooser (ADR-0006/0007) */
    obstruction = "obstruction",
    /** a cell ahead declared impassable, forcing an in-flight re-route around it */
    block = "block",
};
/**
* The nature of a green asset's protection rule (tagged for the future DEC-60 J3 hard/soft split).
*/
export enum Protection {
    
    /** no-go / no-strike area (future HARD constraint) */
    keep_out = "keep_out",
    /** collateral to be minimised (future SOFT objective) */
    minimise_effect = "minimise_effect",
};


/**
 * Who decided, under what authority, when. Stamped on every committing act — this is universal rule 2 (DEC-15, NF2).
 */
export interface Attribution {
    /** the role-hat the author wore */
    issuing_role?: string,
    /** the authority the act was taken under */
    authority?: string,
    /** the author */
    by?: string,
    /** ISO timestamp of the act */
    at?: string,
}


/**
 * The source and trust of a datum or entity (DEC-19). Trivial defaults in v1.
 */
export interface DataProvenance {
    /** source-class — one of: self, planned, forecast, observed, provider. The prose model separates entity kind (self/actor/feature/phenomenon) from data provenance (planned/forecast/observed); the skeleton folds them, using self/forecast/provider. A documented string rather than an enum (see the AspectType note). */
    kind: string,
    confidence?: string,
    /** how recent — e.g. "provisioned" */
    freshness?: string,
}


/**
 * Hash-link back to the version this one supersedes (universal rule 1).
 */
export interface Lineage {
    /** id of the prior Requirement version */
    previous_version?: string,
    /** reference to the amending order, if any */
    amending_order_ref?: string,
}


/**
 * A single grid location.
 */
export interface Waypoint {
    x: number,
    y: number,
    /** a human-friendly name, e.g. "OP-21,3" */
    alias?: string,
}


/**
 * A single H3 hex location — the hex-grid successor to Waypoint (ADR-0014). Identified by its H3 index, with an optional lat/lng centre for rendering.
 */
export interface HexCell {
    /** the H3 cell index (res 9) */
    h3: string,
    /** cell-centre latitude */
    lat?: number,
    /** cell-centre longitude */
    lng?: number,
}


/**
 * A commitment's ownership and waiver authority (B3).
 */
export interface CommitmentProvenance {
    issuing_role?: string,
    authority?: string,
    owner?: string,
    /** who may waive this commitment */
    waiver_authority?: string,
    expiry?: string,
    rationale?: string,
}


/**
 * The command's narrative intent, owned as a versioned immutable object (DEC-5/18). Amend it and you get a new version with lineage — the original stands. Content-addressed: its id is the hash of its canonical form.
 */
export interface Requirement {
    /** content id (sha256:…) of the canonical form (DEC-35) */
    id: string,
    /** amendment → new version (B5) */
    version?: number,
    /** the command's narrative, in their words */
    intent: string,
    /** issuing role/authority + time */
    provenance?: Attribution,
    /** the promises it decomposes into */
    commitments?: Commitment[],
    lineage?: Lineage,
}


/**
 * One thing the plan must achieve (DEC-16/17/22). Either hard (must hold) or soft with a priority. Carries the negotiated contract text and any unresolved ambiguities, and walks a lifecycle of states.
 */
export interface Commitment {
    /** e.g. "cmt-1" */
    id: string,
    activity: Activity,
    criticality: string,
    provenance?: CommitmentProvenance,
    /** the negotiated contract record (DEC-17) */
    capture?: Capture,
    state?: string,
}


/**
 * The negotiation record behind a commitment — answers, the canonical contract text, open ambiguities (DEC-17).
 */
export interface Capture {
    answers?: Answer[],
    /** the canonical contract text read back to the operator */
    echo_back?: string,
    /** resolvable-later */
    ambiguities?: Ambiguity[],
}



export interface Answer {
    /** which question slot */
    slot?: string,
    value?: string,
    status?: string,
    by?: string,
    at?: string,
}



export interface Ambiguity {
    question?: string,
    status?: string,
    /** what hinges on resolving it */
    consequence?: string,
}


/**
 * The verb of a commitment — visit, loiter, avoid, transit, maintain (DEC-16/21). `where` is a Waypoint or a boolean predicate over map cells (DEC-33); `when` is a window, before/after, or recurring. Always inlined in its Commitment (no independent identity).
 */
export interface Activity {
    type: string,
    /** the location — a map cell (skeleton uses {x, y, alias}) */
    where?: Waypoint,
    /** alternative to `where` — a boolean predicate tree over cells (DEC-33) */
    where_predicate?: CellPredicate,
    when?: TimingConstraint,
    duration?: DurationBound,
    modifiers?: ActivityModifiers,
    /** "v1: self-state delta / persistent marker (always empty in the skeleton)" */
    effects?: Effect[],
    /** "v1: boolean | duration; pluggable (probabilistic = H3)" */
    outcome_model?: string,
    /** channel ids to sample / trigger on (DEC-21) */
    relevant_channels?: ChannelId[],
}


/**
 * A boolean tree over map cells (DEC-33): an atom, or and/or/not of sub-predicates. Atoms are a pluggable registry (land-cover, elevation, slope, static-LOS, near(feature, dist)). Conceptual — the skeleton uses Waypoints only.
 */
export interface CellPredicate {
    /** "atom | and | or | not" */
    op?: string,
    /** the atom name when op = atom (e.g. land-cover, slope) */
    atom?: string,
    /** atom parameters */
    params?: string,
    /** sub-predicates for and/or/not */
    children?: CellPredicate[],
}


/**
 * When an activity must happen — exactly one form is used (DEC-16).
 */
export interface TimingConstraint {
    /** an absolute or anchored interval */
    window?: TimeWindow,
    /** deadline, in mission minutes */
    before_min?: number,
    /** earliest start, in mission minutes */
    after_min?: number,
    /** "recurring(period, anchor) — conceptual" */
    recurring?: string,
}



export interface TimeWindow {
    start_min?: number,
    end_min?: number,
}



export interface DurationBound {
    /** minimum dwell, in minutes */
    min_min?: number,
    max_min?: number,
}



export interface ActivityModifiers {
    stationary?: boolean,
    /** "entry | exit | visit" */
    be_at_role?: string,
    /** sequencing — id of a commitment this must follow (e.g. "cmt-1") */
    after?: string,
}


/**
 * The world as known truth (DEC-7/20/28): a medium (land/sea/air grid) carrying channels and per-cell attributes, plus a single fact layer that observations append to. Immutable and versioned; the kernel always evaluates baseline ⊕ excursion ⊕ plan-effects-to-date (DEC-19).
 */
export interface Baseline {
    /** content id of the canonical form (DEC-35) */
    id: string,
    name?: string,
    version?: number,
    medium?: Medium,
    /** the grid cells (skeleton, row-major) */
    cells?: Cell[],
    channels?: Channel[],
    /** the one truth; observations append here */
    facts?: FactLayer,
    /** when the world is expected to shift */
    forecast_changepoints?: Changepoint[],
    lineage?: Lineage,
}


/**
 * A forecast time at which a channel is expected to shift (e.g. a tidal ford opening) (DEC-21).
 */
export interface Changepoint {
    /** mission minutes */
    at_min?: number,
    /** the channel that shifts */
    channel?: ChannelId,
    /** what changes, in words */
    change?: string,
}


/**
 * The domain, grid and cell-attribute schema of a baseline (DEC-20/28).
 */
export interface Medium {
    domain: string,
    grid?: Grid2D,
    /** the names of the per-cell attributes carried (e.g. mobility, cover) */
    cell_attrs?: string[],
}



export interface Grid2D {
    w: number,
    h: number,
    /** cell edge length, in metres */
    cell_m?: number,
}


/**
 * One grid cell's attributes (skeleton mobility raster).
 */
export interface Cell {
    terrain?: string,
    /** 0–1 speed factor (0 = impassable) */
    mobility?: number,
    /** 0–1 concealment */
    cover?: number,
}


/**
 * A field over space and time — tide, cloud, risk, mobility (DEC-19/21). Its values are conceptually `f(cell, t)`, however realised; that function is resolved across the seam (DEC-49) and is *not* a data slot here. For parametric/periodic channels the realising parameters (`params`) *are* data and are modelled.
 */
export interface Channel {
    /** e.g. "tide", "mobility" */
    id: string,
    /** what the field measures, e.g. "water_level", "speed_factor" */
    domain_type?: string,
    realisation?: string,
    confidence?: string,
    freshness?: string,
    /** sampling cadence (tide coarse, cloud fine) (DEC-21) */
    sampling_step_min?: number,
    predictability?: string,
    /** realising parameters for parametric channels */
    params?: ChannelParams,
}


/**
 * Parameters of a parametric/periodic channel — e.g. the skeleton's tidal ford (ADR-0006).
 */
export interface ChannelParams {
    period_min?: number,
    /** first low tide, in mission minutes */
    low_tide_min?: number,
    /** ±minutes around low tide the ford is wadeable */
    open_half_width_min?: number,
    /** the cell/feature the params apply to (e.g. the ford alias) */
    applies_to?: string,
}


/**
 * The single truth layer; observations append here (E5). Collapses excursions and forecast entities over time.
 */
export interface FactLayer {
    observations?: Observation[],
}


/**
 * Per-domain cost of travel, and anisotropic — a property of the edge between cells, not the cell (DEC-49/34): slope-along-direction on land, current/wind vectors at sea and in air. Its cost function `cost_speed = f(cell→cell, t, profile)` is behaviour, resolved across the seam — only `domain` and `realisation` are data here. Not yet implemented in the v1 skeleton.
 */
export interface MovementModel {
    domain?: string,
    /** "parametric(type, params) | provider" */
    realisation?: string,
}


/**
 * A named, versioned set of deltas layered on a baseline — "what if the weather turns?" — without disturbing the underlying truth (DEC-7). Not yet implemented in the v1 skeleton.
 */
export interface Excursion {
    id: string,
    name?: string,
    version?: number,
    /** the baseline version it sits on */
    base?: BaselineId,
    delta?: ChannelDelta[],
}


/**
 * How the world is edited (DEC-34): a parametric delta (time-shift, scale, mask) from a pluggable registry, or a raw cell patch (the escape hatch). Not yet implemented in the v1 skeleton.
 */
export interface ChannelDelta {
    /** "parametric | cell_patch" */
    kind?: string,
    /** the parametric delta type (registry) — when kind = parametric */
    type?: string,
    /** parameters for the parametric delta */
    params?: string,
    /** raw (cell, t, value) patches — when kind = cell_patch */
    patches?: CellPatch[],
}



export interface CellPatch {
    x?: number,
    y?: number,
    /** mission minutes */
    t?: number,
    /** the patched value */
    value?: string,
}


/**
 * A delta a plan's activity applies from a point in time (DEC-19/34) — a ChannelDelta or a self-state delta. Referenced from Activity.effects; always empty in the v1 skeleton.
 */
export interface Effect {
    source_plan?: PlanId,
    /** the activity that applies the effect */
    source_activity?: string,
    /** mission minutes */
    active_from?: number,
    delta?: ChannelDelta,
}


/**
 * Everything provisioned for an Area of Operations, packaged ready to plan against (DEC-11/12/52). Not yet assembled as one object in the v1 skeleton.
 */
export interface AOPackage {
    baseline_versions?: BaselineId[],
    excursions?: ExcursionId[],
    profiles?: ProfileId[],
    /** located things to display */
    entities?: EntityId[],
}


/**
 * What a platform can do — the fixed capabilities a sensitivity sweep varies (DEC-19/20, F5). Immutable and versioned, content-addressed.
 */
export interface Profile {
    /** content id of the canonical form (DEC-35) */
    id: string,
    name?: string,
    version?: number,
    domain?: string,
    /** how fast, where */
    speed_by_medium?: SpeedByMedium,
    endurance?: Endurance,
    /** what it can perceive */
    sensors?: string[],
    /** how it manoeuvres (e.g. "wheeled") */
    dynamics?: string,
}


/**
 * Speed per medium (skeleton: land only).
 */
export interface SpeedByMedium {
    land_kph?: number,
    sea_kph?: number,
    air_kph?: number,
}



export interface Endurance {
    /** starting fuel, 0–100 */
    fuel_pct?: number,
    /** how long it can keep going */
    hours?: number,
}


/**
 * The platform right now — the live condition the kernel re-anchors to during execution (DEC-19). It is the privileged self-entity (DEC-52): its fields are the dynamic aspects of the `self` Entity (position → map/distance; endurance/availability → state curves).
 */
export interface State {
    /** which cell */
    position?: Waypoint,
    /** the current mission time, in minutes */
    clock_min?: number,
    /** how much fuel is left, 0–100 */
    endurance_fuel_pct?: number,
    /** "available | down" */
    availability?: string,
}


/**
 * Anything located with an identity — yourself, an actor, a feature, a phenomenon (DEC-52). Where a Channel is a field, an Entity is a thing, projected across synchronised views. To affect the plan it is *cast* to a Channel or Commitment (actor → moving risk channel; window → timing commitment); in v1 entities are display-only. Skeleton note: aspects are keyed by name in an object (phase/fuel/height/pass); modelled here as a list of named Aspects.
 */
export interface Entity {
    /** e.g. "ent-self", "ent-tide", "ent-sat" */
    id: string,
    label?: string,
    /** conceptual kind (DEC-52) — one of: self, actor, feature, phenomenon. Optional; the skeleton folds this into provenance.kind. A documented string rather than an enum (see the AspectType note). */
    kind?: string,
    provenance?: DataProvenance,
    /** side typing (DEC-60); absent ⇒ unaligned / own-context as today */
    allegiance?: string,
    aspects?: Aspect[],
}


/**
 * One facet of an entity, over time (DEC-52/53) — its position, an altitude, a timing window, an up/down status — rendered onto a shared axis by a view. Its value `f(t)` is behaviour, evaluated across the seam, and is not a data slot; the render-type, unit and bounds *are* data.
 */
export interface Aspect {
    /** e.g. "phase", "fuel", "height", "pass" */
    name: string,
    type: string,
    /** unit for scalar aspects (e.g. "%") */
    unit?: string,
    /** "[min, max] bounds for scalar aspects" */
    domain?: number[],
    /** the source channel, if any */
    channel_ref?: ChannelId,
}


/**
 * The roster of participants & potential participants for a scenario — the authoring root (DEC-60). Versioned & immutable when committed (lineage); the editable working draft mirrors to localStorage. v1 authors the red & green sides; blue is the existing own force.
 */
export interface Orbat {
    /** content id of the canonical form (DEC-35) */
    id: string,
    name?: string,
    version?: number,
    assets?: Asset[],
    lineage?: Lineage,
}


/**
 * One ORBAT entry — a first-class located thing (DEC-52) typed by allegiance, with independently-tunable parameters. Display-only in v1.
 */
export interface Asset {
    /** stable per-instance identity (not the label) */
    id: string,
    allegiance: string,
    /** human label; need not be unique */
    label?: string,
    /** AO location (H3 cell / lat-lon) */
    position?: Waypoint,
    /** reach / footprint radius in metres */
    extent_m?: number,
    /** present iff allegiance = blue */
    blue?: BlueParams,
    /** present iff allegiance = red */
    red?: RedParams,
    /** present iff allegiance = green */
    green?: GreenParams,
    /** true on the single blue asset reconciled from the existing planned own-force (ROVER-1); it drives the plan via the existing machinery and is protected from removal. */
    canonical_own_force?: boolean,
}


/**
 * Own-force pool member (capability-matched ALLOCATION deferred to H2; display-only in v1 — does not drive routing). The capability vocabulary is the seam a future Scheme matches to a requirement's activity needs (DEC-59/60).
 */
export interface BlueParams {
    /** "available | down" (own State mirror, DEC-52) */
    availability?: string,
    /** capability tags a future Scheme matches to activity needs (stub) */
    capabilities?: string[],
    /** mission-minute window the asset is available (display-only Sync-Matrix track) */
    availability_window?: TimeWindow,
}


/**
 * Hostile threat picture (threat SOURCE only in v1; reactive behaviour deferred, DEC-51).
 */
export interface RedParams {
    /** graded threat severity (e.g. 1..5) */
    severity?: number,
    /** mission-minute windows the threat is active (Sync-Matrix track) */
    active_windows?: TimeWindow[],
}


/**
 * Neutral / collateral picture (ROE & collateral emission deferred; inert in v1, DEC-60 J3).
 */
export interface GreenParams {
    /** graded collateral weight (e.g. 1..5) */
    sensitivity?: number,
    /** nature of the rule (tagged for the future hard/soft split) */
    protection?: string,
}


/**
 * Every input that determines a plan, bundled into one identity (DEC-23/24/29): which requirement, which world, which config core, what appetites and steering, which kernel and seed. A plan's id IS the hash of its Stamp, so two plans are comparable only when their stamps share a basis (the comparability guard). Skeleton additions (DEC-47): `profile_version` and `start` are part of identity because the plan depends on the platform and the starting state.
 */
export interface Stamp {
    /** id of the requirement version */
    requirement_version?: RequirementId,
    /** id of the baseline version */
    baseline_version?: BaselineId,
    /** ids of the excursion versions (empty in v1) */
    excursions?: ExcursionId[],
    /** hash of the world-defining config core — medium/channels/movement-model/providers/vocabulary; the instance shell is excluded (DEC-48) */
    config_core_hash?: string,
    /** id of the profile version (skeleton addition, DEC-47) */
    profile_version?: ProfileId,
    /** the starting state (skeleton addition, DEC-47) */
    start?: StartState,
    /** the implementer's risk dials (DEC-6) */
    appetites?: Appetite[],
    /** interpreted operator gestures / no-go constraints (DEC-24) */
    steering?: Constraint[],
    /** e.g. "mock-0.1" — part of identity (DEC-29) */
    kernel_version?: string,
    /** RNG seed for strategy ordering — part of identity (DEC-29) */
    strategy_seed?: number,
}


/**
 * The starting position and clock baked into a Stamp (skeleton, DEC-47).
 */
export interface StartState {
    x?: number,
    y?: number,
    clock_min?: number,
}


/**
 * One risk-appetite dial setting (DEC-6) — e.g. tempo = rapid, exposure = cautious.
 */
export interface Appetite {
    /** "e.g. tempo, exposure" */
    axis?: string,
    /** "e.g. deliberate/balanced/rapid, bold/balanced/cautious" */
    setting?: string,
}


/**
 * One interpreted operator steering gesture (DEC-24) — e.g. a no-go region.
 */
export interface Constraint {
    /** "e.g. no-go" */
    type?: string,
    cells?: Waypoint[],
}


/**
 * One candidate strategy in the plan handful (skeleton).
 */
export interface Strategy {
    key: string,
    label?: string,
    /** the axis it optimises, e.g. "time/speed" */
    axis?: string,
    /** a one-line description */
    blurb?: string,
}


/**
 * A candidate solution whose id IS the hash of its Stamp (DEC-5/22/29). Its materialisation (schedule, trajectory, state curves) is cached and regenerable; its scores and first-class conflicts make it comparable. The skeleton also carries the chosen `strategy` and the `tide_decision` weighing.
 */
export interface Plan {
    /** "= hash(Stamp, strategy)" */
    id: string,
    strategy?: Strategy,
    /** authoritative — the plan's identity basis */
    stamp?: Stamp,
    /** cached, regenerable; null when infeasible */
    materialisation?: Materialisation,
    scores?: Scores,
    /** the exfil wait-vs-detour weighing (ADR-0006); null when no ford */
    tide_decision?: TideDecision,
    /** first-class, named clashes (C1) */
    conflicts?: Conflict[],
}


/**
 * The cached, regenerable working-out of a plan; absent when the plan is infeasible.
 */
export interface Materialisation {
    schedule?: ScheduleLeg[],
    trajectory?: TrajectoryPoint[],
    state_curves?: StateCurves,
    /** the tide decision at plan time */
    tide?: TideDecision,
    verified?: boolean,
    /** the kernel version that verified the materialisation */
    kernel_version_verified?: string,
}


/**
 * One leg of a plan's schedule. Exfil legs may carry a tide hold (ADR-0006).
 */
export interface ScheduleLeg {
    kind: string,
    label?: string,
    start_min?: number,
    end_min?: number,
    /** the commitment this leg serves (visit/exfil legs) */
    commitment_id?: CommitmentId,
}


/**
 * One sampled point on the platform's path; coordinates may be fractional, time/fuel rounded to 1 dp for IEEE stability.
 */
export interface TrajectoryPoint {
    x?: number,
    y?: number,
    /** mission minutes */
    t?: number,
    fuel_pct?: number,
}


/**
 * The end-state of the platform's curves over the plan (v1 carries fuel only).
 */
export interface StateCurves {
    fuel_end_pct?: number,
}


/**
 * A plan's comparable scores, read under the comparability guard (A2/C2/C6, NF10).
 */
export interface Scores {
    satisfaction?: Satisfaction[],
    cost_band?: string,
    robustness_band?: string,
}


/**
 * One commitment's verdict and slack within a plan.
 */
export interface Satisfaction {
    commitment_id?: CommitmentId,
    label?: string,
    /** slack in minutes; may be negative */
    margin_min?: number,
    margin_band?: string,
    verdict?: string,
}


/**
 * The result of the tidal-ford wait-vs-detour weighing (ADR-0006): the kernel materialises the exfil both ways — wait at the bank vs a ford-free detour — and commits to the earlier RV arrival, publishing the choice here.
 */
export interface TideDecision {
    mode: string,
    /** minutes held at the bank before crossing */
    wait_min?: number,
    /** mission minutes the ford route reaches the RV */
    ford_rv?: number,
    /** mission minutes the detour route reaches the RV; null when no detour exists */
    detour_rv?: number,
    /** the choice, in words */
    narrative?: string,
}


/**
 * A first-class, named clash when commitments cannot all be kept (C1) — not a silent failure.
 */
export interface Conflict {
    id: string,
    kind: string,
    /** the commitments in tension */
    parties?: CommitmentId[],
    /** what the clash is, in words */
    narrative?: string,
}


/**
 * The record of a choice (DEC-23): which plan won, which it beat, on which axis, with the after-mitigation bands, and who decided. Content-addressed.
 */
export interface SelectionRationale {
    /** content id of the canonical form (DEC-35) */
    id: string,
    /** the winning plan */
    chosen?: PlanId,
    /** the field it beat */
    beaten?: PlanId[],
    /** "what tipped it — e.g. time/speed, exposure, robustness, completeness" */
    deciding_axis?: string,
    /** the justification narrative */
    note?: string,
    /** the risk-appetite selections at the time */
    appetites?: Appetite[],
    /** "e.g. armed-escort" */
    mitigations?: string[],
    /** cost/robustness bands after mitigations */
    chosen_bands?: ChosenBands,
    by?: string,
    /** "e.g. implementer" */
    role?: string,
    at?: string,
}



export interface ChosenBands {
    cost?: string,
    rob?: string,
}


/**
 * The append-only live history of a mission (DEC-23/25/26): alerts when a band is crossed, observations that update truth, waivers, and replans — never overwritten. Together with rationales and stamps it gives a complete after-action record with perfect replay (F1).
 */
export interface ExecutionLog {
    entries?: LogEntry[],
}


/**
 * Base of the append-only execution log; the store stamps each with a `seq`.
 */
export interface LogEntry {
    kind: string,
    /** 0-indexed sequence, stamped on append */
    seq?: number,
    /** mission minutes */
    at?: number,
}


/**
 * A band crossing or hard-infeasibility raised during execution (E3).
 */
export interface Alert extends LogEntry {
    cause?: AlertCause,
}



export interface AlertCause {
    type: string,
    /** the phased commitment being tracked (e.g. "observe", "exfil") */
    commitment?: string,
    /** the prior band state */
    from?: string,
    /** the new band state */
    to?: string,
}


/**
 * A fact delta appended to the baseline's fact layer (E5).
 */
export interface Observation extends LogEntry {
    fact_delta?: FactDelta,
    /** "e.g. operator" */
    source?: string,
    /** "e.g. reported" */
    confidence?: string,
}



export interface FactDelta {
    note?: string,
    /** "e.g. track-state, sighting, weather" */
    tag?: string,
}


/**
 * A relaxed commitment, attributed (B3). Not yet logged in the v1 skeleton.
 */
export interface Waiver extends LogEntry {
    commitment_id?: CommitmentId,
    by?: string,
    authority?: string,
    rationale?: string,
}


/**
 * A move from one committed plan to another, with rationale (DEC-36). Not yet logged in the v1 skeleton.
 */
export interface Replan extends LogEntry {
    from?: PlanId,
    to?: PlanId,
    rationale_ref?: SelectionRationaleId,
}


/**
 * A stamped cross-role write to the shared store (DEC-61): a role's contribution is an attributed delta — the same write path that serialises over `/sync` later (DEC-25), so going multi-node is transport, not re-architecture. Base of the concrete delta kinds; v1 emits SteeringDelta. Write-scope *enforcement* is designed-for — the delta is attributed (NF2) but not yet scope-checked.
 */
export interface Delta {
    /** "the write-scope this delta falls under — e.g. steering" */
    scope?: string,
    /** the contributing author */
    by?: string,
    /** "the contributing role-hat — e.g. duty-officer-plans" */
    role?: string,
    /** when it was contributed (DEC-15, NF2) */
    at?: string,
}


/**
 * The first DEC-61 write built in v1: an operator's *applied intel* — denied (no-go) cells — shared to the store as steering constraints, where every surface (e.g. the Data Analysis monitor, including a popped-out one) sees it land. Risk appetites, by contrast, stay local (a ranking lens). Identity is content (DEC-35): the store keys it by the hash of its canonical form.
 */
export interface SteeringDelta extends Delta {
    /** the interpreted steering gestures shared (DEC-24) — e.g. no-go regions */
    constraints?: Constraint[],
}


/**
 * An in-flight operator perturbation during Execute (issue #7): an obstruction (a +N min hold at the vehicle's current cell) or a blocked cell forcing a re-route. Previously these survived only as a prose Observation note; capturing them as a typed, content-addressed store object preserves their structured inputs for inspection (the Data Analysis monitor) and replay (NF3), and re-uses the DEC-61 attributed-delta write path. Identity is content (DEC-35).
 */
export interface ExecutionDelta extends Delta {
    /** which perturbation — obstruction or block */
    event: string,
    /** mission minutes when applied (sim-time ≡ plan-time, ADR-0007) */
    at_min?: number,
    /** where the perturbation bites — the vehicle's cell for an obstruction, the blocked cell for a block */
    cell?: HexCell,
    /** the hold added by an obstruction (absent for a block) */
    delay_min?: number,
    /** the re-planned RV / mission-end after the perturbation */
    rv_min?: number,
    /** minutes the downstream holds absorbed, so the RV slipped less than delay_min (ADR-0007) */
    absorbed_min?: number,
}



