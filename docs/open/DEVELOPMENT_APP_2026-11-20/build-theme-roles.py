#!/usr/bin/env python3
"""Generate theme-roles.json (worker L, 2026-11-20).
Inputs: themes.json (C), design-system.json (D aliases). Run: python3 build-theme-roles.py
Roles are defined in ROLES below (the canonical list); the per-app maps come from
CANDIDATES (ordered var names per role; the first one declared in the app wins, the rest go to `also`)
plus D's alias rows (family hooks such as --eac-form-bg land in `also`).
match: exact = same job under another name; near = similar job (check by eye); none = app has nothing."""
import json, re, os
HERE = os.path.dirname(os.path.abspath(__file__))

# id, label (what the owner sees), group, var, format, description
ROLES = [
 # colour
 ("ground","Page background","colour","--eac-ground","color","The colour every page sits on."),
 ("panel","Cards and panels","colour","--eac-panel","color","Cards, popups, sheets: a surface sitting on the page."),
 ("ground-soft","Soft panels","colour","--eac-ground-soft","color","Sunken or tinted areas: fields, wells, rails, hover."),
 ("ink","Text","colour","--eac-ink","color","Main text, read against the page and panels."),
 ("ink-muted","Quiet text","colour","--eac-ink-muted","color","Secondary text, hints, captions."),
 ("ink-faint","Faint text","colour","--eac-ink-faint","color","Placeholders and disabled text."),
 ("line","Lines","colour","--eac-line","color","Hairline borders and dividers."),
 ("rule","Strong rules","colour","--eac-rule","color","The heavier rule under heads and feet."),
 ("accent","Main accent","colour","--eac-accent","color","The one brand colour: buttons, marks, focus, the current page."),
 ("on-accent","Text on the accent","colour","--eac-on-accent","color","Text that sits on a filled accent."),
 ("accent-ink","Accent as text","colour","--eac-accent-ink","color","The accent used as text on the page (must pass 4.5:1)."),
 ("accent-soft","Hover wash","colour","--eac-accent-soft","color","The accent as a quiet fill: chips, selected row, row under the pointer."),
 ("accent-2","Second accent","colour","--eac-accent-2","color","An optional second brand colour (celadon, gold, rust)."),
 ("danger","Warning red","colour","--eac-danger","color","Errors and destructive actions."),
 ("ok","Done green","colour","--eac-ok","color","Done, ready, saved, live."),
 ("warn","Attention amber","colour","--eac-warn","color","Needs attention."),
 ("scrim","Popup backdrop","colour","--eac-scrim","rgba","The dimming behind a popup (translucent)."),
 ("band","Section banners","colour","--eac-band","background","Behind section titles: a colour or a gradient."),
 # type
 ("font-body","Body text font","type","--eac-font-body","font","Running text and controls."),
 ("font-title","Headings font","type","--eac-font-title","font","Titles and mastheads (older name: heading)."),
 ("font-nav","Menu font","type","--eac-font-nav","font","Navigation."),
 ("font-caption","Caption font","type","--eac-font-caption","font","Captions and small notes."),
 ("font-reading","Reading font","type","--eac-font-reading","font","Long-form reading."),
 ("font-record","Label font","type","--eac-font-record","font","Kickers, facts, datelines (the registry voice)."),
 ("text-scale","Text size","type","--eac-text-scale","number","Overall text size multiplier (1 = as designed)."),
 # shape
 ("radius","Corners","shape","--eac-radius","length","Corner radius of panels and cards. 0 for square."),
 ("radius-control","Field corners","shape","--eac-radius-control","length","Corner radius of buttons and fields."),
 ("radius-mark","Small-mark corners","shape","--eac-radius-mark","length","Chips, tags, dots."),
 ("shadow-panel","Panel shadow","shape","--eac-shadow-panel","shadow","The shadow under a sheet or panel."),
 ("shadow-pop","Popup shadow","shape","--eac-shadow-pop","shadow","The shadow under a menu or popup."),
 # space
 ("gap","Spacing step","space","--eac-gap-3","length","The base gap; the scale is gap-1..gap-5 (4, 8, 12, 18, 24)."),
 ("width-standard","Page width","space","--eac-width-standard","length","Standard content width (compact 440, standard 640, wide 940, full 1180)."),
 ("measure","Reading width","space","--eac-measure","length","Line length for long text."),
 ("header-h","Header height","space","--eac-header-h","length","Height of the site header, so a hero can sit under it."),
 # motion
 ("ease","Easing","motion","--eac-ease","easing","The one easing curve."),
 ("dur-base","Speed","motion","--eac-dur-base","duration","Normal transition time (fast 120, base 180, slow 320 ms)."),
]
# CORE: the 12 roles an owner sees open by default; the rest sit behind a fold
CORE = {"ground","panel","ground-soft","ink","ink-muted","line","accent","on-accent","danger","font-body","font-title","radius"}
# CANDIDATES: role -> list of (var, match). Applies to every app; first declared wins.
C = {
 "ground":[("--eac-ground","exact"),("--background","exact"),("--paper","exact"),("--violet","exact"),("--oad-paper","exact"),("--oad-page-bg","exact"),("--ig-c-paper","near"),("--he-bg","near"),("--ktp-bg","near"),("--eac-surface-bg","exact"),("--sf-bg","exact"),("--eac-control-bg","exact"),("--eac-block-bg","exact"),("--eac-form-bg","exact")],
 "panel":[("--eac-panel","exact"),("--card","exact"),("--surface","exact"),("--violet-panel","exact"),("--oad-panel","exact"),("--eac-card-bg","exact")],
 "ground-soft":[("--eac-ground-soft","exact"),("--muted","exact"),("--eac-surface-bg-soft","exact"),("--sf-bg-soft","exact"),("--sf-soft","exact")],
 "ink":[("--eac-ink","exact"),("--foreground","exact"),("--ink","exact"),("--oad-ink","exact"),("--ig-c-black","near"),("--eac-surface-fg","exact"),("--sf-fg","exact"),("--eac-control-fg","exact")],
 "ink-muted":[("--eac-ink-muted","exact"),("--muted-foreground","exact"),("--ink-soft","near"),("--oad-ink-soft","near"),("--eac-surface-muted","exact"),("--sf-muted","exact"),("--eac-control-muted","exact")],
 "ink-faint":[("--eac-ink-faint","exact"),("--eac-surface-faint","exact"),("--sf-faint","exact")],
 "line":[("--eac-line","exact"),("--border","exact"),("--line","exact"),("--oad-line","exact"),("--eac-surface-line","exact"),("--sf-line","exact"),("--eac-control-line","exact")],
 "rule":[("--eac-rule","exact"),("--eac-surface-rule","exact"),("--sf-rule","exact"),("--frame","near")],
 "accent":[("--eac-accent","exact"),("--primary","exact"),("--oxide","near"),("--cyan","near"),("--oad-gold","near"),("--eac-surface-accent","exact"),("--sf-accent","exact"),("--eac-control-accent","exact")],
 "on-accent":[("--eac-on-accent","exact"),("--primary-foreground","exact"),("--oad-on-gold","near"),("--eac-surface-on-accent","exact"),("--sf-on-accent","exact"),("--eac-control-accent-on","exact")],
 "accent-ink":[("--eac-accent-ink","exact"),("--eac-control-accent-ink","exact"),("--eac-form-accent-ink","exact"),("--frm-accent-ink","exact")],
 "accent-soft":[("--eac-accent-soft","exact"),("--accent","near"),("--eac-form-accent-soft","exact"),("--frm-accent-soft","exact")],
 "accent-2":[("--eac-accent-2","exact"),("--gold","near"),("--orange","near"),("--ig-c-gold","near"),("--verdigris","near"),("--rust","near"),("--live","near"),("--secondary","near")],
 "danger":[("--eac-danger","exact"),("--destructive","exact"),("--oad-status-no","near"),("--eac-surface-danger","exact"),("--sf-danger","exact"),("--eac-control-danger","exact")],
 "ok":[("--eac-ok","exact"),("--oad-status-yes","near"),("--blk-ok","exact"),("--live","near")],
 "warn":[("--eac-warn","exact"),("--eac-form-warn","exact"),("--frm-warn","exact")],
 "scrim":[("--eac-scrim","exact"),("--eac-surface-scrim","exact"),("--sf-scrim","exact")],
 "band":[("--eac-band","exact"),("--eac-block-band","exact")],
 "font-body":[("--eac-font-body","exact"),("--site-font-body","exact"),("--dm-font-body","exact"),("--oad-font-body","exact"),("--font-body","exact"),("--eac-block-font-body","exact"),("--font-sans","near")],
 "font-title":[("--eac-font-title","exact"),("--site-font-heading","exact"),("--dm-font-heading","exact"),("--oad-font-display","near"),("--font-heading","exact"),("--eac-block-font-title","exact"),("--eac-font-heading","exact")],
 "font-nav":[("--eac-font-nav","exact"),("--dm-font-nav","exact"),("--font-nav","exact")],
 "font-caption":[("--eac-font-caption","exact"),("--dm-font-caption","exact"),("--font-caption","exact")],
 "font-reading":[("--eac-font-reading","exact"),("--dm-font-reading","exact"),("--font-reading","exact")],
 "font-record":[("--eac-font-record","exact"),("--site-font-kicker","near"),("--sf-font-record","exact"),("--eac-font-kicker","exact")],
 "text-scale":[("--eac-text-scale","exact"),("--eac-form-text-scale","exact")],
 "radius":[("--eac-radius","exact"),("--radius","exact"),("--sf-radius","exact"),("--radius-card","near")],
 "radius-control":[("--eac-radius-control","exact"),("--eac-control-radius","exact"),("--radius-input","near")],
 "radius-mark":[("--eac-radius-mark","exact"),("--eac-form-radius-mark","exact")],
 "shadow-panel":[("--eac-shadow-panel","exact"),("--sf-shadow","exact"),("--shadow","near")],
 "shadow-pop":[("--eac-shadow-pop","exact"),("--eac-form-shadow-pop","exact")],
 "gap":[("--eac-gap-3","exact")],
 "width-standard":[("--eac-width-standard","exact"),("--sf-w-standard","exact"),("--oad-width","near")],
 "measure":[("--eac-measure","exact"),("--eac-block-measure","exact")],
 "header-h":[("--eac-header-h","exact"),("--pts-header-h","exact")],
 "ease":[("--eac-ease","exact"),("--sf-morph-easing","exact")],
 "dur-base":[("--eac-dur-base","exact")],
}

