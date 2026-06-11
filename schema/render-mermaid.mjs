// render-mermaid.mjs — build-time Mermaid → inline-SVG renderer (offline).
// Reads {id: mermaidSource} JSON, writes {id: svgString} JSON, using the bundled
// Chromium (@sparticuz/chromium) + the local mermaid package (no CDN at runtime).
// Usage: node schema/render-mermaid.mjs <in.json> <out.json>
import fs from "fs";
import { chromium } from "playwright";
import chromiumPkg from "@sparticuz/chromium";

const [, , inPath, outPath] = process.argv;
const sources = JSON.parse(fs.readFileSync(inPath, "utf8"));
const mermaidPath = new URL("../node_modules/mermaid/dist/mermaid.esm.min.mjs", import.meta.url).pathname;
const theme = process.env.MERMAID_THEME || "default";

const loader = `<!doctype html><meta charset="utf-8"><body><script type="module">
import mermaid from '${mermaidPath}';
mermaid.initialize({ startOnLoad:false, securityLevel:'loose', theme:'${theme}', er:{ useMaxWidth:true } });
window.__render = async (s) => (await mermaid.render('mm'+Math.random().toString(36).slice(2), s)).svg;
window.__ready = true;
</script>`;
const loaderPath = "/tmp/remit-mermaid-loader.html";
fs.writeFileSync(loaderPath, loader);

const execPath = await (chromiumPkg.default?.executablePath?.() ?? chromiumPkg.executablePath());
const browser = await chromium.launch({ executablePath: execPath, args: chromiumPkg.args ?? chromiumPkg.default?.args });
const page = await browser.newPage();
page.on("pageerror", (e) => console.error("pageerror:", e.message));
await page.goto("file://" + loaderPath);
await page.waitForFunction("window.__ready===true", { timeout: 30000 });

const out = {};
for (const [id, src] of Object.entries(sources)) {
  try {
    out[id] = await page.evaluate((s) => window.__render(s), src);
  } catch (e) {
    out[id] = `<p class="err">diagram render failed: ${String(e.message || e)}</p>`;
    console.error(`render failed for ${id}:`, e.message || e);
  }
}
await browser.close();
fs.writeFileSync(outPath, JSON.stringify(out));
console.error(`rendered ${Object.keys(out).length} diagrams (theme=${theme})`);
