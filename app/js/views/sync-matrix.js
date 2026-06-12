// @ts-check
// views/sync-matrix.js — the D6 Sync Matrix (DEC-53): a configurable stack of
// time-aligned tracks over one shared time axis, each track a projection of an
// entity ASPECT via a render type (status→segments, scalar→line, window→band).
// Generalises the skeleton's single timeline: own-force phase + fuel, the tide
// forecast (height curve + ford-open windows) and a provider satellite's
// overhead passes all sit on the same axis, so the operator scans VERTICALLY
// for coincidences — augmented by the advisory window lane (H1-lite, DEC-53/NF9).
//
// The SVG is rebuilt only when the projected CONTENT changes (selected plan,
// schedule, horizon, catalogue) — the playhead cursor just slides — so live
// playback and scrubbing stay cheap and the drag handlers survive mid-scrub.

const W = 720, LBL = 140, PAD_R = 12, TOP = 14, TH = 30, GAP = 10, AX = 22;
const PW = W - LBL - PAD_R;

const PROV_COLOR = { self: '#4493f8', forecast: '#7ec8e3', provider: '#bc8cff' };
const PHASE_COLOR = { transit: '#4493f8', hold: '#6e7681', visit: '#38d39f', exfil: '#e3b341' };
/** @param {string} s */
const esc = (s) => String(s).replace(/[<&]/g, (c) => (c === '<' ? '&lt;' : '&amp;'));

/** One Sync-Matrix catalogue row (CONFIG, DEC-53) — see `syncCatalogue()`. */
/** @typedef {{ key: string, entity: string, aspect: string, render: string, label: string, needsPlan?: boolean }} CatalogueRow */

/** An advisory coincidence window (see `coincidenceWindows()`). */
/** @typedef {import('../entities/entities.js').CoincidenceWindow} CoincidenceWindow */

/**
 * @param {HTMLElement} host
 * @param {import('./render.js').Playhead} playhead
 */
export function makeSyncMatrix(host, playhead) {
  let dragging = false, lastSig = '', txFn = (/** @type {number} */ t) => t,
      cursor = /** @type {SVGLineElement|null} */ (null),
      tracksBottom = TOP;
  window.addEventListener('pointerup', () => { dragging = false; });

  return {
    /**
     * @param {{sel: any, commitment: any, exfilCommitment: any,
     *          horizonMin: number, entities: any, catalogue: CatalogueRow[],
     *          coincidences?: CoincidenceWindow[]}} opts
     */
    render({ sel, commitment, exfilCommitment, horizonMin, entities, catalogue, coincidences = [] }) {
      const horizon = horizonMin || 180;
      /** @param {number} t */
      const tx = (t) => LBL + (Math.max(0, Math.min(horizon, t)) / horizon) * PW;

      // Rebuild only when the *content* changes (not on every playhead tick).
      const sig = JSON.stringify([
        sel?.id ?? null, horizon, catalogue.map((r) => r.key),
        commitment?.activity?.when?.window, exfilCommitment?.activity?.when?.before_min,
        sel?.materialisation?.schedule?.map((/** @type {{kind: string, start_min: number, end_min: number}} */ s) => `${s.kind}:${s.start_min}-${s.end_min}`),
        coincidences.map((c) => `${c.id}:${c.start}-${c.end}`),
      ]);
      if (sig !== lastSig) {
        host.innerHTML = buildSvg({ sel, commitment, exfilCommitment, horizon, entities, catalogue, coincidences, tx });
        const svg = /** @type {SVGSVGElement} */ (host.querySelector('svg'));
        cursor = host.querySelector('#sm-cursor');
        tracksBottom = Number(svg.dataset.tracksBottom);
        txFn = tx;
        /** @param {number} clientX */
        const toT = (clientX) => {
          const r = svg.getBoundingClientRect();
          const localX = ((clientX - r.left) / r.width) * W;
          if (localX < LBL) return null;                       // ignore the label gutter
          return Math.max(0, Math.min(horizon, ((localX - LBL) / PW) * horizon));
        };
        /** @param {PointerEvent} e */
        const scrub = (e) => { const t = toT(e.clientX); if (t != null) playhead.set(t); };
        svg.addEventListener('pointerdown', (e) => { dragging = true; scrub(e); });
        svg.addEventListener('pointermove', (e) => { if (dragging) scrub(e); });
        lastSig = sig;
      }
      // Slide the shared cursor (cheap; runs every playhead tick).
      if (cursor) {
        const x = String(txFn(playhead.t));
        cursor.setAttribute('x1', x); cursor.setAttribute('x2', x);
      }
      host.dataset.tracks = String(catalogue.length);
      host.dataset.selfActive = sel ? '1' : '0';
      host.dataset.coincidences = coincidences.map((c) => `${c.id}:${c.start}-${c.end}`).join('|');
    },
  };
}

