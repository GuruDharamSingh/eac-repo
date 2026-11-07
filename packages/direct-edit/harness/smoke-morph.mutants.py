#!/usr/bin/env python3
# Do smoke-morph's checks catch a removed fix? One fix at a time: a scratch copy of its file with the fix taken out is
# mounted over the read-only tree, smoke-morph is bundled against it, and the groups that should notice run in isolated
# Chromium. Every mutant must fail at least one check; a NOAPPLY means the source moved and the list needs updating.
#   sg docker -c "S=<scratch holding h3/> python3 smoke-morph.mutants.py [index ...]"
# Writes only in the scratch folder, and leaves smoke-morph.js there bundled from the real tree. 2026-11-04, stone 2.
import os, subprocess, sys
S = os.environ["S"]; R = "/mnt/pool1/home/guru/eac"; M = f"{S}/mut"; os.makedirs(M, exist_ok=True)
BUNDLE = """set -e
ES=$(ls -d /app/node_modules/.pnpm/esbuild@0.25.10/node_modules/esbuild/bin/esbuild)
cd /app/apps/arts-collective
cp /app/packages/blocks/src/blocks.css /w/h3/blocks.css
NODE_PATH=/app/packages/page-builder/node_modules:/app/apps/innergathering/node_modules $ES /w/h3/smoke-morph.ts --bundle --format=iife --jsx=automatic --outfile=/w/h3/smoke-morph.js --log-level=error --define:process.env.NODE_ENV=\\"development\\" --external:node:*
"""
RUN = """N=mutant-$$; docker run -d --name $N --network none --shm-size=512m --entrypoint chromium-browser zenika/alpine-chrome --headless --no-sandbox --disable-gpu --disable-dev-shm-usage --remote-debugging-address=127.0.0.1 --remote-debugging-port=9222 --remote-allow-origins='*' about:blank >/dev/null; sleep 3
docker run --rm -u 3003 --network container:$N -e ONLY="$ONLY" -v "$S/h3:/h" -w /h node:24-alpine timeout 170 node smoke-morph.cjs 2>&1
docker rm -f $N >/dev/null
"""
def bundle(*mounts):
    return subprocess.run(["docker", "run", "--rm", "-u", "3003", "--network", "none", "-v", f"{R}:/app:ro", *mounts, "-v", f"{S}:/w", "--entrypoint", "sh", "eac-dev", "-c", BUNDLE], capture_output=True, text=True)
