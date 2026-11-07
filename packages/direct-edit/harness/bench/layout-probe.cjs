// Measures what a narrow screen does to the editor, on the assembled test page: what covers what, how much page is left
// to work on, sideways overflow, tap target sizes, and field font sizes (iOS Safari zooms the page on focus below 16 px).
// Writes bench-layout.json next to the screenshots. Passes and failures here are measurements with a stated limit, not
// agreed requirements: read them with the screenshots.
const { chromium } = require("playwright-core"); const http = require("http"), fs = require("fs");
const srv = http.createServer((q, r) => { r.writeHead(200, { "content-type": "text/html" }); r.end("<!doctype html><meta charset=utf-8>" + fs.readFileSync("/h/click-through-test.html")); });
const say = (s) => console.log(s);
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; say(`${c ? "  ok  " : "FAIL"} ${n} ${x === undefined ? "" : JSON.stringify(x)}`); };

const measure = () => {
  const vis = (e) => { if (!e) return null; const s = getComputedStyle(e); if (s.display === "none" || s.visibility === "hidden") return null; const r = e.getBoundingClientRect(); return r.width && r.height ? { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), r: Math.round(r.right), b: Math.round(r.bottom) } : null; };
  const of = (s) => vis(document.querySelector(s));
  const parts = { panel: of(".de-vpanel"), tabs: of(".de-vpanel .de-tabs"), body: of(".de-vpanel .de-body"), layers: of(".de-vpanel .de-layers"), editbar: of(".de-editbar"), testTabs: of(".tt-tabs"), testActs: of("#tt-acts") };
  const over = (a, b) => (a && b ? Math.max(0, Math.min(a.r, b.r) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.b, b.b) - Math.max(a.y, b.y)) : 0);
  const pairs = {}; const names = Object.keys(parts);
  for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) {
    const a = names[i], b = names[j]; if (["tabs", "body", "layers"].includes(a) && b !== "testTabs" && b !== "testActs" && b !== "editbar") continue;
    if (a === "panel" && ["tabs", "body", "layers"].includes(b)) continue;
    const v = over(parts[a], parts[b]); if (v) pairs[`${a}/${b}`] = v;
  }
  const buttons = [...document.querySelectorAll(".de-vpanel button, .de-vpanel input, .de-vpanel select, .de-vpanel textarea, .de-editbar button, .de-menu button")].filter((e) => vis(e));
  const small = buttons.filter((e) => { const r = e.getBoundingClientRect(); return r.height < 44 || r.width < 24; });
  const fields = [...document.querySelectorAll(".de-vpanel input:not([type=checkbox]):not([type=radio]):not([type=color]), .de-vpanel select, .de-vpanel textarea")].filter((e) => vis(e));
  const sizes = fields.map((e) => parseFloat(getComputedStyle(e).fontSize));
  return {
    vw: innerWidth, vh: innerHeight, parts, overlaps: pairs,
    pageWidth: document.documentElement.scrollWidth, panelScrollWidth: document.querySelector(".de-vpanel")?.scrollWidth, panelClientWidth: document.querySelector(".de-vpanel")?.clientWidth,
    canvasLeft: parts.panel ? (parts.panel.y > 0 ? parts.panel.y : Math.min(parts.panel.x, innerWidth)) : null,
    controls: buttons.length, smallControls: small.length, smallestHeight: buttons.length ? Math.round(Math.min(...buttons.map((e) => e.getBoundingClientRect().height))) : null,
    fields: fields.length, fieldsUnder16px: sizes.filter((x) => x < 16).length, smallestFieldFont: sizes.length ? Math.min(...sizes) : null,
  };
};

