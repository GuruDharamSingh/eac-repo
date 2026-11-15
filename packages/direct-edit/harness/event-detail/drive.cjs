// Drives Para Theater's event detail, services and writing blocks on the canvas editor (2026-11-14, editing landscape
// round 1, docs/open/EDITING_LANDSCAPE_2026-11-12/ROUND1.md "fc"). Run (from packages/direct-edit/harness):
//   ALIAS='{"@/lib/puck/service-actions":"/app/packages/direct-edit/harness/event-detail/service-actions-stub.ts"}' \
//   W=<scratch> bash frankenstein/run.sh event-detail/entry.tsx:ed.js -- event-detail/drive.cjs
// (run.sh copies frankenstein's *.cjs into $W/h; copy this folder's drive.cjs there too, or pass its /h path.)
const { chromium } = require("playwright-core");
const fs = require("fs");
const { serve } = require("./serve.cjs");
const page = `<!doctype html><meta charset=utf-8><link rel=stylesheet href=/site.css><link rel=stylesheet href=/ed.css><body><main><div id="host"></div></main><script src=/ed.js></script>`;
let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => { cond ? pass++ : fail++; console.log(`${cond ? "pass" : "  FAIL"} ${name}${extra ? "  " + extra : ""}`); };
const BLOCKS = ["pt-event-header", "pt-event-about", "pt-talk-room", "pt-event-rsvp", "pt-event-materials", "pt-offering-card", "pt-services", "pt-service", "pt-booking", "pt-journal", "pt-article", "pt-series-nav", "pt-notice"];
// Parts drawn only in a state the documents do not reach: the call opens on a click (a live iframe).
const STATE_ONLY = new Set(["pt-offering-card.call", "pt-article.colophon"]);

