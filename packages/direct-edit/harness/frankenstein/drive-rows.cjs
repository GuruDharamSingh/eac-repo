// The shared row rich text (round 2, 2026-11-14): with buildEditorConfig's default and no host override, a rows
// prop's rich-text column is Puck's formatted field; opening and publishing changes no stored value; typing stores
// HTML; plain columns keep their plain fields. Run: W=<scratch> bash run.sh frankenstein/entry-rows.tsx:fkr.js -- drive-rows.cjs
const { chromium } = require("playwright-core");
const fs = require("fs");
const { serve } = require("./serve.cjs");
const page = `<!doctype html><meta charset=utf-8><link rel=stylesheet href=/site.css><link rel=stylesheet href=/fkr.css><body><div id="host"></div><script src=/fkr.js></script>`;
let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => { cond ? pass++ : fail++; console.log(`${cond ? "pass" : "  FAIL"} ${name}${extra ? "  " + extra : ""}`); };

(async () => {
  const srv = await serve("/h", page);
  const b = await chromium.connectOverCDP("http://127.0.0.1:9222"); const p = b.contexts()[0].pages()[0];
  p.setDefaultTimeout(9000); await p.setViewportSize({ width: 1500, height: 950 });
  const errs = []; p.on("pageerror", (e) => errs.push((e.stack || e.message).slice(0, 300)));
  await p.goto("http://127.0.0.1:8123/", { waitUntil: "domcontentloaded", timeout: 60000 });
  const frameEl = await p.waitForSelector("iframe", { timeout: 20000 }); const f = await frameEl.contentFrame();
  const STEPS = '[data-puck-component="try-steps"]';
  await f.waitForSelector(STEPS, { timeout: 20000 }); await p.waitForTimeout(1500);
  const item = (id) => p.evaluate((id) => globalThis.__getPuck().getItemById(id)?.props ?? null, id);
  const seedSteps = await p.evaluate(() => globalThis.__seed.content.find((n) => n.props.id === "try-steps").props.steps);
  const publish = async () => { await p.locator("header").getByText("Publish", { exact: true }).click(); await p.waitForTimeout(1200); return p.evaluate(() => globalThis.__published); };
  const stepsOf = (doc) => doc?.content?.find((n) => n.props.id === "try-steps")?.props?.steps;

  const af = await p.evaluate(() => Object.fromEntries(Object.entries(globalThis.__arrayFields ?? {}).map(([k, v]) => [k, v.type])));
  ok("config: the rich-text column is a custom field, the title column untouched", af.text === "custom" && af.title !== "custom", JSON.stringify(af));
  ok("the canvas draws the row's HTML as markup", (await f.locator(`${STEPS} li strong`).count()) >= 1);

  // A. Open and publish, nothing typed: byte-equal rows.
  let pub = await publish();
  ok("publish without edits: rows byte-equal to the seed", JSON.stringify(stepsOf(pub)) === JSON.stringify(seedSteps), JSON.stringify(stepsOf(pub)).slice(0, 200));

  // B. Open a row: a rich editor, no raw-HTML textarea, and opening it changes nothing.
  const h2 = f.locator(`${STEPS} h2`).first(); await h2.scrollIntoViewIfNeeded(); const bb = await h2.boundingBox();
  await p.mouse.click(bb.x + 20, bb.y + 8); await p.waitForTimeout(700);
  const rowB = p.locator("body *:not(iframe)", { hasText: /^Read before we meet$/ }).last();
  await rowB.click(); await p.waitForTimeout(900);
  const raw = await p.evaluate(() => [...document.querySelectorAll("textarea")].map((t) => t.value).filter((v) => /<p>/.test(v)));
  ok("no textarea shows the stored HTML", raw.length === 0, JSON.stringify(raw).slice(0, 120));
  const editor = p.locator('[contenteditable="true"]:visible', { hasText: "Second paragraph" }).first();
  ok("the row's words are in a rich-text editor", (await editor.count()) === 1);
  ok("…with the bold kept as bold", (await editor.locator("strong").count()) === 1);
  ok("opening the row changed no stored value", JSON.stringify((await item("try-steps")).steps) === JSON.stringify(seedSteps));
  pub = await publish();
  ok("publish after opening: still byte-equal", JSON.stringify(stepsOf(pub)) === JSON.stringify(seedSteps));
  ok("the title column is still a plain text input", (await p.locator('input[value="Read before we meet"]').count()) >= 1);

  // C. Type: HTML is stored, as a string, in that row only.
  if (await editor.count()) {
    await editor.locator("p").last().click(); await p.keyboard.press("End"); await p.keyboard.type(" More.", { delay: 15 }); await p.waitForTimeout(900);
    const after = (await item("try-steps")).steps;
    ok("typing stores HTML in the row", typeof after[1].text === "string" && /Second paragraph\. More\.<\/p>$/.test(after[1].text) && /<strong>listed<\/strong>/.test(after[1].text), JSON.stringify(after[1].text));
    ok("the other rows are untouched", JSON.stringify([after[0], after[2]]) === JSON.stringify([seedSteps[0], seedSteps[2]]));
    pub = await publish();
    ok("published row holds the typed HTML", stepsOf(pub)?.[1]?.text === after[1].text);
  }
  ok("no page errors", errs.length === 0, errs.slice(0, 3).join(" | "));
  console.log(`\nrows ${pass}/${pass + fail}`);
  srv.close(); process.exit(0);
})().catch((e) => { console.log("CRASH", e.stack || e.message); console.log(`\nrows ${pass}/${pass + fail + 1}`); process.exit(1); });
