// Drives the Fields lens on a page drawn with edit marks, in headless Chromium. Every save is a recorded call, never a write.
const { chromium } = require("playwright-core");
let pass = 0, fail = 0;
const check = (name, cond, extra = "") => { cond ? pass++ : fail++; console.log(`${cond ? "ok  " : "FAIL"} ${name}${extra ? "  -> " + extra : ""}`); };
(async () => {
  const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
  const ctx = browser.contexts()[0] || (await browser.newContext());
  const page = await ctx.newPage();
  await page.setViewportSize({ width: 1280, height: 1000 });
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + String(e.message).slice(0, 300)));
  page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text().slice(0, 300)); });
  await page.goto("file:///t/site/index.html");
  await page.waitForSelector(".fl-bar", { timeout: 20000 });
  check("the bar appears because the lens found fields in the blocks", (await page.locator(".fl-bar__toggle").textContent()).trim() === "Edit wording");
  const fieldsAttr = await page.$$eval("[data-field]", (els) => els.map((e) => e.getAttribute("data-field")));
  check("the blocks' own parts carry C4 ids", fieldsAttr.includes("block:home:h-1:title") && fieldsAttr.includes("block:home:c-typed:body") && fieldsAttr.includes("block:home:c-typed:title"), fieldsAttr.join(" "));
  check("a value a record fills carries the record's id instead", fieldsAttr.includes("record:thread:abc123:title") && !fieldsAttr.includes("block:home:c-rec:title"));
  check("without the lens on, nothing is underlined or clickable", (await page.$$eval("[data-fields-ok]", (e) => e.length)) > 0 && (await page.evaluate(() => document.body.hasAttribute("data-fields-lens"))) === false);
  await page.click(".fl-bar__toggle");
  const calls = () => page.evaluate(() => window.__calls);

  // 1. a block's own verbatim title, typed in place
  const hero = page.locator('[data-field="block:home:h-1:title"]');
  await hero.click();
  check("a title that the block draws verbatim is typed in place", (await hero.getAttribute("contenteditable")) !== null);
  await page.keyboard.press("Control+A");
  await page.keyboard.type("Hero, changed");
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.__calls.some((c) => c.op === "save"));
  let c = await calls();
  const s1 = c.find((x) => x.op === "save");
  check("Enter saves one field of the block, by the block's id, with the version the lens loaded", s1 && s1.kind === "block" && s1.id === "home:h-1" && JSON.stringify(s1.values) === JSON.stringify({ title: "Hero, changed" }) && s1.version === "v1", JSON.stringify(s1));
  check("the page shows the typed words, in the look the block has", (await hero.textContent()) === "Hero, changed" && (await hero.evaluate((e) => getComputedStyle(e).color)) === "rgb(224, 178, 60)");

  // 2. a card's title that is the post's own: the record is what changes, and the page says so
  const rec = page.locator('[data-field="record:thread:abc123:title"]');
  await rec.click();
  await page.waitForSelector(".fl-bar__note");
  check("a title that is a record's says so before anything is typed", /post itself, everywhere it appears/.test(await page.locator(".fl-bar__note").textContent()));
  await page.keyboard.press("Control+A");
  await page.keyboard.type("A better post title");
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.__calls.filter((c) => c.op === "save").length >= 2);
  c = await calls();
  const s2 = c.filter((x) => x.op === "save")[1];
  check("it saves to the record (kind thread), never to the card", s2.kind === "thread" && s2.id === "abc123" && JSON.stringify(s2.values) === JSON.stringify({ title: "A better post title" }), JSON.stringify(s2));
  check("no step was sent for the card's own title", !c.some((x) => x.op === "save" && x.kind === "block" && x.id === "home:c-rec"));

  // 3. a longer text opens the panel for the whole block
  await page.locator('[data-field="block:home:c-typed:body"]').click();
  await page.waitForSelector(".fl-panel");
  check("a longer text opens the block's panel, named from the block's declaration", (await page.locator(".fl-panel h2").textContent()) === "Card on this page");
  const labels = await page.$$eval(".fl-field__label", (e) => e.map((x) => x.textContent.trim()));
  check("the panel lists the block's typed settings", labels.includes("Title") && labels.includes("Words"), labels.join(","));
  check("and focuses the one that was clicked", await page.evaluate(() => document.activeElement && document.activeElement.getAttribute("data-fl-input") === "body"));
  await page.locator('[data-fl-input="body"]').fill("New body words");
  await page.click(".fl-btn--primary");
  await page.waitForFunction(() => window.__calls.filter((c) => c.op === "save").length >= 3);
  c = await calls();
  const s3 = c.filter((x) => x.op === "save")[2];
  check("Save sends only what changed", s3.kind === "block" && s3.id === "home:c-typed" && JSON.stringify(s3.values) === JSON.stringify({ body: "New body words" }), JSON.stringify(s3));
  check("the lens says it was saved (a longer text follows on the page after the host refreshes it)", (await page.locator(".fl-bar__note").textContent()).trim() === "Saved");
  await page.click(".fl-x");

  // 4. a summary a record fills cannot be typed over
  await page.locator('[data-field="record:thread:abc123:excerpt"]').click();
  await page.waitForSelector(".fl-panel");
  check("a value the record makes opens the record's panel with the shared line", /post itself, everywhere it appears/.test(await page.locator(".fl-msg--shared").textContent()));
  check("and its summary is read only, with the reason", (await page.locator('[data-fl-input="excerpt"]').isDisabled()) && /made from the post's own text/.test(await page.locator(".fl-panel").textContent()));
  check("no extra writes happened", (await calls()).filter((x) => x.op === "save").length === 3);
  await page.screenshot({ path: "/t/shots/record-panel.png" });
  check("no console or page errors", errors.length === 0, errors.join(" | "));
  console.log(`\n${pass} passed, ${fail} failed`);
  await page.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log("FAIL harness error", String(e).slice(0, 600)); process.exit(1); });
