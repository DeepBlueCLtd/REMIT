// @ts-check
// views/map.js — the map projection (DEC-24, NF1) on the H3 hex grid (ADR-0016): a
// MapLibre basemap with a deck.gl overlay (H3HexagonLayer terrain + PathLayer routes +
// markers/ghost). Projects the kernel's materialisation through its evaluator (`stateAt`);
// never re-derives. Sets data-* attributes on the container for the e2e suite.

import 'maplibre-gl/dist/maplibre-gl.css';
import maplibregl from 'maplibre-gl';
import { MapboxOverlay } from '@deck.gl/mapbox';
import { H3HexagonLayer } from '@deck.gl/geo-layers';
import { PathLayer, ScatterplotLayer, TextLayer } from '@deck.gl/layers';
import { TERRAIN, fordOpenAt, AO_BOUNDS } from '../kernel/world.js';
import { stateAt } from '../kernel/kernel.js';
import { latLngToId } from '../kernel/hexgrid.js';
import { STRAT_COLORS } from './render.js';
import { ALLEGIANCE_COLOR } from '../orbat/orbat.js';

const ALLEGIANCE_RGB = Object.fromEntries(Object.entries(ALLEGIANCE_COLOR).map(([k, v]) => [k, [parseInt(v.slice(1, 3), 16), parseInt(v.slice(3, 5), 16), parseInt(v.slice(5, 7), 16)]]));

