#!/usr/bin/env python3
"""Render the Act VII PRD markdown into a self-contained HTML artifact."""
import re, html, sys

SRC = 'docs/PRD-act-seven-farm-team.md'
OUT = 'docs/prd-act-seven.html'


def slug(text):
    s = re.sub(r'[^a-z0-9]+', '-', text.lower()).strip('-')
    return s or 'sec'


def inline(t):
    """Inline markdown -> HTML. Code spans are protected first."""
    spans = []

    def stash(m):
        spans.append(m.group(1))
        return f'\x00{len(spans)-1}\x00'

    t = re.sub(r'`([^`]+)`', stash, t)
    t = html.escape(t, quote=False)
    t = re.sub(r'\[([^\]]+)\]\(([^)]+)\)',
               lambda m: f'<a href="{html.escape(m.group(2),True)}">{m.group(1)}</a>', t)
    t = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', t)
    t = re.sub(r'(?<![\w*])\*([^*\n]+)\*(?![\w*])', r'<em>\1</em>', t)
    t = re.sub(r'\x00(\d+)\x00',
               lambda m: f'<code>{html.escape(spans[int(m.group(1))], quote=False)}</code>', t)
    return t


def render(md):
    lines = md.split('\n')
    out, toc = [], []
    i, n = 0, len(lines)
    while i < n:
        ln = lines[i]

        # fenced code
        if ln.startswith('```'):
            lang = ln[3:].strip()
            i += 1
            buf = []
            while i < n and not lines[i].startswith('```'):
                buf.append(lines[i]); i += 1
            i += 1
            code = html.escape('\n'.join(buf), quote=False)
            out.append(f'<div class="scroll"><pre class="code" data-lang="{html.escape(lang,True)}">'
                       f'<code>{code}</code></pre></div>')
            continue

        # headings
        m = re.match(r'^(#{1,6})\s+(.*)$', ln)
        if m:
            lvl, txt = len(m.group(1)), m.group(2).strip()
            sid = slug(txt)
            if lvl == 1:
                out.append(f'<h1 id="{sid}">{inline(txt)}</h1>')
            else:
                out.append(f'<h{lvl} id="{sid}">{inline(txt)}</h{lvl}>')
                if lvl in (2, 3):
                    toc.append((lvl, txt, sid))
            i += 1
            continue

        # table
        if ln.startswith('|') and i + 1 < n and re.match(r'^\|[\s:|-]+\|?$', lines[i+1]):
            def cells(row):
                r = row.strip()
                if r.startswith('|'): r = r[1:]
                if r.endswith('|'): r = r[:-1]
                return [c.strip() for c in r.split('|')]
            head = cells(ln)
            i += 2
            body = []
            while i < n and lines[i].startswith('|'):
                body.append(cells(lines[i])); i += 1
            th = ''.join(f'<th>{inline(c)}</th>' for c in head)
            rows = ''.join('<tr>' + ''.join(f'<td>{inline(c)}</td>' for c in r) + '</tr>'
                           for r in body)
            out.append(f'<div class="scroll"><table><thead><tr>{th}</tr></thead>'
                       f'<tbody>{rows}</tbody></table></div>')
            continue

        # blockquote
        if ln.startswith('>'):
            buf = []
            while i < n and lines[i].startswith('>'):
                buf.append(lines[i].lstrip('>').strip()); i += 1
            out.append(f'<blockquote>{inline(" ".join(buf))}</blockquote>')
            continue

        # lists (supports one nested level)
        if re.match(r'^\s*([-*]|\d+\.)\s+', ln):
            ordered = bool(re.match(r'^\s*\d+\.\s+', ln))
            tag = 'ol' if ordered else 'ul'
            items, cur, curind = [], None, 0
            while i < n and (re.match(r'^\s*([-*]|\d+\.)\s+', lines[i]) or
                             (lines[i].strip() and lines[i].startswith('  ') and cur is not None)):
                mm = re.match(r'^(\s*)([-*]|\d+\.)\s+(.*)$', lines[i])
                if mm:
                    if cur is not None:
                        items.append((curind, cur))
                    curind = len(mm.group(1))
                    cur = mm.group(3)
                else:
                    cur += ' ' + lines[i].strip()
                i += 1
            if cur is not None:
                items.append((curind, cur))
            base = min(ind for ind, _ in items)
            htmlout, open_nested = [], False
            for ind, txt in items:
                if ind > base and not open_nested:
                    htmlout.append(f'<{tag}>'); open_nested = True
                elif ind == base and open_nested:
                    htmlout.append(f'</{tag}>'); open_nested = False
                htmlout.append(f'<li>{inline(txt)}</li>')
            if open_nested:
                htmlout.append(f'</{tag}>')
            out.append(f'<{tag}>' + ''.join(htmlout) + f'</{tag}>')
            continue

        # hr
        if re.match(r'^---+\s*$', ln):
            out.append('<hr />'); i += 1; continue

        # html comment passthrough / blank
        if not ln.strip():
            i += 1; continue

        # paragraph
        buf = []
        while i < n and lines[i].strip() and not lines[i].startswith(('#', '|', '>', '```')) \
                and not re.match(r'^---+\s*$', lines[i]) \
                and not re.match(r'^\s*([-*]|\d+\.)\s+', lines[i]):
            buf.append(lines[i].strip()); i += 1
        if buf:
            out.append(f'<p>{inline(" ".join(buf))}</p>')
    return '\n'.join(out), toc


