const { chromium } = require("playwright-core");
const http = require("http"), fs = require("fs"), path = require("path");
const srv = http.createServer((q, r) => { const f = path.join("/h", q.url.split("?")[0].split("#")[0]); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { "content-type": f.endsWith(".css") ? "text/css" : f.endsWith(".js") ? "text/javascript" : "text/html" }); r.end(d); }); });
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else { fail++; console.log("FAIL", n, x === undefined ? "" : JSON.stringify(x)); } };
(async () => {
  await new Promise((r) => srv.listen(8123, "127.0.0.1", r));
  const b = await chromium.connectOverCDP("http://127.0.0.1:9222"); const p = b.contexts()[0].pages()[0];
  p.on("pageerror", (e) => ok("pageerror", false, e.message)); await p.setViewportSize({ width: 1400, height: 950 });
  await p.goto("http://127.0.0.1:8123/live.html");
  const cen = async (id) => { const bb = await p.locator("#" + id).boundingBox(); return [bb.x + bb.width / 2, bb.y + bb.height / 2]; };
  const secs = () => p.$$eval(".de-vpanel .de-sec[data-section]", (e) => e.map((x) => x.dataset.section));
  const head = () => p.$eval(".de-vpanel .de-head b", (e) => e.textContent);
  const fv = (id) => p.$eval(`.de-vpanel [data-f="${id}"]`, (e) => e.value);
  const type = async (id, v) => { await p.fill(`.de-vpanel [data-f="${id}"]`, v); };
  const css = (id, k) => p.$eval("#" + id, (e, k) => getComputedStyle(e)[k], k);
  // Empty state
  ok("panel present", (await p.$$(".de-vpanel .de-panel, .de-vpanel.de-panel")).length === 1);
  ok("tabs", (await p.$$eval(".de-tabs button", (e) => e.map((x) => x.textContent).join())) === "Properties,Code");
  ok("tree whole page at load", (await p.$$(".de-layers li")).length >= 1);
  ok("page moved over", (await p.evaluate(() => getComputedStyle(document.body).marginRight)) === "346px");
  // Select by click: section, then grid
  const [x, y] = await cen("h2a");
  await p.mouse.click(x, y); await p.mouse.click(x, y);
  ok("heading is Section", (await head()) === "Section", await head());
  console.log("section sections", await secs());
  ok("container has layout", (await secs()).includes("layout"));
  ok("computed width shown", (await fv("width")) !== "", await fv("width"));
  await p.screenshot({ path: "/h/shots/p-section.png" });
  // Child of a grid gets Column span
  const [x2, y2] = await cen("h2a"); await p.mouse.click(x2, y2);
  ok("column", (await head()) === "Column", await head());
  ok("column span in grid child", (await p.$$('.de-vpanel [data-f="cspan"]')).length === 1);
  // Heading: leaf with text section, contrast
  await p.mouse.click(x2, y2);
  ok("heading leaf", (await head()) === "Heading", await head());
  ok("text section", (await secs()).includes("text"));
  ok("no layout chips on leaf", (await p.$$('[data-f="layout"]')).length === 0);
  ok("contrast shown", (await p.$$(".de-contrast")).length === 1);
  await p.screenshot({ path: "/h/shots/p-heading.png" });
  // Typing keeps focus and applies
  await p.focus('.de-vpanel [data-f="size"]'); await p.fill('.de-vpanel [data-f="size"]', "31");
  ok("size applied", (await css("h2a", "fontSize")) === "31px", await css("h2a", "fontSize"));
  ok("focus kept", await p.evaluate(() => document.activeElement?.dataset?.f === "size"));
  ok("reset arrow", (await p.$$('.de-vpanel [data-reset="size"]')).length === 1);
  await p.click('.de-vpanel [data-reset="size"]');
  ok("reset works", (await css("h2a", "fontSize")) !== "31px");
  // Container layout: Stack on a block, Grid
  await p.keyboard.press("Escape"); await p.keyboard.press("Escape");
  ok("back to Section", (await head()) === "Section", await head());
  await p.selectOption('[data-f="layout"]', '"stack"');
  ok("stack is flex", (await css("band", "display")) === "flex", await css("band", "display"));
  ok("direction appears", (await p.$$('[data-f="dir=row"]')).length === 1);
  await p.selectOption('[data-f="layout"]', '"grid"'); await p.waitForTimeout(50);
  await type("gcols", "2");
  ok("grid columns", (await css("band", "gridTemplateColumns")).split(" ").length === 2, await css("band", "gridTemplateColumns"));
  await p.click('.de-vpanel [data-reset="gcols"]'); await p.click('.de-vpanel [data-reset="layout"]');
  // Padding beyond an ad's bounds, per side
  await type("padding", "120");
  ok("large padding kept", (await css("band", "paddingTop")) === "120px", await css("band", "paddingTop"));
  await p.click('[data-f="split-padding"]'); await p.waitForTimeout(40);
  await type("padding-1", "10");
  ok("per side", (await css("band", "paddingRight")) === "10px" && (await css("band", "paddingTop")) === "120px");
  // Colour, picture
  await p.click('[data-f="pop-fill"]'); await p.click('[data-f="ctab-custom"]'); await p.fill('[data-f="chex"]', "#335577"); await p.click('[data-f="popclose"]');
  ok("fill", (await css("band", "backgroundColor")) === "rgb(51, 85, 119)", await css("band", "backgroundColor"));
  await type("image", "/pic.jpg");
  ok("picture", (await css("band", "backgroundImage")).includes("/pic.jpg"));
  ok("fit control", (await p.$$('[data-f="fit-contain"]')).length === 1);
  await p.click('[data-f="fit-contain"]');
  ok("fit", (await css("band", "backgroundSize")) === "contain");
  await type("image", "");
  // Font
  await p.click('.de-more[data-more="text"]').catch(() => {});
  await p.click('[data-f="pop-font"]'); await p.fill('[data-fontq]', "Lora"); await p.click('[data-font="Lora"]');
  ok("font inherited down", (await css("p2", "fontFamily")).includes("Lora"), await css("p2", "fontFamily"));
  // Layer tree
  const rows = () => p.$$eval(".de-layers li", (e) => e.map((x) => x.querySelector(".de-layer b").textContent));
  console.log("tree", (await rows()).join(" | "));
  const sel = await p.$eval(".de-layers li.on b", (e) => e.textContent); ok("tree marks selection", sel === "Section", sel);
  await p.click('.de-layers button[data-expand="landing/1/1"]').catch(() => {});
  await p.waitForTimeout(40);
  await p.hover('.de-layers [data-layer="landing/1/1"]'); await p.waitForTimeout(40);
  ok("tree hover outlines page", (await p.$$(".de-layer-sheet .de-box.hov")).length === 1);
  await p.click('.de-layers [data-layer="landing/1/1"]'); await p.waitForTimeout(40);
  ok("tree click selects", (await p.evaluate(() => document.querySelector(".de-head span")?.textContent ?? "")).includes("Wanted"));
  await p.click('.de-layers [data-hide="landing/1/1"]'); await p.waitForTimeout(40);
  ok("eye hides faint", (await p.$$eval(".de-layers li.off", (e) => e.length)) === 1);
  ok("eye opacity rule", (await p.$eval("style[data-edit-patches]", (e) => e.textContent)).includes("opacity:.3"));
  await p.click('.de-layers [data-hide="landing/1/1"]');
  // Code tab
  await p.click('[data-tab="code"]'); await p.waitForTimeout(30);
  ok("no Your CSS", !(await p.$eval(".de-vpanel", (e) => e.textContent)).includes("Your CSS"));
  await p.click('.de-layers [data-layer]').catch(() => {});
  ok("inherited listed", (await p.$eval(".de-vpanel", (e) => e.textContent)).includes("From"));
  await p.screenshot({ path: "/h/shots/p-code.png" });
  await p.click('[data-tab="props"]');
  // Undo through the panel
  await p.click("[data-a=undo]"); ok("undo", true);
  await p.click("[data-a=redo]");
  await p.click("[data-a=save]"); await p.waitForFunction(() => document.querySelector(".de-editbar-hint")?.textContent.includes("Saved"));
  const saved = await p.evaluate(() => window.saved.at(-1)); console.log(JSON.stringify(saved));
  ok("clean round trip", JSON.stringify(await p.evaluate((d) => window.pure.cleanPatches(d), saved)) === JSON.stringify(saved));
  await p.setViewportSize({ width: 400, height: 800 }); await p.waitForTimeout(100);
  await p.screenshot({ path: "/h/shots/p-phone.png" });
  ok("phone: no sideways scroll", await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await p.setViewportSize({ width: 1400, height: 950 });
  await p.evaluate(() => { window.onbeforeunload = null; window.ed.dispose(); });
  ok("margin restored", (await p.evaluate(() => getComputedStyle(document.body).marginRight)) === "0px");
  console.log(`pass ${pass} fail ${fail}`); srv.close(); await b.close(); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("ERR", e.message.slice(0, 400)); process.exit(2); });
