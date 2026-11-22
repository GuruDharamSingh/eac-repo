// check-drafts: org page drafts (contract C3). Every statement runs inside ONE transaction that is rolled back,
// against a made-up slug on one real organisation; the last lines prove no row is left. Prints "N passed, M failed".
//   sudo -n docker run --rm -u 3003 --network eac-network --env-file $HOME/eac/.env -v $HOME/eac:/app \
//     -w /app/packages/page-builder eac-dev node /app/node_modules/.pnpm/tsx@4.20.6/node_modules/tsx/dist/cli.mjs scripts/check-drafts.mts
import React from "react";
(globalThis as any).React = React;
import { readFileSync } from "node:fs";
const { db } = await import("@elkdonis/db");
const { sanitizeRichValues } = await import("@elkdonis/blocks");
const drafts = await import("../src/drafts");

let pass = 0, fail = 0;
const check = (name: string, cond: boolean, extra = "") => { cond ? pass++ : fail++; console.log(`${cond ? "ok  " : "FAIL"} ${name}${extra ? "  -> " + extra : ""}`); };
const J = (v: unknown) => JSON.stringify(v);
const RUN = Math.random().toString(36).slice(2, 8);
const SLUG = `door-check-${RUN}`;
const SLUG2 = `door-check-${RUN}-new`;
const page = (title: string) => ({ root: { props: { title } }, content: [{ type: "prose", props: { id: "p-1", body: `<p>${title}</p>` } }] });
const person = { id: "u-door-check", kind: "person" as const, label: "Door check" };
const ROLLBACK = new Error("rollback on purpose");

const [anyOrg] = await db<Array<{ org_id: string }>>`SELECT org_id FROM site_config WHERE key = 'puck:home' LIMIT 1`;
const ORG = anyOrg!.org_id;
console.log(`org under test: ${ORG.slice(0, 6)}... (never printed in full, no content read)`);
const leftovers = async () => (await db<Array<{ n: number }>>`SELECT count(*)::int AS n FROM site_config WHERE key LIKE ${"%" + RUN + "%"}`)[0]!.n;
check("nothing with this run's name exists before we start", (await leftovers()) === 0);