(async () => {
  await new Promise((r) => srv.listen(8123, "127.0.0.1", r)); fs.mkdirSync("/h/shots", { recursive: true });
  const b = await chromium.connectOverCDP("http://127.0.0.1:9222"); const p = b.contexts()[0].pages()[0];
  p.setDefaultTimeout(12000); p.on("dialog", (d) => d.accept().catch(() => {}));
  const out = {};
  const snap = async (name) => { out[name] = await p.evaluate(measure).catch((e) => ({ error: e.message.slice(0, 200) })); await p.screenshot({ path: `/h/shots/layout-${name}.png` }).catch(() => {}); };
  await p.goto("http://127.0.0.1:8123/"); await p.waitForSelector(".de-vpanel .de-tabs"); await p.waitForTimeout(250);
  await snap("0-open");

  const m = out["0-open"]; say(`TRACE open ${JSON.stringify(m)}`);
  ok("no sideways page overflow", m.pageWidth <= m.vw, [m.pageWidth, m.vw]);
  ok("the panel does not overflow sideways", m.panelScrollWidth <= m.panelClientWidth + 1, [m.panelScrollWidth, m.panelClientWidth]);
  ok("test tabs clear of the panel's tabs", !m.overlaps["tabs/testTabs"], m.overlaps);
  ok("test tabs clear of the panel's body", !m.overlaps["body/testTabs"], m.overlaps);
  ok("test actions clear of the panel", !m.overlaps["panel/testActs"], m.overlaps);
  ok("test tabs clear of the test actions", !m.overlaps["testTabs/testActs"], m.overlaps);
  ok("edit bar clear of the panel", !m.overlaps["panel/editbar"], m.overlaps);
  const left = m.parts.panel ? (m.parts.panel.y > 0 ? m.vw * m.parts.panel.y : m.parts.panel.x * m.vh) : m.vw * m.vh;
  say(`TRACE page left to work on beside or above the panel: ${Math.round((100 * left) / (m.vw * m.vh))}% of the screen`);
  ok("at least half the screen is left for the page", left >= (m.vw * m.vh) / 2, Math.round((100 * left) / (m.vw * m.vh)));
  ok("panel controls at least 44 px tall", m.smallControls === 0, { small: m.smallControls, of: m.controls, smallest: m.smallestHeight });
  ok("fields at 16 px or more (iOS Safari zooms below that)", m.fieldsUnder16px === 0, { under: m.fieldsUnder16px, of: m.fields, smallest: m.smallestFieldFont });

  // The panel's last control must be reachable: scrolled to its end, is it what lies under the finger?
  const hero = p.locator('#stage [data-tree-node="hero"]'); await hero.scrollIntoViewIfNeeded(); await p.waitForTimeout(80);
  const hb = await hero.boundingBox(); await p.mouse.click(hb.x + hb.width / 2, hb.y + Math.min(hb.height * 0.3, 60)); await p.waitForTimeout(150);
  await snap("1-hero");
  const head = await p.$eval(".de-vpanel .de-head b", (e) => e.textContent).catch(() => null);
  ok("a tap on the hero selects it", head === "Hero banner", head);
  const end = await p.evaluate(() => {
    const body = document.querySelector(".de-vpanel .de-body"); if (!body) return null; body.scrollTop = body.scrollHeight;
    const list = [...body.querySelectorAll("button, input, select, textarea")].filter((e) => e.getClientRects().length); const last = list[list.length - 1]; if (!last) return null; const r = last.getBoundingClientRect();
    const at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { last: last.dataset?.f ?? last.tagName, under: at === last || last.contains(at), covering: at ? (at.closest("[class]")?.className ?? at.tagName) : null, y: Math.round(r.top), vh: innerHeight };
  });
  await p.waitForTimeout(80); await snap("2-panel-end");
  ok("the panel's last control can be reached", !!end && end.under, end);
  await p.evaluate(() => { const b = document.querySelector(".de-vpanel .de-body"); if (b) b.scrollTop = 0; });

  // The focused field against the on-screen keyboard: no browser here draws one, so this states the room only.
  await p.locator('.de-vpanel [data-f="p-title"]').first().tap().catch(() => {}); await p.waitForTimeout(120); await snap("3-field-focus");
  const focus = await p.evaluate(() => { const a = document.activeElement; const r = a?.getBoundingClientRect(); return a ? { tag: a.tagName, f: a.dataset?.f, top: Math.round(r.top), bottom: Math.round(r.bottom), vh: innerHeight, visualViewport: Math.round(window.visualViewport?.height ?? 0) } : null; });
  say(`TRACE focused field ${JSON.stringify(focus)}`);
  ok("a tap on Title focuses it", focus?.f === "p-title", focus);

  fs.writeFileSync("/h/shots/bench-layout.json", JSON.stringify(out, null, 1));
  say(`pass ${pass} fail ${fail}`); srv.close(); await b.close(); process.exit(fail ? 1 : 0);
})().catch((e) => { say(`ERR ${e.message.slice(0, 400)} ${(e.stack || "").split("\n").find((l) => l.includes("layout-probe")) ?? ""}`); process.exit(2); });
