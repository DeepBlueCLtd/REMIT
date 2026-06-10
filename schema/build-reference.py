#!/usr/bin/env python3
"""Generate the single-page data-model reference (site/data-model/index.html)
from the LinkML schema. Derived artefact — do not hand-edit the output; edit
schema/remit.yaml (and its modules under schema/) and re-run schema/generate.sh (DEC-57).

The page mirrors the schema's modular structure: a hierarchical sidebar (module →
class), a module overview, and the class cards grouped under their module."""
import html
import sys
import yaml
from pathlib import Path

from linkml_runtime import SchemaView
from linkml.generators.erdiagramgen import ERDiagramGenerator

ROOT = Path(__file__).resolve().parent.parent
SCHEMA = ROOT / "schema" / "remit.yaml"
OUT = ROOT / "site" / "data-model" / "index.html"

# Logical order + human labels for the modules (the schema's section structure).
MODULE_ORDER = ["common", "requirement", "world", "force", "entities", "plan", "records"]
MODULE_LABEL = {
    "common": "Common", "requirement": "Requirement", "world": "World",
    "force": "Own force", "entities": "Entities", "plan": "Plan", "records": "Records",
}


def esc(s):
    return html.escape(str(s)) if s is not None else ""


def card(required, multivalued):
    lo = "1" if required else "0"
    return f"{lo}..*" if multivalued else (lo if required else "0..1")


def module_of(obj):
    return (obj.from_schema or "").rsplit("/", 1)[-1]


def main():
    sv = SchemaView(str(SCHEMA))
    classes = sv.all_classes()
    enums = sv.all_enums()
    class_names = set(classes)
    enum_names = set(enums)

    # module descriptions, sourced from the module files (DRY)
    mod_desc = {}
    for k in MODULE_ORDER:
        try:
            mod_desc[k] = yaml.safe_load((ROOT / "schema" / f"{k}.yaml").read_text()).get("description", "")
        except Exception:
            mod_desc[k] = ""

    # group classes by module, preserving definition order within each
    classes_by_mod = {k: [] for k in MODULE_ORDER}
    for name, cls in classes.items():
        classes_by_mod.setdefault(module_of(cls), []).append((name, cls))

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
            '<table class="slots"><thead><tr><th>field</th><th>type</th>'
            "<th>card</th><th>description</th></tr></thead><tbody>"
            + "".join(rows) + "</tbody></table>"
        ) if rows else '<p class="empty">No fields.</p>'
        return (
            f'<article class="entity" id="class-{esc(name)}">'
            f'<div class="top"><h3>{esc(name)}</h3>{"".join(tags)}</div>'
            f'<p class="desc">{esc(cls.description)}</p>{body}</article>'
        )

    # ---- module reference sections + overview cards + sidebar ----
    sections, overview, toc = [], [], []
    for k in MODULE_ORDER:
        items = classes_by_mod.get(k, [])
        if not items:
            continue
        label = MODULE_LABEL.get(k, k.title())
        extra = " · 20 enums" if k == "common" else ""
        cards = "".join(class_card(n, c) for n, c in items)
        sections.append(
            f'<section class="module" id="module-{k}">'
            f'<div class="sec-head"><h2>{esc(label)} '
            f'<span class="modcount">{len(items)} classes{extra}</span></h2>'
            f'<p>{esc(mod_desc.get(k, ""))}</p></div>'
            f'<div class="grid">{cards}</div></section>'
        )
        overview.append(
            f'<a class="modcard" href="#module-{k}"><h3>{esc(label)}</h3>'
            f'<p>{esc(mod_desc.get(k, ""))}</p>'
            f'<span class="n">{len(items)} classes{extra}</span></a>'
        )
        links = "".join(f'<li><a href="#class-{esc(n)}">{esc(n)}</a></li>' for n, _ in items)
        toc.append(
            f'<details open><summary><a href="#module-{k}">{esc(label)}</a>'
            f'<span class="c">{len(items)}</span></summary><ul>{links}</ul></details>'
        )

    # ---- enums (all defined in common) ----
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
    toc.append(
        f'<details><summary><a href="#enums">Enums</a><span class="c">{len(enum_names)}</span>'
        f'</summary><ul>{"".join(enum_links)}</ul></details>'
    )
    enums_section = (
        '<section id="enums"><div class="sec-head"><h2>Enums '
        f'<span class="modcount">{len(enum_names)} value sets</span></h2>'
        '<p>The closed value vocabularies (in the <code>common</code> module) used by the fields above.</p>'
        f'</div><div class="grid">{"".join(enum_cards)}</div></section>'
    )

    # ---- ER diagram ----
    try:
        er = ERDiagramGenerator(str(SCHEMA)).serialize()
        er = "\n".join(l for l in er.splitlines() if not l.strip().startswith("```")).strip()
    except Exception as e:
        er = ""
        print(f"warning: ER diagram generation failed: {e}", file=sys.stderr)
    er_section = (
        '<section id="diagram"><div class="sec-head"><h2>Entity relationships</h2>'
        '<p>Every typed association across the modules, generated from the schema. Pan / scroll.</p></div>'
        f'<details class="er"><summary>Show the entity-relationship diagram ({len(class_names)} classes)</summary>'
        f'<div class="mermaid-wrap"><pre class="mermaid">{esc(er)}</pre></div></details></section>'
    ) if er else ""

    title = esc(sv.schema.title or sv.schema.name)
    lede = esc((sv.schema.description or "").strip().split("\n\n")[0])

    doc = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<meta name="description" content="Generated reference for the REMIT v1 data model — modules, classes, fields and enums, with linkages. Source: schema/remit.yaml and its modules (DEC-57).">