DE = "packages/direct-edit/src"
MUTANTS = [
  ("R-a removed", f"{DE}/block/style.ts", [("""    if (value.length > MAX_CSS_VALUE || /\\/\\*|\\*\\/|!/.test(value) || !balancedCss(value)) continue;\n""", ""), ("out.push([prop, value]);", "out.push([prop, value.slice(0, 160)]);")], "repair"),
  ("cleanBoxDoc leaves morph alone", f"{DE}/block/puck-tree.ts", [("""          if (morph) raw.props.morph = morph; else delete raw.props.morph;\n""", "")], "clean"),
  ("TreeCanvas looks a component up by any key", f"{DE}/puck/TreeCanvas.tsx", [("hasOwn(ctx.config.components, node.type) ? ctx.config.components[node.type] : undefined", "ctx.config.components[node.type]")], "stored"),
  ("slotRulesOf looks up by any key", f"{DE}/block/puck-tree.ts", [("(hasOwn(slots, type) ? slots[type] ?? [] : [])", "(slots[type] ?? [])")], "stored"),
  ("resolved looked up by any key", f"{DE}/puck/TreeCanvas.tsx", [("hasOwn(ctx.resolved, id) ? ctx.resolved[id] : undefined", "ctx.resolved[id]")], "stored"),
  ("font link after the block", f"{DE}/puck/morph-mark.tsx", [("""    c.fonts.map((f) => {
      const href = googleFontsHref([f]);
      return href ? createElement("link", { key: f, rel: "stylesheet", href }) : null;
    }),
    createElement("style", { href: `m-${c.scope}`, precedence: "eac-morph" }, c.css),
    createElement("template", { "data-morph": c.scope }),
    children);""", """    createElement("style", { href: `m-${c.scope}`, precedence: "eac-morph" }, c.css),
    createElement("template", { "data-morph": c.scope }),
    children,
    c.fonts.map((f) => {
      const href = googleFontsHref([f]);
      return href ? createElement("link", { key: f, rel: "stylesheet", href }) : null;
    }));""")], "spacing"),
  ("font link with a precedence", f"{DE}/puck/morph-mark.tsx", [('createElement("link", { key: f, rel: "stylesheet", href })', 'createElement("link", { key: f, rel: "stylesheet", href, precedence: "eac-font" })')], "fonts"),
  ("editor loads no fonts", f"{DE}/puck/morph-mark.tsx", [("    if (c) loadFonts(c.fonts);\n", "")], "fonts"),
  ("editor draws a bare block with no look", f"{DE}/puck/morph-mark.tsx", [("  if (editing) {\n", "  if (editing && !c) return children;\n  if (editing) {\n")], "editorShape"),
  ("the mark may land on the marker", f"{DE}/puck/TreeCanvas.tsx", [('const NOT_A_BOX = new Set(["STYLE", "SCRIPT", "LINK", "TEMPLATE"]);', 'const NOT_A_BOX = new Set(["STYLE", "SCRIPT", "LINK"]);')], "editorShape,parts"),
  ("no !important", f"{DE}/block/morph.ts", [("`${k}:${v} !important`", "`${k}:${v}`")], "cascade-plain"),
  ("hidden is display none in the editor", f"{DE}/block/morph.ts", [("lookDecls(look, !!o.editor)", "lookDecls(look, false)")], "editorShape"),
  ("a bracket after a minus is refused", f"{DE}/block/morph.ts", [(""" && name !== "-" """, " ")], "ordinary"),
  ("a stored name read by any key", f"{DE}/block/morph.ts", [("parts && hasOwn(parts, part) ? parts[part]! : {}", "(parts as any)?.[part] ?? {}")], "clean"),
  ("no byte cap", f"{DE}/block/morph.ts", [("return JSON.stringify(out).length > MAX_BYTES ? null : out;", "return out;")], "clean,hostile"),
  ("no value filter on css", f"{DE}/block/morph.ts", [("""const kept = safeDecls(s.css).filter(([k, v]) => !REFUSED_PROPS.has(k) && !k.startsWith("--") && sheetSafe(v));""", "const kept = safeDecls(s.css);")], "hostile"),
  ("no derived tokens", f"{DE}/block/morph.ts", [("for (const [derived, formula] of DERIVED[name] ?? [])", "for (const [derived, formula] of [] as [string, string][])")], "clean,cascade-plain"),
  ("an empty morph is left in place", f"{DE}/block/morph.ts", [("if (m.parts || m.tokens) props.morph = m; else delete props.morph;", "props.morph = m;")], "clean"),
  ("morph reaches the block", "packages/page-builder/src/config.tsx", [("const drawn = createElement(inner as ComponentType<never>, rest as never);\n          if (!MorphMark)", "const drawn = createElement(inner as ComponentType<never>, props as never);\n          if (!MorphMark)")], "adapter"),
  ("morph not a reserved name", "packages/blocks/src/registry.ts", [('"children", "morph"]', '"children"]')], "clean"),
  ("hero title part loses its class", "packages/blocks/src/blocks/hero-banner.tsx", [('sel: ".blk-hero-title"', 'sel: ".blk-hero-titel"')], "parts"),
  ("pt-banner body selects every paragraph", "apps/sunjay/src/blocks/layout-blocks.tsx", [('sel: "p.leading-relaxed"', 'sel: "p"')], "parts"),
]
only = sys.argv[1:]
survivors = 0
for i, (name, path, subs, groups) in enumerate(MUTANTS):
    if only and str(i) not in only: continue
    text = open(f"{R}/{path}").read()
    for a, b in subs:
        if a not in text: print(f"NOAPPLY {name}: {a[:60]!r}"); survivors += 1; text = None; break
        text = text.replace(a, b, 1)
    if text is None: continue
    mf = f"{M}/m{i}{os.path.splitext(path)[1]}"; open(mf, "w").write(text)
    b = bundle("-v", f"{mf}:/app/{path}:ro")
    if b.returncode: print(f"BUNDLE FAILED {name}: {b.stderr[-300:]}"); survivors += 1; continue
    env = dict(os.environ, ONLY=groups, S=S)
    r = subprocess.run(["bash", "-c", RUN], capture_output=True, text=True, env=env)
    lines = r.stdout.strip().splitlines()
    tail = lines[-1] if lines else ""
    fails = [l for l in lines if l.startswith("FAIL")]
    caught = "fail 0" not in tail
    if not caught: survivors += 1
    print(f"{'caught  ' if caught else 'SURVIVED'} [{groups}] {name}: {tail}; first: {(fails[0] if fails else '')[:150]}", flush=True)
bundle()
print(f"survivors {survivors}")