def hsl_to_hex(v):
    m = re.match(r"^(\d{1,3}(?:\.\d+)?) (\d{1,3}(?:\.\d+)?)% (\d{1,3}(?:\.\d+)?)%$", v.strip())
    if not m: return None
    h, s, l = float(m[1]), float(m[2])/100, float(m[3])/100
    a = s*min(l, 1-l)
    f = lambda n: l - a*max(-1, min((n+h/30) % 12 - 3, 9-(n+h/30) % 12, 1))
    return "#%02x%02x%02x" % tuple(round(f(n)*255) for n in (0, 8, 4))

def hexish(v):
    v = v.strip()
    if re.match(r"^#[0-9a-fA-F]{6}$", v): return v.lower()
    if re.match(r"^#[0-9a-fA-F]{3}$", v): return "#"+"".join(c*2 for c in v[1:]).lower()
    m = re.match(r"^hsl\(\s*(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%\s*\)$", v)
    if m: return hsl_to_hex("%s %s%% %s%%" % m.groups())
    return hsl_to_hex(v)

t = json.load(open(os.path.join(HERE, "themes.json")))
ds = json.load(open(os.path.join(HERE, "design-system.json")))
role_by_var = {r[3]: r[0] for r in ROLES}
extra = {}  # D alias rows: from-var -> role id (card is excluded: D folded it into ground, we keep it as panel)
for a in ds["aliases"]:
    to = a["to"]
    if to in role_by_var and a["from"] != "--card":
        extra.setdefault(a["from"], role_by_var[to])

