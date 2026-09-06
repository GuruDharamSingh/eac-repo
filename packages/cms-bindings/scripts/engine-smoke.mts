/**
 * Engine smoke tests. `pnpm --filter @elkdonis/cms-bindings test:engine`
 *
 * Deliberately covers the cases the old regex renderer got wrong or could not
 * express: nested same-tag elements, HTML-bearing values, repeated markup, and
 * escaping.
 */

import assert from "node:assert/strict";
import { applyBindings, validateBindings } from "../src/engine/index";
import type { BindingMap } from "../src/engine/types";

let passed = 0;
function test(name: string, fn: () => void): void {
  try {
    fn();
    passed += 1;
    console.log(`  ok  ${name}`);
  } catch (err) {
    console.error(`  FAIL ${name}`);
    console.error(String(err instanceof Error ? err.stack : err));
    process.exitCode = 1;
  }
}

const ctx = {
  workshop: {
    title: "Clay & Breath",
    discipline: "Ceramics",
    seriesLabel: "Spring series",
    body: "<p>Two hands, <em>one</em> pot.</p>",
    price: 48,
    currency: "CAD",
    scheduledAt: "2026-03-04T18:00:00.000Z",
    sessionCount: 3,
    attendeeLimit: 12,
    registrationUrl: "https://example.org/register",
    registrationStatus: "open",
    slidingScaleNote: "",
    level: "all_levels",
    format: "in_person",
    coverImageUrl: "/assets/hero.jpg",
    sessions: [
      { title: "Centering", scheduledAt: "2026-03-04T18:00:00.000Z", location: "Studio A" },
      { title: "Pulling", scheduledAt: "2026-03-11T18:00:00.000Z", location: "Studio A" },
    ],
  },
  facilitator: { displayName: "Ana R.", photoUrl: "/assets/ana.jpg" },
};

console.log("\nengine");

test("text binding escapes markup in values", () => {
  const html = `<h1 data-trait="title">placeholder</h1>`;
  const out = applyBindings(html, { title: { kind: "text", from: "workshop.title" } }, ctx);
  assert.equal(out, `<h1 data-trait="title">Clay &amp; Breath</h1>`);
});

test("text binding neutralises an injected script", () => {
  const html = `<h1 data-trait="title">x</h1>`;
  const evil = { workshop: { title: `<script>alert(1)</script>` } };
  const out = applyBindings(html, { title: { kind: "text", from: "workshop.title" } }, evil);
  assert.ok(!out.includes("<script>"), out);
  assert.ok(out.includes("&lt;script&gt;"), out);
});

test("html binding passes markup through (caller sanitizes)", () => {
  const html = `<div data-trait="body"><p>old</p></div>`;
  const out = applyBindings(html, { body: { kind: "html", from: "workshop.body" } }, ctx);
  assert.equal(out, `<div data-trait="body"><p>Two hands, <em>one</em> pot.</p></div>`);
});

test("nested same-tag elements bind correctly (regex could not)", () => {
  const html = `<div data-trait="body"><div>a</div><div>b</div></div><div>after</div>`;
  const out = applyBindings(html, { body: { kind: "html", from: "workshop.body" } }, ctx);
  assert.ok(out.endsWith("<div>after</div>"), `trailing markup was eaten: ${out}`);
  assert.ok(out.includes("<em>one</em>"), out);
});

test("join composes several paths", () => {
  const html = `<p data-trait="eyebrow">x</p>`;
  const out = applyBindings(
    html,
    { eyebrow: { kind: "text", from: ["workshop.discipline", "workshop.seriesLabel"], join: " · " } },
    ctx
  );
  assert.ok(out.includes("Ceramics · Spring series"), out);
});

test("join drops empty parts instead of leaving stray separators", () => {
  const html = `<p data-trait="eyebrow">x</p>`;
  const thin = { workshop: { discipline: "Ceramics", seriesLabel: "" } };
  const out = applyBindings(
    html,
    { eyebrow: { kind: "text", from: ["workshop.discipline", "workshop.seriesLabel"], join: " · " } },
    thin
  );
  assert.ok(out.includes(">Ceramics<"), out);
});

test("formatter receives every resolved value positionally", () => {
  const html = `<span data-trait="price">x</span>`;
  const out = applyBindings(
    html,
    { price: { kind: "text", from: ["workshop.price", "workshop.currency"], format: "price" } },
    ctx
  );
  assert.ok(/\$48/.test(out), out);
});

test("registrationCta formatter composes status + price", () => {
  const html = `<span data-trait="cta">x</span>`;
  const out = applyBindings(
    html,
    {
      cta: {
        kind: "text",
        from: ["workshop.registrationStatus", "workshop.price", "workshop.currency"],
        format: "registrationCta",
      },
    },
    ctx
  );
  assert.ok(out.includes("Register"), out);
});

test("template wraps the formatted value", () => {
  const html = `<span data-trait="spots">x</span>`;
  const out = applyBindings(
    html,
    { spots: { kind: "text", from: "workshop.attendeeLimit", template: "{} spots" } },
    ctx
  );
  assert.ok(out.includes(">12 spots<"), out);
});

test("fallback fills an empty value", () => {
  const html = `<a data-href-trait="url" href="#">go</a>`;
  const out = applyBindings(
    html,
    { url: { kind: "attr", attr: "href", from: "workshop.missing", fallback: "#register" } },
    ctx
  );
  assert.ok(out.includes(`href="#register"`), out);
});