try {
  await db.begin(async (tx) => {
    const o = { tx };
    check("loadDraft of a page with no draft is null", (await drafts.loadDraft(ORG, SLUG, o)) === null);

    // A live page to start from, inside the transaction.
    const [live] = await tx<Array<{ version: string }>>`
      INSERT INTO site_config (org_id, key, value) VALUES (${ORG}, ${"puck:" + SLUG}, ${tx.json(page("Live one") as never)}) RETURNING updated_at::text AS version`;
    const base = live!.version;

    check("a draft with a bad author kind is refused", !(await drafts.saveDraft(ORG, SLUG, { data: page("x"), base, author: { id: "a", kind: "robot" as never, label: "x" } }, o)).ok);
    check("a draft that is not a page is refused", !(await drafts.saveDraft(ORG, SLUG, { data: { nope: true }, base, author: person }, o)).ok);
    check("a draft for a name that cannot be a page is refused", !(await drafts.saveDraft(ORG, "Not A Slug!", { data: page("x"), base, author: person }, o)).ok);
    check("a draft for a name too long for the key is refused", !(await drafts.saveDraft(ORG, `${"a".repeat(40)}/${"b".repeat(40)}/${"c".repeat(40)}`, { data: page("x"), base, author: person }, o)).ok);
    const huge = { root: { props: {} }, content: [{ type: "prose", props: { id: "p-1", body: "x".repeat(600 * 1024) } }] };
    check("a draft over the page size cap is refused", !(await drafts.saveDraft(ORG, SLUG, { data: huge, base, author: person }, o)).ok);
    check("a note over 500 characters is refused", !(await drafts.saveDraft(ORG, SLUG, { data: page("x"), base, author: person, note: "n".repeat(501) }, o)).ok);
    check("nothing was kept by the refusals", (await drafts.loadDraft(ORG, SLUG, o)) === null);

    const dirty = { root: { props: { title: "Proposed" } }, content: [{ type: "prose", props: { id: "p-1", body: "<p>Hi</p><script>alert(1)</script>" } }] };
    const steps = [{ op: "set_prop", block: "p-1", prop: "body", value: "Hi" }];
    const saved = await drafts.saveDraft(ORG, SLUG, { data: dirty, base, author: { id: "grant-1", kind: "assistant", label: "Helper" }, note: "Make it kinder", steps }, o);
    check("a good draft is saved", saved.ok, saved.error ?? "");
    const got = await drafts.loadDraft(ORG, SLUG, o);
    check("the draft reads back with its base, author, note, steps and a time", !!got && got.v === 1 && got.base === base && got.author.kind === "assistant" && got.author.label === "Helper" && got.note === "Make it kinder" && got.steps?.length === 1 && (got.steps[0] as any).op === "set_prop" && (got.steps[0] as any).value === "Hi" && !Number.isNaN(Date.parse(got.savedAt)), J({ v: got?.v, base: got?.base === base, kind: got?.author?.kind, label: got?.author?.label, note: got?.note, steps: J(got?.steps), at: got?.savedAt }));
    check("the draft went through the same sanitiser a page save runs", !!got && J(got.data) === J(sanitizeRichValues(dirty)) && !/script/i.test(J(got.data)));
    check("the draft does not touch the live page", J((await tx<Array<{ value: unknown }>>`SELECT value FROM site_config WHERE org_id = ${ORG} AND key = ${"puck:" + SLUG}`)[0]!.value) === J(page("Live one")));

    const [raw] = await tx<Array<{ key: string }>>`SELECT key FROM site_config WHERE org_id = ${ORG} AND key = ${"puck-draft:" + SLUG}`;
    check("the draft is one site_config row keyed puck-draft:<slug>", raw?.key === `puck-draft:${SLUG}`);

    const listed = await drafts.listDrafts(ORG, o);
    const mine = listed.find((d) => d.slug === SLUG);
    check("listDrafts shows it with author, note, time and base", !!mine && mine.author.kind === "assistant" && mine.note === "Make it kinder" && mine.base === base && !!mine.savedAt, `${listed.length} draft(s) listed for the org`);
    check("listDrafts shows no document", !!mine && !("data" in mine));
    const pages = await tx<Array<{ key: string }>>`SELECT key FROM site_config WHERE org_id = ${ORG} AND key LIKE 'puck:%'`;
    check("a draft row does not match the live-page listing rule", !pages.some((p) => p.key.includes("puck-draft")));
    const store = readFileSync(new URL("../src/store.ts", import.meta.url), "utf8");
    check("listPages still uses that rule (store.ts)", /listPages[\s\S]*key LIKE 'puck:%'/.test(store));
    check("another organisation does not see this draft", (await drafts.loadDraft("no-such-org-" + RUN, SLUG, o)) === null && !(await drafts.listDrafts("no-such-org-" + RUN, o)).some((d) => d.slug === SLUG));

    // Someone else changes the live page after the draft began: publishing must refuse and keep both.
    await tx`UPDATE site_config SET updated_at = updated_at + interval '1 second', value = ${tx.json(page("Changed elsewhere") as never)} WHERE org_id = ${ORG} AND key = ${"puck:" + SLUG}`;
    const stale = await drafts.publishDraft(ORG, SLUG, { tx, clean: (x) => x });
    check("publishing a draft whose live page changed answers stale and publishes nothing", !stale.ok && stale.stale === true, stale.error ?? "");
    check("...and the live page is the other person's, the draft is still waiting", J((await tx<Array<{ value: unknown }>>`SELECT value FROM site_config WHERE org_id = ${ORG} AND key = ${"puck:" + SLUG}`)[0]!.value) === J(page("Changed elsewhere")) && (await drafts.loadDraft(ORG, SLUG, o)) !== null);

    // Start again from the live page as it is now.
    const [now] = await tx<Array<{ version: string }>>`SELECT updated_at::text AS version FROM site_config WHERE org_id = ${ORG} AND key = ${"puck:" + SLUG}`;
    await drafts.saveDraft(ORG, SLUG, { data: page("Second try"), base: now!.version, author: person }, o);
    const done = await drafts.publishDraft(ORG, SLUG, { tx, clean: (d) => d });
    check("publishing a draft that is current succeeds and returns the new version", done.ok && typeof done.updatedAt === "string", done.error ?? "");
    check("...the live page is now the draft's document", J((await tx<Array<{ value: unknown }>>`SELECT value FROM site_config WHERE org_id = ${ORG} AND key = ${"puck:" + SLUG}`)[0]!.value) === J(page("Second try")));
    check("...and the draft row is gone", (await drafts.loadDraft(ORG, SLUG, o)) === null);
    check("publishing again with no draft says so", !(await drafts.publishDraft(ORG, SLUG, { tx, clean: (x) => x })).ok);

    // A page that does not exist yet: base null.
    check("a draft for a new page is saved with a null base", (await drafts.saveDraft(ORG, SLUG2, { data: page("Brand new"), base: null, author: person }, o)).ok);
    const born = await drafts.publishDraft(ORG, SLUG2, { tx, clean: (x) => x });
    check("publishing it creates the page", born.ok && (await tx`SELECT 1 FROM site_config WHERE org_id = ${ORG} AND key = ${"puck:" + SLUG2}`).length === 1, born.error ?? "");
    await drafts.saveDraft(ORG, SLUG2, { data: page("Another new"), base: null, author: person }, o);
    const clash = await drafts.publishDraft(ORG, SLUG2, { tx, clean: (x) => x });
    check("a new-page draft is stale once somebody has made that page", !clash.ok && clash.stale === true);

    await drafts.discardDraft(ORG, SLUG2, o);
    check("discardDraft removes the draft", (await drafts.loadDraft(ORG, SLUG2, o)) === null);
    let threw = "";
    try { await drafts.discardDraft(ORG, SLUG2, o); } catch (e) { threw = String(e); }
    check("discarding a draft that is not there is not an error", threw === "", threw);

    await drafts.saveDraft(ORG, SLUG, { data: page("No cleaner"), base: (await tx<Array<{ v: string }>>`SELECT updated_at::text AS v FROM site_config WHERE org_id = ${ORG} AND key = ${"puck:" + SLUG}`)[0]!.v, author: person }, o);
    const naked = await drafts.publishDraft(ORG, SLUG, { tx } as never);
    check("publishing without the host's cleaner is refused, and the draft stays", !naked.ok && /cleaner/.test(naked.error ?? "") && (await drafts.loadDraft(ORG, SLUG, o)) !== null, naked.error ?? "");
    await drafts.discardDraft(ORG, SLUG, o);
    // Compare-and-set: a caller that read the draft says what it read.
    const cas = SLUG + "-cas";
    const first = await drafts.saveDraft(ORG, cas, { data: page("v1"), base: null, author: person, expected: null }, o);
    check("expected null saves when there was no draft", first.ok, first.error ?? "");
    const seen = (await drafts.loadDraft(ORG, cas, o))!;
    const rawBefore = J((await tx<Array<{ value: unknown }>>`SELECT value FROM site_config WHERE org_id = ${ORG} AND key = ${"puck-draft:" + cas}`)[0]!.value);
    const none = await drafts.saveDraft(ORG, cas, { data: page("v2"), base: null, author: person, expected: null }, o);
    check("expected null refuses when a draft exists, as draft_changed, row untouched", !none.ok && (none as any).code === "draft_changed" && /Nothing was written/.test(none.error ?? "") && J((await tx<Array<{ value: unknown }>>`SELECT value FROM site_config WHERE org_id = ${ORG} AND key = ${"puck-draft:" + cas}`)[0]!.value) === rawBefore, none.error ?? "");
    const staleCas = await drafts.saveDraft(ORG, cas, { data: page("v2"), base: null, author: person, expected: "2020-01-01T00:00:00.000Z" }, o);
    check("a stale expected refuses and leaves the row byte-identical", !staleCas.ok && (staleCas as any).code === "draft_changed" && J((await tx<Array<{ value: unknown }>>`SELECT value FROM site_config WHERE org_id = ${ORG} AND key = ${"puck-draft:" + cas}`)[0]!.value) === rawBefore);
    const match = await drafts.saveDraft(ORG, cas, { data: page("v2"), base: null, author: person, expected: seen.savedAt }, o);
    const now2 = (await drafts.loadDraft(ORG, cas, o))!;
    check("the savedAt the caller read saves, and the new draft has a new savedAt", match.ok && J(now2.data) === J(page("v2")) && now2.savedAt !== seen.savedAt, match.error ?? "");
    const again = await drafts.saveDraft(ORG, cas, { data: page("v3"), base: null, author: person, expected: seen.savedAt }, o);
    check("the old savedAt now refuses (someone saved in between)", !again.ok && (again as any).code === "draft_changed");
    const free = await drafts.saveDraft(ORG, cas, { data: page("v4"), base: null, author: person }, o);
    check("with no expected it still just saves, as before", free.ok && J((await drafts.loadDraft(ORG, cas, o))!.data) === J(page("v4")));
    await drafts.discardDraft(ORG, cas, o);
    // The cleaner a host passes runs on publish.
    await drafts.saveDraft(ORG, SLUG, { data: page("Cleaned"), base: (await tx<Array<{ v: string }>>`SELECT updated_at::text AS v FROM site_config WHERE org_id = ${ORG} AND key = ${"puck:" + SLUG}`)[0]!.v, author: person }, o);
    const cleaned = await drafts.publishDraft(ORG, SLUG, { tx, clean: () => page("Host cleaned") });
    check("a host's cleaner runs on what is published", cleaned.ok && J((await tx<Array<{ value: unknown }>>`SELECT value FROM site_config WHERE org_id = ${ORG} AND key = ${"puck:" + SLUG}`)[0]!.value) === J(page("Host cleaned")), cleaned.error ?? "");
    throw ROLLBACK;
  });
} catch (e) {
  if (e !== ROLLBACK) { fail++; console.log("FAIL unexpected error  -> " + String(e)); }
}
check("after the rollback no row with this run's name is left", (await leftovers()) === 0);
await db.end({ timeout: 2 });
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
