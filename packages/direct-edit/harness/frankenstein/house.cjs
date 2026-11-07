// Drives house.tsx: an edit in Arrange (Puck), a handoff, an edit in Shape (direct-edit), a handoff back.
const { chromium } = require("playwright-core");
const fs = require("fs");
const { serve } = require("./serve.cjs");
const page = `<!doctype html><meta charset=utf-8><link rel=stylesheet href=/site.css><link rel=stylesheet href=/house.css><link rel=stylesheet href=/editor.css><body><div id="host"></div><script src=/house.js></script>`;
let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => { cond ? pass++ : fail++; console.log(`${cond ? "pass" : "  FAIL"} ${name}${extra ? "  " + extra : ""}`); };

(async () => {
  const srv = await serve("/h", page); fs.mkdirSync("/h/shots", { recursive: true });
  const b = await chromium.connectOverCDP("http://127.0.0.1:9222"); const p = b.contexts()[0].pages()[0];
  p.setDefaultTimeout(15000); await p.setViewportSize({ width: 1500, height: 950 });
  const errs = []; p.on("pageerror", (e) => errs.push((e.stack || e.message).slice(0, 300)));
  await p.goto("http://127.0.0.1:8123/", { waitUntil: "domcontentloaded", timeout: 60000 });
  const arrangeFrame = async () => { const el = await p.waitForSelector("iframe", { timeout: 30000 }); const f = await el.contentFrame(); await f.waitForSelector('[data-puck-component="try-banner"]', { timeout: 30000 }); await p.waitForTimeout(1200); return f; };
  let f = await arrangeFrame();
  ok("opens in Arrange (Puck)", (await p.evaluate(() => globalThis.__house.room)) === "arrange");

  // 1. Edits in Arrange: a setting (subtitle) and a part look (title fill), both through Puck's replace.
  await p.evaluate(() => {
    const s = globalThis.__getPuck(); const it = s.getItemById("try-banner"); const w = s.getSelectorForId("try-banner");
    const props = { ...it.props, subtitle: "Edited in Arrange", morph: { v: 1, parts: { title: { fill: "#b85c3a" } } } };
    s.dispatch({ type: "replace", destinationIndex: w.index, destinationZone: w.zone, data: { ...it, props } });
  });
  await p.waitForTimeout(500);
  ok("Arrange draws the look", (await f.$eval('[data-puck-component="try-banner"] h1', (e) => getComputedStyle(e).backgroundColor)) === "rgb(184, 92, 58)");
  await p.screenshot({ path: "/h/shots/house-1-arrange.png" });

  // 2. Handoff to Shape.
  await p.click('[data-room="shape"]');
  await p.waitForSelector('[data-tree-node="try-banner"]', { timeout: 30000 }); await p.waitForTimeout(1200);
  ok("now in Shape (direct-edit)", (await p.evaluate(() => globalThis.__house.room)) === "shape");
  ok("Puck's editor is gone (one writer)", (await p.locator("iframe").count()) === 0);
  ok("Shape shows the Arrange subtitle", (await p.locator('[data-tree-node="try-banner"]').innerText()).includes("Edited in Arrange"));
  ok("Shape draws the Arrange look", (await p.$eval('[data-tree-node="try-banner"] h1', (e) => getComputedStyle(e).backgroundColor)) === "rgb(184, 92, 58)");
  ok("handoff logged", (await p.evaluate(() => globalThis.__house.log.length)) === 1, await p.locator("[data-house-note]").innerText());

  // 3. A structural edit in Shape: move a band to the end ("]").
  const before = await p.evaluate(() => globalThis.__shape.doc().content.map((n) => n.props.id));
  await p.evaluate(() => globalThis.__shape.select("try-feed-band")); await p.waitForTimeout(200);
  await p.keyboard.press("BracketRight"); await p.waitForTimeout(400);
  const after = await p.evaluate(() => globalThis.__shape.doc().content.map((n) => n.props.id));
  ok("Shape moved the band to the end", after[after.length - 1] === "try-feed-band" && before[1] === "try-feed-band", after.slice(-2).join(","));
  await p.screenshot({ path: "/h/shots/house-2-shape.png" });

  // 4. Handoff back to Arrange.
  await p.click('[data-room="arrange"]');
  f = await arrangeFrame();
  const data = await p.evaluate(() => globalThis.__getPuck().appState.data);
  const ids = data.content.map((n) => n.props.id);
  const banner = data.content.find((n) => n.props.id === "try-banner");
  ok("Arrange has the Shape move", ids[ids.length - 1] === "try-feed-band", ids.slice(-2).join(","));
  ok("Arrange kept its own subtitle", banner.props.subtitle === "Edited in Arrange");
  ok("Arrange kept its own look", banner.props.morph?.parts?.title?.fill === "#b85c3a", JSON.stringify(banner.props.morph));
  ok("canvas order follows", (await f.$$eval("[data-puck-component]", (l) => l.filter((e) => !e.parentElement.closest("[data-puck-component]")).map((e) => e.getAttribute("data-puck-component")))).pop() === "try-feed-band");
  ok("two handoffs logged", (await p.evaluate(() => globalThis.__house.log.map((x) => `${x.from}->${x.to}:${x.blocks}`).join(" "))).split(" ").length === 2, await p.evaluate(() => globalThis.__house.log.map((x) => `${x.from}->${x.to}:${x.blocks}:${x.hash}`).join(" ")));
  await p.screenshot({ path: "/h/shots/house-3-back.png" });

  // 5. Rail 2 on its own: a handoff that loses a prop is refused.
  const lost = await p.evaluate(() => { const H = globalThis.__house; const a = H.doc; const b = JSON.parse(JSON.stringify(a)); delete b.content[0].props.subtitle; return H.dropped(a, b); });
  ok("rail refuses a handoff that drops a prop", lost.length === 1 && lost[0] === "try-banner.subtitle", JSON.stringify(lost));
  const deleted = await p.evaluate(() => { const H = globalThis.__house; const a = H.doc; const b = JSON.parse(JSON.stringify(a)); b.content.splice(1, 1); return H.dropped(a, b); });
  ok("deleting a whole block is allowed", deleted.length === 0);

  ok("no page errors", errs.length === 0, [...new Set(errs)].slice(0, 3).join(" | "));
  console.log(`\nhouse ${pass}/${pass + fail}`);
  await b.close(); srv.close(); process.exit(0);
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });
