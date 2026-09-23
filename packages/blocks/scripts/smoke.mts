/**
 * Runtime smoke test for the block library.
 *
 * Type-checking proves the declarations agree with the components. This proves
 * the things types cannot: that coercion turns real attribute strings into the
 * values a component wants, that an unknown option falls back instead of
 * rendering nothing, and that every block actually produces markup from its
 * own sample props.
 *
 *   pnpm --filter @elkdonis/blocks test
 */
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import {
  Region,
  sharedCatalogue,
  coerceProps,
  propsFromAttributes,
  toPuckFields,
  toSilexTraits,
  embedUrlFor,
  toDefaultProps,
  slotNames,
} from "../src/index.js";

let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  console.log(`${ok ? "  ok  " : "FAIL  "}${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

// ── The catalogue ───────────────────────────────────────────────────────────
console.log(`\ncatalogue: ${sharedCatalogue.defs.length} blocks`);
for (const def of sharedCatalogue.defs) {
  console.log(`  ${def.id.padEnd(16)} ${def.styling.padEnd(9)} ${def.props.length} props${def.dataDriven ? "  [data-driven]" : ""}`);
}

// ── Coercion ────────────────────────────────────────────────────────────────
console.log("\ncoercion");
const feed = sharedCatalogue.get("thread-feed")!;

const coerced = coerceProps(feed.def, { limit: "3", showCovers: "false", layout: "grid" });
check("number from attribute string", coerced.limit === 3, `limit=${JSON.stringify(coerced.limit)}`);
check("boolean 'false' is false", coerced.showCovers === false);
check("valid select passes", coerced.layout === "grid");

const bad = coerceProps(feed.def, { limit: "not-a-number", layout: "carousel" });
check("unparseable number falls back to default", bad.limit === 10, `limit=${JSON.stringify(bad.limit)}`);
check("unknown select option falls back", bad.layout === "list", `layout=${JSON.stringify(bad.layout)}`);

const empty = coerceProps(feed.def, {});
check("missing props take declared defaults", empty.limit === 10 && empty.showCovers === true);

const extra = coerceProps(feed.def, { limit: "2", onclick: "alert(1)" } as never);
check("undeclared props are dropped", !("onclick" in extra));

// ── Attributes, the Silex path ──────────────────────────────────────────────
console.log("\nattributes");
const attrs: Record<string, string> = { "data-limit": "5", "data-show-covers": "true", "data-layout": "grid" };
const fromAttrs = propsFromAttributes(feed.def, (n) => attrs[n] ?? null);
check("camelCase prop reads its kebab attribute", fromAttrs.showCovers === true, "data-show-covers → showCovers");
check("limit round-trips as a number", fromAttrs.limit === 5);

// ── Editor adapters ─────────────────────────────────────────────────────────
console.log("\neditor adapters");
const puck = toPuckFields(feed.def);
check("puck field per declared prop", Object.keys(puck).length === feed.def.props.length);
check("select becomes a puck select with options", puck.layout?.type === "select" && puck.layout.options?.length === 2);
check("boolean becomes a radio", puck.showCovers?.type === "radio");
const silex = toSilexTraits(feed.def);
check("silex trait names are data-attributes", silex.every((t) => t.name.startsWith("data-")));
check("silex select carries {id,name} options", silex.find((t) => t.name === "data-layout")?.options?.[0]?.id === "list");
check("defaults come from the declaration", toDefaultProps(feed.def).limit === 10);

// ── Every block renders from its own sample ─────────────────────────────────
console.log("\nrender");
for (const block of sharedCatalogue.all) {
  const props = block.sample ? block.sample() : ({} as never);
  let html = "";
  let err: unknown = null;
  try {
    html = renderToStaticMarkup(createElement(block.Component as never, props));
  } catch (e) {
    err = e;
  }
  check(
    `${block.def.id} renders`,
    !err && html.length > 0,
    err ? String(err) : `${html.length} chars`
  );
}

// A data-driven block with no rows must say so rather than vanish.
const emptyFeed = renderToStaticMarkup(
  createElement(feed.Component as never, { items: [], emptyMessage: "Nothing scheduled." } as never)
);
check("empty feed states it is empty", emptyFeed.includes("Nothing scheduled."));

// An unrecognised status must render nothing, never a wrong claim.
const badge = sharedCatalogue.get("cycle-badge")!;
const wrong = renderToStaticMarkup(createElement(badge.Component as never, { status: "maybe" } as never));
check("unknown cycle status renders nothing", wrong === "", `got ${JSON.stringify(wrong.slice(0, 40))}`);

// ── Slots: the exception to "every prop survives an HTML attribute" ─────────
//
// A slot is a REGION, not a value. Every adapter that turns props into or out
// of strings has to skip it, and each of those skips is asserted here because
// getting one wrong fails quietly: a slot coerced to a string would reach the
// component as the text "[object Object]" rather than as the blocks someone
// dropped in.

const split = sharedCatalogue.get("split-row")!;
check("split-row is in the catalogue", !!split);
check(
  "slotNames finds both regions",
  JSON.stringify(slotNames(split.def)) === '["start","end"]',
  JSON.stringify(slotNames(split.def))
);

const traits = toSilexTraits(split.def);
check(
  "Silex traits skip slots",
  !traits.some((t) => t.name === "data-start" || t.name === "data-end"),
  traits.map((t) => t.name).join(", ")
);
// Counted from the declaration rather than hard-coded, so adding a setting to
// the block is not a test failure — only losing one, or leaking a slot, is.
const splitSettings = split.def.props.filter((p) => p.kind !== "slot").length;
check(
  "Silex traits keep the real settings",
  traits.length === splitSettings,
  `${traits.length} of ${splitSettings}`
);

const splitPuck = toPuckFields(split.def);
check("Puck maps start to a slot field", splitPuck.start?.type === "slot", JSON.stringify(splitPuck.start));
check("Puck maps end to a slot field", splitPuck.end?.type === "slot");
check("Puck maps ratio to a select", splitPuck.ratio?.type === "select");
check(
  "the ratio select carries its options",
  (splitPuck.ratio?.options?.length ?? 0) === 5,
  String(splitPuck.ratio?.options?.length)
);

const defaults = toDefaultProps(split.def);
check("defaults skip slots", !("start" in defaults) && !("end" in defaults), JSON.stringify(defaults));
check("defaults keep ratio", defaults.ratio === "even");

// Coercion must leave a slot alone rather than defaulting it to a string.
const splitCoerced = coerceProps(split.def, { ratio: "wide-end" });
check("coerce keeps a slot out of the prop bag", !("start" in splitCoerced), JSON.stringify(splitCoerced));
check("coerce still reads the select", splitCoerced.ratio === "wide-end");

// An unknown ratio falls back rather than reaching CSS as an unmatched value,
// which would leave the row with no grid-template-columns at all.
const badRatio = coerceProps(split.def, { ratio: "diagonal" });
check("unknown ratio falls back to even", badRatio.ratio === "even", String(badRatio.ratio));

const splitAttrs = propsFromAttributes(split.def, (n) =>
  n === "data-ratio" ? "sidebar-end" : null
);
check("attributes skip slots", !("start" in splitAttrs), JSON.stringify(splitAttrs));
check("attributes still parse the select", splitAttrs.ratio === "sidebar-end");

// And the block itself renders what it was handed, into both columns.
const rendered = renderToStaticMarkup(
  createElement(split.Component as never, {
    ratio: "wide-start",
    start: createElement("p", null, "Left side"),
    end: createElement("p", null, "Right side"),
  } as never)
);
check("split renders both regions", rendered.includes("Left side") && rendered.includes("Right side"));
check("split writes the ratio to the DOM", rendered.includes('data-ratio="wide-start"'), rendered.slice(0, 90));

// ── Both shapes of a slot ───────────────────────────────────────────────────
//
// The whole reason <Region> exists: a hand-written page passes JSX, an editor
// passes a function that draws a drop zone, and React throws on a function
// child. Both paths must produce one element carrying the block's class, or
// the CSS only works for one kind of caller.

const asJsx = renderToStaticMarkup(
  createElement(split.Component as never, {
    start: createElement("p", null, "written by hand"),
    end: null,
  } as never)
);
check("a JSX slot renders", asJsx.includes("written by hand"));
check("...inside the block's own class", /class="blk-split-col"[^>]*><p>written by hand/.test(asJsx), asJsx);
check("an empty slot still draws its column", (asJsx.match(/blk-split-col/g) ?? []).length === 2, asJsx);

// Stand in for an editor's zone: a component that records what it was handed.
let zoneProps: Record<string, unknown> | undefined;
const FakeZone = (props: Record<string, unknown>) => {
  zoneProps = props;
  return createElement("span", null, "DROP ZONE");
};
const asZone = renderToStaticMarkup(
  createElement(split.Component as never, { start: FakeZone, end: null } as never)
);
check("a function slot renders instead of throwing", asZone.includes("DROP ZONE"), asZone);
// The point of moving this out of the adapter: these reach the zone now.
check("the block's class reaches the zone", zoneProps?.className === "blk-split-col", JSON.stringify(zoneProps));
// Only what the block actually specified may be sent. A key present with an
// `undefined` value survives an object spread and would DELETE the editor's
// own default — which for `allow` means silently removing a restriction the
// block declared.
check(
  "undefined props are omitted, not sent as undefined",
  zoneProps !== undefined && !("allow" in zoneProps) && !("minEmptyHeight" in zoneProps),
  JSON.stringify(Object.keys(zoneProps ?? {}))
);
check("only the class was passed", JSON.stringify(zoneProps) === '{"className":"blk-split-col"}', JSON.stringify(zoneProps));

// ...and what IS specified still gets through.
let explicit: Record<string, unknown> | undefined;
const Probe = (props: Record<string, unknown>) => { explicit = props; return null; };
renderToStaticMarkup(
  createElement(Region as never, { of: Probe, className: "x", minEmptyHeight: 200 } as never)
);
check(
  "explicit region props pass through",
  explicit?.className === "x" && explicit?.minEmptyHeight === 200,
  JSON.stringify(explicit)
);

// Permissions are NOT a region prop. Puck 0.23 moved them to the field,
// because as a prop they only constrained the canvas and left the outline
// able to drop anything. A block declares what its region accepts, and the
// adapter puts that on the slot field — one statement, every surface.
check(
  "a region does not carry permissions",
  !("allow" in (explicit ?? {})) && !("disallow" in (explicit ?? {})),
  JSON.stringify(Object.keys(explicit ?? {}))
);
const gatedDef = {
  id: "gated", label: "G", description: "", memberSafe: true, styling: "tokens" as const,
  props: [{ name: "only", kind: "slot" as const, label: "Only", allow: ["figure"] }],
};
const gatedField = toPuckFields(gatedDef).only as { type: string; allow?: string[] };
check(
  "a declared restriction reaches the slot field",
  gatedField.type === "slot" && JSON.stringify(gatedField.allow) === '["figure"]',
  JSON.stringify(gatedField)
);
check("explicit minEmptyHeight passes through", explicit?.minEmptyHeight === 200);

// ── The catalogue as a whole ────────────────────────────────────────────────

console.log(`\ncatalogue is now ${sharedCatalogue.defs.length} blocks`);
for (const def of sharedCatalogue.defs) {
  // Every block must render from its own sample without throwing — that is
  // what an editor's palette and a preview both rely on.
  let html = "";
  let err: unknown = null;
  const block = sharedCatalogue.get(def.id)!;
  try {
    html = renderToStaticMarkup(createElement(block.Component as never, (block.sample?.() ?? {}) as never));
  } catch (e) {
    err = e;
  }
  check(`${def.id} renders from sample`, !err, err ? String(err) : "");
  check(`${def.id} declares a category`, !!def.category, def.category ?? "(none)");
}

// Text must never become markup. A block library whose text block renders HTML
// is an XSS hole on every public page it is placed on.
const proseBlock = sharedCatalogue.get("prose")!;
const injected = renderToStaticMarkup(
  createElement(proseBlock.Component as never, { body: "<img src=x onerror=alert(1)>\n\nsecond" } as never)
);
check("prose escapes markup", !injected.includes("<img src=x"), injected.slice(0, 90));
check("prose splits on a blank line", (injected.match(/<p>/g) ?? []).length === 2, injected);

// An empty or missing required value must draw nothing rather than an empty frame.
for (const [id, props] of [
  ["prose", { body: "" }],
  ["quote", { text: "   " }],
  ["figure", { src: "" }],
  ["link-button", { label: "Go", href: "" }],
] as const) {
  const b = sharedCatalogue.get(id)!;
  const out = renderToStaticMarkup(createElement(b.Component as never, props as never));
  check(`${id} renders nothing when unset`, out === "", out.slice(0, 60));
}

// A card with a link must BE a link, not a div someone attached a click to.
const card = sharedCatalogue.get("feature-card")!;
const linked = renderToStaticMarkup(createElement(card.Component as never, { title: "T", href: "/x" } as never));
check("a linked card is an anchor", linked.startsWith("<a ") && linked.includes('href="/x"'), linked.slice(0, 70));
const plain = renderToStaticMarkup(createElement(card.Component as never, { title: "T" } as never));
check("an unlinked card is an article", plain.startsWith("<article"), plain.slice(0, 70));

// A new tab must say so, and must not leak the opener.
const nt = renderToStaticMarkup(
  createElement(sharedCatalogue.get("link-button")!.Component as never, { label: "Go", href: "/x", newTab: true } as never)
);
check("new tab sets noopener noreferrer", nt.includes('rel="noopener noreferrer"'), nt.slice(0, 120));
check("new tab is announced", nt.includes("opens in a new tab"));

// Heading level must actually change the element, not just its size.
const h = renderToStaticMarkup(
  createElement(sharedCatalogue.get("section-heading")!.Component as never, { title: "T", level: "h3" } as never)
);
check("heading level is honoured", h.includes("<h3"), h.slice(0, 80));

// ── Wrapping: the float mechanism ───────────────────────────────────────────
//
// These are the checks that would have caught the two ways this feature can be
// quietly broken: a figure that carries no float marker for the stylesheet to
// act on, and a size that reaches the page unclamped.
console.log("\nwrapping");

const fig = sharedCatalogue.get("figure")!;
const floated = renderToStaticMarkup(
  createElement(fig.Component as never, {
    src: "/x.jpg",
    alt: "a",
    float: "left",
    size: 35,
  } as never)
);
check('a floated figure marks itself', floated.includes('data-float="left"'), floated.slice(0, 120));
check("a floated figure carries its width inline", floated.includes("--blk-figure-size:35%"), floated.slice(0, 160));

const unfloated = renderToStaticMarkup(
  createElement(fig.Component as never, { src: "/x.jpg", alt: "a" } as never)
);
check('an unfloated figure says so', unfloated.includes('data-float="none"'));
check("an unfloated figure sets no width", !unfloated.includes("--blk-figure-size"));

// The stylesheet spaces "every child that is not floated". That selector only
// works because the attribute is always present.
check(
  "the flowing-column selector has an attribute to match",
  unfloated.includes("data-float="),
  "data-float must be present even when none"
);

const sized = coerceProps(fig.def, { size: "400" });
check("an out-of-range width is clamped", sized.size === 100, `size=${JSON.stringify(sized.size)}`);
const tiny = coerceProps(fig.def, { size: "-5" });
check("a negative width is clamped", tiny.size === 15, `size=${JSON.stringify(tiny.size)}`);

const figFields = toPuckFields(fig.def);
const sizeField = figFields.size as { type: string; min?: number; max?: number; step?: number };
check(
  "the width reaches the editor as a bounded number",
  sizeField?.type === "number" && sizeField.min === 15 && sizeField.max === 100,
  JSON.stringify(sizeField)
);

const ti = sharedCatalogue.get("text-image")!;
const beside = renderToStaticMarkup(
  createElement(ti.Component as never, {
    src: "/x.jpg",
    body: "one\n\ntwo",
    place: "left",
    size: 30,
  } as never)
);
check('text-image marks its placement', beside.includes('data-place="left"'));
check("text-image carries its width inline", beside.includes("--blk-textimg-size:30%"), beside.slice(0, 200));
check(
  "the image comes before the text it pushes aside",
  beside.indexOf("blk-textimg-figure") < beside.indexOf("blk-textimg-body"),
  "a float only moves what follows it"
);

// Below the text is the one placement where the order flips — visual order and
// DOM order have to agree, or the caption is read out before the words.
const under = renderToStaticMarkup(
  createElement(ti.Component as never, { src: "/x.jpg", body: "one", place: "below" } as never)
);
check(
  "an image below the text comes after it in the DOM",
  under.indexOf("blk-textimg-body") < under.indexOf("blk-textimg-figure"),
  under.slice(0, 120)
);

const textOnly = renderToStaticMarkup(
  createElement(ti.Component as never, { src: "", body: "just words" } as never)
);
check("text-image draws with no image yet", textOnly.includes("just words"));
const neither = renderToStaticMarkup(
  createElement(ti.Component as never, { src: "", body: "  " } as never)
);
check("text-image renders nothing when empty", neither === "", neither.slice(0, 60));

const injectedImg = renderToStaticMarkup(
  createElement(ti.Component as never, { src: "/x.jpg", body: "<b>bold</b>" } as never)
);
check("text-image escapes markup", !injectedImg.includes("<b>bold"), injectedImg.slice(0, 160));

// The flowing column exists only to be a normal-flow region. If its class were
// dropped the wrap would silently stop happening in it.
const col = sharedCatalogue.get("flow-column")!;
const colOut = renderToStaticMarkup(
  createElement(col.Component as never, { content: "x" } as never)
);
check("the text column renders its flowing region", colOut.includes("blk-flow-body"), colOut.slice(0, 120));

const splitFlowing = renderToStaticMarkup(
  createElement(split.Component as never, { columns: "flowing" } as never)
);
check(
  "two columns can be put into flowing mode",
  splitFlowing.includes('data-columns="flowing"'),
  splitFlowing.slice(0, 120)
);

// ── Direct manipulation: what an editor needs to offer a drag ───────────────
//
// The gesture lives in the editor package, but everything it needs is declared
// HERE, and a rename on this side breaks it silently over there.
console.log("\nmanipulation");

for (const id of ["text-image", "figure"]) {
  const b = sharedCatalogue.get(id)!;
  const m = b.def.manipulate;
  check(`${id} declares how to manipulate it`, !!m, JSON.stringify(m));
  if (!m) continue;
  const names = new Set(b.def.props.map((p) => p.name));
  for (const key of ["place", "size", "offset"] as const) {
    const prop = m[key];
    check(
      `${id}.manipulate.${key} names a real prop`,
      !!prop && names.has(prop),
      `${key} → ${prop}`
    );
  }
}

// The element the editor grabs. Without the attribute the handles have nothing
// to attach to and the drag silently does nothing.
const draggable = renderToStaticMarkup(
  createElement(ti.Component as never, { src: "/x.jpg", body: "w", place: "left" } as never)
);
check('text-image marks its drag target', draggable.includes('data-drag-target="image"'), draggable.slice(0, 160));

const floatedFig = renderToStaticMarkup(
  createElement(fig.Component as never, { src: "/x.jpg", float: "left" } as never)
);
check("a floated figure marks its drag target", floatedFig.includes('data-drag-target="image"'));
const staticFig = renderToStaticMarkup(createElement(fig.Component as never, { src: "/x.jpg" } as never));
check(
  "an unfloated figure does NOT",
  !staticFig.includes("data-drag-target"),
  "nothing to drag when it is not beside any text"
);

// Sliding down the text. Written only when set, because `0px` would override
// the stylesheet's own optical offset.
const slid = renderToStaticMarkup(
  createElement(ti.Component as never, { src: "/x.jpg", body: "w", place: "left", offsetY: 120 } as never)
);
check("an offset image carries it inline", slid.includes("--blk-textimg-offset:120px"), slid.slice(0, 200));
check("an unmoved image writes no offset", !draggable.includes("--blk-textimg-offset"));

// Tight wrap. The silhouette comes from the image's own alpha channel.
const tight = renderToStaticMarkup(
  createElement(ti.Component as never, { src: "/cut out.png", body: "w", place: "left", wrap: "tight" } as never)
);
check('tight wrap is announced', tight.includes('data-wrap="tight"'));
check(
  "the shape points at the image, url-encoded",
  tight.includes("--blk-textimg-shape:url(&quot;/cut%20out.png&quot;)"),
  tight.slice(tight.indexOf("--blk-textimg-shape"), tight.indexOf("--blk-textimg-shape") + 70)
);
check("a square wrap sets no shape", !draggable.includes("--blk-textimg-shape"));

// ── Rows: structured, repeatable items ──────────────────────────────────────
//
// The second exception to "every kind survives an HTML attribute", and the one
// that lets a CV, a wall of pictures or an exhibition history be DATA rather
// than forty dragged blocks.
console.log("\nrows");

const wall = sharedCatalogue.get("picture-wall")!;
const rowsProp = wall.def.props.find((p) => p.name === "pictures")!;
check("a rows prop declares its columns", (rowsProp.fields?.length ?? 0) === 6, String(rowsProp.fields?.length));

const wallFields = toPuckFields(wall.def);
const arrayField = wallFields.pictures as {
  type: string;
  arrayFields: Record<string, { type: string }>;
  getItemSummary?: (item: Record<string, unknown>, i?: number) => string;
};
check("rows become an array field with real columns", arrayField.type === "array" && !!arrayField.arrayFields.src);
check(
  "a row is named by its own content, not its position",
  arrayField.getItemSummary?.({ caption: "Medicine Buddha" }) === "Medicine Buddha",
  arrayField.getItemSummary?.({ caption: "Medicine Buddha" })
);
check(
  "an empty row still gets a handle",
  arrayField.getItemSummary?.({}, 2) === "Picture 3",
  arrayField.getItemSummary?.({}, 2)
);

// Rows have no attribute form, like a slot — and unlike a slot they ARE
// coerced, because they are a value that lives in the saved page JSON.
check("rows are skipped by Silex traits", !toSilexTraits(wall.def).some((t) => t.name === "data-pictures"));
const coercedRows = coerceProps(wall.def, {
  pictures: [{ src: "/a.jpg", caption: "A", nope: "dropped" }, "not-an-object"],
} as never);
const got = coercedRows.pictures as Record<string, unknown>[];
check("each row is coerced against its columns", got.length === 1 && got[0]!.src === "/a.jpg", JSON.stringify(got));
check("an undeclared column is dropped", !("nope" in got[0]!));
check("a row that is not an object is dropped", got.length === 1);
check(
  "rows with nothing supplied fall back to an array, never undefined",
  Array.isArray(coerceProps(wall.def, {}).pictures),
  JSON.stringify(coerceProps(wall.def, {}).pictures)
);

// Half-filled rows are the normal state of an unfinished page and must not
// draw empty frames or blank lines.
const wallOut = renderToStaticMarkup(
  createElement(wall.Component as never, { pictures: [{ src: "" }, { src: "/x.jpg", alt: "x" }] } as never)
);
check("a picture row with no image draws nothing", (wallOut.match(/<img/g) ?? []).length === 1, wallOut.slice(0, 120));

const list = sharedCatalogue.get("entry-list")!;
const listOut = renderToStaticMarkup(
  createElement(list.Component as never, { entries: [{ year: "", text: "" }, { year: "2024", text: "Show" }] } as never)
);
check("an empty entry draws nothing", (listOut.match(/<dt/g) ?? []).length === 1, listOut.slice(0, 160));
check("a dated list is a description list", listOut.startsWith("<dl"), listOut.slice(0, 40));

// ── Video: a URL becomes a player, or it does not ───────────────────────────
//
// The one place author input reaches an iframe src, so the parser refuses
// anything it does not recognise instead of guessing.
console.log("\nvideo");
const cases: Array<[string, string | null]> = [
  ["https://vimeo.com/76979871", "https://player.vimeo.com/video/76979871"],
  ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"],
  ["https://youtu.be/dQw4w9WgXcQ", "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"],
  ["https://example.com/a-film", null],
  ["javascript:alert(1)", null],
  ["not a url at all", null],
  ["https://vimeo.com/channels/staffpicks", null],
];
for (const [input, expected] of cases) {
  check(`embed: ${input.slice(0, 44)}`, embedUrlFor(input) === expected, String(embedUrlFor(input)));
}
const unknownHost = renderToStaticMarkup(
  createElement(sharedCatalogue.get("video")!.Component as never, { url: "https://example.com/film", title: "A film" } as never)
);
check("an unrecognised host becomes a link, not a blank frame", unknownHost.includes("<a ") && !unknownHost.includes("<iframe"), unknownHost.slice(0, 120));

// ── The contact form's two boundaries ───────────────────────────────────────
console.log("\ncontact form");
const form = sharedCatalogue.get("contact-form")!;
check("the form declares itself interactive", form.def.interactive === true, "or its editor context breaks the published page");
check("the form is not member-placeable", form.def.memberSafe === false, "a channel into the org is an editor's decision");
const formOut = renderToStaticMarkup(createElement(form.Component as never, form.sample!() as never));
check("the form posts nowhere the author chose", !form.def.props.some((p) => /endpoint|url|action/i.test(p.name)));
check("the form has a honeypot", formOut.includes('name="company"'), "unfilled by people, filled by bots");

// ── The FAQ, and what was and was not taken from HyperUI ────────────────────
console.log("\nfaq");
const faqBlock = sharedCatalogue.get("faq")!;
const faqOut = renderToStaticMarkup(createElement(faqBlock.Component as never, faqBlock.sample!() as never));
check(
  "questions are <details>, so they work without JavaScript",
  (faqOut.match(/<details/g) ?? []).length === 3,
  faqOut.slice(0, 80)
);
check("each has a <summary>", (faqOut.match(/<summary/g) ?? []).length === 3);
check("the first one is open", faqOut.includes("<details class=\"blk-faq-item\" open"), faqOut.slice(0, 120));
check(
  "it ships no JavaScript",
  faqBlock.def.interactive !== true,
  "a details element is the browser's own behaviour"
);
check(
  "nothing Tailwind came across with the structure",
  !/class="[^"]*(flex items-center|text-lg|rounded-md|group-open|dark:)/.test(faqOut),
  "utility classes render as nothing in an app that does not compile them"
);
const faqEmpty = renderToStaticMarkup(
  createElement(faqBlock.Component as never, { items: [{ question: "  ", answer: "x" }] } as never)
);
check("a question with no text draws nothing", faqEmpty === "", faqEmpty.slice(0, 60));

// Every block in the library must still be portable to an app with its own
// stylesheet. This is the check that would catch a Tailwind block slipping in.
const tailwindBlocks = sharedCatalogue.defs.filter((d) => d.styling !== "tokens").map((d) => d.id);
check(
  "every block is token-styled, so it renders on ifac and danamccool too",
  tailwindBlocks.length === 0,
  tailwindBlocks.join(", ") || "all tokens"
);

// The stylesheet is the other half of every check above. A rule renamed there
// and not here is the failure mode this catches.
const css = readFileSync(new URL("../src/blocks.css", import.meta.url), "utf8");
for (const rule of [
  ".blk-faq-item[open] .blk-faq-mark",
  "grid-template-columns: subgrid",
  // The rule that makes "start lower" mean anything. A float's exclusion is
  // its MARGIN box, so a top margin alone moves the picture down and still
  // refuses the text the band above it — measured at 157px of dead space.
  "shape-outside: inset(var(--blk-textimg-offset, 0px) 0 0 0)",
  "shape-outside: inset(var(--blk-figure-offset, 0px) 0 0 0)",
  "shape-outside: var(--blk-textimg-shape)",
  "shape-outside: var(--blk-figure-shape)",
  "var(--blk-textimg-offset, 0.35rem)",
  "var(--blk-figure-offset, 0.35rem)",
  ".blk-flow-body",
  "display: flow-root",
  '.blk-figure[data-float="left"]',
  '.blk-textimg[data-place="right"] .blk-textimg-figure',
  '.blk-split[data-columns="flowing"] .blk-split-col',
]) {
  check(`blocks.css still has ${rule}`, css.includes(rule));
}
check(
  "a float is dropped on a narrow screen",
  /@media \(max-width: 640px\)[\s\S]{0,400}float: none/.test(css),
  "wrapping beside an image in a phone-width column is unreadable"
);

console.log(failures === 0 ? "\nall checks passed\n" : `\n${failures} FAILED\n`);
process.exit(failures === 0 ? 0 : 1);
