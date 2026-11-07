// Read-only (2026-11-07): Para Theater's resolvers for Featured person, Opens and Card against the live database, the
// chooser lists, and what the published config draws for them and for the three new layout blocks. Bundled by
// sunjay-bundle.cjs inside the sunjay container: no writes, no network beyond Postgres.
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Render, resolveAllData } from "@puckeditor/core";
import { serverPuckConfig } from "@/lib/puck/config.server";
import { cardRecord, opensChoices, resolveOpens } from "@/lib/opens-server";
import { featuredWho } from "@/lib/featured-person";
import { stripResolved } from "@/blocks/resolved-keys";

const JASON = "a4c2c969-0b8b-40e2-8650-b5dca5fe36c6";
const GATHERING = "u_Nc_PUtWLPnSRjxAjWu2", SERIES = "bl0whFnG6dS_7J9NvvLyS", POST = "buP84VR3eAs133JwwXHZ9";
let pass = 0, fail = 0;
const ok = (name: string, c: boolean, x?: unknown) => { if (c) pass++; else { fail++; console.log("  FAIL", name, x === undefined ? "" : JSON.stringify(x).slice(0, 300)); } };

async function main() {
  const cases: Array<[string, string, boolean]> = [
    ["page", "page:/writing", true],
    ["gathering popup", `popup:thread:${GATHERING}`, true],
    ["series popup", `popup:thread:${SERIES}`, true],
    ["writing popup", `popup:thread:${POST}`, true],
    ["person, then their page", `popup:person:${JASON}>page:/about/jason-ford`, true],
    ["archived post", "popup:thread:ngBSCazEyfa2wrmEaiu7y", false],
    ["a series session (not a visitor's kind)", "popup:thread:3WK5GPXadGIFfOoTEVOFw", false],
    ["another org's thread", "popup:thread:zbereXeUpM-vXGTpAmzYw", false],
    ["Then after a thread popup", `popup:thread:${GATHERING}>page:/series`, false],
    ["a page with //", "page://evil.example", false],
    ["javascript", "page:javascript:alert(1)", false],
  ];
  for (const [name, v, want] of cases) {
    const o = await resolveOpens(v);
    ok(`opens: ${name}`, want ? !!o : o === null, o);
  }
  const g = await resolveOpens(`popup:thread:${GATHERING}`);
  ok("gathering popup goes to its page and opens the thread popup", g?.href === "/gatherings/ritual-theatre-lab" && g?.popup?.key === "thread" && g?.popup?.props?.id === GATHERING, g);
  const s = await resolveOpens(`popup:thread:${SERIES}`);
  ok("series goes to /series/<slug>", s?.href === "/series/running-the-script", s?.href);
  const pr = await resolveOpens(`popup:person:${JASON}>page:/about/jason-ford`);
  ok("person popup carries who and then", pr?.popup?.key === "person" && (pr?.popup?.props?.then as { href?: string })?.href === "/about/jason-ford", pr);

  const c1 = await cardRecord(`thread:${POST}`);
  ok("card from writing", c1?.kind === "Writing" && c1?.href === "/writing/why-we-meditate", c1);
  const c2 = await cardRecord(`thread:${GATHERING}`);
  ok("card from a gathering", c2?.kind === "Gathering" && !!c2?.title, c2);
  ok("card from an archived post draws nothing", (await cardRecord("thread:ngBSCazEyfa2wrmEaiu7y")) === null);
  ok("card from another org's thread draws nothing", (await cardRecord("thread:zbereXeUpM-vXGTpAmzYw")) === null);

  const who = await featuredWho(`user:${JASON}`);
  ok("featured person: a public person here", !!who && who.href === "/about/jason-ford", who);

  const people = await opensChoices("opens", "person");
  ok("person choices are people only, with a Then variant", people.length >= 3 && people.some((p) => p.value.includes(">page:/about/")), people.length);
  const threads = await opensChoices("opens", "thread");
  ok("thread choices hold no session or archived post", threads.length > 0 && !threads.some((t) => /3WK5GPXadGIFfOoTEVOFw|ngBSCazEyfa2wrmEaiu7y/.test(t.value)), threads.map((t) => t.value));
  const recs = await opensChoices("record", "series");
  ok("record choices by kind", recs.length === 1 && recs[0]!.value === `thread:${SERIES}`, recs);

  // The published config: a page with the new blocks, resolved and drawn.
  const doc = {
    root: { props: {} },
    content: [
      { type: "featured-person", props: { id: "fp", person: `user:${JASON}`, opens: `popup:person:${JASON}>page:/about/jason-ford`, layout: "side" } },
      { type: "link-button", props: { id: "lb", label: "Typed", href: "/typed", opens: `popup:thread:${GATHERING}` } },
      { type: "feature-card", props: { id: "fc", record: `thread:${POST}`, title: "", opens: "" } },
      { type: "sticky-split", props: { id: "ss", sideAt: "end", ratio: "third", offset: 120, gap: "regular", side: [{ type: "prose", props: { id: "p1", body: "Side words" } }], main: [] } },
      { type: "tab-set", props: { id: "tb", label1: "One", label2: "Two", label3: "", label4: "", label5: "", look: "line", align: "start", panel1: [{ type: "prose", props: { id: "p2", body: "In tab one" } }], panel2: [{ type: "prose", props: { id: "p3", body: "In tab two" } }] } },
      { type: "accordion-set", props: { id: "ac", title1: "First", title2: "Second", title3: "", title4: "", title5: "", title6: "", look: "divided", openFirst: true, oneAtATime: true, section1: [{ type: "prose", props: { id: "p4", body: "Inside one" } }], section2: [] } },
    ],
  };
  const filled = await resolveAllData(doc as never, serverPuckConfig as never, {});
  const html = renderToStaticMarkup(h(Render as never, { config: serverPuckConfig, data: filled } as never));
  ok("featured person drawn with its name", html.includes("blk-fperson") && html.includes("Jason Ford"), html.slice(0, 200));
  ok("its name opens the person popup", /data-opens="[^"]*person/.test(html));
  ok("button: Opens replaces the typed link", html.includes('href="/gatherings/ritual-theatre-lab"') && !html.includes('href="/typed"'));
  ok("card filled from the writing", html.includes("/writing/why-we-meditate"));
  ok("sticky side drawn, side on the right, offset set", html.includes('class="blk blk-sticky"') && html.includes('data-side="end"') && html.includes("--sticky-top:120px"));
  ok("tabs: two tabs, the third (unnamed) not drawn", (html.match(/role="tab"/g) ?? []).length === 2 && html.includes("In tab two"));
  ok("tabs: first selected", /aria-selected="true"[^>]*>One</.test(html) || /<button[^>]*aria-selected="true"[^>]*>One/.test(html), html.match(/<div class="blk-tabs-list"[\s\S]{0,400}/)?.[0]);
  ok("sections: two, first open, one-at-a-time group", (html.match(/class="blk-acc-item"/g) ?? []).length === 2 && /<details class="blk-acc-item" name="blk-acc-ac" open/.test(html), html.match(/<details[^>]*>/g));

  // Saving strips what resolvers filled.
  const stored = JSON.stringify(stripResolved(filled));
  // Puck's resolveAllData adds `readOnly: { who: true }` flags beside props; only a stored VALUE would be content.
  const left = [...stored.matchAll(/"(who|opened|bound)":(?!true[,}])/g)].map((m) => m[1]);
  ok("save strips who, opened and bound (values)", left.length === 0, left);
  ok("save keeps the references", stored.includes(`user:${JASON}`) && stored.includes(`popup:thread:${GATHERING}`) && stored.includes(`thread:${POST}`));

  console.log(`pass ${pass} fail ${fail}`);
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error("ERR", e); process.exit(2); });
