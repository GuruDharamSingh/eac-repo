// Writes sunjay-banner.css: the rules of sunjay's served Tailwind chunk that pt-banner's classes use, so the test page
// draws that block with its real cascade (layered utilities) and no site preflight over the other blocks.
//   curl -sk --resolve paratheater.arts-collective.com:30022:127.0.0.1 https://paratheater.arts-collective.com:30022/<chunk>.css -o c6.css
//   node sunjay-extract.cjs c6.css > sunjay-banner.css
const fs = require("fs");
const css = fs.readFileSync(process.argv[2], "utf8");
const CLASSES = String.raw`relative isolate flex items-center overflow-hidden border-b border-border absolute inset-0 -z-10 h-full w-full object-cover bg-header-footer
mx-auto max-w-5xl px-5 py-12 py-20 py-28 sm\:py-16 sm\:py-28 sm\:py-40 text-left text-center font-serif text-4xl font-semibold tracking-tight sm\:text-5xl
mt-3 text-lg italic mt-6 max-w-2xl leading-relaxed mt-8 inline-block border py-2\.5 text-sm font-medium transition-opacity hover\:opacity-80`.split(/\s+/).map((c) => `.${c}`);
const wanted = new Set(CLASSES);
const isWanted = (selector) => selector.split(",").some((s) => { const t = s.trim(); return wanted.has(t) || wanted.has(t.replace(/:hover$/, "")); });

// The stylesheet as a tree: [{ prelude, body }] where body is a string (declarations) or a list (nested rules).
function parse(text) {
  const out = []; let i = 0;
  while (i < text.length) {
    let j = i, quote = "";
    while (j < text.length && (quote || (text[j] !== "{" && text[j] !== ";"))) { if (quote) { if (text[j] === quote) quote = ""; } else if (text[j] === '"' || text[j] === "'") quote = text[j]; j++; }
    if (j >= text.length) break;
    if (text[j] === ";") { i = j + 1; continue; }
    const prelude = text.slice(i, j).trim();
    let depth = 1, k = j + 1; quote = "";
    while (k < text.length && depth) { const c = text[k]; if (quote) { if (c === quote) quote = ""; } else if (c === '"' || c === "'") quote = c; else if (c === "{") depth++; else if (c === "}") depth--; k++; }
    const inner = text.slice(j + 1, k - 1);
    out.push({ prelude, body: prelude.startsWith("@") ? parse(inner) : inner });
    i = k;
  }
  return out;
}
const write = (nodes) => nodes.map((n) => `${n.prelude}{${Array.isArray(n.body) ? write(n.body) : n.body}}`).join("\n");
function keep(nodes) {
  const out = [];
  for (const n of nodes) {
    if (Array.isArray(n.body)) { if (!n.prelude.startsWith("@keyframes")) { const k = keep(n.body); if (k.length) out.push({ ...n, body: k }); } }
    else if (isWanted(n.prelude)) {
      // Only the wanted selectors of a shared list.
      const sel = n.prelude.split(",").filter((s) => wanted.has(s.trim()) || wanted.has(s.trim().replace(/:hover$/, ""))).join(",");
      out.push({ prelude: sel, body: n.body });
    }
  }
  return out;
}
const tree = parse(css);
const layer = tree.filter((n) => /^@layer (components|utilities)$/.test(n.prelude) || !n.prelude.startsWith("@"));
const kept = keep(layer);
console.log(`/* Extract of sunjay's served CSS (2026-11-04), written by sunjay-extract.cjs: what pt-banner's classes use, in their
   real layers. The variables and the preflight are scoped to the banner's section, so the test page's other blocks keep
   their own look. --font-fraunces comes from next/font on the real site; a system serif stands in, with no network. */
@layer base,components,utilities;
section.isolate{--spacing:.25rem;--container-2xl:42rem;--container-5xl:64rem;--text-sm:.875rem;--text-sm--line-height:calc(1.25/.875);--text-lg:1.125rem;--text-lg--line-height:calc(1.75/1.125);--text-4xl:2.25rem;--text-4xl--line-height:calc(2.5/2.25);--text-5xl:3rem;--text-5xl--line-height:1;--font-weight-medium:500;--font-weight-semibold:600;--tracking-tight:-.025em;--leading-relaxed:1.625;--default-transition-duration:.15s;--default-transition-timing-function:cubic-bezier(.4,0,.2,1);--border:203 7% 23%;--font-fraunces:Georgia,"Times New Roman",serif}
section.isolate,section.isolate *{--tw-border-style:solid}
@layer base{section.isolate,section.isolate *,section.isolate :after,section.isolate :before{box-sizing:border-box;border:0 solid;margin:0;padding:0}section.isolate h1{font-size:inherit;font-weight:inherit}section.isolate a{color:inherit;text-decoration:inherit}section.isolate img{display:block;max-width:100%}}`);
console.log(write(kept));
