/**
 * The linked-card contract.
 *
 *   pnpm --filter @elkdonis/newsletter check:cards
 *
 * A card is the one thing in a letter that claims to point at something real,
 * so the ways it can lie are worth pinning down: filling the wrong slots,
 * leaking the editor's badge into an inbox, or quietly rendering a card for a
 * thread that was taken down.
 */
import {
  resolveThreadCards,
  referencedThreadIds,
  unresolvedPlaceholders,
  type ThreadCardData,
} from "../src/thread-cards";

let failed = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "ok  " : "FAIL"}  ${name}${ok || !detail ? "" : ` — ${detail}`}`);
  if (!ok) failed += 1;
}

const card = (id: string, label = "Old title") => `
<table data-eac-thread="${id}" data-eac-thread-label="${label}">
  <tr><td>
    <div data-eac-thread-field="kind">Pick a thread</div>
    <div data-eac-thread-field="title">No thread linked yet</div>
    <div data-eac-thread-field="summary"></div>
    <div data-eac-thread-field="when"></div>
    <div data-eac-thread-field="where"></div>
    <a data-eac-thread-field="url" href="#">Navigate back to view details</a>
  </td></tr>
</table>`;

const thread: ThreadCardData = {
  id: "t1",
  title: "Attention & the Moving Centre",
  kind: "workshop",
  when: "Saturday, 3 October, 7:00 p.m. EDT",
  where: "Toronto, and online",
  summary: "Six weeks of practical work.",
  url: "https://amritcanada.ca/workshops/attention",
  orgName: "Amrit Canada",
};
const live = new Map([[thread.id, thread]]);

// ── a linked card fills ──────────────────────────────────────────────────────
const one = resolveThreadCards(card("t1"), live);
check("finds the reference", referencedThreadIds(card("t1")).join() === "t1");
check("fills the title", one.html.includes("Attention &amp; the Moving Centre"));
check("escapes on the way in", !one.html.includes("Attention & the"));
check("joins kind and org", one.html.includes("workshop · Amrit Canada"));
check("fills the date", one.html.includes("Saturday, 3 October, 7:00 p.m. EDT"));
check("fills the place", one.html.includes("Toronto, and online"));
check("sets the href", one.html.includes('href="https://amritcanada.ca/workshops/attention"'));
check("drops the placeholder copy", !one.html.includes("No thread linked yet"));
// The badge is editor furniture. Shipping it would put the OLD title in the
// inbox as an attribute, which is both stale and nobody's business.
check("strips the editor badge", !one.html.includes("data-eac-thread-label"));
check("nothing reported missing", one.missing.length === 0);

// ── a card whose thread is gone ──────────────────────────────────────────────
const gone = resolveThreadCards(card("t-deleted", "Spring intensive"), live);
check("reports the broken link", gone.missing.length === 1, JSON.stringify(gone.missing));
check(
  "names it so the author knows which card",
  gone.missing[0]?.label === "Spring intensive"
);
check(
  "leaves the card alone rather than half-filling it",
  gone.html.includes("No thread linked yet")
);

// ── an unlinked card ─────────────────────────────────────────────────────────
const blank = resolveThreadCards(card(""), live);
check("an unlinked card references nothing", referencedThreadIds(card("")).length === 0);
check("and is not reported as broken", blank.missing.length === 0);

// ── nesting ──────────────────────────────────────────────────────────────────
// Every block in the library is a table, so a card inside a two-column layout
// is tables inside tables — the shape a regex resolver would get wrong.
const nested = `<table><tr><td>${card("t1")}</td><td>${card("t1")}</td></tr></table>`;
const many = resolveThreadCards(nested, live);
check("resolves nested cards", (many.html.match(/Attention &amp; the/g) ?? []).length === 2);
check("deduplicates ids", referencedThreadIds(nested).length === 1);

// ── placeholders ─────────────────────────────────────────────────────────────
check(
  "catches an example.org link",
  unresolvedPlaceholders('<a href="https://example.org">x</a>').length === 1
);
check(
  "catches leftover demo copy",
  unresolvedPlaceholders("<div>The title of the thing</div>").length === 1
);
check("says nothing about a clean letter", unresolvedPlaceholders(one.html).length === 0);

// Every new block ships example copy, and every one of them has to be catchable
// before a real send — that copy is the failure mode of a drag-and-drop kit.
import { BLOCKS_FOR_CHECK, DARK_BLOCK_PALETTE as PAL } from "../src/blocks";
const EXAMPLE_BEARING = [
  "eac-issue-head", "eac-feature", "eac-cta-panel", "eac-quote",
  "eac-signoff", "eac-gallery", "eac-image", "eac-profile-card",
  "eac-thread-card", "eac-writing-card", "eac-agenda", "eac-prose",
];
for (const id of EXAMPLE_BEARING) {
  const block = BLOCKS_FOR_CHECK.find((b) => b.id === id);
  if (!block) { check(`${id} exists`, false); continue; }
  const html = block.content(PAL, "newsletter");
  check(`${id} is caught while still an example`, unresolvedPlaceholders(html).length > 0);
}


// ── shape follows kind ───────────────────────────────────────────────────────
import { shapeForKind, threadCardMarkup, DARK_BLOCK_PALETTE } from "../src/blocks";

check("a workshop is a gathering", shapeForKind("workshop") === "gathering");
check("a meeting is a gathering", shapeForKind("meeting") === "gathering");
check("a post is writing", shapeForKind("post") === "writing");
check("a blog piece is writing", shapeForKind("writing") === "writing");
check("an unknown kind falls to writing", shapeForKind("pigeon") === "writing");
check("a missing kind falls to writing", shapeForKind(null) === "writing");

const gathering = threadCardMarkup(
  { id: "g1", title: "Qi Gong", kind: "workshop", when: "Sat 7pm", where: "Toronto", url: "https://x.org/a" },
  DARK_BLOCK_PALETTE
);
check("a gathering card carries when and where", /data-eac-thread-field="when"/.test(gathering) && /data-eac-thread-field="where"/.test(gathering));
check("and not a cover", !/data-eac-thread-field="cover"/.test(gathering));
check("it declares its shape", /data-eac-shape="gathering"/.test(gathering));

const writing = threadCardMarkup(
  { id: "w1", title: "On attention", kind: "post", published: "3 October 2026", coverUrl: "https://x.org/c.jpg", url: "https://x.org/b" },
  DARK_BLOCK_PALETTE
);
check("a writing card carries a date slot", /data-eac-thread-field="date"/.test(writing));
check("and a cover when there is one", /data-eac-thread-field="cover"/.test(writing));
check("and no when/where lines", !/data-eac-thread-field="when"/.test(writing));
check("it declares its shape", /data-eac-shape="writing"/.test(writing));

const noCover = threadCardMarkup({ id: "w2", title: "No cover", kind: "post" }, DARK_BLOCK_PALETTE);
// An <img> with an empty src is a broken-image icon in a mail client.
check("a coverless post omits the image entirely", !/<img/.test(noCover));

const tokenCard = threadCardMarkup({}, DARK_BLOCK_PALETTE, { shape: "gathering", tokens: true, empty: true });
check("a template card carries tokens, not values", tokenCard.includes("{meetingTitle}") && tokenCard.includes("{when}"));
check("and is not reported as a linked card", referencedThreadIds(tokenCard).length === 0);

// A writing card resolves through the same resolver.
const wLive = new Map([["w1", {
  id: "w1", title: "On attention", kind: "post", published: "3 October 2026",
  coverUrl: "https://x.org/new.jpg", url: "https://x.org/b", orgName: "InnerGathering",
}]]);
const wOut = resolveThreadCards(
  threadCardMarkup({ id: "w1", title: "old", kind: "post", coverUrl: "https://x.org/old.jpg" }, DARK_BLOCK_PALETTE),
  wLive as never
);
check("a writing card fills its date", wOut.html.includes("3 October 2026"));
check("and swaps its cover", wOut.html.includes("https://x.org/new.jpg"));

// ── the origin a recipient can reach ─────────────────────────────────────────
import { publicBaseUrl } from "../src/index";

check(
  "a localhost env var loses to the real forwarded host",
  publicBaseUrl("http://localhost:3015", "https", "elkdonis-arts.org") ===
    "https://elkdonis-arts.org"
);
check(
  "a real configured origin still wins",
  publicBaseUrl("https://amritcanada.ca", "https", "elkdonis-arts.org") ===
    "https://amritcanada.ca"
);
check(
  "a private address is treated as a developer default",
  publicBaseUrl("http://172.16.7.13:3015", "https", "elkdonis-arts.org") ===
    "https://elkdonis-arts.org"
);
check(
  "a comma-joined forwarded header takes the first hop",
  publicBaseUrl(undefined, "https,http", "elkdonis-arts.org, internal") ===
    "https://elkdonis-arts.org"
);
check("trailing slashes are dropped", publicBaseUrl("https://x.org/", null, null) === "https://x.org");

console.log(failed === 0 ? "\nall checks passed" : `\n${failed} failed`);
if (failed > 0) process.exitCode = 1;
