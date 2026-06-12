#!/usr/bin/env node
// tools/sample-terrain.mjs — AUTHOR-TIME terrain sampler (ADR-0016 follow-up).
//
// Classifies each H3 cell of the AO by the colour of the Carto Positron basemap beneath
// it, and bakes the result to app/js/kernel/terrain-sampled.json (committed) so the hex
// shading matches the real map AND the kernel stays deterministic (NF3) — no live fetch
// at runtime. Re-run deliberately when the basemap or AO changes, then regenerate the
// golden fixtures.
//
//   node tools/sample-terrain.mjs            # sample + classify + write
//   node tools/sample-terrain.mjs --classify # re-classify cached colours only (no browser)
//
// In a Claude Code cloud session it uses the bundled @sparticuz/chromium and ignores the
// proxy's TLS interception (the basemap CDN is reachable; only the bundled browser's cert
// store isn't seeded). Locally it uses Playwright's managed browser.

import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { buildHexAO } from '../app/js/kernel/hexgrid.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const COLORS_CACHE = resolve(ROOT, 'tools/.terrain-colors.json');
const OUT = resolve(ROOT, 'app/js/kernel/terrain-sampled.json');
const isCloud = ['1', 'true'].includes(process.env.CLAUDE_CODE ?? '') || ['1', 'true'].includes(process.env.CLAUDECODE ?? '');
const PORT = 4178;
const URL = `http://127.0.0.1:${PORT}/`;

// --- classification: Positron palette → terrain vocabulary --------------------------
// Positron is near-white land, pale-blue water, faint-green landuse, light-grey urban.
// We can reliably separate water (blue) and green (parks/wood); everything else is land.
function classify({ r, g, b }) {
  if (r == null) return null;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  // Water: blue dominant and not too dark (Positron water ≈ pale blue).
  if (b - r >= 6 && b >= g && b >= 150 && max - min >= 4) return 'water';
  // Green landuse (park / wood): green channel leads red and blue.
  if (g - r >= 4 && g - b >= 2 && g >= 150) return 'forest';
  // Light-grey urban fabric (slightly darker than the cream land) → rough ground.
  if (max <= 232 && max - min <= 10) return 'rough';
  return 'open';
}

function classifyAll(colors) {
  const out = {};
  const counts = {};
  for (const c of colors) {
    const k = classify(c) ?? 'open';
    out[c.h3] = k;
    counts[k] = (counts[k] || 0) + 1;
  }
  return { out, counts };
}

function report(colors, counts) {
  const N = colors.length;
  console.log(`\nclassified ${N} cells:`);
  for (const [k, n] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(7)} ${String(n).padStart(4)}  (${(100 * n / N).toFixed(1)}%)`);
  }
  // a few sample colours per class to sanity-check thresholds
  const byClass = {};
  for (const c of colors) { const k = classify(c) ?? 'open'; (byClass[k] ||= []).push(c); }
  console.log('\nsample colours per class (r,g,b):');
  for (const [k, arr] of Object.entries(byClass)) {
    const ex = arr.slice(0, 4).map((c) => `(${c.r},${c.g},${c.b})`).join(' ');
    console.log(`  ${k.padEnd(7)} ${ex}`);
  }
}

function write(colors) {
  const { out, counts } = classifyAll(colors);
  writeFileSync(OUT, JSON.stringify(out) + '\n');
  report(colors, counts);
  console.log(`\nwrote ${Object.keys(out).length} cells -> ${OUT.replace(ROOT + '/', '')}`);
}

// --- re-classify cached colours only ------------------------------------------------
if (process.argv.includes('--classify')) {
  if (!existsSync(COLORS_CACHE)) { console.error('no cached colours — run without --classify first'); process.exit(1); }
  write(JSON.parse(readFileSync(COLORS_CACHE, 'utf8')));
  process.exit(0);
}

// --- sample the basemap in a headless browser ---------------------------------------
const ao = buildHexAO();
const cells = ao.indexes.map((h3, id) => [h3, ao.centers[id][0], ao.centers[id][1]]); // [h3,lat,lng]
console.log(`AO: ${cells.length} cells`);

let chromiumPath;
if (isCloud) chromiumPath = await (await import('@sparticuz/chromium')).default.executablePath();

const server = spawn('python3', ['-m', 'http.server', String(PORT), '--directory', 'dist'], { cwd: ROOT, stdio: 'ignore' });
const { chromium } = await import('@playwright/test');

try {
  // wait for server
  for (let i = 0; i < 40; i++) { try { const r = await fetch(URL); if (r.ok) break; } catch {} await sleep(250); }

  const browser = await chromium.launch({
    executablePath: chromiumPath, ignoreHTTPSErrors: true,
    args: ['--no-sandbox', '--ignore-certificate-errors', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1200 }, deviceScaleFactor: 1, ignoreHTTPSErrors: true });
  await page.addInitScript(() => { window.__REMIT_SAMPLE = true; });
  let tiles = 0; page.on('response', (r) => { if (r.url().includes('cartocdn') && r.status() < 400) tiles++; });

  await page.goto(URL);
  await page.waitForFunction(() => !!window.__map, { timeout: 30000 });
  // let every basemap tile in view load and paint
  await page.waitForFunction(() => window.__map.loaded() && window.__map.areTilesLoaded(), { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(4000);
  console.log(`carto tiles loaded: ${tiles}`);

  const result = await page.evaluate((cells) => {
    const map = window.__map;
    const canvas = map.getCanvas();
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (map.redraw) map.redraw();                       // force a fresh synchronous paint
    const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight;
    const buf = new Uint8Array(W * H * 4);
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, buf);  // origin = bottom-left
    let nonzero = 0; for (let i = 0; i < buf.length; i += 4) if (buf[i] | buf[i + 1] | buf[i + 2]) nonzero++;
    const at = (x, y) => { const fy = H - 1 - y; const i = (fy * W + x) * 4; return [buf[i], buf[i + 1], buf[i + 2]]; };
    const out = [];
    for (const [h3, lat, lng] of cells) {
      const p = map.project([lng, lat]);
      const x = Math.round(p.x), y = Math.round(p.y);
      let r = 0, g = 0, b = 0, n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        const c = at(xx, yy); r += c[0]; g += c[1]; b += c[2]; n++;
      }
      out.push(n ? { h3, r: Math.round(r / n), g: Math.round(g / n), b: Math.round(b / n) } : { h3, r: null });
    }
    const attrs = gl.getContextAttributes();
    return { debug: { W, H, nonzero, preserveDrawingBuffer: attrs && attrs.preserveDrawingBuffer }, colors: out };
  }, cells);
  const colors = result.colors;
  console.log('readback debug:', JSON.stringify(result.debug));

  await browser.close();

  if (!existsSync(dirname(COLORS_CACHE))) mkdirSync(dirname(COLORS_CACHE), { recursive: true });
  writeFileSync(COLORS_CACHE, JSON.stringify(colors));
  const off = colors.filter((c) => c.r == null).length;
  if (off) console.log(`note: ${off} cells projected off-canvas (fallback open)`);
  write(colors);
} finally {
  server.kill();
}
