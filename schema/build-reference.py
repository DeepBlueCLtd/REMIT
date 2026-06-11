#!/usr/bin/env python3
"""Generate the data-model reference (site/data-model/index.html) from the LinkML
schema. Derived artefact — do not hand-edit the output; edit the modules under
schema/ and re-run schema/generate.sh (DEC-57).

The reference is a single page: the module overview, a whole-model ER diagram and
per-module ER diagrams (Mermaid, rendered in-browser), and a hyperlinked card per
class and enum. The diagrams are pan/zoom viewports whose boxes link to their
class cards (see schema/build-reference.py's PANZOOM_SCRIPT). The Mermaid renderer
is the canonical structure view — ADR-0013.
"""
import html
from pathlib import Path

from linkml_runtime import SchemaView

ROOT = Path(__file__).resolve().parent.parent
SCHEMA = ROOT / "schema" / "remit.yaml"
OUTDIR = ROOT / "site" / "data-model"

MODULE_ORDER = ["common", "requirement", "world", "force", "entities", "plan", "records"]
MODULE_LABEL = {"common": "Common", "requirement": "Requirement", "world": "World",
                "force": "Own force", "entities": "Entities", "plan": "Plan", "records": "Records"}

CSS = """
:root{color-scheme:light dark;--bg:#fff;--bg-soft:#f6f7f9;--card:#fff;--ink:#1b1f24;--ink-soft:#5b6470;
--line:#e3e6ea;--line-strong:#c9ced6;--accent:#2f6db5;--accent-soft:#eaf1fb;--accent-ink:#1f4f86;
--chip:#eef1f4;--mono-bg:#f1f3f6;--enum:#7a4fb5;--enum-soft:#f0eafb;--shadow:0 1px 2px rgba(20,30,45,.05),0 8px 24px rgba(20,30,45,.06)}
@media (prefers-color-scheme:dark){:root{--bg:#0e1116;--bg-soft:#12161d;--card:#161b22;--ink:#e6edf3;--ink-soft:#9aa6b2;
--line:#232a33;--line-strong:#323b46;--accent:#6ca8e8;--accent-soft:#16243a;--accent-ink:#9cc4f0;--chip:#1c222b;
--mono-bg:#1b212a;--enum:#b89ae8;--enum-soft:#221a33;--shadow:0 1px 2px rgba(0,0,0,.3),0 10px 30px rgba(0,0,0,.35)}}
*{box-sizing:border-box}html{scroll-behavior:smooth;scroll-padding-top:4.2rem}
body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:var(--ink);background:var(--bg);line-height:1.5;-webkit-font-smoothing:antialiased}
a{color:var(--accent)}code,.mono{font-family:ui-monospace,"SF Mono",Menlo,Consolas,monospace}
header.site{position:sticky;top:0;z-index:50;display:flex;align-items:center;gap:1rem;padding:.6rem clamp(1rem,4vw,2.5rem);background:color-mix(in srgb,var(--bg) 88%,transparent);backdrop-filter:saturate(180%) blur(10px);border-bottom:1px solid var(--line)}
header.site .brand{font-weight:700;text-decoration:none;color:var(--ink)}header.site .brand span{color:var(--accent)}
header.site nav{margin-left:auto;display:flex;gap:.2rem;flex-wrap:wrap}
header.site nav a{text-decoration:none;color:var(--ink-soft);font-size:.8rem;padding:.35rem .5rem;border-radius:.4rem}
header.site nav a:hover{color:var(--ink);background:var(--bg-soft)}
.wrap{max-width:84rem;margin:0 auto;padding:0 clamp(1rem,4vw,2.5rem)}
.hero{padding:clamp(2rem,5vw,3.2rem) 0 1.4rem;background:radial-gradient(1200px 400px at 15% -10%,var(--accent-soft),transparent 60%),radial-gradient(900px 380px at 95% 0%,var(--accent-soft),transparent 55%)}
.eyebrow{text-transform:uppercase;letter-spacing:.14em;font-size:.72rem;font-weight:700;color:var(--accent-ink);margin:0 0 .5rem}
.hero h1{font-size:clamp(1.8rem,5vw,2.8rem);line-height:1.08;margin:0 0 .6rem;letter-spacing:-.02em}
.hero p.lede{font-size:clamp(1rem,2.2vw,1.18rem);color:var(--ink-soft);max-width:50rem;margin:0}
.stats{display:flex;gap:1.2rem;margin-top:.9rem;font-size:.84rem;color:var(--ink-soft);flex-wrap:wrap}.stats b{color:var(--ink)}
.layout{display:grid;grid-template-columns:15rem minmax(0,1fr);gap:2.2rem;align-items:start;padding-top:1.4rem}
aside.toc{position:sticky;top:4.3rem;max-height:calc(100vh - 5rem);overflow:auto;font-size:.85rem;padding-bottom:2rem}
aside.toc .toc-title{text-transform:uppercase;letter-spacing:.1em;font-size:.68rem;font-weight:700;color:var(--ink-soft);margin:.2rem 0 .6rem}
aside.toc details{margin-bottom:.15rem}
aside.toc summary{cursor:pointer;display:flex;align-items:center;gap:.4rem;padding:.25rem .3rem;border-radius:.35rem;list-style:none}
aside.toc summary::-webkit-details-marker{display:none}
aside.toc summary::before{content:"▸";color:var(--ink-soft);font-size:.7rem;transition:transform .12s}
aside.toc details[open]>summary::before{transform:rotate(90deg)}
aside.toc summary:hover{background:var(--bg-soft)}aside.toc summary a{font-weight:600;text-decoration:none;color:var(--ink)}
aside.toc summary .c{margin-left:auto;font-size:.66rem;color:var(--ink-soft);background:var(--chip);border-radius:1rem;padding:.02rem .4rem}
aside.toc ul{list-style:none;margin:.1rem 0 .5rem .85rem;padding:0;border-left:1px solid var(--line)}
aside.toc li a{display:block;padding:.12rem .55rem;color:var(--ink-soft);text-decoration:none;font-family:ui-monospace,monospace;font-size:.76rem;border-left:2px solid transparent;margin-left:-1px}
aside.toc li a:hover{color:var(--accent);border-left-color:var(--accent)}
aside.toc a.flat{display:block;font-weight:600;color:var(--ink);text-decoration:none;padding:.25rem .3rem;border-radius:.35rem}
aside.toc a.flat:hover{background:var(--bg-soft)}
.content{min-width:0}
section{padding:1.5rem 0;border-top:1px solid var(--line)}section:first-child{border-top:0;padding-top:0}
.sec-head{max-width:52rem;margin-bottom:1.1rem}
.sec-head h2{font-size:clamp(1.25rem,3vw,1.7rem);margin:0 0 .3rem;letter-spacing:-.01em;display:flex;align-items:baseline;gap:.7rem;flex-wrap:wrap}
.sec-head .modcount{font-size:.74rem;font-weight:600;color:var(--ink-soft);background:var(--chip);border-radius:1rem;padding:.1rem .6rem;letter-spacing:0}
.sec-head p{color:var(--ink-soft);margin:0}
.modgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(15rem,1fr));gap:.8rem}
.modcard{display:block;background:var(--card);border:1px solid var(--line);border-radius:.8rem;padding:.9rem 1rem;box-shadow:var(--shadow);text-decoration:none;color:inherit;transition:transform .14s ease,border-color .14s ease}
.modcard:hover{transform:translateY(-2px);border-color:var(--accent)}
.modcard h3{margin:0 0 .3rem;font-size:1.02rem;color:var(--accent-ink)}.modcard p{margin:0 0 .55rem;font-size:.82rem;color:var(--ink-soft)}
.modcard .n{font-size:.7rem;font-family:ui-monospace,monospace;color:var(--ink-soft);background:var(--bg-soft);border:1px solid var(--line);border-radius:.3rem;padding:.05rem .4rem}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(24rem,1fr));gap:1rem;align-items:start}
.entity{background:var(--card);border:1px solid var(--line);border-radius:.85rem;padding:1.1rem 1.2rem;box-shadow:var(--shadow);scroll-margin-top:4.5rem}
.entity .top{display:flex;align-items:baseline;gap:.5rem;flex-wrap:wrap;margin-bottom:.4rem}
.entity h3{margin:0;font-size:1.06rem;font-family:ui-monospace,monospace;letter-spacing:-.01em}
.tag{font-size:.64rem;text-transform:uppercase;letter-spacing:.05em;font-weight:700;padding:.12rem .42rem;border-radius:.3rem;background:var(--chip);color:var(--ink-soft)}
.tag.id{background:var(--accent-soft);color:var(--accent-ink)}.tag.enum{background:var(--enum-soft);color:var(--enum)}
.entity .desc{margin:.2rem 0 .7rem;color:var(--ink);font-size:.89rem}
table.slots{width:100%;border-collapse:collapse;font-size:.81rem}
table.slots th{text-align:left;font-weight:600;color:var(--ink-soft);border-bottom:1px solid var(--line);padding:.25rem .4rem;font-size:.7rem;text-transform:uppercase;letter-spacing:.05em}
table.slots td{padding:.28rem .4rem;border-bottom:1px solid var(--line);vertical-align:top}table.slots tr:last-child td{border-bottom:0}
td.k{font-family:ui-monospace,monospace;color:var(--accent-ink);white-space:nowrap}
td.card{font-family:ui-monospace,monospace;color:var(--ink-soft);white-space:nowrap}td.d{color:var(--ink-soft)}
.flag{font-size:.58rem;margin-left:.35rem;padding:.02rem .3rem;border-radius:.25rem;background:var(--accent-soft);color:var(--accent-ink);text-transform:uppercase;letter-spacing:.04em}
.flag.inh{background:var(--chip);color:var(--ink-soft)}
.ref{text-decoration:none;font-family:ui-monospace,monospace}.ref.cls{color:var(--accent)}.ref.enum{color:var(--enum)}.ref.prim{color:var(--ink-soft)}
.empty{color:var(--ink-soft);font-size:.84rem;margin:.2rem 0 0}
.pvs{list-style:none;margin:.2rem 0 0;padding:0;display:grid;gap:.25rem;font-size:.83rem;color:var(--ink-soft)}
.pvs code{color:var(--enum);background:var(--enum-soft);padding:.03rem .35rem;border-radius:.25rem}
/* ER diagram — pan/zoom viewport with clickable entity boxes */
.erd{position:relative;overflow:hidden;height:clamp(22rem,72vh,58rem);background:#fff;border:1px solid var(--line);border-radius:.7rem;margin-bottom:.4rem;box-shadow:var(--shadow);cursor:grab;touch-action:none}
.erd.grabbing{cursor:grabbing}
.erd .mermaid svg{position:absolute;top:0;left:0;max-width:none;transform-origin:0 0;will-change:transform}
.erd .mermaid-wrap,.erd .mermaid{position:static;margin:0}
.pz-ctrl{position:absolute;top:.55rem;right:.55rem;z-index:6;display:flex;gap:.2rem;background:color-mix(in srgb,var(--card) 84%,transparent);border:1px solid var(--line);border-radius:.5rem;padding:.2rem;box-shadow:var(--shadow);backdrop-filter:blur(6px)}
.pz-ctrl button{width:1.7rem;height:1.7rem;border:0;background:transparent;color:var(--ink);font:600 1rem/1 system-ui,sans-serif;border-radius:.35rem;cursor:pointer;display:grid;place-items:center}
.pz-ctrl button:hover{background:var(--bg-soft);color:var(--accent)}
.pz-hint{position:absolute;left:.65rem;bottom:.55rem;z-index:6;font-size:.68rem;color:var(--ink-soft);background:color-mix(in srgb,var(--card) 78%,transparent);border:1px solid var(--line);border-radius:.4rem;padding:.08rem .45rem;pointer-events:none;backdrop-filter:blur(6px)}
.erd a.erd-node-link{cursor:pointer}
.erd a.erd-node-link rect{transition:stroke .1s,stroke-width .1s,fill .1s}
.erd a.erd-node-link:hover rect{stroke:var(--accent);stroke-width:2px;fill:var(--accent-soft)}
.erd a.erd-node-link:hover .nodeLabel{color:var(--accent-ink)}
.erd-legend{font-size:.73rem;color:var(--ink-soft);margin:.3rem 0 1.2rem}
.erd-legend .cf{font-family:ui-monospace,monospace;background:var(--mono-bg);padding:.02rem .3rem;border-radius:.25rem}
details.er{border:1px solid var(--line);border-radius:.7rem;background:var(--card);padding:.4rem .9rem}
details.er summary{cursor:pointer;font-weight:600;padding:.4rem 0}
footer.site{border-top:1px solid var(--line);padding:2rem 0 3rem;color:var(--ink-soft);font-size:.85rem}
footer.site a{font-weight:600}.backlinks{display:flex;gap:1.25rem;flex-wrap:wrap;margin-bottom:1rem}
@media (max-width:62rem){.layout{grid-template-columns:1fr}aside.toc{display:none}}
"""

MERMAID_SCRIPT = ('<script type="module">import mermaid from '
                  '"https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";'
                  'mermaid.initialize({startOnLoad:false,securityLevel:"loose",'
                  'theme:matchMedia("(prefers-color-scheme: dark)").matches?"dark":"default"});'
                  'try{await mermaid.run();}catch(e){console.error(e);}'
                  'window.remitInitPanzoom&&window.remitInitPanzoom();</script>')

# Self-contained pan/zoom for the ER diagram boxes (no CDN of its own). Drag to
# pan, wheel to zoom toward the cursor, +/-/fit controls; each entity box is
# wrapped in an anchor to its #class-<Name> card. Idempotent, and defers the
# initial fit until a box is actually visible (collapsed <details>).
PANZOOM_SCRIPT = """<script>(function(){
function size(svg){var vb=svg.viewBox&&svg.viewBox.baseVal;
 if(vb&&vb.width&&vb.height)return{w:vb.width,h:vb.height};
 try{var b=svg.getBBox();if(b.width&&b.height)return{w:b.width,h:b.height};}catch(e){}
 var r=svg.getBoundingClientRect();return{w:r.width||320,h:r.height||220};}
function linkify(svg){
 // Each entity box is <g class="node" id="...-entity-<Name>-<n>">; the page has a
 // matching #class-<Name> card, so wrap the box in an SVG anchor to it.
 svg.querySelectorAll('g.node[id*="-entity-"]').forEach(function(g){
  if(g.parentNode&&g.parentNode.classList&&g.parentNode.classList.contains('erd-node-link'))return;
  var m=g.id.match(/-entity-(.+)-\\d+$/);if(!m)return;var name=m[1];
  if(!document.getElementById('class-'+name))return;
  var a=document.createElementNS('http://www.w3.org/2000/svg','a');
  a.setAttribute('href','#class-'+name);a.setAttributeNS('http://www.w3.org/1999/xlink','xlink:href','#class-'+name);
  a.setAttribute('class','erd-node-link');a.setAttribute('aria-label',name);
  g.parentNode.insertBefore(a,g);a.appendChild(g);});}
function setup(box){var svg=box.querySelector('svg');if(!svg||box.__pz)return;box.__pz=1;
 linkify(svg);
 svg.style.maxWidth='none';svg.style.transformOrigin='0 0';svg.style.position='absolute';svg.style.top='0';svg.style.left='0';
 var s=1,tx=0,ty=0,n=null;
 function apply(){svg.style.transform='translate('+tx+'px,'+ty+'px) scale('+s+')';}
 function clamp(v){return Math.max(0.05,Math.min(8,v));}
 function measure(){n=size(svg);svg.style.width=n.w+'px';svg.style.height=n.h+'px';}
 function fit(){if(!n)measure();var bw=box.clientWidth,bh=box.clientHeight;if(!bw||!bh)return;
  var pad=28;s=clamp(Math.min((bw-pad)/n.w,(bh-pad)/n.h));tx=(bw-n.w*s)/2;ty=(bh-n.h*s)/2;apply();}
 function zoomAt(cx,cy,f){var ns=clamp(s*f);var wx=(cx-tx)/s,wy=(cy-ty)/s;s=ns;tx=cx-wx*s;ty=cy-wy*s;apply();}
 box.addEventListener('wheel',function(e){e.preventDefault();var r=box.getBoundingClientRect();
  zoomAt(e.clientX-r.left,e.clientY-r.top,Math.exp(-e.deltaY*0.0015));},{passive:false});
 var drag=false,moved=false,lx=0,ly=0,pid=null;
 box.addEventListener('pointerdown',function(e){if(e.button!==0)return;drag=true;moved=false;lx=e.clientX;ly=e.clientY;pid=e.pointerId;});
 box.addEventListener('pointermove',function(e){if(!drag)return;var dx=e.clientX-lx,dy=e.clientY-ly;
  if(!moved){if(Math.abs(dx)+Math.abs(dy)<=3)return;moved=true;box.classList.add('grabbing');try{box.setPointerCapture(pid);}catch(_){}}
  tx+=dx;ty+=dy;lx=e.clientX;ly=e.clientY;apply();});
 function up(){drag=false;if(moved)box.classList.remove('grabbing');moved=false;}
 box.addEventListener('pointerup',up);box.addEventListener('pointercancel',up);
 var ctrl=document.createElement('div');ctrl.className='pz-ctrl';
 function btn(t,lbl,fn){var b=document.createElement('button');b.type='button';b.textContent=t;b.title=lbl;b.setAttribute('aria-label',lbl);b.addEventListener('click',fn);ctrl.appendChild(b);}
 btn('+','Zoom in',function(){zoomAt(box.clientWidth/2,box.clientHeight/2,1.3);});
 btn('\\u2212','Zoom out',function(){zoomAt(box.clientWidth/2,box.clientHeight/2,1/1.3);});
 btn('\\u2922','Fit',fit);
 box.appendChild(ctrl);
 var hint=document.createElement('div');hint.className='pz-hint';hint.textContent='scroll to zoom \\u00b7 drag to pan \\u00b7 click a box to open it';box.appendChild(hint);
 if('ResizeObserver'in window){var ro=new ResizeObserver(function(){if(box.clientWidth&&box.clientHeight&&!box.__fit){box.__fit=1;fit();}});ro.observe(box);}
 if(box.clientWidth&&box.clientHeight){box.__fit=1;fit();}}
function init(){document.querySelectorAll('.erd').forEach(setup);}
window.remitInitPanzoom=init;
if(document.readyState!=='loading')init();else document.addEventListener('DOMContentLoaded',init);
})();</script>"""