test("attr binding sets href via data-href-trait", () => {
  const html = `<a data-href-trait="url" href="#">go</a>`;
  const out = applyBindings(
    html,
    { url: { kind: "attr", attr: "href", from: "workshop.registrationUrl" } },
    ctx
  );
  assert.ok(out.includes(`href="https://example.org/register"`), out);
});

test("style binding merges into an existing style attribute", () => {
  const html = `<div data-trait="cover" style="opacity:1"></div>`;
  const out = applyBindings(
    html,
    { cover: { kind: "style", prop: "background-image", from: "workshop.coverImageUrl", format: "cssUrl" } },
    ctx
  );
  assert.ok(out.includes("opacity:1"), out);
  assert.ok(out.includes("background-image:url('/assets/hero.jpg')"), out);
});

test("omitWhenEmpty removes the element", () => {
  const html = `<p data-trait="note">placeholder</p><p>keep</p>`;
  const out = applyBindings(
    html,
    { note: { kind: "text", from: "workshop.slidingScaleNote", omitWhenEmpty: true } },
    ctx
  );
  assert.equal(out, `<p>keep</p>`);
});

test("a filled value clears the template's hidden attribute", () => {
  const html = `<p data-trait="title" hidden>x</p>`;
  const out = applyBindings(html, { title: { kind: "text", from: "workshop.title" } }, ctx);
  assert.ok(!out.includes("hidden"), out);
});

test("show removes the element when the value is empty", () => {
  const html = `<div data-trait="gate">g</div><div>keep</div>`;
  const out = applyBindings(html, { gate: { kind: "show", from: "workshop.slidingScaleNote" } }, ctx);
  assert.equal(out, `<div>keep</div>`);
});

test("list clones the item template once per item", () => {
  const html =
    `<ol data-trait="sessions">` +
    `<li class="s"><h3 data-trait="sTitle">t</h3><span data-trait="sTime">time</span></li>` +
    `</ol>`;
  const bindings: BindingMap = {
    sessions: {
      kind: "list",
      from: "workshop.sessions",
      item: {
        sTitle: { kind: "text", from: "item.title" },
        sTime: { kind: "text", from: "item.scheduledAt", format: "time" },
      },
    },
  };
  const out = applyBindings(html, bindings, ctx);
  assert.equal((out.match(/<li class="s">/g) ?? []).length, 2, out);
  assert.ok(out.includes("Centering"), out);
  assert.ok(out.includes("Pulling"), out);
});

test("list removes its container when there are no items", () => {
  const html = `<ol data-trait="sessions"><li><span data-trait="sTitle">t</span></li></ol><p>after</p>`;
  const bindings: BindingMap = {
    sessions: { kind: "list", from: "workshop.missingList", item: { sTitle: { kind: "text", from: "item.title" } } },
  };
  assert.equal(applyBindings(html, bindings, ctx), `<p>after</p>`);
});

test("list honours limit and firstClass", () => {
  const html = `<div data-trait="g"><figure><img data-trait="src" src=""></figure></div>`;
  const bindings: BindingMap = {
    g: {
      kind: "list",
      from: "workshop.sessions",
      limit: 1,
      firstClass: "featured",
      item: { src: { kind: "attr", attr: "alt", from: "item.title" } },
    },
  };
  const out = applyBindings(html, bindings, ctx);
  assert.equal((out.match(/<figure/g) ?? []).length, 1, out);
  assert.ok(out.includes("featured"), out);
});

test("untouched markup round-trips byte-identically", () => {
  const html =
    `<section><style>.x{content:"<b>"}</style>` +
    `<eac-embed data-eac-component="rsvp"></eac-embed><br><img src="a.png"></section>`;
  assert.equal(applyBindings(html, { nope: { kind: "text", from: "workshop.title" } }, ctx), html);
});

test("a trait with no element in the HTML is a no-op at render time", () => {
  const html = `<p>nothing</p>`;
  assert.equal(applyBindings(html, { ghost: { kind: "text", from: "workshop.title" } }, ctx), html);
});

console.log("\nvalidate");

test("reports a binding whose hook is missing from the HTML", () => {
  const issues = validateBindings([
    { id: "sec", html: `<p data-trait="a">x</p>`, bindings: { b: { kind: "text", from: "workshop.title" } } },
  ]);
  assert.ok(issues.some((i) => i.severity === "error" && i.trait === "b"), JSON.stringify(issues));
});

test("reports an unknown formatter", () => {
  const issues = validateBindings([
    { id: "sec", html: `<p data-trait="a">x</p>`, bindings: { a: { kind: "text", from: "x", format: "nope" } } },
  ]);
  assert.ok(issues.some((i) => i.message.includes("unknown formatter")), JSON.stringify(issues));
});

test("reports a path that does not resolve in the sample context", () => {
  const issues = validateBindings(
    [{ id: "sec", html: `<p data-trait="a">x</p>`, bindings: { a: { kind: "text", from: "workshop.nope" } } }],
    { sampleContext: ctx }
  );
  assert.ok(issues.some((i) => i.message.includes("does not resolve")), JSON.stringify(issues));
});

test("clean template produces no issues", () => {
  const issues = validateBindings(
    [
      {
        id: "sec",
        html: `<h1 data-trait="title">x</h1>`,
        bindings: { title: { kind: "text", from: "workshop.title" } },
      },
    ],
    { sampleContext: ctx }
  );
  assert.deepEqual(issues, []);
});

console.log(`\n${passed} passed${process.exitCode ? " (with failures)" : ""}\n`);