(async () => {
  const srv = await serve("/h", page); fs.mkdirSync("/h/shots", { recursive: true });
  const b = await chromium.connectOverCDP("http://127.0.0.1:9222"); const p = b.contexts()[0].pages()[0];
  p.setDefaultTimeout(8000); await p.setViewportSize({ width: 1440, height: 1000 });
  const errs = []; p.on("pageerror", (e) => errs.push((e.stack || e.message).slice(0, 300)));
  p.on("console", (m) => { if (m.type() === "error" && !/ERR_|404|Failed to load resource/.test(m.text())) errs.push("console: " + m.text().slice(0, 200)); });
  p.on("dialog", (d) => d.accept());
  const open = async (qs) => {
    await p.goto(`http://127.0.0.1:8123/?${qs}`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await p.waitForFunction(() => globalThis.__ready === true, null, { timeout: 30000 });
    await p.waitForTimeout(qs.includes("published") ? 800 : 1500);
  };

  // ── A. The contract: every block has parts; names and props are sound ─────────────────────────────────────
  await open("doc=a");
  const contract = await p.evaluate(() => globalThis.__contract);
  for (const t of BLOCKS) {
    const c = contract[t];
    const parts = Object.entries(c?.parts ?? {});
    const props = new Map((c?.props ?? []).map((x) => [x.name, x.kind]));
    ok(`${t}: declares parts (${parts.length}) with a root`, parts.length >= 3 && !!c.parts.root);
    ok(`${t}: no part is named like a prop`, parts.every(([name]) => !props.has(name)), parts.filter(([n]) => props.has(n)).map(([n]) => n).join(","));
    ok(`${t}: one complex selector each`, parts.every(([, d]) => d.sel && !/[,{};<]/.test(d.sel)));
    const wordParts = parts.filter(([, d]) => d.prop);
    ok(`${t}: word parts name text props of the block (${wordParts.map(([n, d]) => `${n}=${d.prop}`).join(" ") || "none"})`,
      wordParts.every(([, d]) => ["string", "text", "richtext"].includes(props.get(d.prop))));
  }
  // Data words are never marked: these parts draw the record's own words.
  const DATA = { "pt-event-header": ["title", "excerpt", "kicker"], "pt-service": ["title", "summary", "price", "body"], "pt-article": ["title", "lede", "body"], "pt-offering-card": ["title", "blurb"], "pt-series-nav": ["seriesName"] };
  ok("record words (titles, summaries, bodies) carry no prop", Object.entries(DATA).every(([t, names]) => names.every((n) => contract[t].parts[n] && !contract[t].parts[n].prop)));

  // ── B. Every part's selector reaches what is drawn: canvas and published, both documents ──────────────────
  // A `size` look on every part (10px + its index); each element a part's compiled rule matches must draw that size.
  const drawnSomewhere = new Map();
  for (const [doc, view] of [["a", "canvas"], ["b", "canvas"], ["a", "published"], ["b", "published"]]) {
    await open(`doc=${doc}&looks=1${view === "published" ? "&view=published" : ""}`);
    const r = await p.evaluate((BLOCKS) => {
      const C = globalThis.__contract, size = globalThis.__sizeOf;
      // Nodes that carry looks, in document order: the order of the morph markers on the page.
      const order = []; const walk = (l) => (l || []).forEach((n) => { if (n.props.morph) order.push(n); Object.values(n.props).forEach((v) => Array.isArray(v) && v.length && v[0] && v[0].type && walk(v)); });
      walk(globalThis.__doc.content);
      const marks = [...document.querySelectorAll("#host template[data-morph]")];
      const out = { marks: marks.length, nodes: order.length, rows: [], wrong: [] };
      marks.forEach((tpl, i) => {
        const node = order[i]; if (!node || !BLOCKS.includes(node.type)) return;
        const parts = C[node.type].parts; const rootSel = parts.root.sel.replace(/^>\s*/, "");
        const scope = `template[data-morph="${tpl.dataset.morph}"]`;
        for (const [name, d] of Object.entries(parts)) {
          const tail = name === "root" ? rootSel : d.sel.startsWith(">") ? d.sel.replace(/^>\s*/, "") : `${rootSel} ${d.sel}`;
          const els = [...tpl.parentElement.querySelectorAll(`:scope > ${scope} + ${tail}`)];
          const want = `${size(node.type, name)}px`;
          const bad = els.filter((e) => getComputedStyle(e).fontSize !== want);
          out.rows.push({ id: node.props.id, type: node.type, part: name, n: els.length });
          if (bad.length) out.wrong.push(`${node.props.id}.${name}: ${bad.length}/${els.length} not ${want} (${getComputedStyle(bad[0]).fontSize})`);
        }
      });
      return out;
    }, BLOCKS);
    ok(`${doc}/${view}: one morph marker per node with looks (${r.marks}/${r.nodes})`, r.marks === r.nodes);
    ok(`${doc}/${view}: every matched element draws its part's look (${r.rows.reduce((s, x) => s + x.n, 0)} elements)`, r.wrong.length === 0, r.wrong.slice(0, 6).join(" | "));
    for (const row of r.rows) if (row.n > 0) drawnSomewhere.set(`${row.type}.${row.part}`, (drawnSomewhere.get(`${row.type}.${row.part}`) ?? 0) + row.n);
    if (doc === "a") await p.screenshot({ path: `/h/shots/ed-${doc}-${view}-looks.png`, fullPage: true, timeout: 4000 }).catch(() => {});
  }
  const declared = BLOCKS.flatMap((t) => Object.keys(contract[t].parts).map((n) => `${t}.${n}`));
  const never = declared.filter((k) => !drawnSomewhere.has(k) && !STATE_ONLY.has(k));
  ok(`every declared part is drawn by one of the documents (${declared.length - never.length - [...STATE_ONLY].filter((k) => !drawnSomewhere.has(k)).length}/${declared.length}; state-only: ${[...STATE_ONLY].join(", ")})`, never.length === 0, never.join(", "));

  // ── C. A visitor's page without looks: nothing of the editor or of morph is drawn ─────────────────────────
  for (const doc of ["a", "b"]) {
    await open(`doc=${doc}&view=published`);
    const html = await p.locator("#host").innerHTML();
    ok(`${doc}/published, no looks: no morph marker, style or editor attribute`, !/data-morph|<style|data-tree-|data-edit-skip|de-tree/.test(html), (html.match(/data-morph|<style|data-tree-|data-edit-skip|de-tree/) || [])[0]);
  }
  await open("doc=a&view=published");
  const roots = await p.evaluate(() => ({
    header: !!document.querySelector("#host header h1"),
    offer: !!document.querySelector("#host section.pt-offer-section article.pt-offer-card"),
    shelf: !!document.querySelector("#host section.eac-shelf"),
    nav: !!document.querySelector("#host nav.card-natural"),
  }));
  ok("published draws the same roots the parts name (header, offer section, shelf, series nav)", Object.values(roots).every(Boolean), JSON.stringify(roots));

  // ── D. Words typed in place in the block popup; the record's words stay locked ────────────────────────────
  await open("doc=a");
  const S = ".de-popup .de-popup-stage";
  const node = (id) => p.evaluate((id) => { let f = null; const w = (l) => (l || []).forEach((n) => { if (n.props.id === id) f = n.props; Object.values(n.props).forEach((v) => Array.isArray(v) && v.length && v[0] && v[0].type && w(v)); }); w(globalThis.__editor.doc().content); return f; }, id);
  // Closes whatever popup is open: Esc (out of a part, then the popup), and Discard if it asks.
  const closePopup = async () => {
    for (let i = 0; i < 4 && (await p.locator(".de-popup").count()); i++) {
      if (await p.locator('.de-popup [data-ask="discard"]').isVisible().catch(() => false)) await p.locator('.de-popup [data-ask="discard"]').click().catch(() => {});
      else await p.keyboard.press("Escape");
      await p.waitForTimeout(300);
    }
  };
  const openLarge = async (id) => {
    await closePopup();
    await p.evaluate((id) => globalThis.__editor.openLarge(id), id);
    await p.waitForSelector(`${S} [data-tree-node="${id}"]`, { timeout: 6000 }); await p.waitForTimeout(500);
  };
  // False when the element is not drawn in the popup (reported by the caller).
  const stageDbl = async (sel) => {
    const el = p.locator(`${S} ${sel}`).first();
    if (!(await el.count())) { console.log(`  (not in the popup: ${sel}; stage holds ${JSON.stringify(await p.evaluate((S) => [...document.querySelectorAll(`${S} [data-tree-node]`)].map((e) => e.dataset.treeNode + ":" + e.tagName), S))})`); return false; }
    await el.scrollIntoViewIfNeeded(); const bb = await el.boundingBox();
    await p.mouse.dblclick(bb.x + Math.min(bb.width / 2, 40), bb.y + Math.min(bb.height / 2, 12)); await p.waitForTimeout(500);
    return true;
  };
  const typeAll = async (text) => { await p.keyboard.press("Control+a"); await p.keyboard.type(text, { delay: 15 }); await p.keyboard.press("Enter"); await p.waitForTimeout(400); };
  const use = async () => { await p.locator(".de-popup button:visible", { hasText: "Use on this page" }).first().click(); await p.waitForTimeout(800); };
  const editable = () => p.locator(`${S} [contenteditable="true"]`).count();
  const typed = [
    ["ev-about", "section > h2", "heading", "Before you come"],
    ["ev-room", "section > p.max-w-2xl", "note", "Cameras on, please."],
    ["ev-mat", "section > h2", "heading", "Read first"],
    ["offer", ".pt-offer-eyebrow", "eyebrow", "Free and online"],
    ["offer", ".pt-offer-heading", "heading", "This season"],
    ["svc-cards", "section > p.mt-2", "intro", "Choose one below."],
    ["svc-book", "section > h2", "heading", "Reserve a place"],
    ["journal", ".eac-shelf__heading", "heading", "From the lab"],
    ["series", "nav > p", "heading", "Also in this series"],
    ["notice", "aside > h3", "title", "Recorded"],
  ];
  for (const [id, sel, prop, text] of typed) {
    await openLarge(id);
    const drawn = await stageDbl(sel);
    const ce = await editable();
    if (!drawn || ce !== 1) { ok(`${id}.${prop}: double-click starts typing in place`, false, `${drawn ? ce : "not drawn"} editable`); await closePopup(); continue; }
    await typeAll(text); await use();
    ok(`${id}.${prop}: typed in place and handed back`, (await node(id))?.[prop] === text, JSON.stringify((await node(id))?.[prop]));
  }
  // A repeated button whose words are the block's own: typing in one card sets the label every card draws.
  await openLarge("svc-cards"); await stageDbl("div.grid > article a"); await typeAll("Book this"); await use();
  ok("svc-cards.chooseLabel typed through one card's button", (await node("svc-cards"))?.chooseLabel === "Book this");
  ok("…and every card draws it", (await p.locator('[data-tree-node="svc-cards"] div.grid > article a').allInnerTexts()).every((t) => t.trim() === "Book this"));
  // Rich words: the notice's body.
  await openLarge("notice"); await stageDbl("aside > div"); const ceBody = await editable();
  if (ceBody === 1) { await typeAll("Kept for members"); await use(); }
  ok("notice.body typed in place, stored as a paragraph", ceBody === 1 && /^<p>Kept for members<\/p>$/.test((await node("notice"))?.body ?? ""), JSON.stringify((await node("notice"))?.body));
  // The record's own words stay locked.
  for (const [id, sel, what] of [["ev-head", "header h1", "gathering's title"], ["svc-one", "article h2", "service's name"], ["article", ".eac-article__title", "piece's title"], ["offer", ".pt-offer-title", "offering's title"]]) {
    await openLarge(id); const drawn = await stageDbl(sel);
    ok(`${id}: the ${what} is drawn and not typed in place`, drawn && (await editable()) === 0);
    await closePopup();
  }
  ok("popup closed at the end of D", (await p.locator(".de-popup").count()) === 0);
  await p.screenshot({ path: "/h/shots/ed-typed.png", fullPage: true , timeout: 4000 }).catch(() => {});

  // ── E. From what? for a service ───────────────────────────────────────────────────────────────────────────
  await open("doc=a");
  const panel = ".de-vpanel";
  const text = async (id) => (await p.locator(`[data-tree-node="${id}"]`).first().innerText()).replace(/\s+/g, " ").trim();
  const calls = () => p.evaluate(() => ({ ...globalThis.__svcCalls }));
  const select = async (id) => { await p.evaluate((id) => globalThis.__editor.select(id), id); await p.waitForTimeout(300); };
  ok("an unchosen service draws the page's own row (the visitor's choice, else the newest), not the example", /Live Lab \(the newest\)/.test(await text("svc-one")), (await text("svc-one")).slice(0, 80));
  ok("…and the booking block too", /Live Lab \(the newest\)/.test(await text("svc-book")), (await text("svc-book")).slice(0, 80));
  await select("svc-one");
  ok("Service is a chooser, not a text box", (await p.locator(`${panel} [data-f="bind-service"]`).count()) === 1 && (await p.locator(`${panel} #de-p-service`).count()) === 0);
  ok("says nothing is chosen", /Not chosen yet/.test(await p.locator(`${panel} [data-f="bind-service"]`).innerText()));
  await p.click(`${panel} [data-f="bind-open-service"]`); await p.waitForSelector('.de-vdrawer [data-rec-source="services"]');
  ok("drawer is titled Service and asks From what?", /Service/.test(await p.locator(".de-vdrawer").innerText()) && /From what\?/.test(await p.locator(".de-vdrawer").innerText()));
  await p.click('.de-vdrawer [data-rec-source="services"]'); await p.waitForSelector('.de-vdrawer [data-rec-value="voice-and-breath"]');
  ok("lists this site's services with price and state", /Mask Work Intensive/.test(await p.locator(".de-vdrawer").innerText()) && /waitlist/.test(await p.locator(".de-vdrawer").innerText()));
  await p.click('.de-vdrawer [data-rec-value="voice-and-breath"]'); await p.waitForTimeout(500);
  ok("block draws the chosen service", /Voice and Breath/.test(await text("svc-one")), (await text("svc-one")).slice(0, 80));
  ok("panel names it and its price", /Voice and Breath · CA\$60/.test(await p.locator(`${panel} [data-f="bind-service"]`).innerText()), await p.locator(`${panel} [data-f="bind-service"]`).innerText());
  ok("stored: the slug only", (await node("svc-one"))?.service === "voice-and-breath" && !("chosen" in (await node("svc-one"))));
  ok("one draw fetch", (await calls()).draw === 1, JSON.stringify(await calls()));
  await p.click('[data-a="undo"]'); await p.waitForTimeout(400);
  ok("undo: the page's own row again", /Live Lab \(the newest\)/.test(await text("svc-one")) && (await node("svc-one"))?.service === "", (await text("svc-one")).slice(0, 60));
  await p.click('[data-a="redo"]'); await p.waitForTimeout(400);
  ok("redo: the chosen service, no new fetch", /Voice and Breath/.test(await text("svc-one")) && (await calls()).draw === 1);
  await select("svc-one");
  await p.click(`${panel} [data-f="bind-open-service"]`); await p.waitForSelector(".de-vdrawer [data-f=rec-clear]");
  ok("clear says what an empty choice means", /The visitor's choice \(\?service=…\), else the newest/.test(await p.locator(".de-vdrawer [data-f=rec-clear]").innerText()));
  await p.click(".de-vdrawer [data-f=rec-clear]"); await p.waitForTimeout(400);
  ok("cleared: stored empty, and the page's own row drawn again", (await node("svc-one"))?.service === "" && /Live Lab \(the newest\)/.test(await text("svc-one")), (await text("svc-one")).slice(0, 60));
  // Booking: the same chooser, the booking block's own drawing.
  await select("svc-book");
  await p.click(`${panel} [data-f="bind-open-service"]`); await p.waitForSelector('.de-vdrawer [data-rec-source="services"]');
  await p.click('.de-vdrawer [data-rec-source="services"]'); await p.waitForSelector('.de-vdrawer [data-rec-value="mask-work"]');
  await p.click('.de-vdrawer [data-rec-value="mask-work"]'); await p.waitForTimeout(500);
  ok("booking block draws the chosen service", /Mask Work Intensive/.test(await text("svc-book")), (await text("svc-book")).slice(0, 80));
  // Popup: the chooser is there too, and hands back as one step.
  await openLarge("svc-one");
  if (!(await p.locator('.de-popup [data-f="bind-open-service"]').count())) { await p.locator(".de-popup .de-layer").filter({ hasText: "Service" }).first().click().catch(() => {}); await p.waitForTimeout(300); }
  ok("popup panel has the Service chooser", (await p.locator('.de-popup [data-f="bind-open-service"]').count()) === 1);
  if (await p.locator('.de-popup [data-f="bind-open-service"]').count()) {
    await p.click('.de-popup [data-f="bind-open-service"]'); await p.waitForSelector('.de-popup [data-rec-source="services"]');
    await p.click('.de-popup [data-rec-source="services"]'); await p.waitForSelector('.de-popup [data-rec-value="mask-work"]');
    await p.click('.de-popup [data-rec-value="mask-work"]'); await p.waitForTimeout(500);
    ok("popup draws the new service; the page keeps the old", /Mask Work/.test(await p.locator(`${S} [data-tree-node="svc-one"]`).first().innerText()) && !/Mask Work/.test(await text("svc-one")));
    await use();
    ok("Use on this page: the page draws it", /Mask Work Intensive/.test(await text("svc-one")) && (await node("svc-one"))?.service === "mask-work");
  }
  // A piece of writing for "Piece (article)": the same chooser, by series too (2026-11-14).
  const pcalls = () => p.evaluate(() => ({ ...globalThis.__pieceCalls }));
  ok("an unchosen piece draws the page's own (the address, else the newest)", /The newest piece \(live\)/.test(await text("article")), (await text("article")).slice(0, 60));
  await select("article");
  ok("Piece is a chooser, not a text box", (await p.locator(`${panel} [data-f="bind-piece"]`).count()) === 1 && (await p.locator(`${panel} #de-p-piece`).count()) === 0);
  await p.click(`${panel} [data-f="bind-open-piece"]`); await p.waitForSelector('.de-vdrawer [data-rec-source="all"]');
  ok("sources: all of the site's writing, then each series", (await p.locator(".de-vdrawer [data-rec-source]").count()) === 2 && /Notes from the lab/.test(await p.locator(".de-vdrawer").innerText()));
  await p.click('.de-vdrawer [data-rec-source="series:Notes from the lab"]'); await p.waitForSelector('.de-vdrawer [data-rec-value="why-masks"]');
  ok("a series lists only its pieces", (await p.locator(".de-vdrawer [data-rec-value]").count()) === 1);
  await p.click('.de-vdrawer [data-rec-value="why-masks"]'); await p.waitForTimeout(500);
  ok("block draws the chosen piece", /Why we wear masks/.test(await text("article")), (await text("article")).slice(0, 60));
  ok("panel names it and its series", /Why we wear masks \(Notes from the lab\)/.test(await p.locator(`${panel} [data-f="bind-piece"]`).innerText()), await p.locator(`${panel} [data-f="bind-piece"]`).innerText());
  ok("stored: the slug only, one fetch", (await node("article"))?.piece === "why-masks" && !("post" in (await node("article"))) && (await pcalls()).draw === 1, JSON.stringify(await pcalls()));
  await p.click('[data-a="undo"]'); await p.waitForTimeout(400);
  ok("undo: the page's own piece again", /The newest piece \(live\)/.test(await text("article")) && (await node("article"))?.piece === "");
  await p.click('[data-a="redo"]'); await p.waitForTimeout(400);
  ok("redo: the chosen piece, no new fetch", /Why we wear masks/.test(await text("article")) && (await pcalls()).draw === 1);
  await select("article");
  await p.click(`${panel} [data-f="bind-open-piece"]`); await p.waitForSelector(".de-vdrawer [data-f=rec-clear]");
  ok("clear says what an empty choice means", /The piece in the address \(\/journal\/…\), else the newest/.test(await p.locator(".de-vdrawer [data-f=rec-clear]").innerText()));
  await p.keyboard.press("Escape"); await p.waitForTimeout(300);
  // Save: references only.
  await p.evaluate(() => globalThis.__editor.save()); await p.waitForTimeout(600);
  const saved = await p.evaluate(() => globalThis.__saved);
  const found = []; const walk = (l) => (l || []).forEach((n) => { if (["pt-service", "pt-booking"].includes(n.type)) found.push(n.props); Object.values(n.props).forEach((v) => Array.isArray(v) && v.length && v[0] && v[0].type && walk(v)); });
  walk(saved && saved.content);
  ok("saved: services as slugs, no drawn rows", found.length === 2 && found.every((x) => !("chosen" in x) && !("booking" in x)) && found.map((x) => x.service).join(",") === "mask-work,mask-work", JSON.stringify(found.map((x) => [x.service, Object.keys(x)])));
  const art = []; const walkA = (l) => (l || []).forEach((n) => { if (n.type === "pt-article") art.push(n.props); Object.values(n.props).forEach((v) => Array.isArray(v) && v.length && v[0] && v[0].type && walkA(v)); });
  walkA(saved && saved.content);
  ok("saved: the piece as its slug, no drawn post", art.length === 1 && art[0].piece === "why-masks" && !("post" in art[0]), JSON.stringify(art));
  await p.screenshot({ path: "/h/shots/ed-service.png", fullPage: true , timeout: 4000 }).catch(() => {});

  // ── F. Numbered steps: a row's rich text gets Puck's rich-text field in Studio, not a raw-HTML box ───────────
  const f = await p.evaluate(() => { const s = globalThis.__stepsFields; return { type: s?.type, text: s?.arrayFields?.text?.type, title: s?.arrayFields?.title?.type, hasRender: typeof s?.arrayFields?.text?.render === "function" }; });
  ok("pt-steps rows: the text column is a custom field with a render (Puck's richtext inside)", f.type === "array" && f.text === "custom" && f.hasRender, JSON.stringify(f));

  // ── G. A template edited WITH a record: the editor's resolvers ask for that record (2026-11-14) ─────────────
  const asked = [];
  const EV = { event: { id: "T-lab", title: "The Tuesday lab", slug: "tuesday-lab", kind: "meeting", feedSlug: "gatherings", feedName: "Gatherings", descriptionHtml: "<p>x</p>", excerpt: null, coverImageUrl: null, location: null, isOnline: true, meetingUrl: null, scheduledAt: null, durationMinutes: 60, recurrencePattern: null, authorName: "Host", authorSlug: null, talkUrl: null, hasRoom: false, canCreateRoom: false, isRsvpEnabled: false, attendeeLimit: null, attendanceCount: 0, alreadyAttending: false, cancelled: false, signedIn: true, isMember: true, materials: [], attendees: [] } };
  await p.route(/\/api\/blocks\//, (r) => {
    const u = new URL(r.request().url()); asked.push(u.pathname + u.search);
    const body = u.pathname.endsWith("/pt-event-header") && u.searchParams.get("atThread") === "T-lab" ? EV
      : u.pathname.endsWith("/pt-article") && u.searchParams.get("atPiece") === "why-masks" ? { post: { ...EV.event, title: "Previewed piece", lede: null, bodyHtml: "<p>y</p>", layout: "essay", series: null, bylineName: null, readingMinutes: 1, publishedAt: null } }
      : {};
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
  for (const which of ["puck", "canvas"]) {
    asked.length = 0;
    const ev = await p.evaluate((w) => globalThis.__resolveEditor(w, "pt-event-header", { showCrumb: true, showFacts: true, showCover: true }, { orgId: "sunjay", slug: "event-detail", threadId: "T-lab" }), which);
    ok(`${which}: event-detail with ?thread= asks for that gathering`, asked.some((a) => /\/pt-event-header\?.*atThread=T-lab/.test(a)), asked.join(" "));
    ok(`${which}: …and draws it`, ev?.event?.title === "The Tuesday lab", JSON.stringify(ev?.event?.title));
    asked.length = 0;
    const art = await p.evaluate((w) => globalThis.__resolveEditor(w, "pt-article", { piece: "" }, { orgId: "sunjay", slug: "journal-piece", piece: "why-masks" }), which);
    ok(`${which}: journal-piece with ?piece= asks for that piece, apart from the block's own choice`, asked.some((a) => /\/pt-article\?.*atPiece=why-masks/.test(a)) && !asked.some((a) => /[?&]piece=/.test(a)), asked.join(" "));
    ok(`${which}: …and draws it`, art?.post?.title === "Previewed piece", JSON.stringify(art?.post?.title));
    asked.length = 0;
    await p.evaluate((w) => globalThis.__resolveEditor(w, "pt-event-header", { showCrumb: true }, { orgId: "sunjay", slug: "event-detail" }), which);
    ok(`${which}: without a record, no at* key is sent (the next gathering, as before)`, asked.length > 0 && asked.every((a) => !/atThread|atPiece|atService/.test(a)), asked.join(" "));
  }
  await p.unroute(/\/api\/blocks\//);

  // ── H. Which gathering "Next gathering" shows: From what?, and the home page's per-node pieces (2026-11-14) ───
  await open("doc=a");
  const gcalls = () => p.evaluate(() => ({ ...globalThis.__gatherCalls }));
  ok("Next gathering draws the page's own standing meeting", /Standing lab \(live\)/.test(await text("standing")), (await text("standing")).slice(0, 80));
  await select("standing");
  ok("Which gathering is a chooser that names the current choice", (await p.locator(`${panel} [data-f="bind-which"]`).count()) === 1 && /The standing meeting/.test(await p.locator(`${panel} [data-f="bind-which"]`).innerText()), await p.locator(`${panel} [data-f="bind-which"]`).innerText().catch(() => "-"));
  await p.click(`${panel} [data-f="bind-open-which"]`); await p.waitForSelector('.de-vdrawer [data-rec-source="follows"]');
  await p.click('.de-vdrawer [data-rec-source="follows"]'); await p.waitForSelector('.de-vdrawer [data-rec-value="next"]');
  ok("follows the calendar: the standing meeting and the next one, both marked as following", (await p.locator('.de-vdrawer [data-f=rec-follows] [data-rec-value]').count()) === 2 && (await p.locator('.de-vdrawer [data-rec-value="standing"][aria-current]').count()) === 1);
  await p.click('.de-vdrawer [data-rec-value="next"]'); await p.waitForTimeout(500);
  ok("choosing the next upcoming one draws it", /Open Evening/.test(await text("standing")), (await text("standing")).slice(0, 80));
  ok("panel says what it shows now and that it follows", /The next upcoming gathering: now Open Evening.*Follows the calendar/.test(await p.locator(`${panel} [data-f="bind-which"]`).innerText()), await p.locator(`${panel} [data-f="bind-which"]`).innerText());
  ok("stored: \"next\" only, one fetch", (await node("standing"))?.which === "next" && !("standing" in (await node("standing"))) && (await gcalls()).draw === 1, JSON.stringify(await gcalls()));
  await p.click(`${panel} [data-f="bind-open-which"]`); await p.waitForSelector('.de-vdrawer [data-rec-source="gatherings"]');
  await p.click('.de-vdrawer [data-rec-source="gatherings"]'); await p.waitForSelector('.de-vdrawer [data-rec-value="thread:winter-rite"]');
  await p.click('.de-vdrawer [data-rec-value="thread:winter-rite"]'); await p.waitForTimeout(500);
  ok("one particular gathering", /Winter Rite/.test(await text("standing")) && (await node("standing"))?.which === "thread:winter-rite");
  await p.click('[data-a="undo"]'); await p.waitForTimeout(300); await p.click('[data-a="undo"]'); await p.waitForTimeout(400);
  ok("two undos: the standing meeting the page drew, no refetch", /Standing lab \(live\)/.test(await text("standing")) && (await node("standing"))?.which === "standing" && (await gcalls()).draw === 2, JSON.stringify(await gcalls()));
  await select("standing");
  await p.click(`${panel} [data-f="bind-open-which"]`); await p.waitForSelector(".de-vdrawer [data-f=rec-clear]");
  ok("clear goes back to the standing meeting", /The standing meeting \(as before\)/.test(await p.locator(".de-vdrawer [data-f=rec-clear]").innerText()));
  await p.keyboard.press("Escape"); await p.waitForTimeout(300);

  // Whose profile "Profile card" shows (2026-11-14): the site's guide by default, From what? to choose.
  const pcards = () => p.evaluate(() => ({ ...globalThis.__guideCalls }));
  ok("Profile card draws the site's guide with nothing chosen", /Jason \(the site's guide\)/.test(await text("profile")), (await text("profile")).slice(0, 60));
  await select("profile");
  ok("Whose profile is a chooser", (await p.locator(`${panel} [data-f="bind-person"]`).count()) === 1);
  await p.click(`${panel} [data-f="bind-open-person"]`); await p.waitForSelector('.de-vdrawer [data-rec-source="site"]');
  ok("sources: the site's guide first, then the site's people and its gatherings", (await p.locator(".de-vdrawer [data-rec-source]").count()) === 3 && /The site's guide/.test(await p.locator(".de-vdrawer [data-rec-source]").first().innerText()));
  await p.click('.de-vdrawer [data-rec-source="org"]'); await p.waitForSelector('.de-vdrawer [data-rec-value="user:u-guru"]');
  await p.click('.de-vdrawer [data-rec-value="user:u-guru"]'); await p.waitForTimeout(500);
  ok("a chosen person draws their card", /Guru Dharam Singh/.test(await text("profile")), (await text("profile")).slice(0, 60));
  ok("panel names them; stored the reference only", /Guru Dharam Singh\. Always this person/.test(await p.locator(`${panel} [data-f="bind-person"]`).innerText()) && (await node("profile"))?.person === "user:u-guru" && !("guide" in (await node("profile"))));
  await p.click(`${panel} [data-f="bind-open-person"]`); await p.waitForSelector('.de-vdrawer [data-rec-source="thread:lab"]');
  await p.click('.de-vdrawer [data-rec-source="thread:lab"]'); await p.waitForSelector('.de-vdrawer [data-rec-value="thread:lab:author"]');
  await p.click('.de-vdrawer [data-rec-value="thread:lab:author"]'); await p.waitForTimeout(500);
  ok("a following choice: the gathering's author, said to follow", /Follows the gathering/.test(await p.locator(`${panel} [data-f="bind-person"]`).innerText()) && (await node("profile"))?.person === "thread:lab:author");
  await p.click(`${panel} [data-f="bind-open-person"]`); await p.waitForSelector('.de-vdrawer [data-rec-source="site"]');
  await p.click('.de-vdrawer [data-rec-source="site"]'); await p.waitForSelector('.de-vdrawer [data-rec-value=""]');
  await p.click('.de-vdrawer [data-rec-value=""]'); await p.waitForTimeout(500);
  ok("the site's guide again: stored empty, the page's own card drawn, no refetch for it", (await node("profile"))?.person === "" && /Jason \(the site's guide\)/.test(await text("profile")) && (await pcards()).draw === 2, JSON.stringify(await pcards()));

  // ── I. Nothing acts without a click while editing (2026-11-14, round 2 item 5): the Talk room's "open on load", the
  // gallery's own clock. On the published shape both still do.
  const galleryState = (scope) => p.evaluate((scope) => document.querySelector(`${scope}`)?.innerHTML ?? null, scope);
  const settle = async (sel) => { const a = await galleryState(sel); await p.waitForTimeout(2600); return [a, await galleryState(sel)]; };
  await open("doc=a");
  ok("editing: the Talk room set to open on load stays closed (no call frame)", (await p.locator('[data-tree-node="ev-room"] iframe').count()) === 0 && /Join the room/.test(await text("ev-room")), (await text("ev-room")).slice(0, 80));
  const [g0, g1] = await settle('[data-tree-node="gallery"]');
  ok("editing: the gallery set to move on every second stays still", g0 !== null && g0 === g1);
  await open("doc=a&view=published");
  const roomPub = await p.evaluate(() => [...document.querySelectorAll("#host section")].some((s) => /The room/.test(s.textContent) && s.querySelector("iframe")));
  ok("published: the Talk room set to open on load opens (call frame drawn)", roomPub);
  const pubSel = await p.evaluate(() => { const h = [...document.querySelectorAll("#host h2")].find((e) => e.textContent.trim() === "Gallery"); if (!h) return null; h.parentElement.setAttribute("data-probe-gallery", ""); return "[data-probe-gallery]"; });
  const [p0, p1] = pubSel ? await settle(pubSel) : [null, null];
  ok("published: the gallery moves on by itself", p0 !== null && p0 !== p1);

  await open("view=home");
  const home = await p.evaluate(() => [...document.querySelectorAll('#host [data-landing-block="home-standing"]')].map((e) => e.textContent.trim()));
  ok("home: each Next gathering draws its own piece (default, its chosen one, default for an old node)", JSON.stringify(home) === JSON.stringify(["the standing meeting", "the next gathering", "the standing meeting"]), JSON.stringify(home));
  const hc = await p.evaluate(() => globalThis.__homeContract["home-standing"]);
  ok("home: home-standing declares Which gathering (binds gathering) beside its parts", hc?.props?.some((x) => x.name === "which" && x.binds === "gathering" && x.group) && !!hc?.parts?.root, JSON.stringify(hc?.props));

  ok("no page errors", errs.length === 0, errs.slice(0, 4).join(" | "));
  console.log(`\n${pass} passed, ${fail} failed`);
  srv.close(); await b.close().catch(() => {}); process.exit(0);
})().catch((e) => { console.log("CRASH", e.stack || e.message); console.log(`\n${pass} passed, ${fail + 1} failed`); process.exit(1); });