/**
 * @param {{sel: any, commitment: any, exfilCommitment: any, horizon: number,
 *          entities: any, catalogue: CatalogueRow[], coincidences: CoincidenceWindow[],
 *          tx: (t: number) => number}} args
 */
function buildSvg({ sel, commitment, exfilCommitment, horizon, entities, catalogue, coincidences, tx }) {
  const dataBottom = TOP + (catalogue.length - 1) * (TH + GAP) + TH;

  // Coincidence guides (H1-lite) — faint full-height columns where a rule's tracks
  // line up, drawn BEHIND the tracks (the column-aggregation visual).
  let guides = '';
  for (const c of coincidences) {
    const x = tx(c.start), w = Math.max(2, tx(c.end) - x);
    guides += `<rect x="${x}" y="${TOP}" width="${w}" height="${dataBottom - TOP}"
        fill="${c.color}14"/>`;
  }

  const rows = catalogue.map((row, i) => {
    const yTop = TOP + i * (TH + GAP);
    const ent = entities[row.entity];
    const prov = ent.provenance;
    const provText = prov.kind + (prov.confidence ? ` · ${prov.freshness ?? prov.confidence}` : '');
    let body =
      `<rect x="${LBL}" y="${yTop}" width="${PW}" height="${TH}" fill="rgba(255,255,255,.02)" stroke="var(--border)"/>`;
    body += renderTrack(row, { sel, commitment, entities, yTop, tx, horizon });
    return `<g>
      <text x="4" y="${yTop + 13}" class="sm-label">${esc(row.label)}</text>
      <text x="4" y="${yTop + 25}" class="sm-prov" fill="${PROV_COLOR[/** @type {keyof typeof PROV_COLOR} */ (prov.kind)]}">${esc(provText)}</text>
      ${body}</g>`;
  }).join('');

  // Advisory coincidence lane (H1-lite) — labelled bands for each window; advisory
  // only, never alters the plan (C10-lite). Sits below the projected tracks.
  const advY = TOP + catalogue.length * (TH + GAP);
  let advisory =
    `<rect x="${LBL}" y="${advY}" width="${PW}" height="${TH}" fill="rgba(240,180,41,.04)" stroke="var(--border)"/>
     <text x="4" y="${advY + 13}" class="sm-label">⌖ Coincidence</text>
     <text x="4" y="${advY + 25}" class="sm-prov" fill="#f0b429">advisory · C10-lite</text>`;
  if (!coincidences.length) {
    advisory += `<text x="${LBL + PW / 2}" y="${advY + TH / 2 + 3}" text-anchor="middle" class="sm-empty">no coincidence windows in horizon</text>`;
  } else {
    for (const c of coincidences) {
      const x = tx(c.start), w = Math.max(3, tx(c.end) - x);
      advisory += `<rect x="${x}" y="${advY + 6}" width="${w}" height="${TH - 12}" rx="3"
          fill="${c.color}59" stroke="${c.color}"><title>${esc(c.label)} — ${esc(c.hint)} · H+${c.start}–${c.end} (advisory)</title></rect>`;
      if (w > 46) advisory += `<text x="${x + w / 2}" y="${advY + TH / 2 + 3}" text-anchor="middle" class="sm-seg">${esc(c.label)}</text>`;
    }
  }

  const tracksBottom = advY + TH;
  const H = tracksBottom + AX;

  // Exfil deadline — a vertical marker across every track (a hard bound).
  let overlays = '';
  const deadline = exfilCommitment?.activity?.when?.before_min;
  if (deadline != null) {
    const xd = tx(deadline);
    overlays += `<line x1="${xd}" y1="${TOP}" x2="${xd}" y2="${tracksBottom}" stroke="#ff7b72"
        stroke-width="1.4" stroke-dasharray="4 3"/>
      <text x="${xd - 3}" y="${TOP + 9}" text-anchor="end" class="sm-mini" fill="#ff7b72">exfil deadline</text>`;
  }
  // Shared time axis.
  let axis = '';
  for (let tk = 0; tk <= horizon; tk += 60) {
    axis += `<line x1="${tx(tk)}" y1="${tracksBottom}" x2="${tx(tk)}" y2="${tracksBottom + 4}" stroke="#6e7681"/>
      <text x="${tx(tk)}" y="${tracksBottom + 16}" text-anchor="middle" class="sm-tick">H+${tk}</text>`;
  }
  const cursor = `<line id="sm-cursor" x1="${tx(0)}" y1="${TOP}" x2="${tx(0)}" y2="${tracksBottom}"
      stroke="#e6edf3" stroke-width="2"/>`;

  return `<svg viewBox="0 0 ${W} ${H}" class="sync-matrix" data-testid="sync-matrix"
      data-tracks-bottom="${tracksBottom}" preserveAspectRatio="xMidYMid meet">
    ${guides}${rows}${advisory}${overlays}${axis}${cursor}</svg>`;
}

