const { chromium } = require("playwright-core"); const http = require("http"), fs = require("fs"), path = require("path");
const marked = fs.readFileSync("/h/home/marked.html", "utf8").replace(/<script\b[\s\S]*?<\/script>/g, "");
const snapAt = marked.indexOf('<div class="pts-snap">');
const after = marked.indexOf("</main>", snapAt) > 0 ? marked.indexOf("</main>", snapAt) : -1;
const withTree = (inner) => { const doc = marked; const open = doc.indexOf('<div class="pts-snap">') + '<div class="pts-snap">'.length; let depth = 1, i = open; const re = /<(\/?)div\b[^>]*>/g; re.lastIndex = open; let m; while ((m = re.exec(doc))) { depth += m[1] ? -1 : /\/>$/.test(m[0]) ? 0 : 1; if (!depth) { i = m.index; break; } } return doc.slice(0, open) + inner + doc.slice(i); };
const pages = { "/": marked, "/plain": withTree(fs.readFileSync("/h/home/tree-plain.html", "utf8")), "/morph": withTree(fs.readFileSync("/h/home/tree-morph.html", "utf8")) };
const types = { css: "text/css", jpg: "image/jpeg", png: "image/png" };
const file = (u) => (u === "/site.css" ? "/h/home/site.css" : u === "/editor.css" ? "/h/editor.css" : u.startsWith("/api/media/") ? "/h/home/media/" + path.basename(decodeURIComponent(u)) : null);
const srv = http.createServer((q, r) => { const u = q.url.split("?")[0], f = file(u); if (f && fs.existsSync(f)) { r.writeHead(200, { "content-type": types[f.split(".").pop()] || "application/octet-stream" }); r.end(fs.readFileSync(f)); return; } r.writeHead(pages[u] ? 200 : 404, { "content-type": "text/html" }); r.end(pages[u] || ""); });
(async () => {
  await new Promise((r) => srv.listen(8123, "127.0.0.1", r));
  const b = await chromium.connectOverCDP("http://127.0.0.1:9222"); const p = b.contexts()[0].pages()[0]; p.setDefaultTimeout(9000);
  const read = async (u) => { await p.goto("http://127.0.0.1:8123" + u); await p.addStyleTag({ content: "html { scroll-behavior: auto !important; scroll-snap-type: none !important; } .pts-panel--line > .pts-wrap { animation: none !important; }" }); await p.waitForTimeout(500);
    return p.evaluate(() => { const out = { rects: [], words: document.querySelector(".pts-snap").innerText.replace(/\s+/g, " ").trim(), direct: [...document.querySelector(".pts-snap").children].map((e) => e.tagName + "." + e.className.split(" ")[0]) };
      document.querySelectorAll(".pts-snap *").forEach((e) => { if (e.closest("svg") && e.tagName !== "svg") return; if (["TEMPLATE", "STYLE"].includes(e.tagName)) return; const r = e.getBoundingClientRect(); out.rects.push([e.tagName.toLowerCase() + (e.className && typeof e.className === "string" ? "." + e.className.split(" ")[0] : ""), Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)].join(" ")); }); return out; }); };
  for (const [w, h] of [[1440, 900], [390, 844]]) {
    await p.setViewportSize({ width: w, height: h });
    const a = await read("/"); await p.screenshot({ path: `/h/shots/c-${w}-code.png`, fullPage: true });
    const c = await read("/plain"); await p.screenshot({ path: `/h/shots/c-${w}-tree.png`, fullPage: true });
    const m = await read("/morph"); await p.screenshot({ path: `/h/shots/c-${w}-morph.png`, fullPage: true });
    console.log(`== ${w}px  elements: code ${a.rects.length}, tree ${c.rects.length}`);
    console.log("words equal:", a.words === c.words, "| direct children equal:", a.direct.join() === c.direct.join());
    const set = new Set(c.rects), miss = a.rects.filter((x) => !set.has(x)), set2 = new Set(a.rects), extra = c.rects.filter((x) => !set2.has(x));
    console.log("boxes only in code:", miss.length, miss.slice(0, 12)); console.log("boxes only in tree:", extra.length, extra.slice(0, 12));
    const ga = (await (async () => a.rects)()); 
    const sa = await (async () => { await p.goto("http://127.0.0.1:8123/morph"); await p.waitForTimeout(300); return p.$$eval("template[data-morph]", (l) => l.length); })();
    console.log("morph marks on the morph page:", sa, "| style tags:", await p.$$eval(".pts-snap style", (l) => l.length));
  }
  await b.close(); srv.close(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
