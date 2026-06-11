# 003 — H3 hex grid for routing & visualisation

**Status:** in progress · **Source of truth:** the requirements interview (this session)
distilled into the approved implementation plan, and **ADR-0010 / ADR-0011 / ADR-0012**
(`docs/project_notes/decisions.md`). Supersedes the square-grid assumptions of
`specs/002-walking-skeleton/`.

> Authored directly (cloud session, by maintainer request via an interview): the maintainer
> and Claude developed the objectives below interactively; this file records scope,
> requirements, and exit-criteria evidence.

## Context — why

REMIT's skeleton planned on an abstract **28×18 square grid** (8-connected A\*, octile
heuristic) with a hand-rolled **Canvas** renderer — no geography, no dependencies, no build.
We move routing **and** visualisation to a **hexagonal grid based on H3** to gain isotropic
movement, real-world grounding, and a richer map, while preserving the seven-stage spine and
the project's determinism guarantee (NF3).

## Objectives (from the interview)

1. **Uniform routing** — hex 6-neighbour movement removes the square grid's
   diagonal-vs-orthogonal cost asymmetry; all neighbours are equidistant.
2. **Genuine H3 indexing** — cells are *real* H3 indexes (the AO is anchored to a real
   lat/lon), so the H3 **hierarchy** and **dataset interop** are available later. The
   hierarchy is **latent now** (future-proofing only — no LOD / coarse-to-fine / aggregation).
3. **Real-map visualisation** — render on a real **MapLibre** basemap with a **deck.gl** H3
   overlay, replacing the Canvas renderer.

## Decisions (confirmed) — see ADR-0010/0011/0012

| Topic | Decision |
|---|---|
| Index / maths | `h3-js`; base resolution **res 9** (~300 m cells, ~1.2k over a ~14×9 km AO) |
| Geography | abstract-now / geo-later: synthetic terrain over a **real lat/lon anchor** (Solway Firth head ≈ 54.96°N, 3.10°W) |
| Rendering | MapLibre GL + deck.gl `H3HexagonLayer`/`PathLayer`/`IconLayer` via `MapboxOverlay`; keyless **Carto dark-matter** basemap (OSM-raster / demotiles fallback) |
| Build | adopt **Vite** (`base: './'`, `root: app`, `outDir: ../dist`); `pages.config.yml` build hooks |
| Scope | full replacement of the square grid + a **fresh scenario** authored on hexes |
| Scenario | **river delta with multiple tidal fords** → **time-dependent (time-expanded) A\*** |
| Dependencies | minimised, maintainer-approved (ADR-0010): `h3-js`, `maplibre-gl`, `@deck.gl/*`, `vite` |
| Determinism (NF3) | plan identity keys off H3 index **strings** (no floats); bearing-sorted neighbours + frozen adjacency + the existing heap tie-break |

## Functional requirements

- **F1 — Hex AO.** A deterministic res-9 H3 cell set over the AO polygon, with a stable
  sorted-id ↔ H3-string bijection and a frozen, bearing-sorted adjacency (`hexgrid.js`).
- **F2 — Hex routing.** A\* re-hosted on hex neighbours with a `gridDistance` heuristic,
  preserving the `edgeCost` interface and the three strategies (direct / tracked / covered).
- **F3 — Time-dependent crossings.** Multiple tidal fords: route feasibility is gated by
  arrival time; waiting is allowed; the wait-vs-detour outcome emerges from one search and is
  surfaced as `plan.tide_decision`. (Subsumes ADR-0006's leg-level chooser.)
- **F4 — Execution.** `stateAt` interpolates in lat/lng along hex-centre trajectories;
  obstruction/reroute (block-a-hex) re-plans from (current cell, now).
- **F5 — Map.** Terrain hexes, routes, markers, vehicle ghost, tide-aware ford styling,
  click-to-pick-hex, and no-go painting render on the MapLibre + deck.gl map.
- **F6 — Fresh scenario.** A small, deterministic "Solway crossing" AO: inland base, OP(s)
  over the channels, RV on the far bank, several tidal-ford hexes (waths) on the tide channel.

## Non-functional requirements

- **NF3 (determinism)** — identical inputs reproduce identical plan ids across a full reload;
  the stamp contains only canonical-JSON-safe fields (H3 strings, ints, enums).
- **No-regression** — the seven-stage spine, Sync Matrix, coincidence windows, and replay
  behave as before (entities/sync-matrix/learn/seam/stores/canonical are unchanged).
- **Build/deploy** — `npm run build` produces `dist/`; PR preview and deploy publish it via
  the existing config-driven workflows.

## Exit criteria → evidence

Asserted by `e2e/skeleton.spec.ts` (map-interaction adapted to hexes) and captured in
`evidence/screenshots/`:

1. **World** — the res-9 hex AO renders over the real basemap; config core canonicalises and
   hashes; candidate OPs render. `01-world.png`
2. **Capture** — picked OP highlighted on the map; committed `visit` round-trips. `02-capture.png`
3. **Plan** — one stamped call yields a handful of distinct banded plans; same stamp → same
   ids across a full reload (NF3). `03-plan.png`
4. **Compare / Views** — selection rationale committed; ghost projects on a route. `04`,`05`
5. **Execute** — block-a-hex reroutes; multi-ford tide sequencing (hold/detour) visible.
   `06-execute.png`
6. **Learn** — execution log → after-action record; perfect replay from stamp.

## Out of scope (this spec)

- Active H3 **hierarchy** use (LOD, coarse-to-fine planning, aggregation) — latent only.
- **Real terrain** data ingest — terrain/mobility/cover stay synthetic over the real basemap.
- Keyed/satellite basemaps — keyless tiles only.

## WebGL-in-cloud note

deck.gl/MapLibre need WebGL2; the bundled `@sparticuz/chromium` may need SwiftShader flags.
A spike validates in-session screenshots; functional e2e is `data-*`/state-based, so
determinism testing does not depend on headless WebGL.
