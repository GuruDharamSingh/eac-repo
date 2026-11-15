// Numbered steps in Puck Studio (2026-11-14): a step's "Words under it" is Puck's rich-text field, not a textarea of
// raw HTML, and what is typed there is stored as HTML. On frankenstein's entry-popup bundle (Para Theater's real
// puckConfig, the /try seed with `try-steps`). Run (from packages/direct-edit/harness):
//   W=<scratch> bash frankenstein/run.sh frankenstein/entry-popup.tsx:fkp.js -- drive-steps.cjs
const { chromium } = require("playwright-core");
const fs = require("fs");
const { serve } = require("./serve.cjs");
const page = `<!doctype html><meta charset=utf-8><link rel=stylesheet href=/site.css><link rel=stylesheet href=/fkp.css><body><div id="host"></div><script src=/fkp.js></script>`;
let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => { cond ? pass++ : fail++; console.log(`${cond ? "pass" : "  FAIL"} ${name}${extra ? "  " + extra : ""}`); };

(async () => {
  const srv = await serve("/h", page); fs.mkdirSync("/h/shots", { recursive: true });
  const b = await chromium.connectOverCDP("http://127.0.0.1:9222"); const p = b.contexts()[0].pages()[0];
  p.setDefaultTimeout(9000); await p.setViewportSize({ width: 1500, height: 950 });
  const errs = []; p.on("pageerror", (e) => errs.push((e.stack || e.message).slice(0, 300)));
  await p.goto("http://127.0.0.1:8123/", { waitUntil: "domcontentloaded", timeout: 60000 });
  const frameEl = await p.waitForSelector("iframe", { timeout: 20000 }); const f = await frameEl.contentFrame();
  const STEPS = '[data-puck-component="try-steps"]';
  await f.waitForSelector(STEPS, { timeout: 20000 }); await p.waitForTimeout(1500);
  const item = (id) => p.evaluate((id) => globalThis.__getPuck().getItemById(id)?.props ?? null, id);
  const before = await item("try-steps");

  // Select the block (a click on its heading), then open its first row in the right column.
  const h2 = f.locator(`${STEPS} h2`).first(); await h2.scrollIntoViewIfNeeded(); const bb = await h2.boundingBox();
  await p.mouse.click(bb.x + 20, bb.y + 8); await p.waitForTimeout(700);
  ok("the block is selected", (await p.evaluate(() => globalThis.__getPuck().selectedItem?.props?.id)) === "try-steps");
  const row = p.locator("body *:not(iframe)", { hasText: /^Open the room$/ }).last();
  ok("its first row is listed by its title", (await row.count()) > 0);
  await row.click(); await p.waitForTimeout(700);
  const raw = await p.evaluate(() => [...document.querySelectorAll("textarea")].map((t) => t.value).filter((v) => /<p>/.test(v)));
  ok("no textarea shows the stored HTML", raw.length === 0, JSON.stringify(raw).slice(0, 120));
  const editor = p.locator('[contenteditable="true"]:visible', { hasText: "Use the button below" }).first();
  ok("the row's words are in a rich-text editor, drawn as text", (await editor.count()) === 1);
  if (!(await editor.count())) console.log("  panel:", JSON.stringify(await p.evaluate(() => ({
    ce: [...document.querySelectorAll('[contenteditable]')].map((e) => e.getAttribute("contenteditable") + ":" + e.className.slice(0, 40) + ":" + e.textContent.slice(0, 40)),
    ta: [...document.querySelectorAll("textarea")].map((t) => t.value.slice(0, 40)),
    inputs: [...document.querySelectorAll("input")].map((i) => i.value).filter(Boolean).slice(0, 12),
    words: (() => { const l = [...document.querySelectorAll("label, div, span")].find((e) => e.childElementCount === 0 && /Words under it/.test(e.textContent)); let x = l; for (let i = 0; i < 4 && x; i++) x = x.parentElement; return x ? x.outerHTML.slice(0, 900) : null; })(),
  }))));
  await p.screenshot({ path: "/h/shots/steps-field.png", timeout: 4000 }).catch(() => {});
  if (await editor.count()) {
    const html = await editor.innerHTML();
    ok("…as a paragraph, not as tags", /<p[ >]/.test(html) && !/&lt;p&gt;/.test(html), html.slice(0, 120));
    await editor.click(); await p.keyboard.press("End"); await p.keyboard.type(" Then wait.", { delay: 15 }); await p.waitForTimeout(900);
    const after = await item("try-steps");
    const text = after?.steps?.[0]?.text ?? "";
    ok("typing stores HTML in the row", /^<p>Use the button below\. Allow your camera when asked\. Then wait\.<\/p>$/.test(text), JSON.stringify(text));
    ok("the other rows are untouched", JSON.stringify(after.steps.slice(1)) === JSON.stringify(before.steps.slice(1)));
    ok("the row's title is still a plain text field", (await p.locator('input[value="Open the room"]').count()) >= 1);
  }
  ok("no page errors", errs.length === 0, errs.slice(0, 3).join(" | "));
  console.log(`\n${pass} passed, ${fail} failed`);
  srv.close(); await b.close().catch(() => {}); process.exit(0);
})().catch((e) => { console.log("CRASH", e.stack || e.message); console.log(`\n${pass} passed, ${fail + 1} failed`); process.exit(1); });