def pick(decls):
    for cond in (lambda v: not v["dark"] and v["scope"] == ":root", lambda v: not v["dark"] and not v.get("schemaOnly"), lambda v: not v.get("schemaOnly"), lambda v: True):
        for v in decls:
            if cond(v): return v

out_maps, orphans, stats = {}, {}, {}
for app, a in t["apps"].items():
    by = {}
    for v in a["vars"]: by.setdefault(v["name"], []).append(v)
    if not by: continue
    m, used = {}, set()
    for rid, label, grp, var, fmt, desc in ROLES:
        found = [(n, mt) for n, mt in C[rid] if n in by]
        for fr, ro in extra.items():
            if ro == rid and fr in by and fr not in [f[0] for f in found]: found.append((fr, "exact"))
        if not found:
            m[rid] = {"var": None, "value": None, "match": "none"}; continue
        n, mt = found[0]
        d = pick(by[n]); val = d["value"]
        e = {"var": n, "value": val, "match": mt}
        h = hexish(val) if fmt == "color" else None
        if h: e["hex"] = h
        dk = [x for x in by[n] if x["dark"]]
        if dk: e["dark"] = dk[0]["value"]
        if len(found) > 1: e["also"] = [f[0] for f in found[1:]]
        m[rid] = e; used.update(f[0] for f in found)
    out_maps[app] = m
    orphans[app] = sorted({v["name"] for v in a["vars"] if v.get("editable") and v["name"] not in used})
    stats[app] = {k: sum(1 for e in m.values() if e["match"] == k) for k in ("exact", "near", "none")}

out = {
  "generated_by": "build-theme-roles.py", "generated_from": ["themes.json", "design-system.json"],
  "colour_format": "hex",
  "format_notes": {"color": "#rrggbb (lowercase). Legacy hsl triplet 'H S% L%' converts with hslToHex/hexToHsl in direct-edit/site/style.ts; hsl(var(--x)) wrappers are emitted for legacy shadcn aliases only.",
                   "rgba": "#rrggbbaa or rgba(r, g, b, a)", "background": "#rrggbb or linear-gradient(<n>deg, #rrggbb <p>%, ...)",
                   "font": "a stack declared in the site's fonts list", "length": "0 | <n>px | <n>rem | <n>em", "number": "plain number", "shadow": "css box-shadow, no url()", "easing": "cubic-bezier(a, b, c, d) or a keyword", "duration": "<n>ms"},
  "roles": [{"id": r[0], "label": r[1], "group": r[2], "var": r[3], "format": r[4], "core": r[0] in CORE, "description": r[5]} for r in ROLES],
  "maps": out_maps, "orphans": orphans, "stats": stats,
}
json.dump(out, open(os.path.join(HERE, "theme-roles.json"), "w"), indent=1)
print(len(ROLES), "roles;", len(out_maps), "apps")
for k, v in stats.items(): print(k, v, "orphans:", len(orphans[k]))
