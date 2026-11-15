// Record parts (record-header, record-body, record-facts, checkout, rsvp):
// what each draws for a visitor, for an editor, and with hostile input.
//   pnpm --filter @elkdonis/blocks exec tsx scripts/record-parts.mts
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { recordHeader, recordBody, recordFacts, checkoutBlock, rsvpBlock, RECORD_RESOLVED_KEYS, type RecordView } from "../src/blocks/record-parts";
import { createCatalogue } from "../src/registry";

let failed = 0;
const ok = (name: string, pass: boolean, detail = "") => {
  if (!pass) failed++;
  console.log(`  ${pass ? "ok  " : "FAIL"} ${name}${pass || !detail ? "" : ` — ${detail}`}`);
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const draw = (b: { Component: any }, props: Record<string, unknown>) => renderToStaticMarkup(createElement(b.Component, props));

const rec: RecordView = {
  kind: "service",
  kicker: "A reading",
  title: "An hour <with> the figure",
  subtitle: "One conversation.",
  dateLabel: "7 November 2026",
  authorName: "Ario",
  authorHref: "/about/ario",
  coverUrl: "/api/media/EAC_Network/x/cover.jpg",
  bodyHtml: '<p>Hello <strong>there</strong></p><script>alert(1)</script><img src="x" onerror="alert(2)">',
  facts: [{ label: "Format", value: "Online" }, { label: "", value: "dropped" }],
};
const acted: string[] = [];
const action = async (ref: string) => { acted.push(ref); };
const checkout = checkoutBlock({ action, After: ({ after }) => createElement("p", { "data-after": after.orderId }, "when"), buttonClass: "site-btn" });
const rsvp = rsvpBlock({ action });

console.log("\ncatalogue");
try {
  const c = createCatalogue([recordHeader, recordBody, recordFacts, checkout, rsvp] as never);
  ok("five blocks register", c.all.length === 5);
  ok("ids carry no site prefix", c.defs.every((d) => /^(record-(header|body|facts)|checkout|rsvp)$/.test(d.id)));
  ok("no organisation setting", c.defs.every((d) => d.props.every((p) => !/org/i.test(p.name))));
  ok("copy settings: at most two per block", c.defs.every((d) => d.props.filter((p) => ["string", "text", "richtext", "url"].includes(p.kind) && p.name !== "record").length <= 2));
  ok("resolved keys never equal a prop name", c.defs.every((d) => (RECORD_RESOLVED_KEYS[d.id] ?? []).every((k) => !d.props.some((p) => p.name === k))));
  ok("every block has resolved keys listed", c.defs.every((d) => !!RECORD_RESOLVED_KEYS[d.id]));
} catch (e) {
  ok("catalogue builds", false, String(e));
}

console.log("\nheader");
const h = draw(recordHeader, { rec, showKicker: true, showSubtitle: true, showMeta: true, showCover: true, align: "center" });
ok("title escaped as text", h.includes("An hour &lt;with&gt; the figure"));
ok("one h1", (h.match(/<h1/g) ?? []).length === 1);
ok("kicker, subtitle, date, author link, cover", ["A reading", "One conversation.", "7 November 2026", 'href="/about/ario"', "blk-rcd-cover"].every((x) => h.includes(x)));
const h2 = draw(recordHeader, { rec: { ...rec, authorHref: "https://evil.example/x", coverUrl: "javascript:alert(1)" }, showKicker: false, showSubtitle: false, showMeta: true, showCover: true });
ok("off-site author link and script picture dropped", !h2.includes("evil.example") && !h2.includes("javascript:") && !h2.includes("A reading"));
ok("no record: visitor sees nothing", draw(recordHeader, { rec: null }) === "");
ok("no record: editor sees a note", draw(recordHeader, { rec: null, puck: { isEditing: true } }).includes("blk-rcd-note"));

console.log("\nbody");
const b = draw(recordBody, { rec, width: "reading" });
ok("text kept", b.includes("<strong>there</strong>"));
ok("script and handler removed", !/<script|onerror|alert\(/i.test(b), b);
ok("empty text: nothing", draw(recordBody, { rec: { ...rec, bodyHtml: "" } }) === "");

console.log("\nfacts");
const f = draw(recordFacts, { rec, layout: "row" });
ok("one fact drawn, blank label dropped", (f.match(/<dt/g) ?? []).length === 1 && !f.includes("dropped"));
ok("no facts: nothing", draw(recordFacts, { rec: { ...rec, facts: [] } }) === "");

console.log("\ncheckout");
const open = draw(checkout, { rec, recordRef: "service:hour", buttonLabel: "Book and pay", pay: { price: 120, priceMin: 80, currency: "CAD", open: true } });
ok("range, amount field with bounds, button", /\$80\.00\s–\s\$120\.00/.test(open) && 'min="80"' && open.includes('max="120"') && open.includes("data-book-and-pay") && open.includes("site-btn"));
ok("note under the button, and not when the button is withheld", draw(checkout, { rec, recordRef: "r", pay: { price: 5, currency: "CAD", open: true, note: "Secure page." } }).includes("Secure page.") && !draw(checkout, { rec, recordRef: "r", pay: { price: 5, currency: "CAD", open: true, note: "Secure page.", unavailable: "Paused." } }).includes("Secure page."));
ok("fixed price: no amount field", !draw(checkout, { rec, recordRef: "service:hour", pay: { price: 120, currency: "CAD", open: true } }).includes('name="amount"'));
const closed = draw(checkout, { rec, recordRef: "service:hour", pay: { price: 120, currency: "CAD", open: false } });
ok("closed: no form, a sentence", !closed.includes("<form") && closed.includes("Not open for booking"));
const blocked = draw(checkout, { rec, recordRef: "service:hour", pay: { price: 120, currency: "CAD", open: true, unavailable: "Card booking is paused." } });
ok("unavailable: sentence in place of the button", blocked.includes("Card booking is paused.") && !blocked.includes("<button"));
const paid = draw(checkout, { rec, recordRef: "service:hour", pay: { price: 120, currency: "CAD", open: true, paidLine: "Thank you.", after: { orderId: "o1" } } });
ok("paid: confirmation and the host's After, no form", paid.includes("Thank you.") && paid.includes('data-after="o1"') && !paid.includes("<form"));
ok("paid without after data: no After", !draw(checkout, { rec, recordRef: "service:hour", pay: { price: 1, currency: "CAD", open: true, paidLine: "Thank you." } }).includes("data-after"));
ok("no ref: visitor sees nothing", draw(checkout, { rec, pay: { price: 1, currency: "CAD", open: true } }) === "");
ok("editor: drawn inert", draw(checkout, { rec, recordRef: "service:hour", pay: { price: 1, currency: "CAD", open: true }, puck: { isEditing: true } }).includes("inert"));
ok("bad currency does not throw", draw(checkout, { rec, recordRef: "r", pay: { price: 5, currency: "not-a-code", open: true } }).includes("5"));

console.log("\nrsvp");
const r0 = draw(rsvp, { rec, recordRef: "thread:t1", yesLabel: "I’m coming", showCount: true, attendance: { open: true, mine: null, count: 7 } });
ok("unanswered: yes button and count", r0.includes('value="yes"') && r0.includes("7 coming"));
const r1 = draw(rsvp, { rec, recordRef: "thread:t1", attendance: { open: true, mine: "yes", count: 8 }, showCount: false });
ok("answered yes: can withdraw, count hidden", r1.includes('value="no"') && r1.includes("You are coming.") && !r1.includes("8 coming"));
const r2 = draw(rsvp, { rec, recordRef: "thread:t1", attendance: { open: true, mine: null, signInHref: "/login?next=/x" } });
ok("signed out: sign-in link, no form", r2.includes('href="/login?next=/x"') && !r2.includes("<form"));
ok("off-site sign-in link is not used", !draw(rsvp, { rec, recordRef: "t", attendance: { open: true, mine: null, signInHref: "//evil.example" } }).includes("evil.example"));
ok("closed: sentence", draw(rsvp, { rec, recordRef: "t", attendance: { open: false, mine: null, closedLine: "This gathering has passed." } }).includes("This gathering has passed."));

ok("drawing never called the host action", acted.length === 0);

if (failed) {
  console.error(`\n${failed} record-parts check(s) failed`);
  process.exit(1);
}
console.log("\nall record-parts checks passed");
