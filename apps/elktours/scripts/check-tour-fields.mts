// Checks for the tour page's in-place editing (src/lib/tour-fields.ts): who may change a tour's words, that nothing but a
// published tour can be changed, that every save keeps ONE previous version and "put back" restores it, that hostile input
// is refused or cleaned, and that the database is byte-identical afterwards. Everything runs inside one transaction that is
// rolled back; nothing is committed.
//   cd ~/eac && sudo -n docker compose run --rm --no-deps -w /app/apps/elktours admin node \
//     /app/node_modules/.pnpm/tsx@4.20.6/node_modules/tsx/dist/cli.mjs scripts/check-tour-fields.mts
import React from "react";
(globalThis as any).React = React;
import { randomUUID } from "node:crypto";

process.env.BOOKING_TABLES = "1"; // as the live site runs
const { db } = await import("@elkdonis/db");
const tf = await import("../src/lib/tour-fields");

type Sql = typeof db;
const PUBLISHED = "elkIleCite1tour000001"; // a real published tour with dates on the booking tables (Ile de la Cite)
const DRAFT = "elkMediev01tour000004"; // a real draft tour
let failed = 0;
let passed = 0;
function check(name: string, ok: boolean, detail = "") {
  if (ok) passed++;
  else failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : detail ? `  -> ${detail}` : ""}`);
}
class Rollback extends Error {}

async function fingerprint(): Promise<string> {
  const [a] = (await db`SELECT md5(t::text) AS h FROM threads t WHERE id = ${PUBLISHED}`) as unknown as { h: string }[];
  const [b] = (await db`SELECT md5(COALESCE(string_agg(s::text, ',' ORDER BY s.id), '')) AS h FROM tour_stops s WHERE thread_id = ${PUBLISHED}`) as unknown as { h: string }[];
  const [c] = (await db`SELECT md5(t::text) AS h FROM threads t WHERE id = ${DRAFT}`) as unknown as { h: string }[];
  const [e] = (await db`SELECT md5(COALESCE(string_agg(s::text, ',' ORDER BY s.id), '')) AS h FROM booking_slots s JOIN booking_offers o ON o.id = s.offer_id WHERE o.thread_id = ${PUBLISHED}`) as unknown as { h: string }[];
  return `${a!.h}|${b!.h}|${c!.h}|${e!.h}`;
}

const before = await fingerprint();

try {
  await db.begin(async (rawTx) => {
    const tx = rawTx as unknown as Sql;
    const [t] = (await tx`SELECT id, title, slug, excerpt, author_id, metadata FROM threads WHERE id = ${PUBLISHED} AND org_id = 'elktours'`) as unknown as any[];
    const [d] = (await tx`SELECT id, author_id FROM threads WHERE id = ${DRAFT} AND org_id = 'elktours'`) as unknown as any[];
    const [stop] = (await tx`SELECT id, excerpt FROM tour_stops WHERE thread_id = ${PUBLISHED} ORDER BY position LIMIT 1`) as unknown as any[];
    const [ow] = (await tx`SELECT user_id FROM user_organizations WHERE org_id = 'elktours' AND role = 'owner' LIMIT 1`) as unknown as any[];
    check("setup: a published tour, a draft tour, a stop, an owner exist", !!(t && d && stop && ow));

    const guide: any = { userId: t.author_id, role: "guide" }; // the guide who wrote the tour
    const owner: any = { userId: ow.user_id, role: "owner" };
    const stranger: any = { userId: randomUUID(), role: "guide" }; // a guide of the organisation, not of this tour
    const outsider: any = { userId: randomUUID(), role: null }; // signed in, not a member
    const origTitle = t.title as string;
    const origStopLine = (stop.excerpt ?? "") as string;

    // ── who may ──
    check("the tour's own guide may edit a published tour", (await tf.mayEditTour(tx, guide, { id: PUBLISHED, status: "published", visibility: "PUBLIC", author_id: t.author_id })) === true);
    check("an owner may edit any published tour", (await tf.mayEditTour(tx, owner, { id: PUBLISHED, status: "published", visibility: "PUBLIC", author_id: t.author_id })) === true);
    check("a guide who does not lead it may not", (await tf.mayEditTour(tx, stranger, { id: PUBLISHED, status: "published", visibility: "PUBLIC", author_id: t.author_id })) !== true);
    check("a non-member may not", (await tf.mayEditTour(tx, outsider, { id: PUBLISHED, status: "published", visibility: "PUBLIC", author_id: t.author_id })) !== true);
    check("nobody signed in may not", (await tf.mayEditTour(tx, null, { id: PUBLISHED, status: "published", visibility: "PUBLIC", author_id: t.author_id })) !== true);
    check("editableTourId: guide gets the id, stranger and signed-out get null",
      (await tf.editableTourId(tx, guide, PUBLISHED)) === PUBLISHED && (await tf.editableTourId(tx, stranger, PUBLISHED)) === null && (await tf.editableTourId(tx, null, PUBLISHED)) === null);

    // A guide who leads a coming date (not the author) may edit; made inside the transaction.
    const [dep] = (await tx`
      SELECT s.id FROM booking_slots s JOIN booking_offers o ON o.id = s.offer_id AND o.mode = 'set_dates'
      WHERE o.thread_id = ${PUBLISHED} AND s.status <> 'cancelled' LIMIT 1`) as unknown as any[];
    const [u] = (await tx`SELECT id FROM users WHERE id <> ${t.author_id} AND id <> ${ow.user_id} LIMIT 1`) as unknown as any[];
    check("setup: a date and a spare user exist for the 'leads a coming date' case", !!(dep && u));
    if (dep && u) {
      check("before it is assigned, that user may not edit", (await tf.editableTourId(tx, { userId: u.id, role: "guide" }, PUBLISHED)) === null);
      await tx`UPDATE booking_slots SET guide_user_id = ${u.id}, starts_at = NOW() + interval '10 days', ends_at = NOW() + interval '10 days 2 hours' WHERE id = ${dep.id}`;
      check("a guide leading a coming date may edit it", (await tf.editableTourId(tx, { userId: u.id, role: "guide" }, PUBLISHED)) === PUBLISHED);
      await tx`UPDATE booking_slots SET status = 'cancelled' WHERE id = ${dep.id}`;
      check("not once that date is cancelled", (await tf.editableTourId(tx, { userId: u.id, role: "guide" }, PUBLISHED)) === null);
    }

    // ── strangers are refused, and see nothing ──
    for (const [who, a] of [["a stranger", stranger], ["a non-member", outsider], ["signed-out", null]] as const) {
      const r = await tf.saveTourFields(tx, a, PUBLISHED, { title: "Hacked" });
      check(`${who} cannot save the title`, r.ok === false);
      const rd = await tf.readTourFields(tx, a, PUBLISHED);
      check(`${who} reads no values, only a reason`, !!rd && Object.keys(rd.values).length === 0 && !!rd.readOnly);
      check(`${who} cannot save a stop line`, (await tf.saveStopLine(tx, a, stop.id, "Hacked")).ok === false);
      check(`${who} cannot put anything back`, (await tf.putBackTourField(tx, a, PUBLISHED, "title")).ok === false);
    }
    const [afterStranger] = (await tx`SELECT title FROM threads WHERE id = ${PUBLISHED}`) as unknown as any[];
    check("the title is untouched after the refused saves", afterStranger.title === origTitle);

    // ── an unpublished tour refuses ──
    const rDraft = await tf.saveTourFields(tx, { userId: d.author_id, role: "guide" }, DRAFT, { title: "Draft edit" });
    check("a draft tour refuses its own guide", rDraft.ok === false && /published/i.test((rDraft as any).error));
    check("a draft tour refuses an owner too", (await tf.saveTourFields(tx, owner, DRAFT, { excerpt: "x" })).ok === false);
    await tx`UPDATE threads SET status = 'archived' WHERE id = ${PUBLISHED}`;
    check("a tour that was unpublished meanwhile refuses", (await tf.saveTourFields(tx, guide, PUBLISHED, { title: "Late" })).ok === false);
    await tx`UPDATE threads SET status = 'published' WHERE id = ${PUBLISHED}`;

    // ── each field saves, keeps the previous value, and puts back ──
    const fields: [string, string, string][] = [
      ["title", "Montmartre check title", "Montmartre second title"],
      ["excerpt", "A short check summary.", "A second check summary."],
      ["goodToKnow", "Wear walking shoes\nBring water", "Bring a coat"],
      ["contact", "guide@example.com", "Ask at the meeting point"],
    ];
    const metaBefore = (await tx`SELECT metadata->'tour' AS tour, metadata->'film' AS film, metadata->'coverImageUrl' AS cover FROM threads WHERE id = ${PUBLISHED}`) as unknown as any[];
    for (const [f, v1, v2] of fields) {
      const r0 = await tf.readTourFields(tx, guide, PUBLISHED);
      const was = r0!.values[f]!;
      const s1 = await tf.saveTourFields(tx, guide, PUBLISHED, { [f]: v1 });
      check(`${f}: the guide saves it`, s1.ok === true, (s1 as any).error);
      const r1 = await tf.readTourFields(tx, guide, PUBLISHED);
      check(`${f}: it reads back as saved`, r1!.values[f] === (f === "goodToKnow" ? v1 : v1), r1!.values[f]);
      check(`${f}: the value it replaced is kept (who and when)`, r1!.previous?.[f]?.value === was && !!r1!.previous?.[f]?.at, JSON.stringify(r1!.previous?.[f]));
      const s2 = await tf.saveTourFields(tx, guide, PUBLISHED, { [f]: v2 });
      const r2 = await tf.readTourFields(tx, guide, PUBLISHED);
      check(`${f}: a second save keeps only the one before it (one level)`, s2.ok === true && r2!.previous?.[f]?.value === v1 && r2!.values[f] === v2, JSON.stringify(r2!.previous?.[f]));
      const pb = await tf.putBackTourField(tx, guide, PUBLISHED, f);
      const r3 = await tf.readTourFields(tx, guide, PUBLISHED);
      check(`${f}: put back restores the previous version`, pb.ok === true && r3!.values[f] === v1, JSON.stringify(r3!.values[f]));
      check(`${f}: putting back again undoes it (they trade places)`, r3!.previous?.[f]?.value === v2);
      await tf.putBackTourField(tx, guide, PUBLISHED, f);
      const rSame = await tf.saveTourFields(tx, guide, PUBLISHED, { [f]: v2 });
      const rNoop = await tf.readTourFields(tx, guide, PUBLISHED);
      check(`${f}: saving the same value changes nothing and keeps the earlier version`, rSame.ok === true && (rSame as any).changed.length === 0 && rNoop!.previous?.[f]?.value === v1);
    }
    // The first save on a field that was empty keeps "" as its previous version.
    const [slugRow] = (await tx`SELECT slug, title FROM threads WHERE id = ${PUBLISHED}`) as unknown as any[];
    check("a title change leaves the web address alone", slugRow.slug === t.slug && slugRow.title !== origTitle);
    const metaAfter = (await tx`SELECT metadata->'tour' AS tour, metadata->'film' AS film, metadata->'coverImageUrl' AS cover FROM threads WHERE id = ${PUBLISHED}`) as unknown as any[];
    check("the office form's data, the film and the cover are untouched", JSON.stringify(metaBefore) === JSON.stringify(metaAfter));
    const [kv] = (await tx`SELECT metadata->'goodToKnow' AS g, metadata->'contact' AS c FROM threads WHERE id = ${PUBLISHED}`) as unknown as any[];
    check("good to know is stored as a list of lines, contact as text", Array.isArray(kv.g) && kv.g.length === 1 && kv.g[0] === "Bring a coat" && kv.c === "Ask at the meeting point", JSON.stringify(kv));

    // clearing
    check("good to know can be cleared", (await tf.saveTourFields(tx, guide, PUBLISHED, { goodToKnow: "" })).ok === true && (await tf.readTourFields(tx, guide, PUBLISHED))!.values.goodToKnow === "");
    check("the title cannot be emptied", (await tf.saveTourFields(tx, guide, PUBLISHED, { title: "  " })).ok === false);
    check("the title needs two letters", (await tf.saveTourFields(tx, guide, PUBLISHED, { title: "A" })).ok === false);

    // ── stop line ──
    const sl1 = await tf.saveStopLine(tx, guide, stop.id, "First stop line.");
    const sr1 = await tf.readStopLine(tx, guide, stop.id);
    check("stop line: the guide saves it and it reads back", sl1.ok === true && sr1!.values.line === "First stop line.", (sl1 as any).error);
    check("stop line: the replaced line is kept", sr1!.previous?.line?.value === origStopLine);
    await tf.saveStopLine(tx, guide, stop.id, "Second stop line.");
    const sr2 = await tf.readStopLine(tx, guide, stop.id);
    check("stop line: only one earlier version is kept", sr2!.previous?.line?.value === "First stop line.");
    await tf.putBackStopLine(tx, guide, stop.id);
    check("stop line: put back restores it", (await tf.readStopLine(tx, guide, stop.id))!.values.line === "First stop line.");
    check("stop line: an owner may write it too", (await tf.saveStopLine(tx, owner, stop.id, "Owner line.")).ok === true);
    check("stop line: a stop id that is not one is refused", (await tf.saveStopLine(tx, guide, "not-an-id", "x")).ok === false);

    // ── hostile input ──
    const big = "x".repeat(50_000);
    for (const f of ["title", "excerpt", "contact"]) check(`50,000 characters refused: ${f}`, (await tf.saveTourFields(tx, guide, PUBLISHED, { [f]: big })).ok === false);
    check("50,000 characters refused: good to know", (await tf.saveTourFields(tx, guide, PUBLISHED, { goodToKnow: big })).ok === false);
    check("50,000 characters refused: stop line", (await tf.saveStopLine(tx, guide, stop.id, big)).ok === false);
    check("a list of 500 bullets is refused", (await tf.saveTourFields(tx, guide, PUBLISHED, { goodToKnow: Array.from({ length: 500 }, (_, i) => `point ${i}`).join("\n") })).ok === false);
    check("a bullet of 301 characters is refused", (await tf.saveTourFields(tx, guide, PUBLISHED, { goodToKnow: "y".repeat(301) })).ok === false);
    check("a field that is not declared is refused", (await tf.saveTourFields(tx, guide, PUBLISHED, { slug: "other" })).ok === false && (await tf.saveTourFields(tx, guide, PUBLISHED, { status: "draft" })).ok === false);
    check("a value that is not text is refused", (await tf.saveTourFields(tx, guide, PUBLISHED, { title: { a: 1 } as any })).ok === false);
    const sc = await tf.saveTourFields(tx, guide, PUBLISHED, { title: "<script>alert(1)</script>Safe <b>title</b>", excerpt: '<img src=x onerror=alert(1)>Plain "summary"', goodToKnow: "<script>bad()</script>\n<b>kept</b> text\n\n  \n<a href=\"javascript:alert(1)\">link</a>", contact: "<i>me</i>@example.com" });
    const sr = await tf.readTourFields(tx, guide, PUBLISHED);
    check("script tags and markup are cleaned out of every field", sc.ok === true && !/[<>]/.test(JSON.stringify(sr!.values)) && !/script|onerror|javascript:/i.test(JSON.stringify(sr!.values)), JSON.stringify(sr!.values));
    check("the cleaned title and bullets keep the real words", sr!.values.title === "Safe title" && sr!.values.goodToKnow === "kept text\nlink", JSON.stringify(sr!.values));
    const sl = await tf.saveStopLine(tx, guide, stop.id, "<script>x()</script>Real <b>line</b>");
    check("a stop line is cleaned the same way", sl.ok === true && (await tf.readStopLine(tx, guide, stop.id))!.values.line === "Real line");

    throw new Rollback();
  });
} catch (e) {
  if (!(e instanceof Rollback)) {
    failed++;
    console.log("FAIL  the checks stopped with an error:", e);
  }
}

const after = await fingerprint();
check("after the rollback the rows are byte-identical (tour, stops, draft)", before === after, `${before} vs ${after}`);
console.log(`\n${passed} passed, ${failed} failed`);
await db.end({ timeout: 5 }).catch(() => {});
process.exit(failed ? 1 : 0);
