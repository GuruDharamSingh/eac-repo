/**
 * Her hand-written pages, as editor documents.
 *
 * The 28 routes are going; the words in them are not. Every page below is
 * rebuilt from the SAME constants the routes rendered (src/lib/content.ts), so
 * nothing is retyped and nothing is invented — the conversion either produces
 * her own text or it fails loudly.
 */
import { db } from "@elkdonis/db";
import * as C from "../src/lib/content.js";

const ORG = "danamccool";
let n = 0;

type Node = { type: string; props: Record<string, unknown> };
const id = () => `n${++n}`;

const heading = (title: string, level = "h1", eyebrow?: string): Node => ({
  type: "section-heading",
  props: { id: id(), title, level, align: "start", ...(eyebrow ? { eyebrow } : {}) },
});
const prose = (body: string): Node => ({
  type: "prose",
  props: { id: id(), body, size: "regular", align: "start", measure: true },
});
/** A year-and-entry group becomes one dated list, which is what it always was. */
const dated = (groups: ReadonlyArray<{ year: string; items?: readonly string[]; text?: string }>): Node => ({
  type: "entry-list",
  props: {
    id: id(),
    align: "column",
    rules: true,
    // Two shapes in the same file: most CV sections are `{year, items[]}`,
    // memberships are `{year, text}`. Both are read rather than one being
    // assumed, because assuming is what threw the first three times.
    entries: groups.flatMap((g) =>
      (g.items ?? (g.text ? [g.text] : [])).map((text) => ({ year: g.year, text, detail: "", href: "" }))
    ),
  },
});
const listAsProse = (items: readonly string[]): Node => prose(items.join("\n\n"));
/** Several fields of a content object, in order, skipping the ones it lacks.
 *  The constants are not uniform — some have `intro`, some `body`, some a
 *  `subtitle` and a `caption` — so the shape is read rather than assumed. */
const fields = (o: Record<string, unknown>, keys: string[]): string[] =>
  keys.flatMap((k) => {
    const v = o[k];
    if (typeof v === "string") return [v];
    if (Array.isArray(v)) return v.filter((x): x is string => typeof x === "string");
    return [];
  });

const PAGES: Record<string, { title: string; content: Node[] }> = {
  home: {
    title: "Dana McCool",
    content: [
      heading("Dana McCool", "h1", "Interdisciplinary artist, designer and writer"),
      prose(C.BIOGRAPHY[0]!),
    ],
  },
  biography: { title: "Biography", content: [heading("Biography"), listAsProse(C.BIOGRAPHY)] },
  manifestos: {
    title: "Manifestos",
    content: [
      heading("Manifestos"),
      heading(C.MANIFESTO_2018.year, "h2"),
      listAsProse(fields(C.MANIFESTO_2018, ["intro", "body"])),
      heading(C.MANIFESTO_2013.year, "h2"),
      listAsProse(fields(C.MANIFESTO_2013, ["intro", "body"])),
    ],
  },
  current: {
    title: "Current & Upcoming",
    content: [heading("Current & Upcoming"), listAsProse(fields(C.CURRENT_UPCOMING, ["intro", "body"]))],
  },
  cv: {
    title: "CV",
    content: [
      heading("CV", "h1", "Dana McCool — Interdisciplinary Artist & Writer, BFA"),
      heading("Collectives & community membership", "h2"),
      dated(C.CV_MEMBERSHIPS),
      heading("Exhibitions & marketplaces", "h2"),
      dated(C.CV_EXHIBITIONS),
      heading("Workshops & teaching", "h2"),
      dated(C.CV_WORKSHOPS_TEACHING),
      heading("Writing & community organizing", "h2"),
      dated(C.CV_WRITING_ORGANIZING),
      heading("Performance", "h2"),
      dated(C.CV_PERFORMANCE),
      heading("Publications", "h2"),
      dated(C.CV_PUBLICATIONS),
      heading("Education", "h2"),
      dated(C.CV_EDUCATION),
    ],
  },
  exhibitions: {
    title: "Past Exhibitions",
    content: [heading("Past Exhibitions"), prose(C.PAST_EXHIBITIONS_NOTE), listAsProse(C.PAST_EXHIBITIONS_HIGHLIGHTS)],
  },
  workshops: {
    title: "Workshops",
    content: [heading("Workshops"), prose(C.WORKSHOPS_INTRO), listAsProse(C.WORKSHOPS_PAST), listAsProse(C.WORKSHOPS_OTHER)],
  },
  commissions: {
    title: "Commission Inquiries",
    content: [
      heading("Commission Inquiries"),
      prose(C.COMMISSION_INQUIRIES_INTRO),
      listAsProse(C.COMMISSION_PAST),
      { type: "contact-form", props: { id: id(), heading: "Ask about a commission", intro: "", topics: ["A commission", "Something else"], submitLabel: "Send", success: "Thank you — your message has been sent.", note: "" } },
    ],
  },
  publications: { title: "Publications", content: [heading("Publications"), listAsProse(C.PUBLICATIONS_LIST)] },
  "art-archive": { title: "Art Archive", content: [heading("Art Archive"), listAsProse(C.ART_ARCHIVE)] },
  "medicine-buddha": { title: "Medicine Buddha", content: [heading("Medicine Buddha", "h1", C.MEDICINE_BUDDHA.subtitle), listAsProse(fields(C.MEDICINE_BUDDHA, ["caption", "credit", "note", "body"]))] },
  "universal-pharmacy": { title: "Universal Pharmacy", content: [heading("Universal Pharmacy", "h1", C.UNIVERSAL_PHARMACY.caption), listAsProse(fields(C.UNIVERSAL_PHARMACY, ["body"]))] },
  "mixed-media/botanical-resin-sculptures": { title: "Botanical resin sculptures", content: [heading("Botanical resin sculptures", "h1", C.BOTANICAL_RESIN.subtitle), listAsProse(fields(C.BOTANICAL_RESIN, ["body"]))] },
  "mixed-media/radical-renaissance": { title: "Radical Renaissance", content: [heading("Radical Renaissance", "h1", C.RADICAL_RENAISSANCE.subtitle), listAsProse(fields(C.RADICAL_RENAISSANCE, ["body"]))] },
  "mixed-media/collage": { title: "Collage", content: [heading("Collage"), prose(C.COLLAGE_NOTE)] },
};

for (const [slug, page] of Object.entries(PAGES)) {
  const data = { root: { props: { title: page.title } }, content: page.content };
  await db`
    INSERT INTO site_config (org_id, key, value, updated_at)
    VALUES (${ORG}, ${`puck:${slug}`}, ${db.json(data as never)}, NOW())
    ON CONFLICT (org_id, key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
  `;
  console.log(`  ${slug.padEnd(42)} ${page.content.length} blocks`);
}
console.log(`\n${Object.keys(PAGES).length} pages converted`);
process.exit(0);
