// Drives entry-layout.tsx (2026-11-07). Run:
//   ALIAS='{"@/lib/featured-person-actions":"/app/packages/direct-edit/harness/featured/actions-stub.ts"}' \
//   W=<scratch> bash run.sh frankenstein/entry-layout.tsx:fl.js -- drive-layout.cjs
const { chromium } = require("playwright-core");
const fs = require("fs");
const { serve } = require("./serve.cjs");
// The CSS is inlined: Puck's canvas iframe did not receive mirrored <link> sheets in this sandbox (featured/studio.cjs).
const css = () => ["/h/site.css", "/h/fl.css"].map((f) => fs.readFileSync(f, "utf8")).join("\n");
const page = () => `<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><style>${css()}</style><body><div id="host"></div><script src=/fl.js></script>`;
let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => { cond ? pass++ : fail++; console.log(`${cond ? "pass" : "  FAIL"} ${name}${extra ? "  " + JSON.stringify(extra).slice(0, 300) : ""}`); };

(async () => {
  const srv = await serve("/h", page()); fs.mkdirSync("/h/shots", { recursive: true });
  const b = await chromium.connectOverCDP("http://127.0.0.1:9222"); const p = b.contexts()[0].pages()[0];
  p.setDefaultTimeout(12000);
  const errs = []; p.on("pageerror", (e) => errs.push((e.stack || e.message).slice(0, 300))); p.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errs.push("console: " + m.text().slice(0, 200)); });

  // ── A visitor's page, wide ────────────────────────────────────────────────
  await p.setViewportSize({ width: 1280, height: 800 });
  await p.goto("http://127.0.0.1:8123/?view=1", { waitUntil: "domcontentloaded" });
  await p.waitForSelector(".blk-tabs[data-scripted]");
  const vis = (sel) => p.locator(sel).first().isVisible();
  ok("tabs: three named tabs, script ran", (await p.locator(".blk-tabs-tab").count()) === 3);
  ok("tabs: first panel shows, second hidden", (await vis("text=In tab one")) && !(await vis("text=In tab two")));
  ok("tabs: no tab-name headings while scripted", !(await vis(".blk-tabs-heading")));
  await p.click(".blk-tabs-tab >> text=Two");
  ok("tabs: a click shows tab two", (await vis("text=In tab two")) && !(await vis("text=In tab one")));
  ok("tabs: aria-selected follows", (await p.getAttribute(".blk-tabs-tab >> text=Two", "aria-selected")) === "true" && (await p.getAttribute(".blk-tabs-tab >> text=One", "aria-selected")) === "false");
  await p.focus(".blk-tabs-tab >> text=Two"); await p.keyboard.press("ArrowRight");
  ok("tabs: ArrowRight moves to tab three and focuses it", (await p.evaluate(() => document.activeElement?.textContent)) === "Three" && !(await vis("text=In tab two")));
  await p.keyboard.press("Home");
  ok("tabs: Home goes back to tab one", await vis("text=In tab one"));
  ok("tabs: only the chosen tab is in the Tab order", (await p.$$eval(".blk-tabs-tab", (ts) => ts.map((t) => t.tabIndex))).join() === "0,-1,-1");

  ok("sections: first open, others closed", await p.$$eval(".blk-acc-item", (ds) => ds.map((d) => d.open).join()) === "true,false,false");
  await p.click(".blk-acc-head >> text=Second"); await p.waitForTimeout(100);
  ok("sections: one at a time (opening the second closes the first)", await p.$$eval(".blk-acc-item", (ds) => ds.map((d) => d.open).join()) === "false,true,false");

  const side0 = await p.locator(".blk-sticky-side").boundingBox();
  const main0 = await p.locator(".blk-sticky-main").boundingBox();
  ok("sticky: side on the left, a third wide", side0.x < main0.x && Math.abs(side0.width / (side0.width + main0.width) - 1 / 3) < 0.06, { side0, main0 });
  await p.mouse.wheel(0, 500); await p.waitForTimeout(200);
  const side1 = await p.locator(".blk-sticky-side").boundingBox();
  ok("sticky: after scrolling, the side stays at its offset", Math.abs(side1.y - 40) < 3, side1);
  await p.screenshot({ path: "/h/shots/layout-wide.png" });

  // ── A phone ───────────────────────────────────────────────────────────────
  await p.setViewportSize({ width: 390, height: 800 });
  await p.goto("http://127.0.0.1:8123/?view=1", { waitUntil: "domcontentloaded" });
  await p.waitForSelector(".blk-tabs[data-scripted]");
  const sideP = await p.locator(".blk-sticky-side").boundingBox(), mainP = await p.locator(".blk-sticky-main").boundingBox();
  ok("phone: sticky side stacks above the long column", sideP.y + sideP.height <= mainP.y + 1 && Math.abs(sideP.width - mainP.width) < 2, { sideP, mainP });
  ok("phone: the side does not stick", (await p.locator(".blk-sticky-side").evaluate((e) => getComputedStyle(e).position)) === "static");
  ok("phone: no sideways scroll", await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), await p.evaluate(() => document.documentElement.scrollWidth));
  const tabsRow = await p.locator(".blk-tabs-list").boundingBox();
  ok("phone: tab row fits the width", tabsRow.width <= 390, tabsRow);
  await p.screenshot({ path: "/h/shots/layout-phone.png", fullPage: true });

  // ── Puck Studio, Para Theater's config ────────────────────────────────────
  await p.setViewportSize({ width: 1500, height: 950 });
  await p.goto("http://127.0.0.1:8123/", { waitUntil: "domcontentloaded", timeout: 60000 });
  const frameEl = await p.waitForSelector("iframe", { timeout: 25000 }); const f = await frameEl.contentFrame();
  await f.waitForSelector('[data-puck-component="tb"]', { timeout: 25000 }); await p.waitForTimeout(1500);
  ok("studio: the three blocks are in the drawer", await p.evaluate(() => ["Sticky side", "Tabs", "Sections that open"].every((n) => [...document.querySelectorAll("[data-puck-drawer-item], [class*=Drawer] *")].some((e) => e.textContent?.trim() === n))));
  ok("studio: sections all open while editing", await f.$$eval(".blk-acc-item", (ds) => ds.every((d) => d.open)));
  ok("studio: one-at-a-time group off while editing", await f.$$eval(".blk-acc-item", (ds) => ds.every((d) => !d.getAttribute("name"))));
  ok("studio: every tab panel shows while editing, under its name", (await f.locator(".blk-tabs[data-editing]").count()) === 1 && (await f.locator("text=In tab one").isVisible()) && (await f.locator("text=In tab two").isVisible()) && (await f.locator(".blk-tabs-heading >> text=Two").isVisible()));
  ok("studio: the tab row is hidden while editing", !(await f.locator(".blk-tabs-list").isVisible()));
  // A block inside tab two can be selected in the canvas.
  const t2 = await f.locator('[data-puck-component="t2"]').boundingBox();
  await p.mouse.click(t2.x + 20, t2.y + Math.min(10, t2.height / 2)); await p.waitForTimeout(500);
  ok("studio: a block in tab two is selectable", await p.evaluate(() => globalThis.__getPuck().selectedItem?.props?.id === "t2"), await p.evaluate(() => globalThis.__getPuck().selectedItem?.props?.id ?? null));
  // Naming tab four in the panel adds a tab and a panel to drop into.
  await p.evaluate(() => { const gp = globalThis.__getPuck(); const it = gp.getItemById("tb"); gp.dispatch({ type: "replace", destinationIndex: 1, destinationZone: "root:default-zone", data: { ...it, props: { ...it.props, label4: "Four" } } }); });
  await p.waitForTimeout(600);
  ok("studio: naming tab four adds its panel, shown while editing", (await f.locator('.blk-tabs-panel[data-tab="4"]').count()) === 1 && (await f.locator('.blk-tabs-panel[data-tab="4"]').isVisible()));
  ok("studio: the Featured person draws from the stub", await f.locator(".blk-fperson >> text=Dana McCool").isVisible().catch(() => false));
  await p.screenshot({ path: "/h/shots/layout-studio.png" });

  ok("no page errors", errs.length === 0, errs.slice(0, 4));
  console.log(`pass ${pass} fail ${fail}`);
  srv.close(); await b.close(); process.exit(fail ? 1 : 0);
})().catch((e) => { console.log("ERR", e.message.slice(0, 600)); process.exit(2); });