<style>
:root {{
  color-scheme: light dark;
  --bg:#fff; --bg-soft:#f6f7f9; --card:#fff; --ink:#1b1f24; --ink-soft:#5b6470;
  --line:#e3e6ea; --line-strong:#c9ced6; --accent:#2f6db5; --accent-soft:#eaf1fb;
  --accent-ink:#1f4f86; --chip:#eef1f4; --mono-bg:#f1f3f6; --enum:#7a4fb5; --enum-soft:#f0eafb;
  --shadow:0 1px 2px rgba(20,30,45,.05),0 8px 24px rgba(20,30,45,.06);
}}
@media (prefers-color-scheme: dark) {{
  :root {{
    --bg:#0e1116; --bg-soft:#12161d; --card:#161b22; --ink:#e6edf3; --ink-soft:#9aa6b2;
    --line:#232a33; --line-strong:#323b46; --accent:#6ca8e8; --accent-soft:#16243a;
    --accent-ink:#9cc4f0; --chip:#1c222b; --mono-bg:#1b212a; --enum:#b89ae8; --enum-soft:#221a33;
    --shadow:0 1px 2px rgba(0,0,0,.3),0 10px 30px rgba(0,0,0,.35);
  }}
}}
*{{box-sizing:border-box}}
html{{scroll-behavior:smooth;scroll-padding-top:4.2rem}}
body{{margin:0;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:var(--ink);background:var(--bg);line-height:1.5;-webkit-font-smoothing:antialiased}}
a{{color:var(--accent)}}
code,.mono{{font-family:ui-monospace,"SF Mono",Menlo,Consolas,monospace}}
header.site{{position:sticky;top:0;z-index:50;display:flex;align-items:center;gap:1rem;padding:.6rem clamp(1rem,4vw,2.5rem);background:color-mix(in srgb,var(--bg) 88%,transparent);backdrop-filter:saturate(180%) blur(10px);border-bottom:1px solid var(--line)}}
header.site .brand{{font-weight:700;text-decoration:none;color:var(--ink)}}
header.site .brand span{{color:var(--accent)}}
header.site nav{{margin-left:auto;display:flex;gap:.2rem;flex-wrap:wrap}}
header.site nav a{{text-decoration:none;color:var(--ink-soft);font-size:.8rem;padding:.35rem .5rem;border-radius:.4rem}}
header.site nav a:hover{{color:var(--ink);background:var(--bg-soft)}}
.wrap{{max-width:84rem;margin:0 auto;padding:0 clamp(1rem,4vw,2.5rem)}}
.hero{{padding:clamp(2.2rem,6vw,3.6rem) 0 1.6rem;background:radial-gradient(1200px 400px at 15% -10%,var(--accent-soft),transparent 60%),radial-gradient(900px 380px at 95% 0%,var(--accent-soft),transparent 55%)}}
.eyebrow{{text-transform:uppercase;letter-spacing:.14em;font-size:.72rem;font-weight:700;color:var(--accent-ink);margin:0 0 .6rem}}
.hero h1{{font-size:clamp(1.9rem,5vw,3rem);line-height:1.08;margin:0 0 .7rem;letter-spacing:-.02em}}
.hero p.lede{{font-size:clamp(1rem,2.2vw,1.2rem);color:var(--ink-soft);max-width:50rem;margin:0}}
.source-note{{margin-top:1.3rem;font-size:.84rem;color:var(--ink-soft);display:inline-flex;align-items:center;gap:.5rem;padding:.45rem .75rem;border:1px solid var(--line);border-radius:2rem;background:var(--card)}}
.source-note b{{color:var(--ink);font-weight:600}}
.stats{{display:flex;gap:1.2rem;margin-top:.9rem;font-size:.84rem;color:var(--ink-soft);flex-wrap:wrap}}
.stats b{{color:var(--ink)}}
/* two-column layout: sticky hierarchical sidebar + content */
.layout{{display:grid;grid-template-columns:15rem minmax(0,1fr);gap:2.2rem;align-items:start;padding-top:1.5rem}}
aside.toc{{position:sticky;top:4.3rem;max-height:calc(100vh - 5rem);overflow:auto;font-size:.85rem;padding-bottom:2rem}}
aside.toc .toc-title{{text-transform:uppercase;letter-spacing:.1em;font-size:.68rem;font-weight:700;color:var(--ink-soft);margin:.2rem 0 .6rem}}
aside.toc details{{margin-bottom:.15rem}}
aside.toc summary{{cursor:pointer;display:flex;align-items:center;gap:.4rem;padding:.25rem .3rem;border-radius:.35rem;list-style:none}}
aside.toc summary::-webkit-details-marker{{display:none}}
aside.toc summary::before{{content:"▸";color:var(--ink-soft);font-size:.7rem;transition:transform .12s}}
aside.toc details[open]>summary::before{{transform:rotate(90deg)}}
aside.toc summary:hover{{background:var(--bg-soft)}}
aside.toc summary a{{font-weight:600;text-decoration:none;color:var(--ink)}}
aside.toc summary .c{{margin-left:auto;font-size:.66rem;color:var(--ink-soft);background:var(--chip);border-radius:1rem;padding:.02rem .4rem}}
aside.toc ul{{list-style:none;margin:.1rem 0 .5rem .85rem;padding:0;border-left:1px solid var(--line)}}
aside.toc li a{{display:block;padding:.12rem .55rem;color:var(--ink-soft);text-decoration:none;font-family:ui-monospace,monospace;font-size:.76rem;border-left:2px solid transparent;margin-left:-1px}}
aside.toc li a:hover{{color:var(--accent);border-left-color:var(--accent)}}
.content{{min-width:0}}
section{{padding:1.6rem 0;border-top:1px solid var(--line)}}
section:first-child{{border-top:0;padding-top:0}}
.sec-head{{max-width:52rem;margin-bottom:1.2rem}}
.sec-head h2{{font-size:clamp(1.25rem,3vw,1.7rem);margin:0 0 .3rem;letter-spacing:-.01em;display:flex;align-items:baseline;gap:.7rem;flex-wrap:wrap}}
.sec-head .modcount{{font-size:.74rem;font-weight:600;color:var(--ink-soft);background:var(--chip);border-radius:1rem;padding:.1rem .6rem;letter-spacing:0}}
.sec-head p{{color:var(--ink-soft);margin:0}}
.modgrid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(15rem,1fr));gap:.8rem}}
.modcard{{display:block;background:var(--card);border:1px solid var(--line);border-radius:.8rem;padding:.9rem 1rem;box-shadow:var(--shadow);text-decoration:none;color:inherit;transition:transform .14s ease,border-color .14s ease}}
.modcard:hover{{transform:translateY(-2px);border-color:var(--accent)}}
.modcard h3{{margin:0 0 .3rem;font-size:1.02rem;color:var(--accent-ink)}}
.modcard p{{margin:0 0 .55rem;font-size:.82rem;color:var(--ink-soft)}}
.modcard .n{{font-size:.7rem;font-family:ui-monospace,monospace;color:var(--ink-soft);background:var(--bg-soft);border:1px solid var(--line);border-radius:.3rem;padding:.05rem .4rem}}
.grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(24rem,1fr));gap:1rem;align-items:start}}
.entity{{background:var(--card);border:1px solid var(--line);border-radius:.85rem;padding:1.1rem 1.2rem;box-shadow:var(--shadow);scroll-margin-top:4.5rem}}
.entity .top{{display:flex;align-items:baseline;gap:.5rem;flex-wrap:wrap;margin-bottom:.4rem}}
.entity h3{{margin:0;font-size:1.06rem;font-family:ui-monospace,monospace;letter-spacing:-.01em}}
.tag{{font-size:.64rem;text-transform:uppercase;letter-spacing:.05em;font-weight:700;padding:.12rem .42rem;border-radius:.3rem;background:var(--chip);color:var(--ink-soft)}}
.tag.id{{background:var(--accent-soft);color:var(--accent-ink)}}
.tag.enum{{background:var(--enum-soft);color:var(--enum)}}
.entity .desc{{margin:.2rem 0 .7rem;color:var(--ink);font-size:.89rem}}
table.slots{{width:100%;border-collapse:collapse;font-size:.81rem}}
table.slots th{{text-align:left;font-weight:600;color:var(--ink-soft);border-bottom:1px solid var(--line);padding:.25rem .4rem;font-size:.7rem;text-transform:uppercase;letter-spacing:.05em}}
table.slots td{{padding:.28rem .4rem;border-bottom:1px solid var(--line);vertical-align:top}}
table.slots tr:last-child td{{border-bottom:0}}
td.k{{font-family:ui-monospace,monospace;color:var(--accent-ink);white-space:nowrap}}
td.card{{font-family:ui-monospace,monospace;color:var(--ink-soft);white-space:nowrap}}
td.d{{color:var(--ink-soft)}}
.flag{{font-size:.58rem;margin-left:.35rem;padding:.02rem .3rem;border-radius:.25rem;background:var(--accent-soft);color:var(--accent-ink);text-transform:uppercase;letter-spacing:.04em}}
.flag.inh{{background:var(--chip);color:var(--ink-soft)}}
.ref{{text-decoration:none;font-family:ui-monospace,monospace}}
.ref.cls{{color:var(--accent)}}
.ref.enum{{color:var(--enum)}}
.ref.prim{{color:var(--ink-soft)}}
.empty{{color:var(--ink-soft);font-size:.84rem;margin:.2rem 0 0}}
.pvs{{list-style:none;margin:.2rem 0 0;padding:0;display:grid;gap:.25rem;font-size:.83rem;color:var(--ink-soft)}}
.pvs code{{color:var(--enum);background:var(--enum-soft);padding:.03rem .35rem;border-radius:.25rem}}
details.er{{border:1px solid var(--line);border-radius:.7rem;background:var(--card);padding:.4rem .9rem}}
details.er summary{{cursor:pointer;font-weight:600;padding:.4rem 0}}
.mermaid-wrap{{overflow:auto;max-height:80vh;border-top:1px solid var(--line);margin-top:.4rem;padding-top:.6rem}}
footer.site{{border-top:1px solid var(--line);padding:2rem 0 3rem;color:var(--ink-soft);font-size:.85rem}}
footer.site a{{font-weight:600}}
.backlinks{{display:flex;gap:1.25rem;flex-wrap:wrap;margin-bottom:1rem}}
@media (max-width:62rem){{
  .layout{{grid-template-columns:1fr}}
  aside.toc{{display:none}}
}}
</style>
</head>
<body>
<header class="site">
  <a class="brand" href="../"><span>REMIT</span> · Data Model</a>
  <nav>
    <a href="#overview">Overview</a>
    <a href="#diagram">Diagram</a>
    <a href="#enums">Enums</a>
    <a href="../app/">App</a>
  </nav>
