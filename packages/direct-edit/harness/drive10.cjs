const { chromium } = require("playwright-core");
const http = require("http"), fs = require("fs"), path = require("path");
const srv = http.createServer((q, r) => { const f = path.join("/h", q.url.split("?")[0]); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { "content-type": f.endsWith(".css") ? "text/css" : f.endsWith(".js") ? "text/javascript" : "text/html" }); r.end(d); }); });
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else { fail++; console.log("FAIL", n, x === undefined ? "" : JSON.stringify(x)); } };
(async () => {
  await new Promise((r) => srv.listen(8123, "127.0.0.1", r));
  const b = await chromium.connectOverCDP("http://127.0.0.1:9222"); const p = b.contexts()[0].pages()[0];
  p.setDefaultTimeout(15000); await p.setViewportSize({ width: 1500, height: 950 });
  const errs = []; p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (m) => { if (m.type() === "error") errs.push(m.text().slice(0, 220)); });
  await p.goto("http://127.0.0.1:8123/tree.html#classifieds"); await p.waitForSelector(".de-vpanel .de-tabs"); await p.waitForTimeout(200);
  const rows = () => p.$$eval(".de-layers li", (e) => e.map((x) => `${"  ".repeat(Number(x.style.getPropertyValue("--d")))}${x.querySelector(".de-layer b").textContent}${x.querySelector(".de-layer span:not(.de-kind)") ? " " + x.querySelector(".de-layer span:not(.de-kind)").textContent : ""}`));
  const head = () => p.$eval(".de-vpanel .de-head b", (e) => e.textContent).catch(() => null);
  const rowFor = (name) => p.locator(".de-layers li").filter({ hasText: name }).first();
  const clickRow = async (name) => { await rowFor(name).locator(".de-layer").click(); await p.waitForTimeout(40); };
  const css = () => p.$eval(".de-sheet-css", (e) => e.value);
  const fromText = () => p.$$eval(".de-from", (e) => e.map((g) => g.querySelector(".de-from-head").textContent.replace(/\s+/g, " ").trim() + ": " + [...g.querySelectorAll(".de-from-row")].map((r) => r.querySelector(".p").textContent).join(",")));
  const docNode = (id) => p.evaluate((i) => { let o = null; const go = (l) => { for (const n of l ?? []) { if (n.props.id === i) o = n; if (n.props.items) go(n.props.items); } }; go(window.ed.doc().content); return o; }, id);

  // Root layer
  const t0 = await rows(); console.log("TREE\n" + t0.slice(0, 22).join("\n"));
  ok("page is the root row", t0[0].startsWith("Page Classifieds page"), t0[0]);
  ok("nesting like the screenshots", /^ {2}Box/.test(t0[1]) && /^ {4}Column/.test(t0[2]) && /^ {6}Header/.test(t0[3]) && /^ {8}Row/.test(t0[4]), t0.slice(1, 5));
  await clickRow("Classifieds page");
  ok("root selected from the tree", (await head()) === "Page", await head());
  ok("root offers background", (await p.$$('.de-vpanel [data-f="pop-fill"]')).length === 1);
  ok("root has no kind or link", (await p.$$('.de-vpanel [data-f="tag"]')).length === 0 && (await p.$$('[data-f="attr-href"]')).length === 0);
  await p.screenshot({ path: "/h/shots/y-root.png" });
  await p.click('[data-f="pop-fill"]'); await p.click('[data-f="ctab-custom"]'); await p.fill('[data-f="chex"]', "#223344"); await p.click('[data-f="popclose"]'); await p.waitForTimeout(40);
  ok("page background", (await p.$eval("[data-page-root]", (e) => getComputedStyle(e).backgroundColor)) === "rgb(34, 51, 68)");
  await p.click("[data-a=undo]"); await p.waitForTimeout(30);

  // Names from the screenshots
  const all = await rows();
  ok("Section by its name", all.some((r) => r.trim() === "Section First page of ads"), all.filter((r) => r.includes("Section")));
  ok("Column by its anchor", all.some((r) => r.trim() === "Column #for-sale"), all.filter((r) => r.includes("#")));
  ok("Nav by its name", all.some((r) => r.trim() === "Navigation Sections"), all.filter((r) => r.includes("Navigation")));
  ok("first words as written, not as the CSS uppercases them", all.some((r) => /Row “Vol\. I/.test(r)), all.slice(1, 5));
  await rowFor("Row “Notices").locator(".de-layer").click(); await p.waitForTimeout(40);
  ok("Heading with first words", (await rows()).some((r) => /Heading “The Collective/.test(r)), (await rows()).slice(4, 10));
  await p.screenshot({ path: "/h/shots/y-tree.png" });
  ok("link glyph on nav items", (await p.$$(".de-linkmark")).length >= 4, (await p.$$(".de-linkmark")).length);

  // Code tab with the tree above it
  await p.click('[data-tab="code"]'); await p.waitForTimeout(30);
  ok("tree on the Code tab", (await p.$$(".de-vpanel .de-layers li")).length > 10);
  // The Row with font-size: the first Row
  await rowFor("Row “Vol.").locator(".de-layer").click(); await p.waitForTimeout(50);
  const rowCss = await css(); console.log("ROW CSS\n" + rowCss);
  ok("declarations listed", rowCss.includes("font-size: 11px;") && rowCss.includes("letter-spacing: .22em;") && rowCss.includes("border-bottom: 1px solid #1d1a16;"), rowCss);
  ok("tag shown", (await p.textContent(".de-sheet-tag")).includes("<div>"));
  await p.screenshot({ path: "/h/shots/y-code-row.png" });
  console.log("ROW FROM", JSON.stringify(await fromText()));
  ok("row inherits family and colour from the group", (await fromText()).some((g) => g.includes("font-family") && g.includes("color")), await fromText());
  // The Text inside: nothing set, inherits from Row then group
  await clickRow("Text “Vol.");
  ok("nothing set: placeholder", (await css()) === "" && (await p.$eval(".de-sheet-css", (e) => e.placeholder)).startsWith("Nothing set"));
  const from = await fromText(); console.log("TEXT FROM", JSON.stringify(from));
  ok("From the row first", from[0]?.includes("font-size") && from[0]?.includes("letter-spacing") && from[0]?.includes("text-transform"), from);
  ok("then from the group", from[1]?.includes("font-family") && from[1]?.includes("color"), from);
  ok("the tag names it", (await p.textContent(".de-sheet-tag")).includes("<span>"));
  await p.screenshot({ path: "/h/shots/y-code-text.png" });
  // Adopt with +
  await p.click('[data-f="adopt-font-size"]'); await p.waitForTimeout(50);
  ok("+ sets it on this box", (await css()).includes("font-size: 11px"), await css());
  const fromAfter = await fromText();
  ok("no longer listed as inherited", !fromAfter.join().includes("font-size"), fromAfter);
  await p.click("[data-a=undo]"); await p.waitForTimeout(40);
  ok("undo adopt", (await css()) === "", await css());
  // Typing
  await p.focus(".de-sheet-css"); await p.keyboard.type("color: red;\nposition: fixed;\nbackground: url(x);\n"); await p.waitForTimeout(420);
  ok("focus stays while typing", await p.evaluate(() => document.activeElement?.dataset?.cssall !== undefined));
  const textEl = p.locator('[data-tree-type="words"]').filter({ hasText: "Vol. I" }).first();
  ok("typed style applies", (await textEl.evaluate((e) => getComputedStyle(e).color)) === "rgb(255, 0, 0)");
  ok("refused lines are named", /Not kept:.*position.*background/.test(await p.textContent(".de-flagline")), await p.textContent(".de-flagline"));
  await p.fill(".de-sheet-css", ""); await p.waitForTimeout(420);
  // Layout written in code shows in Properties, and a field wins over it
  await p.click('.de-vpanel [data-tab="props"]'); await p.waitForTimeout(30);
  await rowFor("Section First page").locator(".de-layer").click(); await p.waitForTimeout(40);
  ok("code layout read back", (await p.$eval('.de-vpanel [data-f="layout"]', (e) => e.selectedOptions[0].textContent)) === "Grid");
  ok("columns read back", (await p.$eval('.de-vpanel [data-f="gcols"]', (e) => e.value)) === "6", await p.$eval('.de-vpanel [data-f="gcols"]', (e) => e.value));
  await p.fill('.de-vpanel [data-f="gap"]', "40"); await p.waitForTimeout(40);
  const sec = p.locator('[data-tree-type="box"][aria-label="First page of ads"]');
  ok("field wins over code", (await sec.evaluate((e) => getComputedStyle(e).rowGap)) === "40px", await sec.evaluate((e) => getComputedStyle(e).rowGap));
  await p.fill('.de-vpanel [data-f="gcols"]', "3"); await p.waitForTimeout(40);
  ok("columns field drives a coded grid", (await sec.evaluate((e) => getComputedStyle(e).gridTemplateColumns)).split(" ").length === 3);
  await p.click("[data-a=undo]"); await p.click("[data-a=undo]"); await p.waitForTimeout(40);
  ok("undo to six columns", (await sec.evaluate((e) => getComputedStyle(e).gridTemplateColumns)).split(" ").length === 6);

  // Inline runs
  await clickRow("Column #for-sale");
  await clickRow("Text “EASEL");
  const r2 = await rows(); ok("inline run is a child row", r2.some((r) => /Text “EASEL,”/.test(r)), r2.filter((r) => r.includes("EASEL")));
  await p.locator('.de-layers li').filter({ hasText: "“EASEL,”" }).locator(".de-layer").click(); await p.waitForTimeout(40);
  ok("selecting the run selects its words", (await p.$eval(".de-head span", (e) => e.textContent)).includes("EASEL"));

  // Link, anchor, name
  await rowFor("Paragraph “Notices").locator(".de-layer").click(); await p.waitForTimeout(40);
  await p.fill('[data-f="attr-anchor"]', "top-note"); await p.fill('[data-f="attr-href"]', "#for-sale"); await p.waitForTimeout(40);
  const para = p.locator("#top-note");
  ok("anchor set", (await para.count()) === 1);
  ok("link inside", (await para.locator('a[href="#for-sale"]').count()) === 1, await para.innerHTML());
  ok("link inert while editing", p.url().endsWith("#classifieds"));
  const rr = await rows(); ok("tree shows the anchor", rr.some((r) => r.trim() === "Paragraph #top-note"), rr.filter((x) => x.includes("Paragraph")).slice(0, 3));
  await p.fill('[data-f="attr-href"]', "javascript:alert(1)"); await p.waitForTimeout(40);
  ok("bad link not drawn", (await para.locator("a").count()) === 0);
  await p.fill('[data-f="attr-href"]', ""); await p.fill('[data-f="attr-anchor"]', ""); await p.waitForTimeout(40);

  // Move: an ad from For Sale into Wanted, across columns
  await p.locator('[data-tree-type="words"]').filter({ hasText: "KILN" }).first().scrollIntoViewIfNeeded();
  const kiln = p.locator('[data-tree-type="words"]').filter({ hasText: "KILN" }).first();
  await clickRow("Column #for-sale"); await rowFor("Text “KILN").locator(".de-layer").click(); await p.waitForTimeout(40);
  const kb = await kiln.boundingBox();
  const wanted = await p.locator("#wanted").boundingBox();
  await p.mouse.move(kb.x + 20, kb.y + 8); await p.mouse.down(); await p.mouse.move(kb.x + 30, kb.y + 14, { steps: 2 }); await p.mouse.move(wanted.x + wanted.width / 2, wanted.y + wanted.height - 14, { steps: 10 });
  await p.screenshot({ path: "/h/shots/y-move.png" });
  await p.mouse.up(); await p.waitForTimeout(50);
  ok("ad moved between columns on the page", await p.locator("#wanted").evaluate((e) => e.textContent.includes("KILN")));
  ok("gone from for sale", !(await p.locator("#for-sale").evaluate((e) => e.textContent.includes("KILN"))));

  // Click on empty space selects the page
  await p.keyboard.press("Escape"); await p.keyboard.press("Escape"); await p.keyboard.press("Escape"); await p.keyboard.press("Escape"); await p.keyboard.press("Escape"); await p.keyboard.press("Escape"); await p.waitForTimeout(20);
  await p.setViewportSize({ width: 1700, height: 950 }); await p.waitForTimeout(40);

  // Save, publish, compare
  await p.click("[data-a=save]"); await p.waitForFunction(() => document.querySelector(".de-editbar-hint")?.textContent.includes("Saved"));
  const saved = await p.evaluate(() => window.saved.at(-1));
  console.log("saved bytes", JSON.stringify(saved).length);
  const check = await p.evaluate((s) => window.kit.validatePage(s, new Set(Object.keys(window.kit.config.components))), saved);
  ok("valid page", check.ok && check.warnings.length === 0, check);
  const stored = await p.evaluate((s) => window.kit.cleanBoxDoc(window.kit.sanitizeRichValues(s)), saved);
  ok("clean stable", JSON.stringify(stored) === JSON.stringify(saved), [JSON.stringify(stored).length, JSON.stringify(saved).length]);
  await p.click(".de-editbar [data-a=done]").catch(() => {});
  await p.waitForTimeout(50);
  const shape = (scope) => p.$$eval(`${scope} h1,${scope} h2,${scope} h3,${scope} p,${scope} span,${scope} a,${scope} section,${scope} header,${scope} nav`, (els) => els.filter((e) => !e.closest("[data-de-ui]")).map((e) => { const r = e.getBoundingClientRect(); return [e.tagName, (e.textContent || "").slice(0, 18), Math.round(r.width), Math.round(r.height)]; }));
  await p.evaluate(() => { document.documentElement.classList.remove("de-vpanel-open", "de-editing"); });
  await p.waitForTimeout(80);
  const inEditor = await shape("#host");
  await p.evaluate((s) => { window.ed.dispose(); document.getElementById("host").style.display = "none"; window.published(s); document.getElementById("pub").style.padding = "50px 16px 80px"; }, stored);
  await p.waitForTimeout(200);
  const inPublished = await shape("#pub");
  const diff = inEditor.map((a, i) => JSON.stringify(a) === JSON.stringify(inPublished[i]) ? null : [a, inPublished[i]]).filter(Boolean);
  console.log("parity", inEditor.length, inPublished.length, JSON.stringify(diff).slice(0, 400));
  ok("published draws the same", inEditor.length === inPublished.length && diff.length === 0);
  ok("anchors and aria on the published page", (await p.locator("#pub #for-sale").count()) === 1 && (await p.locator('#pub section[aria-label="First page of ads"]').count()) === 1);
  ok("published nav links", (await p.locator('#pub nav a[href="#wanted"]').count()) === 1);
  await p.screenshot({ path: "/h/shots/y-published.png", fullPage: true });
  const real = errs.filter((e) => !/favicon|404|Failed to load resource/.test(e));
  ok("no errors", real.length === 0, real.slice(0, 3));
  console.log(`pass ${pass} fail ${fail}`); srv.close(); await b.close(); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("ERR", e.message.slice(0, 500), (e.stack || "").split("\n").find((l) => l.includes("drive10"))); process.exit(2); });