def esc(s):
    return html.escape(str(s)) if s is not None else ""


def card(required, multivalued):
    lo = "1" if required else "0"
    return f"{lo}..*" if multivalued else (lo if required else "0..1")


def main():
    sv = SchemaView(str(SCHEMA))
    classes = sv.all_classes()
    enums = sv.all_enums()
    class_names = set(classes)
    enum_names = set(enums)

    import yaml
    mod_desc = {}
    for k in MODULE_ORDER:
        try:
            mod_desc[k] = yaml.safe_load((ROOT / "schema" / f"{k}.yaml").read_text()).get("description", "")
        except Exception:
            mod_desc[k] = ""

    def module_of(o):
        return (o.from_schema or "").rsplit("/", 1)[-1]

    classes_by_mod = {k: [] for k in MODULE_ORDER}
    for n, c in classes.items():
        classes_by_mod.setdefault(module_of(c), []).append((n, c))

    def range_cell(rng):
        if rng in class_names:
            return f'<a class="ref cls" href="#class-{esc(rng)}">{esc(rng)}</a>'
        if rng in enum_names:
            return f'<a class="ref enum" href="#enum-{esc(rng)}">{esc(rng)}</a>'
        return f'<span class="ref prim">{esc(rng or "string")}</span>'

    def class_card(name, cls):
        own = set((cls.attributes or {}).keys())
        tags = []
        if cls.abstract:
            tags.append('<span class="tag">abstract</span>')
        if cls.is_a:
            tags.append(f'<span class="tag">is a {range_cell(cls.is_a)}</span>')
        induced = sv.class_induced_slots(name)
        if any(getattr(s, "identifier", False) for s in induced):
            tags.append('<span class="tag id">identified</span>')
        rows = []
        for s in induced:
            flags = []
            if getattr(s, "identifier", False):
                flags.append('<span class="flag">id</span>')
            if s.name not in own:
                flags.append('<span class="flag inh">inherited</span>')
            rows.append(
                f'<tr><td class="k">{esc(s.name)}{"".join(flags)}</td>'
                f"<td>{range_cell(s.range)}</td>"
                f'<td class="card">{card(s.required, s.multivalued)}</td>'
                f'<td class="d">{esc(s.description)}</td></tr>'
            )
        body = (
            '<table class="slots"><thead><tr><th>field</th><th>type</th><th>card</th>'
            "<th>description</th></tr></thead><tbody>" + "".join(rows) + "</tbody></table>"
        ) if rows else '<p class="empty">No fields.</p>'
        return (
            f'<article class="entity" id="class-{esc(name)}">'
            f'<div class="top"><h3>{esc(name)}</h3>{"".join(tags)}</div>'
            f'<p class="desc">{esc(cls.description)}</p>{body}</article>'
        )

    # class-valued slots of a class
    def cls_slots(name):
        return [s for s in sv.class_induced_slots(name) if s.range in class_names]

    # ---------- Mermaid ER sources ----------
    def er_rel(required, multivalued, inlined):
        right = "o{" if multivalued else ("||" if required else "o|")
        return f'||{"--" if inlined else ".."}{right}'

    def mermaid_src(names):
        lines = ["erDiagram"]
        for n in names:
            lines.append(f"  {n} {{")
            lines.append("  }")
        for n in names:
            for s in cls_slots(n):
                inl = bool(s.inlined or s.inlined_as_list)
                lines.append(f'  {n} {er_rel(s.required, s.multivalued, inl)} {s.range} : "{s.name}"')
        return "\n".join(lines)

    srcmap = {f"mod-{k}": mermaid_src([n for n, _ in classes_by_mod.get(k, [])])
              for k in MODULE_ORDER if classes_by_mod.get(k)}
    srcmap["overview"] = mermaid_src(list(class_names))

    ER_LEGEND = ('<p class="erd-legend"><b>—</b> contains (inlined) &nbsp;·&nbsp; <b>┈</b> references (by id) '
                 '&nbsp;·&nbsp; <span class="cf">o{</span> many &nbsp;<span class="cf">||</span> one '
                 '&nbsp;<span class="cf">o|</span> optional. Boxes outside the module are classes defined elsewhere.</p>')

    def mermaid_block(key):
        return (f'<div class="erd"><div class="mermaid-wrap"><pre class="mermaid">{esc(srcmap[key])}</pre></div></div>'
                f'{ER_LEGEND}')

    # ---------- enums ----------
    enum_cards, enum_links = [], []
    for name, en in enums.items():
        enum_links.append(f'<li><a href="#enum-{esc(name)}">{esc(name)}</a></li>')
        pvs = "".join(
            f'<li><code>{esc(vn)}</code>{(" — " + esc(v.description)) if v and v.description else ""}</li>'
            for vn, v in (en.permissible_values or {}).items()
        )
        enum_cards.append(
            f'<article class="entity enum-card" id="enum-{esc(name)}">'
            f'<div class="top"><h3>{esc(name)}</h3><span class="tag enum">enum</span></div>'
            f'<p class="desc">{esc(en.description)}</p><ul class="pvs">{pvs}</ul></article>'
        )
    enums_section = ('<section id="enums"><div class="sec-head"><h2>Enums '
                     f'<span class="modcount">{len(enum_names)} value sets</span></h2>'
                     '<p>The closed value vocabularies (in <code>common</code>) used by the fields above.</p>'
                     f'</div><div class="grid">{"".join(enum_cards)}</div></section>')

    # ---------- overview cards ----------
    overview = []
    for k in MODULE_ORDER:
        items = classes_by_mod.get(k, [])
        if not items:
            continue
        extra = " · 20 enums" if k == "common" else ""
        overview.append(
            f'<a class="modcard" href="#module-{k}"><h3>{esc(MODULE_LABEL[k])}</h3>'
            f'<p>{esc(mod_desc.get(k, ""))}</p><span class="n">{len(items)} classes{extra}</span></a>'
        )
    overview_section = ('<section id="overview"><div class="sec-head"><h2>The model at a glance</h2>'
                        f'<p>The serialisable object core, split into {len(MODULE_ORDER)} modules.</p></div>'
                        f'<div class="modgrid">{"".join(overview)}</div></section>')

    # ---------- module sections (overview cards + per-module ER diagram + class cards) ----------
    def module_sections():
        out = []
        for k in MODULE_ORDER:
            items = classes_by_mod.get(k, [])
            if not items:
                continue
            extra = " · 20 enums" if k == "common" else ""
            cards = "".join(class_card(n, c) for n, c in items)
            out.append(
                f'<section class="module" id="module-{k}"><div class="sec-head"><h2>{esc(MODULE_LABEL[k])} '
                f'<span class="modcount">{len(items)} classes{extra}</span></h2>'
                f'<p>{esc(mod_desc.get(k, ""))}</p></div>{mermaid_block(f"mod-{k}")}<div class="grid">{cards}</div></section>'
            )
        return "".join(out)

    # ---------- sidebar ----------
    def sidebar():
        toc = ['<a class="flat" href="#overview">▤ Diagrams</a>']
        for k in MODULE_ORDER:
            items = classes_by_mod.get(k, [])
            if not items:
                continue
            links = "".join(f'<li><a href="#class-{esc(n)}">{esc(n)}</a></li>' for n, _ in items)
            toc.append(f'<details open><summary><a href="#module-{k}">{esc(MODULE_LABEL[k])}</a>'
                       f'<span class="c">{len(items)}</span></summary><ul>{links}</ul></details>')
        toc.append(f'<details><summary><a href="#enums">Enums</a><span class="c">{len(enum_names)}</span>'
                   f'</summary><ul>{"".join(enum_links)}</ul></details>')
        return f'<aside class="toc"><div class="toc-title">Navigate</div><nav>{"".join(toc)}</nav></aside>'

    title = esc(sv.schema.title or sv.schema.name)
    lede = esc((sv.schema.description or "").strip().split("\n\n")[0])
    nclasses, nenums = len(class_names), len(enum_names)

    diagram_section = (
        '<section id="diagram"><div class="sec-head"><h2>Whole-model ER diagram</h2>'
        '<p>Every typed association across the modules, drawn in your browser (Mermaid). '
        'Scroll to zoom, drag to pan, click a box to jump to its class.</p></div>'
        f'<details class="er"><summary>Show the {nclasses}-class diagram</summary>'
        f'{mermaid_block("overview")}</details></section>'
    )

    doc = f"""<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>{title}</title>
<style>{CSS}</style></head><body>
<header class="site"><a class="brand" href="../"><span>REMIT</span> · Data Model</a>
<nav><a href="#overview">Overview</a><a href="#diagram">Diagram</a><a href="#enums">Enums</a><a href="../app/">App</a></nav></header>
<div class="hero"><div class="wrap"><p class="eyebrow">Generated reference · LinkML (DEC-57)</p>
<h1>{title}</h1><p class="lede">{lede}</p>
<div class="stats"><span><b>{len(MODULE_ORDER)}</b> modules</span><span><b>{nclasses}</b> classes</span>
<span><b>{nenums}</b> enums</span><span>JSON Schema &amp; TypeScript generated alongside</span></div></div></div>
<div class="wrap layout">{sidebar()}<main class="content">
{overview_section}{diagram_section}{module_sections()}{enums_section}</main></div>
<footer class="site"><div class="wrap"><div class="backlinks"><a href="../">← Home</a><a href="../app/">Walking skeleton</a><a href="../blog/">Blog</a></div>
Generated from the modular LinkML schema under <code>schema/</code> by <code>schema/build-reference.py</code>.
Cardinality: <code>1</code> required · <code>0..1</code> optional · <code>0..*/1..*</code> list.</div></footer>
{PANZOOM_SCRIPT}{MERMAID_SCRIPT}</body></html>"""

    OUTDIR.mkdir(parents=True, exist_ok=True)
    (OUTDIR / "index.html").write_text(doc, encoding="utf-8")

    print(f"wrote {OUTDIR.relative_to(ROOT)}/index.html ({nclasses} classes, {nenums} enums)")


if __name__ == "__main__":
    main()