const rgb = (/** @type {string} */ h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const STRAT_RGB = Object.fromEntries(Object.entries(STRAT_COLORS).map(([k, v]) => [k, rgb(v)]));
// Keyless Carto **dark-matter** raster basemap — matches the app's dark theme and, at this
// AO's zoom, renders the estuary/coastline legibly beneath the hex overlay. A background
// layer sits *underneath* it as a graceful fallback: where the tiles are blocked (cloud
// sessions, offline, a strict CSP) the map degrades to a flat field — the style still loads,
// so deck.gl keeps a valid viewport — while in a normal browser the real basemap shows
// through wherever the hex grid is toggled off. The synthetic terrain hexes remain the
// substance; the basemap is geographic context (the AO is anchored to a real lat/lon).
const CARTO_TILES = ['a', 'b', 'c', 'd'].map((s) => `https://${s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png`);
const BASEMAP_STYLE = {
  version: 8,
  sources: { carto: { type: 'raster', tiles: CARTO_TILES, tileSize: 256, attribution: '© OpenStreetMap contributors © CARTO' } },
  layers: [
    { id: 'bg', type: 'background', paint: { 'background-color': '#1b2430' } },
    { id: 'carto', type: 'raster', source: 'carto' },
  ],
};
const shortH3 = (/** @type {string} */ h) => h.slice(-6);

/**
 * @param {HTMLElement} el  the #map container
 * @param {any} baseline
 * @param {any} ao  the hex AO
 * @param {any} places  resolved named places (base/ops/rv/...)
 */
export function makeMap(el, baseline, ao, places) {
  const cells = baseline.cells;
  let showHexes = true;   // hex-grid overlay visibility — toggleable to reveal the basemap
  let lastOpts = {};      // remembered render opts so the toggle can re-render in place
  const llById = (/** @type {number} */ id) => [ao.centers[id][1], ao.centers[id][0]];   // [lng,lat]
  const idOfH3 = (/** @type {string} */ h3) => ao.idOf.get(h3);
  const hexTerrain = ao.indexes.map((/** @type {string} */ h3, /** @type {number} */ id) => ({ h3, id, terrain: cells[id].terrain }));

  // Author-time terrain sampling (tools/sample-terrain.mjs) sets window.__REMIT_SAMPLE
  // before load: keep the basemap framebuffer readable and expose the map. Inert otherwise.
  const sampling = typeof window !== 'undefined' && /** @type {any} */ (window).__REMIT_SAMPLE;
  // maplibre's MapOptions type is stricter/narrower than the runtime options
  // (e.g. it omits preserveDrawingBuffer); cast the options blob at this library
  // boundary — the map instance itself stays fully typed.
  const map = new maplibregl.Map(/** @type {any} */ ({
    container: el, style: BASEMAP_STYLE,
    bounds: AO_BOUNDS, fitBoundsOptions: { padding: 8 }, attributionControl: { compact: true },
    preserveDrawingBuffer: sampling,
  }));
  map.on('error', () => {});
  if (sampling) /** @type {any} */ (window).__map = map;
  const overlay = new MapboxOverlay({ interleaved: false, layers: [] });
  map.addControl(overlay);

  /** @type {((cell: {h3: string, id: number}) => void) | null} */
  let clickFn = null;
  // The deck.gl overlay canvas sits above MapLibre's and its event manager stops click
  // propagation, so listen on the container in the CAPTURE phase (fires before deck) and
  // unproject the pixel through the map transform.
  el.addEventListener('click', (e) => {
    if (!clickFn) return;
    // Clicks on map controls (the hex toggle, attribution, …) are not cell picks.
    if (e.target instanceof Element && e.target.closest('.maplibregl-ctrl')) return;
    const rect = el.getBoundingClientRect();
    const lngLat = map.unproject([e.clientX - rect.left, e.clientY - rect.top]);
    const id = latLngToId(ao, lngLat.lat, lngLat.lng);
    if (id !== undefined) clickFn({ h3: ao.indexes[id], id });
  }, true);

  const idOf = (/** @type {any} */ o) => (o == null ? undefined : (o.id ?? ao.idOf.get(o.h3)));

  // ORBAT asset → [lng,lat]: accept either a resolved lat/lng position or a bare H3 cell.
  const assetLngLat = (/** @type {any} */ a) => {
    const p = a?.position;
    if (!p) return null;
    if (typeof p.lng === 'number' && typeof p.lat === 'number') return [p.lng, p.lat];
    if (p.h3 && ao.idOf.has(p.h3)) { const id = ao.idOf.get(p.h3); return [ao.centers[id][1], ao.centers[id][0]]; }
    return null;
  };

  function buildLayers(/** @type {any} */ opts) {
    const { plans = [], selected = null, t = 0, target = null, rv = null,
            candidates = null, highlight = null, obstructions = [], nogo = [], blocked = [],
            assets = [], selectedAsset = null } = opts;
    const fordOpen = fordOpenAt(t);
    const nogoIds = [...new Set(nogo.map(idOf).filter((/** @type {any} */ x) => x !== undefined))];
    const blockedIds = [...new Set(blocked.map(idOf).filter((/** @type {any} */ x) => x !== undefined))];

    const terrainColor = (/** @type {any} */ d) => {
      if (d.terrain === 'ford') { const c = rgb(fordOpen ? TERRAIN.ford.color : TERRAIN.water.color); return [c[0], c[1], c[2], 235]; }
      const c = rgb(TERRAIN[/** @type {keyof typeof TERRAIN} */ (d.terrain)].color); return [c[0], c[1], c[2], d.terrain === 'water' ? 230 : 215];
    };

    // Hex-grid overlay (terrain + situational no-go / blocked highlights). Toggleable:
    // when hidden, the basemap shows through and the operational overlay (routes,
    // markers, vehicle ghost) below still renders.
    const layers = [];
    if (showHexes) {
      layers.push(new H3HexagonLayer({
        id: 'terrain', data: hexTerrain, getHexagon: (d) => d.h3, getFillColor: /** @type {any} */ (terrainColor),
        updateTriggers: { getFillColor: [fordOpen] }, highPrecision: true, getLineColor: [255, 255, 255, 18],
        lineWidthMinPixels: 1, stroked: true, filled: true, extruded: false, pickable: false,
      }));
      if (nogoIds.length) layers.push(new H3HexagonLayer({ id: 'nogo', data: nogoIds, getHexagon: (id) => ao.indexes[id], highPrecision: true, getFillColor: [255, 123, 114, 90], getLineColor: [255, 123, 114, 210], lineWidthMinPixels: 1, stroked: true, filled: true }));
      if (blockedIds.length) layers.push(new H3HexagonLayer({ id: 'blocked', data: blockedIds, getHexagon: (id) => ao.indexes[id], highPrecision: true, getFillColor: [255, 123, 114, 150], getLineColor: [255, 123, 114, 255], lineWidthMinPixels: 2, stroked: true, filled: true }));
    }

    // Routes — non-selected faint, selected bold (or all bold in compare mode).
    const path = (/** @type {any} */ p) => p.materialisation.trajectory.map((/** @type {any} */ q) => [q.lng, q.lat]);
    for (const p of plans) {
      if (!p.materialisation) continue;
      const isSel = selected && p.id === selected.id;
      const base = STRAT_RGB[p.strategy.key] || [200, 200, 200];
      layers.push(new PathLayer({
        id: 'route-' + p.strategy.key, data: [p], getPath: path,
        getColor: /** @type {any} */ (selected && !isSel ? [base[0], base[1], base[2], 110] : base),
        getWidth: isSel ? 3.6 : (selected ? 2 : 3), widthUnits: 'pixels', capRounded: true, jointRounded: true,
      }));
    }

    // Markers.
    const dot = (/** @type {any} */ o, /** @type {any} */ color, /** @type {number} */ r) => ({ pos: llById(idOf(o)), color, r });
    const marks = [dot(places.base, [235, 240, 245], 90)];
    if (candidates) for (const c of candidates) marks.push(dot(c, highlight && highlight.h3 === c.h3 ? [255, 123, 114] : [200, 210, 220], 80));
    if (target) marks.push(dot(target, [255, 123, 114], 95));
    if (rv) marks.push(dot(rv, [227, 179, 65], 95));
    layers.push(new ScatterplotLayer({ id: 'marks', data: marks.filter((m) => m.pos), getPosition: (d) => d.pos, getFillColor: (d) => d.color, getRadius: (d) => d.r, radiusUnits: 'meters', stroked: true, getLineColor: [8, 12, 18], lineWidthMinPixels: 1.5 }));
    if (candidates) layers.push(new TextLayer({ id: 'cand-labels', data: candidates, getPosition: /** @type {any} */ ((/** @type {any} */ c) => llById(idOf(c))), getText: (c) => c.key ?? '', getColor: [235, 240, 245], getSize: 12, getPixelOffset: [0, -15], outlineWidth: 2, outlineColor: [8, 12, 18, 255], fontWeight: 700 }));

    // Vehicle ghost(s).
    const ghosts = [];
    if (selected) { const g = stateAt(selected, t); if (g) ghosts.push({ pos: [g.lng, g.lat], color: STRAT_RGB[selected.strategy.key] || [68, 147, 248], r: 150 }); }
    else for (const p of plans) { if (!p.materialisation) continue; const g = stateAt(p, t); if (g) ghosts.push({ pos: [g.lng, g.lat], color: STRAT_RGB[p.strategy.key] || [230, 237, 243], r: 110 }); }
    if (ghosts.length) layers.push(new ScatterplotLayer({ id: 'ghost', data: ghosts, getPosition: (d) => d.pos, getFillColor: (d) => d.color, getRadius: (d) => d.r, radiusUnits: 'meters', stroked: true, getLineColor: [13, 17, 23], lineWidthMinPixels: 2 }));

    // Obstruction markers (✕) at lat/lng.
    if (obstructions.length) layers.push(new TextLayer({ id: 'obstructions', data: obstructions, getPosition: (o) => [o.lng, o.lat], getText: () => '✕', getColor: [255, 123, 114], getSize: 22, fontWeight: 700, outlineWidth: 2, outlineColor: [8, 12, 18, 255] }));

    // ORBAT assets (DEC-60) — allegiance-coloured marker + faint extent ring + label, each
    // visually distinct across the three sides (FR-005). Display-only (NF9): drawn from the
    // authored roster, never derived. The selected asset's marker is enlarged/ringed.
    const placed = assets.map((/** @type {any} */ a) => ({ a, pos: assetLngLat(a) })).filter((/** @type {any} */ x) => x.pos);
    if (placed.length) {
      const col = (/** @type {any} */ a) => ALLEGIANCE_RGB[a.allegiance] ?? [200, 210, 220];
      layers.push(new ScatterplotLayer({
        id: 'asset-extents', data: placed, getPosition: (/** @type {any} */ d) => d.pos,
        getRadius: (/** @type {any} */ d) => d.a.extent_m ?? 800, radiusUnits: 'meters',
        stroked: true, filled: true,
        getFillColor: /** @type {any} */ ((/** @type {any} */ d) => [...col(d.a), 26]),
        getLineColor: /** @type {any} */ ((/** @type {any} */ d) => [...col(d.a), 150]), lineWidthMinPixels: 1.2,
        updateTriggers: { getRadius: [assets], getFillColor: [assets], getLineColor: [assets] },
      }));
      layers.push(new ScatterplotLayer({
        id: 'asset-marks', data: placed, getPosition: (/** @type {any} */ d) => d.pos,
        getRadius: (/** @type {any} */ d) => (selectedAsset && d.a.id === selectedAsset ? 150 : 95), radiusUnits: 'meters',
        stroked: true, filled: true,
        getFillColor: /** @type {any} */ ((/** @type {any} */ d) => col(d.a)),
        getLineColor: /** @type {any} */ ((/** @type {any} */ d) => (selectedAsset && d.a.id === selectedAsset ? [240, 246, 252] : [8, 12, 18])),
        lineWidthMinPixels: 1.5,
        updateTriggers: { getRadius: [selectedAsset, assets], getFillColor: [assets], getLineColor: [selectedAsset] },
      }));
      layers.push(new TextLayer({
        id: 'asset-labels', data: placed, getPosition: (/** @type {any} */ d) => d.pos,
        getText: (/** @type {any} */ d) => d.a.label ?? d.a.id, getColor: [235, 240, 245], getSize: 12,
        getPixelOffset: [0, -16], outlineWidth: 2, outlineColor: [8, 12, 18, 255], fontWeight: 700,
      }));
    }

    return layers;
  }

  function setData(/** @type {any} */ opts) {
    const { selected = null, t = 0, plans = [], highlight = null, nogo = [], blocked = [], obstructions = [], assets = [] } = opts;
    el.dataset.fordState = fordOpenAt(t) ? 'open' : 'closed';
    // Expose the placed ORBAT roster to the e2e suite: "id:allegiance" per placed asset.
    const placedAssets = assets.filter((/** @type {any} */ a) => assetLngLat(a));
    el.dataset.assets = placedAssets.map((/** @type {any} */ a) => `${a.id}:${a.allegiance}`).join('|');
    el.dataset.assetCount = String(placedAssets.length);
    if (selected) { const g = stateAt(selected, t); el.dataset.ghost = g ? `${g.lng.toFixed(4)},${g.lat.toFixed(4)},${g.phase}` : ''; }
    else el.dataset.ghost = plans.filter((/** @type {any} */ p) => p.materialisation).map((/** @type {any} */ p) => { const g = stateAt(p, t); return g ? `${p.strategy.key}:${g.lng.toFixed(4)},${g.lat.toFixed(4)}` : ''; }).filter(Boolean).join('|');
    el.dataset.highlight = highlight ? shortH3(highlight.h3) : '';
    el.dataset.nogo = nogo.map((/** @type {any} */ c) => shortH3(c.h3)).join('|');
    el.dataset.blocked = blocked.map((/** @type {any} */ c) => shortH3(c.h3 ?? ao.indexes[c.id ?? c])).join('|');
    el.dataset.obstructions = obstructions.map((/** @type {any} */ o) => shortH3(o.h3)).join('|');
  }

  // Execute-mode follow-cam: keep the live vehicle comfortably on screen (esp. when zoomed
  // in) without fighting the user — only recenter once the ghost drifts into the outer
  // margin of the viewport, and preserve the current zoom (pan only).
  function keepInView(/** @type {number} */ lng, /** @type {number} */ lat) {
    let b;
    try { b = map.getBounds(); } catch { return; }        // viewport not ready yet
    const mx = (b.getEast() - b.getWest()) * 0.2;
    const my = (b.getNorth() - b.getSouth()) * 0.2;
    if (lng < b.getWest() + mx || lng > b.getEast() - mx ||
        lat < b.getSouth() + my || lat > b.getNorth() - my) {
      map.easeTo({ center: [lng, lat], duration: 600 });
    }
  }

  function render(/** @type {any} */ opts = {}) {
    lastOpts = opts;
    overlay.setProps({ layers: buildLayers(opts) });   // deck overlay renders above the basemap
    setData(opts);
    if (opts.follow && opts.selected) {
      const g = stateAt(opts.selected, opts.t ?? 0);
      if (g) keepInView(g.lng, g.lat);
    }
  }

  // Hex-grid visibility toggle, as a MapLibre control button (top-right). Flipping it
  // re-renders the remembered opts so the change is immediate at any lifecycle stage.
  const hexToggleCtrl = {
    onAdd() {
      const div = document.createElement('div');
      div.className = 'maplibregl-ctrl maplibregl-ctrl-group hex-toggle';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.testid = 'hex-toggle';
      btn.textContent = '⬡ Hex grid';
      const sync = () => {
        btn.setAttribute('aria-pressed', String(showHexes));
        btn.title = showHexes ? 'Hide the hex grid' : 'Show the hex grid';
        el.dataset.hexes = showHexes ? 'on' : 'off';
      };
      btn.addEventListener('click', () => { showHexes = !showHexes; sync(); render(lastOpts); });
      sync();
      div.appendChild(btn);
      return div;
    },
    onRemove() {},
  };
  map.addControl(hexToggleCtrl, 'top-right');

  return {
    render,
    onCellClick(/** @type {(cell: {h3: string, id: number}) => void} */ fn) { clickFn = fn; },
  };
}
