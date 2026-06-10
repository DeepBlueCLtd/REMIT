#!/usr/bin/env python3
"""Generate the single-page data-model reference (site/data-model/index.html)
from the LinkML schema. Derived artefact — do not hand-edit the output; edit
schema/remit.linkml.yaml and re-run schema/generate.sh (DEC-57)."""
import html
import sys
from pathlib import Path

from linkml_runtime import SchemaView
from linkml.generators.erdiagramgen import ERDiagramGenerator

ROOT = Path(__file__).resolve().parent.parent
SCHEMA = ROOT / "schema" / "remit.linkml.yaml"
OUT = ROOT / "site" / "data-model" / "index.html"


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

    def range_cell(rng):
        if rng in class_names:
            return f'<a class="ref cls" href="#class-{esc(rng)}">{esc(rng)}</a>'
        if rng in enum_names:
            return f'<a class="ref enum" href="#enum-{esc(rng)}">{esc(rng)}</a>'
        return f'<span class="ref prim">{esc(rng or "string")}</span>'

    # ER diagram (mermaid). Strip the ```mermaid fences the generator adds.
    try:
        er = ERDiagramGenerator(str(SCHEMA)).serialize()
        er = "\n".join(l for l in er.splitlines() if not l.strip().startswith("```")).strip()
    except Exception as e:  # diagram is a nicety; never block the reference
        er = ""
        print(f"warning: ER diagram generation failed: {e}", file=sys.stderr)

    # ---- class cards ----
    cards = []
    jump = []
    for name, cls in classes.items():
        jump.append(f'<a href="#class-{esc(name)}">{esc(name)}</a>')
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
            + "".join(rows)
            + "</tbody></table>"
            if rows
            else '<p class="empty">No fields.</p>'
        )
        cards.append(
            f'<article class="entity" id="class-{esc(name)}">'
            f'<div class="top"><h3>{esc(name)}</h3>{"".join(tags)}</div>'
            f'<p class="desc">{esc(cls.description)}</p>{body}</article>'
        )

    # ---- enum cards ----
    enum_cards = []
    enum_jump = []
    for name, en in enums.items():
        enum_jump.append(f'<a href="#enum-{esc(name)}">{esc(name)}</a>')
        pvs = []
        for vname, v in (en.permissible_values or {}).items():
            d = esc(v.description) if v and v.description else ""
            pvs.append(
                f'<li><code>{esc(vname)}</code>{(" — " + d) if d else ""}</li>'
            )
        enum_cards.append(
            f'<article class="entity enum-card" id="enum-{esc(name)}">'
            f'<div class="top"><h3>{esc(name)}</h3><span class="tag enum">enum</span></div>'
            f'<p class="desc">{esc(en.description)}</p>'
            f'<ul class="pvs">{"".join(pvs)}</ul></article>'
        )

    title = esc(sv.schema.title or sv.schema.name)
    # first paragraph of the schema description as the lede
    lede = esc((sv.schema.description or "").strip().split("\n\n")[0])

    er_section = (
        f'<section id="diagram"><div class="sec-head"><h2>Entity relationships</h2>'
        f"<p>Every typed association in the model, generated from the schema. "
        f"Pan / scroll the diagram.</p></div>"
        f'<details class="er"><summary>Show the entity-relationship diagram '
        f"({len(class_names)} classes)</summary>"
        f'<div class="mermaid-wrap"><pre class="mermaid">{esc(er)}</pre></div>'
        f"</details></section>"
        if er
        else ""
    )

    doc = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<meta name="description" content="Generated reference for the REMIT v1 data model — classes, fields and enums, with linkages. Source: schema/remit.linkml.yaml (DEC-57).">
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
header.site{{position:sticky;top:0;z-index:50;display:flex;align-items:center;gap:1rem;padding:.6rem clamp(1rem,4vw,2.5rem);background:color-mix(in srgb,var(--bg) 85%,transparent);backdrop-filter:saturate(180%) blur(10px);border-bottom:1px solid var(--line)}}
header.site .brand{{font-weight:700;text-decoration:none;color:var(--ink)}}
header.site .brand span{{color:var(--accent)}}
header.site nav{{margin-left:auto;display:flex;gap:.25rem;flex-wrap:wrap}}
header.site nav a{{text-decoration:none;color:var(--ink-soft);font-size:.82rem;padding:.35rem .55rem;border-radius:.4rem}}
header.site nav a:hover{{color:var(--ink);background:var(--bg-soft)}}
.wrap{{max-width:74rem;margin:0 auto;padding:0 clamp(1rem,4vw,2.5rem)}}
.hero{{padding:clamp(2.2rem,6vw,4rem) 0 1.6rem;background:radial-gradient(1200px 400px at 15% -10%,var(--accent-soft),transparent 60%),radial-gradient(900px 380px at 95% 0%,var(--accent-soft),transparent 55%)}}
.eyebrow{{text-transform:uppercase;letter-spacing:.14em;font-size:.72rem;font-weight:700;color:var(--accent-ink);margin:0 0 .6rem}}
.hero h1{{font-size:clamp(1.9rem,5vw,3rem);line-height:1.08;margin:0 0 .7rem;letter-spacing:-.02em}}
.hero p.lede{{font-size:clamp(1rem,2.2vw,1.25rem);color:var(--ink-soft);max-width:48rem;margin:0}}
.source-note{{margin-top:1.4rem;font-size:.85rem;color:var(--ink-soft);display:inline-flex;align-items:center;gap:.5rem;padding:.45rem .75rem;border:1px solid var(--line);border-radius:2rem;background:var(--card)}}
.source-note b{{color:var(--ink);font-weight:600}}
.stats{{display:flex;gap:1.2rem;margin-top:1rem;font-size:.85rem;color:var(--ink-soft);flex-wrap:wrap}}
.stats b{{color:var(--ink)}}
section{{padding:2.4rem 0;border-top:1px solid var(--line)}}
.sec-head{{max-width:48rem;margin-bottom:1.4rem}}
.sec-head h2{{font-size:clamp(1.3rem,3vw,1.8rem);margin:0 0 .35rem;letter-spacing:-.01em}}
.sec-head p{{color:var(--ink-soft);margin:0}}
.jump{{display:flex;flex-wrap:wrap;gap:.3rem;margin-bottom:1.6rem}}
.jump a{{font-size:.74rem;font-family:ui-monospace,monospace;text-decoration:none;color:var(--ink-soft);border:1px solid var(--line);border-radius:.3rem;padding:.1rem .4rem;background:var(--bg-soft)}}
.jump a:hover{{color:var(--accent-ink);border-color:var(--accent)}}
.grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(26rem,1fr));gap:1rem;align-items:start}}
.entity{{background:var(--card);border:1px solid var(--line);border-radius:.85rem;padding:1.1rem 1.2rem;box-shadow:var(--shadow);scroll-margin-top:4.5rem}}
.entity .top{{display:flex;align-items:baseline;gap:.5rem;flex-wrap:wrap;margin-bottom:.4rem}}
.entity h3{{margin:0;font-size:1.08rem;font-family:ui-monospace,monospace;letter-spacing:-.01em}}
.tag{{font-size:.66rem;text-transform:uppercase;letter-spacing:.06em;font-weight:700;padding:.12rem .42rem;border-radius:.3rem;background:var(--chip);color:var(--ink-soft)}}
.tag.id{{background:var(--accent-soft);color:var(--accent-ink)}}
.tag.enum{{background:var(--enum-soft);color:var(--enum)}}
.entity .desc{{margin:.2rem 0 .7rem;color:var(--ink);font-size:.9rem}}
table.slots{{width:100%;border-collapse:collapse;font-size:.82rem}}
table.slots th{{text-align:left;font-weight:600;color:var(--ink-soft);border-bottom:1px solid var(--line);padding:.25rem .4rem;font-size:.72rem;text-transform:uppercase;letter-spacing:.05em}}
table.slots td{{padding:.28rem .4rem;border-bottom:1px solid var(--line);vertical-align:top}}
table.slots tr:last-child td{{border-bottom:0}}
td.k{{font-family:ui-monospace,monospace;color:var(--accent-ink);white-space:nowrap}}
td.card{{font-family:ui-monospace,monospace;color:var(--ink-soft);white-space:nowrap}}
td.d{{color:var(--ink-soft)}}
.flag{{font-size:.6rem;margin-left:.35rem;padding:.02rem .3rem;border-radius:.25rem;background:var(--accent-soft);color:var(--accent-ink);text-transform:uppercase;letter-spacing:.04em}}
.flag.inh{{background:var(--chip);color:var(--ink-soft)}}
.ref{{text-decoration:none;font-family:ui-monospace,monospace}}
.ref.cls{{color:var(--accent)}}
.ref.enum{{color:var(--enum)}}
.ref.prim{{color:var(--ink-soft)}}
.empty{{color:var(--ink-soft);font-size:.85rem;margin:.2rem 0 0}}
.pvs{{list-style:none;margin:.2rem 0 0;padding:0;display:grid;gap:.25rem;font-size:.84rem;color:var(--ink-soft)}}
.pvs code{{color:var(--enum);background:var(--enum-soft);padding:.03rem .35rem;border-radius:.25rem}}
details.er{{border:1px solid var(--line);border-radius:.7rem;background:var(--card);padding:.4rem .9rem}}
details.er summary{{cursor:pointer;font-weight:600;padding:.4rem 0}}
.mermaid-wrap{{overflow:auto;max-height:80vh;border-top:1px solid var(--line);margin-top:.4rem;padding-top:.6rem}}
footer.site{{border-top:1px solid var(--line);padding:2rem 0 3rem;color:var(--ink-soft);font-size:.85rem}}
footer.site a{{font-weight:600}}
.backlinks{{display:flex;gap:1.25rem;flex-wrap:wrap;margin-bottom:1rem}}
</style>
</head>
<body>
<header class="site">
  <a class="brand" href="../"><span>REMIT</span> · Data Model</a>
  <nav>
    <a href="#diagram">Diagram</a>
    <a href="#classes">Classes</a>
    <a href="#enums">Enums</a>
    <a href="../app/">App</a>
  </nav>
