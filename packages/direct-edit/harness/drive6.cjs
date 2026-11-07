const { chromium } = require("playwright-core");
const http = require("http"), fs = require("fs"), path = require("path");
const srv = http.createServer((q, r) => { const f = path.join("/h", q.url.split("?")[0]); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { "content-type": f.endsWith(".css") ? "text/css" : f.endsWith(".js") ? "text/javascript" : "text/html" }); r.end(d); }); });
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else { fail++; console.log("FAIL", n, x === undefined ? "" : JSON.stringify(x)); } };
(async () => {
  await new Promise((r) => srv.listen(8123, "127.0.0.1", r));
  const b = await chromium.connectOverCDP("http://127.0.0.1:9222"); const p = b.contexts()[0].pages()[0];
  p.setDefaultTimeout(15000); p.on("pageerror", (e) => ok("pageerror", false, e.message)); await p.setViewportSize({ width: 1500, height: 950 });
  await p.goto("http://127.0.0.1:8123/live.html");
  await p.goto("http://127.0.0.1:8123/live.html");
  const rect = (id) => p.locator("#" + id).boundingBox();
  const cen = async (id) => { const r = await rect(id); return [r.x + r.width / 2, r.y + r.height / 2]; };
  const head = () => p.$eval(".de-vpanel .de-head b", (e) => e.textContent);
  const handle = async (h) => { const bb = await p.locator(`.de-layer-sheet .de-handle.${h}`).boundingBox(); return [bb.x + bb.width / 2, bb.y + bb.height / 2]; };
  const sel = () => p.evaluate(() => document.querySelector(".de-head span")?.textContent ?? "");
  // Select the Wanted column (grid child)
  const [hx, hy] = await cen("h2a");
  await p.mouse.click(hx, hy); await p.mouse.click(hx, hy); await p.mouse.click(hx, hy);
  ok("column", (await head()) === "Column", await head());
  ok("three handles", (await p.$$(".de-layer-sheet .de-handle")).length === 3);
  // Grid: east handle lands on whole columns
  const w0 = (await rect("c2")).width, c3x0 = (await rect("c3")).x;
  let [ex, ey] = await handle("e");
  await p.mouse.move(ex, ey); await p.mouse.down(); await p.mouse.move(ex + 200, ey, { steps: 5 }); await p.mouse.move(ex + 320, ey, { steps: 5 });
  const tag = await p.textContent(".de-layer-sheet .de-box:not(.kid):not(.hov) .de-tag"); console.log("tag", tag); ok("label says columns", /2 of 3 columns/.test(tag), tag);
  await p.screenshot({ path: "/h/shots/m-resize-grid.png" });
  await p.mouse.up();
  ok("spans two columns", (await p.$eval("#c2", (e) => getComputedStyle(e).gridColumnStart)).includes("span 2"));
  ok("wider", (await rect("c2")).width > w0 * 1.5);
  ok("neighbour reflowed, not overlapped", (await rect("c3")).y > (await rect("c2")).y || (await rect("c3")).x >= (await rect("c2")).x + (await rect("c2")).width);
  ok("selection kept", (await head()) === "Column");
  ok("panel shows span", (await p.$eval('[data-f="cspan"]', (e) => e.value)) === "2");
  await p.click("[data-a=undo]"); ok("undo resize", Math.abs((await rect("c2")).width - w0) < 2);
  // Esc cancels
  [ex, ey] = await handle("e");
  await p.mouse.move(ex, ey); await p.mouse.down(); await p.mouse.move(ex + 320, ey, { steps: 4 });
  await p.keyboard.press("Escape"); await p.mouse.up();
  ok("esc cancels", Math.abs((await rect("c2")).width - w0) < 2, (await rect("c2")).width);
  ok("esc keeps selection", (await head()) === "Column", await head());
  // South
  const h0 = (await rect("c2")).height;
  let [sx, sy] = await handle("s");
  await p.mouse.move(sx, sy); await p.mouse.down(); await p.mouse.move(sx, sy + 90, { steps: 4 }); await p.mouse.up();
  ok("taller", Math.abs((await rect("c2")).height - (h0 + 90)) < 3, (await rect("c2")).height);
  await p.click("[data-a=undo]");
  // Flex column child: east gives pixels, and the box stays anchored
  const [ix, iy] = await cen("h2a"); await p.mouse.click(ix, iy);
  ok("heading", (await head()) === "Heading", await head());
  const r0 = await rect("h2a");
  [ex, ey] = await handle("e");
  await p.mouse.move(ex, ey); await p.mouse.down(); await p.mouse.move(ex - 60, ey, { steps: 4 }); await p.mouse.up();
  const r1 = await rect("h2a");
  ok("px width", Math.abs(r1.width - (r0.width - 60)) < 3, r1.width); ok("left stays", Math.abs(r1.x - r0.x) < 1);
  await p.click("[data-a=undo]");
  // Corner
  [ex, ey] = await handle("se"); await p.mouse.move(ex, ey); await p.mouse.down(); await p.mouse.move(ex - 40, ey + 50, { steps: 3 }); await p.mouse.up();
  const r2 = await rect("h2a"); ok("corner both", r2.width < r0.width - 30 && r2.height > r0.height + 30, r2);
  await p.click("[data-a=undo]");
  // Move in a grid: Wanted before For sale
  await p.keyboard.press("Escape");
  ok("column again", (await head()) === "Column", await head());
  const [mx, my] = await cen("p2"); const c1 = await rect("c1");
  await p.mouse.move(mx, my); await p.mouse.down(); await p.mouse.move(mx - 40, my, { steps: 3 }); await p.mouse.move(c1.x + 10, my, { steps: 6 });
  ok("insertion line", (await p.$$(".de-insert")).length === 1);
  await p.screenshot({ path: "/h/shots/m-move-grid.png" });
  await p.mouse.up();
  ok("moved first", (await rect("c2")).x < (await rect("c1")).x, [(await rect("c2")).x, (await rect("c1")).x]);
  ok("line gone", (await p.$$(".de-insert")).length === 0);
  ok("drag did not change selection", (await head()) === "Column", await head());
  ok("order reset offered", (await p.$$('[data-reset="order"]')).length === 1);
  ok("markup unchanged", await p.$eval("#band", (e) => e.children[0].id === "c1"));
  await p.click("[data-a=undo]");
  ok("undo move", (await rect("c1")).x < (await rect("c2")).x);
  // Esc cancels a move
  const [mx2, my2] = await cen("p2");
  await p.mouse.move(mx2, my2); await p.mouse.down(); await p.mouse.move(c1.x + 10, my2, { steps: 5 }); await p.keyboard.press("Escape"); await p.mouse.up();
  ok("esc cancels move", (await rect("c1")).x < (await rect("c2")).x);
  // A wrapped heading moves with its wrapper, in a flex column
  await p.evaluate(() => window.ed); 
  const [ax, ay] = await cen("h1a");
  await p.mouse.click(ax, ay); await p.mouse.click(ax, ay);
  ok("in the first column", (await head()) === "Heading", await head());
  const pb = await rect("p1");
  await p.mouse.move(ax, ay); await p.mouse.down(); await p.mouse.move(ax, pb.y + pb.height + 6, { steps: 6 }); await p.mouse.up();
  ok("wrapper moved below paragraph", (await rect("h1a")).y > (await rect("p1")).y, [(await rect("h1a")).y, (await rect("p1")).y]);
  // Save and draw without the editor
  await p.click("[data-a=save]"); await p.waitForFunction(() => document.querySelector(".de-editbar-hint")?.textContent.includes("Saved"));
  const saved = await p.evaluate(() => window.saved.at(-1)); console.log(JSON.stringify(saved).slice(0, 400));
  ok("round trip", JSON.stringify(await p.evaluate((d) => window.pure.cleanPatches(d), saved)) === JSON.stringify(saved));
  const css = await p.evaluate((d) => window.pure.patchCss(d), saved);
  await p.evaluate(() => { window.ed.dispose(); });
  ok("public keeps the move", (await rect("h1a")).y > (await rect("p1")).y);
  ok("public css has order", /order:\d+ !important/.test(css), css);
  // Plain block parent becomes a column
  await p.goto("http://127.0.0.1:8123/live.html"); await p.waitForSelector(".de-vpanel .de-tabs");
  ok("block parent to start", (await p.$eval("#blk", (e) => getComputedStyle(e).display)) === "block");
  const [bx, by] = await cen("b0");
  await p.mouse.click(bx, by); await p.mouse.click(bx, by); await p.mouse.click(bx, by);
  ok("paragraph", (await head()) === "Paragraph", await head());
  const b2 = await rect("b2");
  await p.mouse.move(bx, by); await p.mouse.down(); await p.mouse.move(bx, b2.y + b2.height + 4, { steps: 6 }); await p.mouse.up();
  ok("moved last in a block", (await rect("b0")).y > (await rect("b2")).y, [(await rect("b0")).y, (await rect("b2")).y]);
  ok("parent became a column", (await p.$eval("#blk", (e) => getComputedStyle(e).display)) === "flex");
  ok("full width kept", Math.abs((await rect("b0")).width - (await rect("blk")).width) < 2);
  await p.evaluate(() => { window.onbeforeunload = null; window.ed.dispose(); });
  console.log(`pass ${pass} fail ${fail}`); srv.close(); await b.close(); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("ERR", e.message.slice(0, 400)); process.exit(2); });
