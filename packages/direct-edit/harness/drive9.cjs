const { chromium } = require("playwright-core");
const http = require("http"), fs = require("fs"), path = require("path");
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAEBgIApD5fRAAAAABJRU5ErkJggg==", "base64");
const srv = http.createServer((q, r) => { if (q.url.startsWith("/pic.png")) { r.writeHead(200, { "content-type": "image/png" }); r.end(PNG); return; } const f = path.join("/h", q.url.split("?")[0]); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { "content-type": f.endsWith(".css") ? "text/css" : f.endsWith(".js") ? "text/javascript" : "text/html" }); r.end(d); }); });
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else { fail++; console.log("FAIL", n, x === undefined ? "" : JSON.stringify(x)); } };
(async () => {
  await new Promise((r) => srv.listen(8123, "127.0.0.1", r));
  const b = await chromium.connectOverCDP("http://127.0.0.1:9222"); const p = b.contexts()[0].pages()[0];
  p.setDefaultTimeout(15000); await p.setViewportSize({ width: 1500, height: 950 });
  const errs = []; global.errs = errs; p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (m) => { if (m.type() === "error") errs.push(m.text().slice(0, 220)); });
  await p.goto("http://127.0.0.1:8123/tree.html"); await p.waitForSelector(".de-vpanel .de-tabs");
  const n = (id) => `[data-tree-node="${id}"]`;
  const box = (id) => p.locator(n(id)).boundingBox();
  const cen = async (id) => { const r = await box(id); return [r.x + r.width / 2, r.y + r.height / 2]; };
  const head = () => p.$eval(".de-vpanel .de-head b", (e) => e.textContent).catch(() => null);
  await p.addStyleTag({ content: '[data-tree-node="p1"], #pub img { width: 40px; height: 40px; }' });
  const doc = () => p.evaluate(() => window.ed.doc());
  const parentOf = (d, id) => { let out = null; const go = (list, par) => { for (const x of list ?? []) { if (x.props.id === id) out = par; for (const v of Object.values(x.props)) if (Array.isArray(v) && v[0]?.props) go(v, x.props.id); } }; go(d.content, "root"); return out; };
  const kids = (d, id) => { let out = []; const go = (list) => { for (const x of list ?? []) { if (x.props.id === id) out = (x.props.items ?? []).map((k) => k.props.id); for (const v of Object.values(x.props)) if (Array.isArray(v) && v[0]?.props) go(v); } }; go(d.content); return out; };
  const drag = async (from, to) => { await p.mouse.move(from[0], from[1]); await p.mouse.down(); await p.mouse.move(from[0] + 8, from[1] + 8, { steps: 2 }); await p.mouse.move(to[0], to[1], { steps: 8 }); };
  const sel = async (id, clicks) => { const [x, y] = await cen(id); for (let i = 0; i < clicks; i++) { await p.mouse.click(x, y); await p.waitForTimeout(25); } };

  // Sealed blocks and markers
  ok("marks nodes", (await p.$$("[data-tree-node]")).length === 10, (await p.$$("[data-tree-node]")).length);
  ok("box element is the slot", await p.$eval(n("A"), (e) => e.tagName === "SECTION" && e.dataset.treeSlot === "A:items"));
  ok("grid region is a slot", (await p.$$('[data-tree-slot="G:items"]')).length === 1);
  await sel("head", 1);
  ok("sealed selected by name", (await head()).length > 0 && (await p.$$(".de-layer-sheet .de-handle")).length === 0, await head());
  ok("sealed explains itself", (await p.textContent(".de-vpanel")).includes("Drag it into any box"));
  await p.screenshot({ path: "/h/shots/x-sealed.png" });
  // Click through own boxes
  await p.keyboard.press("Escape");
  await sel("w1", 1); ok("outermost first", (await head()) === "Section", await head());
  await sel("w1", 1); ok("then the words", (await head()) === "Heading", await head());
  ok("handles on own", (await p.$$(".de-layer-sheet .de-handle")).length === 5);
  await p.screenshot({ path: "/h/shots/x-words.png" });

  // THE MOVE: words from A into B, between its children
  const toB = await box("p1");
  await drag(await cen("w1"), [toB.x + 4, toB.y + toB.height / 2]);
  ok("insertion line", await p.$$eval(".de-insert", (e) => e.some((x) => !x.hidden)));
  ok("target outlined", await p.$eval(n("B"), (e) => e.classList.contains("de-dropbox")));
  await p.screenshot({ path: "/h/shots/x-move.png" });
  await p.mouse.up(); await p.waitForTimeout(40);
  let d = await doc();
  ok("moved in the document", parentOf(d, "w1") === "B", parentOf(d, "w1"));
  ok("placed before picture", kids(d, "B").join() === "w3,w1,p1", kids(d, "B"));
  ok("left the old box", kids(d, "A").join() === "w2", kids(d, "A"));
  ok("in the new box on the page", await p.$eval(n("B"), (e) => !!e.querySelector('[data-tree-node="w1"]')));
  ok("still selected", (await head()) === "Heading", await head());
  await p.click("[data-a=undo]"); await p.waitForTimeout(30);
  d = await doc(); ok("undo returns it", parentOf(d, "w1") === "A" && kids(d, "A").join() === "w1,w2", kids(d, "A"));
  await p.click("[data-a=redo]"); await p.waitForTimeout(30);
  d = await doc(); ok("redo", parentOf(d, "w1") === "B");

  // Esc cancels a move
  const eb0 = await box("E");
  await drag(await cen("w1"), [eb0.x + eb0.width / 2, eb0.y + eb0.height / 2]);
  await p.keyboard.press("Escape"); await p.mouse.up(); await p.waitForTimeout(30);
  d = await doc(); ok("esc cancels", parentOf(d, "w1") === "B");
  ok("esc kept selection", (await head()) === "Heading", await head());

  // Into an empty box
  await drag(await cen("w1"), [eb0.x + eb0.width / 2, eb0.y + eb0.height / 2]);
  await p.mouse.up(); await p.waitForTimeout(40);
  d = await doc(); ok("into empty box", parentOf(d, "w1") === "E", parentOf(d, "w1"));

  // A sealed block into a box
  await sel("head", 1);
  const ab = await box("A");
  await drag(await cen("head"), [ab.x + ab.width / 2, ab.y + 6 + 14]); await p.mouse.up(); await p.waitForTimeout(40);
  d = await doc(); ok("sealed block moved into a box", parentOf(d, "head") === "A", parentOf(d, "head"));
  // Into a block's own slot: words into the grid
  await sel("w3", 2);
  ok("w3 selected", (await head()) === "Paragraph", await head());
  const prose = await box("pr");
  await drag(await cen("w3"), [prose.x + prose.width + 30, prose.y + prose.height / 2]); await p.mouse.up(); await p.waitForTimeout(40);
  d = await doc(); ok("into a block's slot", parentOf(d, "w3") === "G", parentOf(d, "w3"));
  await p.screenshot({ path: "/h/shots/x-grid.png" });
  // Pull out to the page
  const gb = await box("G");
  await drag(await cen("w3"), [gb.x + 4, gb.y + gb.height + 8]); await p.mouse.up(); await p.waitForTimeout(40);
  d = await doc(); ok("pulled out to the page", parentOf(d, "w3") === "root", parentOf(d, "w3"));

  // Not into itself
  await p.keyboard.press("Escape");
  await sel("B", 1); ok("box selected", (await head()).length > 0);
  const before = JSON.stringify(await doc());
  const inner = await box("p1");
  await drag(await cen("p1"), [inner.x + inner.width / 2, inner.y + inner.height / 2]); await p.mouse.up(); await p.waitForTimeout(30);
  d = await doc(); ok("cannot enter itself", parentOf(d, "B") === "root");
  ok("picture press-drag ended cleanly", (await p.$$(".de-ghostbox")).length === 0 && !(await p.evaluate(() => document.body.classList.contains("de-dragging"))));

  // Group, ungroup, duplicate, delete, keyboard
  await sel("w2", 2);
  ok("w2", (await head()) === "Paragraph", await head());
  await p.keyboard.press("Control+g"); await p.waitForTimeout(40);
  d = await doc(); const groupId = parentOf(d, "w2");
  ok("grouped in a new box", groupId !== "A" && parentOf(d, groupId) === "A", groupId);
  ok("group selected", (await p.textContent(".de-vpanel .de-head b")) !== "Paragraph");
  await p.keyboard.press("Control+Shift+g"); await p.waitForTimeout(40);
  d = await doc(); ok("ungrouped", parentOf(d, "w2") === "A");
  await p.keyboard.press("Control+d"); await p.waitForTimeout(40);
  d = await doc(); const akids = kids(d, "A");
  ok("duplicated with a new id", akids.length === 3 && new Set(akids).size === 3, akids);
  await p.keyboard.press("Delete"); await p.waitForTimeout(40);
  d = await doc(); ok("delete", kids(d, "A").length === 2, kids(d, "A"));
  await p.click("[data-a=undo]"); await p.waitForTimeout(30);
  d = await doc(); ok("undo delete", kids(d, "A").length === 3);

  // Right-click tools
  await sel("w2", 1);
  const [wx, wy] = await cen("w2");
  await p.mouse.click(wx, wy, { button: "right" }); await p.waitForSelector(".de-menu");
  const labels = await p.$$eval(".de-menu > button", (e) => e.map((x) => x.querySelector("span").textContent));
  console.log("tools", labels.join(" | "));
  ok("real structure tools", ["Duplicate", "Delete", "Group in a row", "Ungroup", "Add", "Layers"].every((l) => labels.includes(l)), labels);
  await p.screenshot({ path: "/h/shots/x-menu.png" });
  await p.keyboard.press("Escape");

  // Add a box, add words, type
  await p.keyboard.press("Escape"); await p.keyboard.press("Escape"); await p.keyboard.press("Escape");
  await p.click("[data-a=add-box]"); await p.waitForTimeout(40);
  ok("box added, selected", (await head()) === "Column", await head());
  await p.click("[data-a=add-words]"); await p.waitForTimeout(60);
  ok("words open for typing", await p.evaluate(() => document.activeElement?.getAttribute("contenteditable") === "true"));
  await p.keyboard.type("Typed <b>on</b> the page"); await p.keyboard.press("Control+Enter"); await p.waitForTimeout(40);
  d = await doc(); const flat = JSON.stringify(d);
  ok("typed and stored, escaped", flat.includes("Typed &lt;b&gt;on&lt;/b&gt; the page"), flat.slice(-400));
  // Double click edits existing words
  const [ex, ey] = await cen("w2");
  await p.mouse.dblclick(ex, ey); await p.waitForTimeout(50);
  ok("double click edits", await p.evaluate(() => document.activeElement?.getAttribute("contenteditable") === "true"));
  await p.keyboard.press("Escape"); await p.waitForTimeout(30);
  ok("esc restores words", (await p.$eval(n("w2"), (e) => e.innerHTML)).includes("<b>words</b>"), await p.$eval(n("w2"), (e) => e.innerHTML));

  // Style through the panel writes the node
  await p.keyboard.press("Escape");
  await sel("A", 0);
  await p.click('.de-layers [data-layer="A"]'); await p.waitForTimeout(40);
  await p.fill('.de-vpanel [data-f="gap"]', "31"); await p.waitForTimeout(30);
  ok("look applied", (await p.$eval(n("A"), (e) => getComputedStyle(e).rowGap)) === "31px");
  d = await doc(); ok("stored as look", d.content.find((x) => x.props.id === "A").props.look.gap === 31);
  await p.selectOption('.de-vpanel [data-f="tag"]', '"article"'); await p.waitForTimeout(40);
  ok("kind changes the element", await p.$eval(n("A"), (e) => e.tagName === "ARTICLE"));
  ok("selection survives", (await head()) === "Article", await head());
  // Resize in the grid and on the page
  const hE = await p.locator(".de-layer-sheet .de-handle.s").boundingBox(); const h0 = (await box("A")).height;
  await p.mouse.move(hE.x + 4, hE.y + 2); await p.mouse.down(); await p.mouse.move(hE.x + 4, hE.y + 72, { steps: 4 }); await p.mouse.up(); await p.waitForTimeout(40);
  ok("resized", (await box("A")).height > h0 + 50, (await box("A")).height);

  // Saved document: valid for Puck, the store's sanitiser and the cleaner
  await p.click("[data-a=save]"); await p.waitForFunction(() => document.querySelector(".de-editbar-hint")?.textContent.includes("Saved"));
  const saved = await p.evaluate(() => window.saved.at(-1));
  const check = await p.evaluate((s) => window.kit.validatePage(s, new Set(Object.keys(window.kit.config.components))), saved);
  ok("validatePage ok, no warnings", check.ok && check.warnings.length === 0, check);
  ok("cleaner stable", JSON.stringify(await p.evaluate((s) => window.kit.cleanBoxDoc(s), saved)) === JSON.stringify(saved));
  const stored = await p.evaluate((s) => window.kit.cleanBoxDoc(window.kit.sanitizeRichValues(s)), saved);
  ok("store round trip keeps words", JSON.stringify(stored).includes("words"), JSON.stringify(stored).slice(0, 200));
  console.log("saved bytes", JSON.stringify(saved).length);

  // Hostile
  const bad = await p.evaluate(() => window.kit.cleanBoxDoc({ root: {}, content: [
    { type: "box", props: { id: "x", tag: "script", image: "javascript:alert(1)", look: { fill: "red;}", css: "background:url(x)", padding: 9e9 }, items: [
      { type: "words", props: { id: "y", tag: "iframe", html: "<script>alert(1)</script><img src=x onerror=1>ok" } },
      { type: "words", props: { id: "y", tag: "p", html: "dup" } },
      { type: "picture", props: { id: "z", src: "data:text/html,x", alt: 5 } },
    ] } },
  ] }));
  const badS = JSON.stringify(bad); console.log("hostile", badS.slice(0, 300));
  ok("hostile cleaned", !/script|iframe|javascript|onerror|data:|url\(/i.test(badS), badS);
  ok("duplicate id dropped", (badS.match(/"id":"y"/g) || []).length === 1);

  // PARITY: the editor's drawing against Puck's own renderer
  const shape = (scopeSel) => p.$$eval(`${scopeSel} h1,${scopeSel} h2,${scopeSel} h3,${scopeSel} p,${scopeSel} article,${scopeSel} img`, (els) => els.filter((e) => !e.closest("[data-de-ui]")).map((e) => { const r = e.getBoundingClientRect(); return [e.tagName, (e.textContent || "").slice(0, 24), Math.round(r.width), Math.round(r.height)]; }));
  await p.evaluate(() => { document.documentElement.classList.remove("de-vpanel-open", "de-editing"); });
  await p.waitForTimeout(60);
  const inEditor = await shape("#host");
  await p.evaluate((s) => { window.ed.dispose(); document.getElementById("host").style.display = "none"; window.published(s); document.getElementById("pub").style.padding = "50px 16px 80px"; }, stored);
  await p.waitForTimeout(150);
  const inPublished = await shape("#pub");
  const diff = inEditor.map((a, i) => JSON.stringify(a) === JSON.stringify(inPublished[i]) ? null : [a, inPublished[i]]).filter(Boolean);
  console.log("parity", inEditor.length, inPublished.length, JSON.stringify(diff).slice(0, 500));
  ok("published draws the same order and sizes", inEditor.length === inPublished.length && diff.length === 0);
  await p.screenshot({ path: "/h/shots/x-published.png" });

  // The old editor opens the same document
  await p.evaluate((s) => { document.getElementById("pub").remove(); window.oldEditor(s); }, stored);
  await p.waitForTimeout(1500);
  const oldCount = await p.$$eval("#old [data-puck-component]", (e) => e.length).catch(() => -1);
  console.log("old editor components", oldCount);
  ok("Puck's own editor opens it, nested", oldCount >= 8, oldCount);
  const oldLook = await p.$$eval("#old *", (els) => els.some((e) => getComputedStyle(e).backgroundColor === "rgb(221, 238, 255)"));
  ok("Puck's own editor shows a box's look", oldLook);
  await p.screenshot({ path: "/h/shots/x-old.png" });

  const real = errs.filter((e) => !/favicon|404|Failed to load resource/.test(e));
  console.log("console", JSON.stringify([...new Set(real)].slice(0, 5)));
  ok("no errors", real.length === 0, real.slice(0, 3));
  console.log(`pass ${pass} fail ${fail}`); srv.close(); await b.close(); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("ERR", e.message.slice(0, 500), JSON.stringify((global.errs||[]).slice(0,4))); console.error("ERR line", (e.stack||"").split("\n").find((l)=>l.includes("drive9"))); process.exit(2); });
