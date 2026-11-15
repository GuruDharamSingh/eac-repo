// The Site Builder card pop-up (2026-11-14, hand-test #6): opened from a card at the foot of a long page, the pop-up
// is inside the window (not at the top of the document); a template row has no View; an ordinary page keeps it.
// Run: W=<scratch> bash run.sh frankenstein/entry-hubpop.tsx:fkh.js -- drive-hubpop.cjs
const { chromium } = require("playwright-core");
const { serve } = require("./serve.cjs");
const page = `<!doctype html><meta charset=utf-8><link rel=stylesheet href=/fkh.css><body style="margin:0"><div id="host"></div><script src=/fkh.js></script>`;
let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => { cond ? pass++ : fail++; console.log(`${cond ? "pass" : "  FAIL"} ${name}${extra ? "  " + extra : ""}`); };
(async () => {
  const srv = await serve("/h", page);
  const b = await chromium.connectOverCDP("http://127.0.0.1:9222"); const p = b.contexts()[0].pages()[0];
  p.setDefaultTimeout(9000);
  const errs = []; p.on("pageerror", (e) => errs.push((e.stack || e.message).slice(0, 300)));
  for (const [w, hgt] of [[1440, 900], [390, 844]]) {
    await p.setViewportSize({ width: w, height: hgt });
    await p.goto("http://127.0.0.1:8123/", { waitUntil: "domcontentloaded" });
    await p.waitForSelector("#cards button, #cards [role=button]", { timeout: 20000 });
    const face = p.locator("#cards").getByText(/Site/).first();
    await face.scrollIntoViewIfNeeded(); await p.waitForTimeout(200);
    const scrolled = await p.evaluate(() => scrollY);
    await face.click(); await p.waitForTimeout(500);
    const pop = p.locator(".hc-popup").first();
    ok(`${w}px: the pop-up opens`, (await pop.count()) === 1);
    const r = await pop.evaluate((e) => { const b = e.getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom), h: innerHeight, pos: getComputedStyle(e).position, scrollY }; });
    ok(`${w}px: it is inside the window, not at the top of the document`, r.pos === "fixed" && r.top >= 0 && r.top < r.h && r.bottom <= r.h + 1, JSON.stringify({ ...r, scrolledTo: scrolled }));
    ok(`${w}px: the page did not jump`, Math.abs(r.scrollY - scrolled) < 2, `${scrolled} → ${r.scrollY}`);
    const rows = await p.evaluate(() => [...document.querySelectorAll(".hc-popup .hc-row")].map((row) => ({ t: row.textContent.replace(/\s+/g, " ").trim().slice(0, 40), view: !!row.querySelector('a[aria-label^="View "]'), href: row.querySelector('a[aria-label^="View "]')?.getAttribute("href") ?? null })));
    const tpl = rows.find((x) => /Event page layout/.test(x.t)), vis = rows.find((x) => /Visiting/.test(x.t));
    ok(`${w}px: the template row (event-detail) has no View`, !!tpl && !tpl.view, JSON.stringify(tpl));
    ok(`${w}px: an ordinary page keeps View → /visiting`, !!vis && vis.href === "/visiting", JSON.stringify(vis));
    if (w === 1440) await p.screenshot({ path: "/h/shots/hubpop-1440.png" }).catch(() => {});
  }
  ok("no page errors", errs.length === 0, errs.slice(0, 3).join(" | "));
  console.log(`\nhubpop ${pass}/${pass + fail}`);
  srv.close(); process.exit(0);
})().catch((e) => { console.log("CRASH", e.stack || e.message); console.log(`\nhubpop ${pass}/${pass + fail + 1}`); process.exit(1); });
