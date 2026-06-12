// hexviz.js — a standalone preview of the H3 "Solway crossing" scenario: terrain hexes +
// the three strategy routes + markers, over a MapLibre basemap. Doubles as the prototype
// for views/map.js and as the source for spec evidence screenshots.
import 'maplibre-gl/dist/maplibre-gl.css';
import maplibregl from 'maplibre-gl';
import { MapboxOverlay } from '@deck.gl/mapbox';
import { H3HexagonLayer } from '@deck.gl/geo-layers';
import { PathLayer, ScatterplotLayer, TextLayer } from '@deck.gl/layers';
import { buildWorld, TERRAIN } from './js/kernel/world.js';
import { planHandful } from './js/kernel/kernel.js';
import { contentId } from './js/shapes/canonical.js';

const rgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const STRAT_COLORS = { direct: [120, 180, 255], tracked: [120, 230, 140], covered: [235, 180, 90] };
const ELEV = { forest: 170, rough: 75, marsh: 12, open: 45, track: 28, road: 8, ford: 6, water: 0 };

const w = buildWorld();
const { ao, places } = w;
const cells = w.baseline.cells;
const hexData = ao.indexes.map((h3, id) => ({ h3, terrain: cells[id].terrain }));
const op = places.ops[0], rv = places.rvEast;

const req = { commitments: [
  { id: 'cmt-1', activity: { type: 'visit', where: { h3: op.h3, alias: 'OP-A' }, when: { window: { start_min: 30, end_min: 120 } }, duration: { min_min: 45 } } },
  { id: 'cmt-2', activity: { type: 'transit', where: { h3: rv.h3, alias: 'RV' }, when: { before_min: 240 } } },
] };

async function main() {
  const { plans } = await planHandful({
    requirement: req, requirement_version: await contentId(req),
    baseline: w.baseline, baseline_version: await contentId(w.baseline),
    profile: w.profile, profile_version: await contentId(w.profile),
    state: w.state, config_core: await contentId(w.configCore),
    appetites: { tempo: 'balanced', exposure: 'balanced' }, steering: [], strategy_seed: 1337, ao,
  });
  const routes = plans.filter((p) => p.materialisation)
    .map((p) => ({ key: p.strategy.key, path: p.materialisation.trajectory.map((t) => [t.lng, t.lat, 200]) }));

  const labels = [
    { p: [places.base.lng, places.base.lat], t: 'BASE', c: [235, 240, 245] },
    { p: [op.lng, op.lat], t: 'OP-A', c: [255, 215, 90] },
    { p: [rv.lng, rv.lat], t: 'RV', c: [120, 255, 180] },
    ...places.fords.map((f) => ({ p: [f.lng, f.lat], t: f.key, c: [220, 170, 110] })),
  ];

  // Blank dark style (no network): external basemap tiles are blocked in cloud sessions,
  // so we render the deck.gl hexes over a flat background here; the real Carto basemap
  // appears in the deployed app where the browser can reach the CDN.
  const blankStyle = {
    version: 8, sources: {},
    layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#0b0f14' } }],
  };
  const map = new maplibregl.Map({
    container: 'map',
    style: blankStyle,
    bounds: [[-3.215, 54.918], [-2.985, 55.000]],
    fitBoundsOptions: { padding: 16 },
    attributionControl: false,
  });
  const overlay = new MapboxOverlay({ interleaved: false, layers: [] });
  map.addControl(overlay);

  const draw = () => overlay.setProps({ layers: [
    new H3HexagonLayer({
      id: 'terrain', data: hexData, getHexagon: (d) => d.h3,
      getFillColor: (d) => { const c = rgb(TERRAIN[d.terrain].color); return [c[0], c[1], c[2], d.terrain === 'water' ? 235 : 225]; },
      getElevation: (d) => ELEV[d.terrain] ?? 30, elevationScale: 1,
      getLineColor: [255, 255, 255, 20], lineWidthMinPixels: 1, stroked: true, filled: true, extruded: true, pickable: false,
    }),
    ...routes.map((r) => new PathLayer({
      id: 'route-' + r.key, data: [r], getPath: (d) => d.path, getColor: STRAT_COLORS[r.key],
      getWidth: 3.2, widthUnits: 'pixels', capRounded: true, jointRounded: true, opacity: 0.95,
    })),
    new ScatterplotLayer({
      id: 'places', data: labels, getPosition: (d) => [d.p[0], d.p[1], 210], getFillColor: (d) => d.c,
      getRadius: 95, radiusUnits: 'meters', stroked: true, getLineColor: [8, 12, 18], lineWidthMinPixels: 1.5,
    }),
    new TextLayer({
      id: 'labels', data: labels, getPosition: (d) => [d.p[0], d.p[1], 210], getText: (d) => d.t, getColor: [235, 240, 245],
      getSize: 13, getPixelOffset: [0, -16], fontWeight: 700, outlineWidth: 2, outlineColor: [8, 12, 18, 255],
      getTextAnchor: 'middle', getAlignmentBaseline: 'center',
    }),
  ] });

  draw();                       // overlaid deck.gl draws independently of the basemap style
  map.on('load', draw);
  map.on('idle', () => { window.__vizReady = true; });
  setTimeout(() => { window.__vizReady = true; }, 4000);
  window.__setView = (o) => map.flyTo({ duration: 0, ...o });
}
main();
