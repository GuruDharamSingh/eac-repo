#!/usr/bin/env python3
"""Scopes each previewed site's stylesheets under [data-mock-app="theme-<app>"] for the /themes view.
Run on eris: python3 apps/development/scripts/scope-site-css.py  (reads apps/<app>/src, writes src/data/site-css.json).
Rules: :root/html/body selectors become the wrapper itself; Tailwind @theme blocks become variables on the wrapper;
@layer blocks are unwrapped; @media min/max-width become @container tp queries (the preview frame is the container, so the
phone/desktop toggle just changes its width); @import/@plugin/@source/@font-face/@property and dark-mode rules are dropped;
position:fixed becomes absolute; 100vh becomes a fixed height. The list of files per site is SITES in src/data/site-pages.json."""
import json, os, re
ROOT = os.path.expanduser("~/eac")
DEV = ROOT + "/apps/development"

def strip_comments(s): return re.sub(r"/\*.*?\*/", "", s, flags=re.S)

def split_blocks(s):
    i, n, out = 0, len(s), []
    while i < n:
        j = i
        while j < n and s[j] not in "{;":
            if s[j] in "\"'":
                q = s[j]; j += 1
                while j < n and s[j] != q:
                    j += 2 if s[j] == "\\" else 1
            j += 1
        if j >= n: break
        if s[j] == ";":
            out.append((s[i:j].strip(), None)); i = j + 1; continue
        depth, k = 1, j + 1
        while k < n and depth:
            if s[k] == "{": depth += 1
            elif s[k] == "}": depth -= 1
            k += 1
        out.append((s[i:j].strip(), s[j + 1:k - 1])); i = k
    return out

def split_sel(sel):
    parts, depth, cur = [], 0, ""
    for ch in sel:
        if ch in "([": depth += 1
        if ch in ")]": depth -= 1
        if ch == "," and depth == 0: parts.append(cur); cur = ""
        else: cur += ch
    parts.append(cur)
    return [p.strip() for p in parts if p.strip()]

def fix_body(body):
    body = re.sub(r"position\s*:\s*fixed", "position: absolute", body)
    body = re.sub(r"(\d+)(?:d|s|l)?vh", lambda m: str(round(int(m.group(1)) * 6.4)) + "px", body)
    return body

def run_site(app, files):
    WR = '[data-mock-app="theme-%s"]' % app
    def scope_sel(sel):
        if re.search(r"(^|[\s.:])\.?dark\b", sel) or "data-theme" in sel or ":has(" in sel and re.match(r"^(html|body)", sel): return None
        if re.match(r"^(html|body|:root)\b", sel):
            t = re.sub(r"^(html|body|:root)(\s*[>+~]?\s*)?", "", sel, count=1)
            t = re.sub(r"^(body)\b", "", t).strip()
            out = WR + (" " + t if t else "")
        else:
            out = WR + " " + sel
        return out if out.count("(") == out.count(")") else None
    def process(s):
        out = []
        for pre, body in split_blocks(s):
            if body is None: continue
            if pre.startswith("@theme") or (pre.startswith("@plugin") and "daisyui/theme" in pre):
                out.append(WR + " {" + body + "}\n")
            elif pre.startswith("@layer"):
                out.append(process(body))
            elif pre.startswith("@media"):
                if "prefers-color-scheme: dark" in pre or "print" in pre: continue
                inner = process(body)
                if not inner.strip(): continue
                if re.search(r"(min|max)-width", pre):
                    q = re.sub(r"^@media\s*", "", pre)
                    q = re.sub(r"\s*and\s*\(\s*(hover|pointer)[^)]*\)", "", q)
                    out.append("@container tp " + q + " {\n" + inner + "}\n")
                else:
                    out.append(pre + " {\n" + inner + "}\n")
            elif pre.startswith("@supports"):
                inner = process(body)
                if inner.strip(): out.append(pre + " {\n" + inner + "}\n")
            elif pre.startswith("@keyframes"):
                out.append(pre.replace("@keyframes ", "@keyframes tp-%s-" % app) + " {" + body + "}\n")
            elif pre.startswith("@"):
                continue
            else:
                sels = [x for x in (scope_sel(p) for p in split_sel(pre)) if x]
                if sels: out.append(",\n".join(sels) + " {" + fix_body(body) + "}\n")
        return "".join(out)
    css = ""
    for f in files:
        p = ROOT + "/" + f
        if not os.path.exists(p): print("missing", p); continue
        t = strip_comments(open(p, encoding="utf-8").read())
        t = re.sub(r"@import[^;]*;", "", t)
        css += "/* " + f + " */\n" + process(t)
    # keyframes names were prefixed: point animation declarations at them is skipped (animations are cosmetic here)
    return css

sites = json.load(open(DEV + "/src/data/site-pages.json"))["sites"]
out = {}
for app, s in sites.items():
    out[app] = run_site(app, s.get("css", []))
    print(app, len(out[app]))
json.dump(out, open(DEV + "/src/data/site-css.json", "w"))
