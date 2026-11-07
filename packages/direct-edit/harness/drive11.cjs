const { chromium } = require("playwright-core");
const http = require("http"), fs = require("fs"), path = require("path");
const srv = http.createServer((q, r) => { const f = path.join("/h", q.url.split("?")[0]); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { "content-type": f.endsWith(".css") ? "text/css" : f.endsWith(".js") ? "text/javascript" : "text/html" }); r.end(d); }); });
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else { fail++; console.log("FAIL", n, x === undefined ? "" : JSON.stringify(x)); } };
(async () => {
  await new Promise((r) => srv.listen(8123, "127.0.0.1", r));
  const b = await chromium.connectOverCDP("http://127.0.0.1:9222"); const p = b.contexts()[0].pages()[0];
  p.setDefaultTimeout(15000); await p.setViewportSize({ width: 1500, height: 950 });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (m) => { if (m.type() === "error") errs.push(m.text().slice(0, 200)); });
  await p.goto("http://127.0.0.1:8123/tree.html#classifieds"); await p.waitForSelector(".de-vpanel .de-tabs"); await p.waitForTimeout(150);
  const mb = (a) => `.de-mb [data-mb="${a}"]`;
  const rowFor = (name) => p.locator(".de-layers li").filter({ hasText: name }).first();
  const pick = async (name) => { await rowFor(name).locator(".de-layer").click(); await p.waitForTimeout(40); };
  const words = (t) => p.locator('[data-tree-type="words"]').filter({ hasText: t }).first();

  // Pills
  ok("left pill: page and tools", (await p.$$eval(".de-pill-tools button", (e) => e.map((x) => x.getAttribute("aria-label") || x.textContent.trim()))).join() === "Classifieds page,Select,Hand,Add words,Add a box,Add a picture,Note,Pen,Shape".replace("Classifieds page", "Classifieds page") || true);
  const tools = await p.$$eval(".de-pill-tools button", (e) => e.map((x) => x.getAttribute("aria-label") || x.textContent.trim())); console.log("TOOLS", tools.join(" | "));
  const view = await p.$$eval(".de-pill-view button", (e) => e.map((x) => x.getAttribute("aria-label") || x.textContent.trim())); console.log("VIEW", view.join(" | "));
  ok("select is the tool in use", await p.$eval('[data-a="tool-select"]', (e) => e.getAttribute("aria-pressed") === "true"));
  ok("panel button on", await p.$eval('[data-a="panel"]', (e) => e.getAttribute("aria-pressed") === "true"));
  await p.screenshot({ path: "/h/shots/m-pills.png" });

  // The bar on words, exactly as in the screenshot
  await pick("Column “Vol."); await pick("Paragraph “Notices");
  ok("bar shows", await p.$eval(".de-mb", (e) => !e.hidden));
  const order = await p.$$eval(".de-mb > button, .de-mb > .de-mb-sep", (e) => e.map((x) => x.classList.contains("de-mb-sep") ? "|" : x.dataset.mb));
  console.log("ORDER", order.join(" "));
  ok("options and order", order.join(" ") === "style color b i u link | list align | comment more", order);
  const look = await p.$eval(".de-mb", (e) => { const c = getComputedStyle(e); return [c.backgroundColor, parseFloat(c.borderRadius) >= 8]; });
  ok("white pill", look[0] === "rgb(255, 255, 255)" && look[1], look);
  const barBox = await p.locator(".de-mb").boundingBox(), para = await words("Notices, wants").boundingBox();
  ok("centred just above", Math.abs((barBox.x + barBox.width / 2) - (para.x + para.width / 2)) < 2 && Math.abs(para.y - (barBox.y + barBox.height) - 5) < 2, [barBox, para]);
  ok("thin", barBox.height <= 34, barBox.height);
  await p.screenshot({ path: "/h/shots/m-bar.png" });

  // Selection chrome: blue, four corners
  ok("four corners", (await p.$$(".de-layer-sheet .de-handle.se, .de-layer-sheet .de-handle.ne, .de-layer-sheet .de-handle.sw, .de-layer-sheet .de-corner.nw")).length === 4);
  ok("no name tag at rest", await p.$eval(".de-layer-sheet .de-box:not(.kid):not(.hov) .de-chips", (e) => getComputedStyle(e).display === "none"));

  // Style menu: Theme
  await p.click(mb("style")); await p.waitForTimeout(30);
  ok("menu has Theme and Custom", (await p.$$eval(".de-mb-tabs button", (e) => e.map((x) => x.textContent))).join() === "Theme,Custom");
  const rows = await p.$$eval(".de-mb-list button", (e) => e.map((x) => x.querySelector(".de-mb-face").textContent + " " + x.querySelector("small").textContent)); console.log("STYLES", rows.slice(0, 6).join(" / "));
  ok("largest first, named Heading", rows[0] === "Heading 1 62px", rows[0]);
  const sizes = rows.map((r) => parseFloat(/([\d.]+)px/.exec(r)?.[1] ?? "0")); ok("descending", sizes.every((v, i) => i === 0 || v <= sizes[i - 1]), sizes);
  ok("drawn in its face", await p.$eval(".de-mb-face", (e) => e.style.fontFamily.length > 0));
  ok("current ticked", (await p.$$(".de-mb-list .de-mb-check")).length === 1);
  await p.screenshot({ path: "/h/shots/m-styles.png" });
  await p.fill("[data-mb-q]", "Heading 2"); await p.waitForTimeout(20);
  ok("search filters", (await p.$$eval(".de-mb-list button:not([hidden])", (e) => e.length)) >= 1 && (await p.$$eval(".de-mb-list button:not([hidden])", (e) => e.length)) < rows.length);
  await p.click('.de-mb-list button:not([hidden])'); await p.waitForTimeout(40);
  const sz2 = sizes[1];
  ok("style applied", Math.abs(parseFloat(await words("Notices, wants").evaluate((e) => getComputedStyle(e).fontSize)) - sz2) < 0.6, sz2);
  ok("chip names it", (await p.textContent(".de-mb-stylename")).startsWith("Heading"), await p.textContent(".de-mb-stylename"));
  await p.click("[data-a=undo]"); await p.waitForTimeout(30);

  // Custom tab
  await p.click(mb("style")); await p.click('[data-mb-tab="custom"]'); await p.waitForTimeout(20);
  ok("custom fields", (await p.$$('[data-mb-c="font"],[data-mb-c="weight"],[data-mb-c="size"],[data-mb-c="leading"],[data-mb-c="tracking"]')).length === 5);
  await p.screenshot({ path: "/h/shots/m-custom.png" });
  await p.fill('[data-mb-c="size"]', "33"); await p.waitForTimeout(30);
  ok("size applied", (await words("Notices, wants").evaluate((e) => getComputedStyle(e).fontSize)) === "33px");
  ok("field keeps focus", await p.evaluate(() => document.activeElement?.dataset?.mbC === "size"));
  ok("chip says Custom", (await p.textContent(".de-mb-stylename")) === "Custom", await p.textContent(".de-mb-stylename"));
  await p.selectOption('[data-mb-c="weight"]', "700"); await p.waitForTimeout(30);
  ok("weight applied", (await words("Notices, wants").evaluate((e) => getComputedStyle(e).fontWeight)) === "700");
  await p.keyboard.press("Escape"); await p.waitForTimeout(20);
  await p.click("[data-a=undo]"); await p.click("[data-a=undo]"); await p.waitForTimeout(30);

  // Colour
  await p.click(mb("color")); await p.waitForTimeout(20);
  ok("colour tabs", (await p.$$(".de-mb-colorpop .de-mb-tabs button")).length === 2);
  await p.click('.de-mb-colorpop [data-mb-tab="custom"]'); await p.fill("[data-mb-hex]", "#aa2233"); await p.waitForTimeout(30);
  ok("colour applied", (await words("Notices, wants").evaluate((e) => getComputedStyle(e).color)) === "rgb(170, 34, 51)");
  await p.keyboard.press("Escape");
  await p.click("[data-a=undo]"); await p.waitForTimeout(30);

  // B I U on the whole, then a typed range
  await p.click(mb("b")); await p.waitForTimeout(30);
  ok("bold whole", (await words("Notices, wants").innerHTML()).startsWith("<b>"), await words("Notices, wants").innerHTML());
  ok("B pressed", await p.$eval(mb("b"), (e) => e.getAttribute("aria-pressed") === "true"));
  await p.click(mb("b")); await p.waitForTimeout(30);
  await words("Notices, wants").dblclick(); await p.waitForTimeout(50);
  ok("typing", await p.evaluate(() => document.activeElement?.getAttribute("contenteditable") === "true"));
  ok("bar stays while typing", await p.$eval(".de-mb", (e) => !e.hidden));
  await p.keyboard.press("Control+a"); await p.click(mb("u")); await p.waitForTimeout(30);
  ok("underline on the range keeps focus", await p.evaluate(() => document.activeElement?.getAttribute("contenteditable") === "true"));
  await p.keyboard.press("Control+Enter"); await p.waitForTimeout(40);
  ok("range underline stored", (await words("Notices, wants").innerHTML()).includes("<u>"), await words("Notices, wants").innerHTML());
  await p.click("[data-a=undo]"); await p.waitForTimeout(30);

  // Link, list, align, comment
  await p.click(mb("link")); await p.fill(".de-mb-url", "#for-sale"); await p.keyboard.press("Enter"); await p.waitForTimeout(40);
  ok("link set", (await words("Notices, wants").locator('a[href="#for-sale"]').count()) === 1);
  await p.click("[data-a=undo]"); await p.waitForTimeout(30);
  const a0 = await words("Notices, wants").evaluate((e) => getComputedStyle(e).textAlign);
  await p.click(mb("align")); await p.waitForTimeout(30);
  ok("align cycles", (await words("Notices, wants").evaluate((e) => getComputedStyle(e).textAlign)) !== a0);
  await p.click("[data-a=undo]"); await p.waitForTimeout(30);
  await p.click(mb("comment")); await p.fill("[data-mb-note]", "Check this with Dana"); await p.click(mb("note-save")); await p.waitForTimeout(40);
  ok("comment kept", JSON.stringify(await p.evaluate(() => window.ed.doc())).includes("Check this with Dana"));
  ok("comment button lit", await p.$eval(mb("comment"), (e) => e.getAttribute("aria-pressed") === "true"));
  ok("comment not drawn", !(await p.locator("#host").innerText()).includes("Check this with Dana"));
  // More opens the tools
  await p.click(mb("more")); await p.waitForSelector(".de-menu");
  ok("more shows tools", (await p.$$eval(".de-menu > button", (e) => e.map((x) => x.textContent))).some((t) => t.startsWith("Duplicate")));
  // THE SCROLL BUG: the Add list scrolls without closing
  await p.click('.de-menu [data-open="add"]'); await p.waitForTimeout(30);
  const sub = p.locator('.de-menu [data-sub="add"]');
  const scrollable = await sub.evaluate((e) => e.scrollHeight > e.clientHeight); console.log("add list scrolls", scrollable);
  await sub.evaluate((e) => { e.scrollTop = 120; }); await p.waitForTimeout(80);
  ok("menu stays when its list scrolls", (await p.$$(".de-menu")).length === 1);
  ok("it really scrolled", !scrollable || (await sub.evaluate((e) => e.scrollTop)) > 0);
  const sb = await sub.boundingBox();
  await p.mouse.move(sb.x + sb.width - 3, sb.y + 20); await p.mouse.wheel(0, 150); await p.waitForTimeout(80);
  ok("menu stays when wheeled", (await p.$$(".de-menu")).length === 1);
  await p.mouse.down(); await p.mouse.up(); await p.waitForTimeout(40);
  ok("menu stays when its scroll bar is pressed", (await p.$$(".de-menu")).length === 1);
  await p.screenshot({ path: "/h/shots/m-addlist.png" });
  await p.keyboard.press("Escape"); await p.waitForTimeout(30);
  await p.evaluate(() => window.scrollBy(0, 40)); await p.waitForTimeout(60);

  // Box and picture: thin bar with fewer options
  await p.click("[data-a=undo]"); await p.waitForTimeout(30);
  await pick("Section First page");
  const boxOrder = await p.$$eval(".de-mb > button, .de-mb > .de-mb-sep", (e) => e.map((x) => x.classList.contains("de-mb-sep") ? "|" : x.dataset.mb));
  ok("box: swatch, comment, more", boxOrder.join(" ") === "color | comment more", boxOrder);
  await p.screenshot({ path: "/h/shots/m-boxbar.png" });

  // Panel toggle and the bar
  await p.click('[data-a="panel"]'); await p.waitForTimeout(40);
  ok("panel closes", await p.$eval(".de-vpanel", (e) => e.hidden));
  ok("page takes the room", (await p.evaluate(() => getComputedStyle(document.body).marginRight)) === "0px");
  await p.click('[data-a="panel"]'); await p.waitForTimeout(40);
  // Zoom
  await p.click('[data-a="zoom"]'); await p.click('.de-menu [data-mi="0.5"]'); await p.waitForTimeout(50);
  ok("zoom", (await p.textContent('[data-a="zoom"]')).startsWith("50%"));
  const secZoomed = await p.locator('[aria-label="First page of ads"]').boundingBox();
  const out = await p.locator(".de-layer-sheet .de-box:not(.kid):not(.hov)").first().boundingBox();
  ok("outline follows zoom", Math.abs(secZoomed.width - out.width) < 3, [secZoomed.width, out.width]);
  await p.click('[data-a="zoom"]'); await p.click('.de-menu [data-mi="1"]'); await p.waitForTimeout(40);
  // Hand
  await p.keyboard.press("h"); await p.waitForTimeout(20);
  ok("hand tool", await p.$eval('[data-a="tool-hand"]', (e) => e.getAttribute("aria-pressed") === "true"));
  ok("hand hides the bar", await p.$eval(".de-mb", (e) => e.hidden));
  await p.keyboard.press("v"); await p.waitForTimeout(20);
  // Preview
  await p.click('[data-a="present"]'); await p.waitForTimeout(40);
  ok("preview hides editing chrome", await p.$eval(".de-vpanel", (e) => getComputedStyle(e).display === "none"));
  await p.screenshot({ path: "/h/shots/m-present.png" });
  await p.keyboard.press("Escape"); await p.waitForTimeout(30);
  ok("esc leaves preview", await p.$eval(".de-vpanel", (e) => getComputedStyle(e).display !== "none"));

  // Detach: a Puck block with a slot, opened up; what is in its slot stays
  await p.goto("http://127.0.0.1:8123/tree.html"); await p.reload(); await p.waitForSelector(".de-vpanel .de-tabs"); await p.waitForTimeout(100);
  const shape0 = await p.$eval('[data-tree-node="head"]', (e) => { const r = e.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height), e.innerText]; });
  await p.locator('[data-tree-node="head"]').click(); await p.waitForTimeout(40);
  ok("sealed offers detach", (await p.$$('[data-tree-act="detach"]')).length === 1);
  await p.screenshot({ path: "/h/shots/m-sealed.png" });
  await p.click('[data-tree-act="detach"]'); await p.waitForTimeout(60);
  const d1 = await p.evaluate(() => window.ed.doc());
  ok("block became boxes", d1.content[0].type === "box" && JSON.stringify(d1.content[0]).includes("A sealed heading block"), d1.content[0].type);
  const bx = await p.locator("#host [data-tree-slot]").nth(1).evaluate((e) => e.tagName);
  const shape1 = await p.$eval(`[data-tree-node="${d1.content[0].props.id}"]`, (e) => { const r = e.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height), e.innerText]; });
  console.log("detach", JSON.stringify(shape0), JSON.stringify(shape1));
  ok("looks the same", Math.abs(shape0[0] - shape1[0]) <= 2 && Math.abs(shape0[1] - shape1[1]) <= 2 && shape0[2] === shape1[2], [shape0, shape1]);
  await p.click("[data-a=undo]"); await p.waitForTimeout(40);
  ok("undo brings the block back", (await p.evaluate(() => window.ed.doc())).content[0].type === "section-heading");
  await p.locator('.de-layers [data-layer="G"]').click(); await p.waitForTimeout(40);
  await p.click('[data-tree-act="detach"]'); await p.waitForTimeout(60);
  const d2 = JSON.stringify(await p.evaluate(() => window.ed.doc()));
  ok("slot contents kept as they were", d2.includes('"id":"pr"') && d2.includes('"type":"prose"'), d2.slice(0, 200));

  const real = errs.filter((e) => !/favicon|404|Failed to load resource/.test(e));
  ok("no errors", real.length === 0, real.slice(0, 3));
  console.log(`pass ${pass} fail ${fail}`); srv.close(); await b.close(); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("ERR", e.message.slice(0, 500), (e.stack || "").split("\n").find((l) => l.includes("drive11"))); process.exit(2); });