</header>

<div class="hero">
  <div class="wrap">
    <p class="eyebrow">Generated reference · LinkML (DEC-57)</p>
    <h1>{title}</h1>
    <p class="lede">{lede}</p>
    <div class="source-note"><span>📐</span><span>Generated from
      <b>schema/remit.linkml.yaml</b> — the one source of truth. Do not hand-edit
      this page; edit the schema and re-run <b>schema/generate.sh</b>.</span></div>
    <div class="stats"><span><b>{len(class_names)}</b> classes</span>
      <span><b>{len(enum_names)}</b> enums</span>
      <span>JSON Schema &amp; TypeScript generated alongside</span></div>
  </div>
</div>

<main class="wrap">
{er_section}
  <section id="classes">
    <div class="sec-head"><h2>Classes</h2><p>Each class with its fields — type
      (linked to the referenced class or enum), cardinality, and description.</p></div>
    <div class="jump">{"".join(jump)}</div>
    <div class="grid">{"".join(cards)}</div>
  </section>

  <section id="enums">
    <div class="sec-head"><h2>Enums</h2><p>The closed value sets used by the fields above.</p></div>
    <div class="jump">{"".join(enum_jump)}</div>
    <div class="grid">{"".join(enum_cards)}</div>
  </section>
</main>

<footer class="site">
  <div class="wrap">
    <div class="backlinks"><a href="../">← Home</a><a href="../app/">Walking skeleton</a><a href="../blog/">Blog</a></div>
    Generated from <code>schema/remit.linkml.yaml</code> by <code>schema/build-reference.py</code>.
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
    print(f"wrote {OUT.relative_to(ROOT)} ({len(doc)//1024} KB, {len(class_names)} classes, {len(enum_names)} enums)")


if __name__ == "__main__":
    main()
