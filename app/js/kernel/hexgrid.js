// @ts-check
// kernel/hexgrid.js — the H3 hex coordinate core (ADR-0012). Browser-free: imports
// only h3-js, so `node --test` can exercise it without a bundler. Owns AO enumeration,
// the stable sorted-id <-> H3-string bijection, a frozen bearing-sorted adjacency (for
// deterministic A*, NF3), the gridDistance heuristic, and geometry helpers for rendering.

import {
  polygonToCells, cellToLatLng, cellToBoundary, latLngToCell,
  gridDisk, gridDistance,
} from 'h3-js';

/** Base resolution: res 9 ≈ 0.105 km² hexes, ~344 m centre-to-centre. */
export const H3_RES = 9;

/** AO polygon (outer ring, [lat,lng]) — Solway Firth head (Esk–Eden delta), ~14.7×9.1 km.
 *  Anchored to real lat/lon so cells are genuine H3 indexes (abstract-now / geo-later). */
export const AO_RING = [
  [54.918, -3.215],
  [54.918, -2.985],
  [55.000, -2.985],
  [55.000, -3.215],
  [54.918, -3.215],
];

const R_EARTH_M = 6371000;
const toRad = Math.PI / 180;

/** Great-circle distance in metres. */
export function haversineM(lat1, lng1, lat2, lng2) {
  const dLat = (lat2 - lat1) * toRad;
  const dLng = (lng2 - lng1) * toRad;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLng / 2) ** 2;
  return 2 * R_EARTH_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Initial bearing A->B in degrees, [0,360). Used only to order neighbours. */
export function bearingDeg(lat1, lng1, lat2, lng2) {
  const p1 = lat1 * toRad, p2 = lat2 * toRad, dl = (lng2 - lng1) * toRad;
  const y = Math.sin(dl) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  return (Math.atan2(y, x) / toRad + 360) % 360;
}

/** Even-odd point-in-ring test (ring is [lat,lng] pairs); for synthetic terrain authoring. */
export function pointInRing(lat, lng, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const yi = ring[i][0], xi = ring[i][1], yj = ring[j][0], xj = ring[j][1];
    const hit = (yi > lat) !== (yj > lat)
      && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (hit) inside = !inside;
  }
  return inside;
}

/**
 * Enumerate the res-9 AO once, deterministically. Sorting the H3 strings pins the integer
 * ids regardless of h3-js traversal order; the bearing-sorted adjacency freezes neighbour
 * visit order for the A* tie-break (NF3). Pentagon / AO-edge cells simply yield fewer
 * neighbours — handled naturally by the in-AO filter.
 * @param {[number,number][]} [ring]
 * @param {number} [res]
 * @returns {{
 *   indexes: string[], idOf: Map<string,number>, N: number,
 *   centers: [number,number][], boundaries: [number,number][][],
 *   adj: number[][], stepM: number
 * }}
 */
export function buildHexAO(ring = AO_RING, res = H3_RES) {
  const indexes = polygonToCells([ring], res).sort();
  const N = indexes.length;
  const idOf = new Map();
  for (let i = 0; i < N; i++) idOf.set(indexes[i], i);

  const centers = indexes.map((h) => /** @type {[number,number]} */ (cellToLatLng(h)));
  const boundaries = indexes.map((h) => /** @type {[number,number][]} */ (cellToBoundary(h)));

  const adj = new Array(N);
  let stepSum = 0, stepCount = 0;
  for (let id = 0; id < N; id++) {
    const lat0 = centers[id][0], lng0 = centers[id][1];
    const nb = [];
    for (const nh of gridDisk(indexes[id], 1)) {
      if (nh === indexes[id]) continue;
      const nid = idOf.get(nh);
      if (nid === undefined) continue; // outside AO = wall
      const lat1 = centers[nid][0], lng1 = centers[nid][1];
      nb.push({ nid, brg: bearingDeg(lat0, lng0, lat1, lng1) });
      stepSum += haversineM(lat0, lng0, lat1, lng1);
      stepCount++;
    }
    nb.sort((a, b) => (a.brg !== b.brg ? a.brg - b.brg : a.nid - b.nid));
    adj[id] = nb.map((x) => x.nid);
  }

  return { indexes, idOf, N, centers, boundaries, adj, stepM: stepCount ? stepSum / stepCount : 344 };
}

export const idToH3 = (ao, id) => ao.indexes[id];
export const h3ToId = (ao, h3) => ao.idOf.get(h3);
export const latLngToId = (ao, lat, lng) => ao.idOf.get(latLngToCell(lat, lng, H3_RES));

/** Hex-step distance to `b` (admissible heuristic basis). Falls back to a centroid
 *  estimate only on the -1 that h3 returns for huge / pentagon-spanning pairs. */
export function hexDistance(ao, a, b) {
  const d = gridDistance(ao.indexes[a], ao.indexes[b]);
  if (d >= 0) return d;
  const ca = ao.centers[a], cb = ao.centers[b];
  return haversineM(ca[0], ca[1], cb[0], cb[1]) / ao.stepM;
}