def build():
    md = open(SRC).read()
    body, toc = render(md)
    nav = []
    for lvl, txt, sid in toc:
        cls = 'l2' if lvl == 2 else 'l3'
        label = re.sub(r'`', '', txt)
        nav.append(f'<a class="{cls}" href="#{sid}">{html.escape(label, quote=False)}</a>')
    navhtml = '\n'.join(nav)

    page = TEMPLATE.replace('{{NAV}}', navhtml).replace('{{BODY}}', body)
    open(OUT, 'w').write(page)
    print('wrote', OUT, len(page), 'bytes;', len(toc), 'toc entries')


TEMPLATE = r'''<title>PRD — Idle Base: Act VII, The Farm Team</title>
<style>
:root{
  --bg:#f6f7f9; --surface:#ffffff; --sunk:#eef0f4;
  --ink:#161b22; --ink-soft:#414b57; --ink-faint:#6b7684;
  --rule:#dde1e8; --rule-soft:#e8ebf0;
  --accent:#3e6b94; --accent-soft:#e4edf5;
  --amber:#b0762a; --amber-soft:#f7efdf;
  --serif: "Iowan Old Style","Charter","Palatino Linotype",Palatino,Georgia,"Times New Roman",serif;
  --sans: ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;
  --mono: ui-monospace,SFMono-Regular,"SF Mono",Menlo,Consolas,"Liberation Mono",monospace;
}
@media (prefers-color-scheme:dark){
  :root:not([data-theme="light"]){
    --bg:#11151b; --surface:#171c24; --sunk:#1d232c;
    --ink:#e6eaf0; --ink-soft:#b3bcc9; --ink-faint:#7f8b9a;
    --rule:#28303b; --rule-soft:#212832;
    --accent:#7fb0da; --accent-soft:#1b2733;
    --amber:#d9a253; --amber-soft:#2a2317;
  }
}
:root[data-theme="dark"]{
  --bg:#11151b; --surface:#171c24; --sunk:#1d232c;
  --ink:#e6eaf0; --ink-soft:#b3bcc9; --ink-faint:#7f8b9a;
  --rule:#28303b; --rule-soft:#212832;
  --accent:#7fb0da; --accent-soft:#1b2733;
  --amber:#d9a253; --amber-soft:#2a2317;
}
*{box-sizing:border-box}
body{
  margin:0; background:var(--bg); color:var(--ink);
  font-family:var(--serif); font-size:17px; line-height:1.62;
  -webkit-font-smoothing:antialiased;
}
.wrap{display:grid; grid-template-columns:280px minmax(0,1fr); gap:0; max-width:1240px; margin:0 auto}
/* ---- sidebar ---- */
nav{
  position:sticky; top:0; align-self:start; height:100vh; overflow-y:auto;
  padding:2.4rem 1.4rem 3rem 1.6rem; border-right:1px solid var(--rule);
  font-family:var(--sans); font-size:13px; line-height:1.45; background:var(--bg);
}
nav .eyebrow{
  font-size:10.5px; letter-spacing:.14em; text-transform:uppercase;
  color:var(--ink-faint); margin-bottom:1.1rem; font-weight:600;
}
nav a{display:block; color:var(--ink-soft); text-decoration:none; padding:.3rem 0; border-left:2px solid transparent; padding-left:.7rem}
nav a.l2{font-weight:600; color:var(--ink); margin-top:.55rem}
nav a.l3{font-size:12.4px; padding-left:1.5rem; color:var(--ink-faint)}
nav a:hover{color:var(--accent); border-left-color:var(--accent)}
nav a:focus-visible,main a:focus-visible{outline:2px solid var(--accent); outline-offset:2px; border-radius:2px}
/* ---- main ---- */
main{padding:2.8rem 3rem 7rem; min-width:0}
main>*{max-width:68ch}
h1{
  font-family:var(--sans); font-size:2.15rem; line-height:1.16; font-weight:700;
  letter-spacing:-.021em; margin:.2rem 0 1.4rem; text-wrap:balance;
}
h2{
  font-family:var(--sans); font-size:1.42rem; font-weight:670; letter-spacing:-.014em;
  margin:3.4rem 0 1rem; padding-top:1.5rem; border-top:1px solid var(--rule); text-wrap:balance;
}
h3{font-family:var(--sans); font-size:1.1rem; font-weight:650; margin:2.3rem 0 .7rem; letter-spacing:-.008em; text-wrap:balance}
h4{font-family:var(--sans); font-size:.94rem; font-weight:650; margin:1.7rem 0 .5rem; color:var(--ink-soft); text-wrap:balance}
p{margin:0 0 1.05rem}
strong{font-weight:680}
hr{border:0; border-top:1px solid var(--rule-soft); margin:2.6rem 0}
a{color:var(--accent)}
ul,ol{margin:0 0 1.15rem; padding-left:1.3rem}
li{margin:.36rem 0}
li>ul,li>ol{margin:.36rem 0 .1rem}
blockquote{
  margin:1.4rem 0; padding:.85rem 1.2rem; background:var(--accent-soft);
  border-left:3px solid var(--accent); border-radius:0 3px 3px 0;
  color:var(--ink-soft); font-style:italic;
}
blockquote strong{color:var(--ink); font-style:normal}
code{
  font-family:var(--mono); font-size:.845em; background:var(--sunk);
  padding:.13em .38em; border-radius:3px; color:var(--ink); word-break:break-word;
}
.scroll{overflow-x:auto; margin:1.35rem 0; max-width:100%}
main>.scroll{max-width:min(100%,86ch)}
pre.code{
  margin:0; padding:1rem 1.15rem; background:var(--surface);
  border:1px solid var(--rule); border-radius:5px; font-size:13px; line-height:1.55;
}
pre.code code{background:none; padding:0; font-size:inherit; white-space:pre}
table{
  border-collapse:collapse; width:100%; font-family:var(--sans); font-size:13.2px;
  line-height:1.45; font-variant-numeric:tabular-nums; background:var(--surface);
  border:1px solid var(--rule); border-radius:5px;
}
th,td{padding:.5rem .7rem; text-align:left; border-bottom:1px solid var(--rule-soft); vertical-align:top}
th{
  background:var(--sunk); font-weight:650; font-size:11.4px; letter-spacing:.045em;
  text-transform:uppercase; color:var(--ink-soft); white-space:nowrap;
}
tbody tr:last-child td{border-bottom:0}
td code{font-size:.87em}
/* ---- responsive ---- */
@media (max-width:900px){
  .wrap{grid-template-columns:1fr}
  nav{position:static; height:auto; border-right:0; border-bottom:1px solid var(--rule); padding:1.5rem 1.4rem}
  nav a.l3{display:none}
  main{padding:2rem 1.25rem 5rem}
  body{font-size:16.5px}
  h1{font-size:1.72rem}
  h2{font-size:1.24rem}
}
@media (prefers-reduced-motion:reduce){*{animation:none!important; transition:none!important}}
</style>
<div class="wrap">
<nav>
<div class="eyebrow">Act VII — Contents</div>
{{NAV}}
</nav>
<main>
{{BODY}}
</main>
</div>
'''

if __name__ == '__main__':
    build()