/**
 * Project one catalogue row to SVG, dispatched by its render type.
 * @param {CatalogueRow} row
 * @param {{sel: any, commitment: any, entities: any, yTop: number,
 *          tx: (t: number) => number, horizon: number}} ctx
 */
function renderTrack(row, { sel, commitment, entities, yTop, tx, horizon }) {
  const ent = entities[row.entity];
  const asp = ent.aspects[row.aspect];
  const mid = yTop + TH / 2;
  /** @param {string} msg */
  const empty = (msg) =>
    `<text x="${LBL + PW / 2}" y="${mid + 3}" text-anchor="middle" class="sm-empty">${esc(msg)}</text>`;

  if (row.render === 'status') {
    let s = '';
    const win = commitment?.activity?.when?.window;
    if (win) {
      const a = tx(win.start_min), b = tx(win.end_min);
      s += `<rect x="${a}" y="${yTop + 3}" width="${b - a}" height="${TH - 6}"
          fill="rgba(255,123,114,.10)" stroke="rgba(255,123,114,.4)" stroke-dasharray="3 3"/>
        <text x="${a + 3}" y="${yTop + 11}" class="sm-mini">obs window</text>`;
    }
    if (!sel) return s + empty('select a COA to project own-force tracks');
    for (const leg of asp.segments(sel)) {
      const x = tx(leg.start_min), w = Math.max(2, tx(leg.end_min) - x);
      s += `<rect x="${x}" y="${mid - 7}" width="${w}" height="14" rx="3" fill="${PHASE_COLOR[/** @type {keyof typeof PHASE_COLOR} */ (leg.kind)]}">
          <title>${esc(leg.label)} · H+${leg.start_min}–${leg.end_min}</title></rect>`;
      if (w > 22) s += `<text x="${x + 3}" y="${mid + 3}" class="sm-seg">${leg.kind[0].toUpperCase()}</text>`;
    }
    return s;
  }

  if (row.render === 'line') {
    if (!sel) return empty('select a COA to project own-force tracks');
    const [mn, mx] = asp.domain;
    const pts = [];
    const N = 96;
    for (let i = 0; i <= N; i++) {
      const t = (horizon * i) / N;
      const v = asp.at(sel, t);
      if (v == null) continue;
      const y = yTop + TH * (1 - (v - mn) / (mx - mn));
      pts.push(`${tx(t).toFixed(1)},${y.toFixed(1)}`);
    }
    return `<polyline points="${pts.join(' ')}" fill="none" stroke="#e3b341" stroke-width="1.6"/>
      <text x="${LBL + 2}" y="${yTop + 9}" class="sm-mini">${mx}${asp.unit}</text>
      <text x="${LBL + 2}" y="${yTop + TH - 2}" class="sm-mini">${mn}${asp.unit}</text>`;
  }

  if (row.render === 'tide') {
    let s = '';
    const windows = asp.windows(horizon);
    for (const w of windows) {                                  // ford-open shading
      const x = tx(w.start), ww = tx(w.end) - x;
      s += `<rect x="${x}" y="${yTop}" width="${ww}" height="${TH}" fill="rgba(56,211,159,.16)"/>`;
    }
    const pts = [];                                             // tide height curve
    const N = 140;
    for (let i = 0; i <= N; i++) {
      const t = (horizon * i) / N;
      const y = yTop + TH * (1 - asp.at(null, t));
      pts.push(`${tx(t).toFixed(1)},${y.toFixed(1)}`);
    }
    s += `<polyline points="${pts.join(' ')}" fill="none" stroke="#7ec8e3" stroke-width="1.4"/>`;
    for (const w of windows) {
      if (w.center >= 0 && w.center <= horizon)
        s += `<text x="${tx(w.center)}" y="${yTop + TH - 2}" text-anchor="middle" class="sm-mini">▽ low</text>`;
    }
    if (windows[0]) {
      const w = windows[0];
      s += `<text x="${tx((w.start + w.end) / 2)}" y="${yTop + 10}" text-anchor="middle"
          class="sm-mini" fill="#38d39f">ford open</text>`;
    }
    return s;
  }

  if (row.render === 'band') {                                  // window track (sat pass)
    let s = '';
    for (const w of asp.windows(horizon)) {
      const x = tx(w.start), ww = Math.max(3, tx(w.end) - x);
      s += `<rect x="${x}" y="${yTop + 6}" width="${ww}" height="${TH - 12}" rx="3"
          fill="rgba(188,140,255,.45)" stroke="#bc8cff">
          <title>overhead pass · H+${Math.round(w.start)}–${Math.round(w.end)}</title></rect>`;
      if (ww > 30) s += `<text x="${x + ww / 2}" y="${mid + 3}" text-anchor="middle" class="sm-seg">pass</text>`;
    }
    return s;
  }
  return '';
}
