// Drives entry-tour-phone.tsx (2026-11-07): on a phone, the tour popup's map stays in view under the tab strip while
// the stops scroll beneath it; on a wide screen the map stays beside the list as before. Needs h/tour.json (the live
// /api/surfaces/tour/<id> answer) and h/elk.css. Run:
//   W=<scratch> bash ../frankenstein/run.sh featured/entry-tour-phone.tsx:ftp.js -- tour-phone.cjs
const { chromium } = require("playwright-core");
const fs = require("fs");
const http = require("http");
const css = ["/h/elk.css", "/h/ftp.css"].map((f) => fs.readFileSync(f, "utf8").replace(/@import[^;]*;/g, "")).join("\n");
const page = `<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><style>${css}</style><body><div id="host"></div><script src=/ftp.js></script>`;
const TOUR = fs.readFileSync("/h/tour.json");
let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => { cond ? pass++ : fail++; console.log(`${cond ? "pass" : "  FAIL"} ${name}${extra ? "  " + JSON.stringify(extra).slice(0, 300) : ""}`); };

(async () => {
  const srv = http.createServer((q, r) => {
    if (q.url.startsWith("/api/surfaces/tour/")) { r.writeHead(200, { "content-type": "application/json" }); r.end(TOUR); return; }
    if (q.url === "/ftp.js") { r.writeHead(200, { "content-type": "text/javascript" }); r.end(fs.readFileSync("/h/ftp.js")); return; }
    if (q.url === "/" ) { r.writeHead(200, { "content-type": "text/html" }); r.end(page); return; }
    r.writeHead(404); r.end();
  });
  await new Promise((res) => srv.listen(8123, "127.0.0.1", res));
  fs.mkdirSync("/h/shots", { recursive: true });
  const b = await chromium.connectOverCDP("http://127.0.0.1:9222"); const p = b.contexts()[0].pages()[0];
  p.setDefaultTimeout(15000);
  const errs = []; p.on("pageerror", (e) => errs.push(e.message.slice(0, 200)));

  const open = async (w, hgt) => {
    await p.setViewportSize({ width: w, height: hgt });
    await p.goto("http://127.0.0.1:8123/", { waitUntil: "domcontentloaded" });
    await p.waitForSelector(".tour-popup-stop", { timeout: 20000 }); await p.waitForTimeout(800);
  };
  const box = (sel) => p.locator(sel).first().boundingBox();
  const body = ".eac-surface-body";

  // ── Phone ────────────────────────────────────────────────────────────────
  await open(390, 844);
  const map0 = await box(".tour-popup-map__frame"), tabs0 = await box('[role="tablist"]');
  ok("phone: map comes first, under the tab strip", map0 && tabs0 && map0.y >= tabs0.y + tabs0.height - 2, { map0, tabs0 });
  ok("phone: map is a phone's height, not the wide one", map0.height >= 150 && map0.height <= 245, map0.height);
  await p.screenshot({ path: "/h/shots/tour-phone-top.png" });
  const scrolled = await p.evaluate((sel) => { const e = document.querySelector(sel); const before = e.scrollTop; e.scrollTop = 700; return { before, after: e.scrollTop, max: e.scrollHeight - e.clientHeight }; }, body);
  await p.waitForTimeout(300);
  ok("phone: the popup body scrolls", scrolled.after > 300, scrolled);
  const map1 = await box(".tour-popup-map__frame"), tabs1 = await box('[role="tablist"]');
  // It rises by at most the popup body's top padding (16px) as it starts to stick, as the tab strip does.
  ok("phone: after scrolling, the map is still in view, full height", map0.y - map1.y >= -1 && map0.y - map1.y <= 16 && map1.height === map0.height, { map0: map0.y, map1: map1.y });
  const bodyTop = (await box(body)).y, wrap1 = await box(".tour-popup-map");
  ok("phone: the tab strip is still in view, at the top of the popup body", tabs1.y >= bodyTop - 1 && tabs1.y <= bodyTop + 4, { bodyTop, tabs1: tabs1.y });
  ok("phone: no gap between the strip and the map's ground", wrap1.y <= tabs1.y + tabs1.height + 0.5, { stripBottom: tabs1.y + tabs1.height, mapTop: wrap1.y });
  // Rows pass under the map: whatever is drawn at the map's middle is the map, not a stop.
  const atMap = await p.evaluate(({ x, y }) => { const e = document.elementFromPoint(x, y); return { inMap: !!e?.closest(".tour-popup-map"), inStop: !!e?.closest(".tour-popup-stop") }; }, { x: map1.x + map1.width / 2, y: map1.y + map1.height / 2 });
  ok("phone: stops scroll beneath the map, not over it", atMap.inMap && !atMap.inStop, atMap);
  const firstVisibleStop = await p.evaluate(() => { const m = document.querySelector(".tour-popup-map").getBoundingClientRect(); return [...document.querySelectorAll(".tour-popup-stop")].map((li) => li.getBoundingClientRect()).find((r) => r.bottom > m.bottom + 4)?.top ?? null; });
  ok("phone: stops show below the map", firstVisibleStop !== null);
  await p.screenshot({ path: "/h/shots/tour-phone-scrolled.png" });
  // Picking the last stop's title brings the map to it and keeps the row out from under the map.
  await p.evaluate((sel) => { document.querySelector(sel).scrollTop = 0; }, body);
  const last = p.locator(".tour-popup-stop").last();
  await last.scrollIntoViewIfNeeded(); await last.locator("button").first().click(); await p.waitForTimeout(400);
  const lastBox = await last.boundingBox(), mapB = await box(".tour-popup-map");
  ok("phone: a picked stop is marked", (await last.getAttribute("aria-current")) === "step");
  ok("phone: the picked stop sits below the map", lastBox.y >= mapB.y + mapB.height - 2, { lastBox: lastBox.y, mapBottom: mapB.y + mapB.height });
  ok("phone: no sideways scroll in the popup", await p.evaluate((sel) => { const e = document.querySelector(sel); return e.scrollWidth <= e.clientWidth + 1; }, body));

  // ── Wide (unchanged: map beside the list, sticky) ─────────────────────────
  await open(1280, 900);
  const mw = await box(".tour-popup-map__frame"), lw = await box(".tour-popup-stop");
  ok("wide: map beside the list, on the right", mw.x > lw.x + lw.width - 4, { mw, lw });
  ok("wide: map at its wide height", mw.height >= 300, mw.height);
  await p.screenshot({ path: "/h/shots/tour-wide.png" });

  ok("no page errors", errs.length === 0, errs.slice(0, 3));
  console.log(`pass ${pass} fail ${fail}`);
  srv.close(); await b.close(); process.exit(fail ? 1 : 0);
})().catch((e) => { console.log("ERR", e.message.slice(0, 500)); process.exit(2); });