</header>

<div class="hero">
  <div class="wrap">
    <p class="eyebrow">Generated reference · LinkML (DEC-57)</p>
    <h1>{title}</h1>
    <p class="lede">{lede}</p>
    <div class="source-note"><span>📐</span><span>Generated from the modular schema
      under <b>schema/</b> (entry <b>schema/remit.yaml</b>). Do not hand-edit this page;
      edit the modules and re-run <b>schema/generate.sh</b>.</span></div>
    <div class="stats"><span><b>{len(MODULE_ORDER)}</b> modules</span>
      <span><b>{len(class_names)}</b> classes</span>
      <span><b>{len(enum_names)}</b> enums</span>
      <span>JSON Schema &amp; TypeScript generated alongside</span></div>
  </div>
</div>

<div class="wrap layout">
  <aside class="toc">
    <div class="toc-title">Navigate</div>
    <nav>{"".join(toc)}</nav>
  </aside>
  <main class="content">
    <section id="overview">
      <div class="sec-head"><h2>The model at a glance</h2>
        <p>The serialisable object core, split into {len(MODULE_ORDER)} modules. Pick a
        module to jump in, or use the navigator on the left.</p></div>
      <div class="modgrid">{"".join(overview)}</div>
    </section>
    {er_section}
    {"".join(sections)}
    {enums_section}
  </main>
</div>

<footer class="site">
  <div class="wrap">
    <div class="backlinks"><a href="../">← Home</a><a href="../app/">Walking skeleton</a><a href="../blog/">Blog</a></div>
    Generated from the modular LinkML schema under <code>schema/</code> by <code>schema/build-reference.py</code>.
    Cardinality: <code>1</code> required · <code>0..1</code> optional · <code>0..*/1..*</code> list.
    Behaviour / function-valued fields are resolved across the seam, not modelled here (DEC-57).
  </div>
</footer>
{('<script type="module">import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";mermaid.initialize({startOnLoad:true,securityLevel:"loose",theme:matchMedia("(prefers-color-scheme: dark)").matches?"dark":"default"});</script>') if er else ''}
</body>
</html>
"""
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(doc, encoding="utf-8")
    print(f"wrote {OUT.relative_to(ROOT)} ({len(doc)//1024} KB, "
          f"{len(MODULE_ORDER)} modules, {len(class_names)} classes, {len(enum_names)} enums)")


if __name__ == "__main__":
    main()
