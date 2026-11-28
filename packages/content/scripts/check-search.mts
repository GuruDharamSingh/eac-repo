// searchContent / contentReadSql checks against elkdonis_dev. Run in the admin container, cwd packages/content:
//   node /app/node_modules/.pnpm/tsx@4.20.6/node_modules/tsx/dist/cli.mjs scripts/check-search.mts
// Exits 1 on any failure.
//
// Writes: NOTHING lasting. Part A inserts synthetic fixture rows into content_index inside a transaction that is
// ROLLED BACK (verified at the end). Everything else is read-only.
// Accounts: synthetic ContentRights objects with random user ids (stranger, owner, org member/guide/owner, site
// keeper, admin, signed-out). Parity (part D) also reads as the test account house-editor-test
// (bb77984c-0bdc-4e47-bb39-33dae6723794, guide of inner_group) and the stranger test account
// claude-center-1018c@test.invalid. No other real account is used.
import { randomUUID } from "node:crypto";
import { db } from "@elkdonis/db";
import { defaultHost, type ContentHost } from "../src/host";
import type { ContentQuery, ContentScope } from "../src/search-types";
import { contentReadSql, resolveRights, threadReadSql, type ContentRights } from "../src/server/access";
import { resolveContentRefs, searchContent } from "../src/server/search";

let pass = 0;
const failures: string[] = [];
async function t(name: string, fn: () => Promise<void> | void) {
  try { await fn(); pass++; console.log("ok   ", name); }
  catch (e) { failures.push(name); console.log("FAIL ", name, "\n      ", (e as Error).message); }
}
const eq = (got: unknown, want: unknown, what: string) => {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g !== w) throw new Error(`${what}\n         got  ${g}\n         want ${w}`);
};

const host: ContentHost = { ...defaultHost(), site: { ...defaultHost().site, orgId: "zz-site", name: "ZZ Site" } };

const uid = { A: randomUUID(), B: randomUUID(), C: randomUUID(), P: randomUUID(), S: randomUUID(), M: randomUUID(), G: randomUUID(), O: randomUUID(), K: randomUUID(), ADM: randomUUID() };
const rights = (userId: string, o: Partial<ContentRights> = {}): ContentRights => ({ userId, isAdmin: false, identityIds: [userId], roles: {}, managedOrgIds: [], ...o });
const V = {
  stranger: rights(uid.S),
  A: rights(uid.A),
  Awith: rights(uid.A, { identityIds: [uid.A, uid.P] }),
  C: rights(uid.C),
  member: rights(uid.M, { roles: { "zz-org": "member" } }),
  guide: rights(uid.G, { roles: { "zz-org": "guide" }, managedOrgIds: ["zz-org"] }),
  owner: rights(uid.O, { roles: { "zz-org": "owner" }, managedOrgIds: ["zz-org"] }),
  keeper: rights(uid.K, { roles: { "zz-site": "owner" }, managedOrgIds: ["zz-site"] }),
  admin: rights(uid.ADM, { isAdmin: true }),
};

// ── A: rights over synthetic fixtures, rolled back ───────────────────────────
class Rollback extends Error {}
const S1 = randomUUID(), S2 = randomUUID();
interface Fx { id: string; store?: "thread" | "artwork"; org?: string | null; site?: string | null; owner?: string | null; ident?: string | null; vis?: string; role?: string | null; status?: string; hidden?: boolean; store_id?: string | null }
const FX: Fx[] = [
  { id: "zz-t1", org: "zz-org", site: "zz-org", owner: uid.A, ident: uid.A },
  { id: "zz-t2", org: "zz-org", site: "zz-org", owner: uid.A, ident: uid.A, status: "draft" },
  { id: "zz-t3", org: "zz-org", site: "zz-org", owner: uid.B, ident: uid.B, status: "draft" },
  { id: "zz-t4", org: "zz-org", site: "zz-org", owner: uid.B, ident: uid.B, vis: "ORGANIZATION" },
  { id: "zz-t5", org: "zz-org", site: "zz-org", owner: uid.B, ident: uid.B, vis: "INVITE_ONLY", role: "member" },
  { id: "zz-t6", org: "zz-org", site: "zz-org", owner: uid.B, ident: uid.B, vis: "INVITE_ONLY", role: "owner" },
  { id: "zz-t7", org: "zz-org", site: "zz-org", owner: uid.A, ident: uid.A, vis: "INVITE_ONLY", role: null },
  { id: "zz-t8", org: "zz-other", site: "zz-other", owner: uid.B, ident: uid.B },
  { id: "zz-t9", org: "zz-site", site: "zz-site", owner: uid.B, ident: uid.B },
  { id: "zz-t10", org: "zz-site", site: "zz-site", owner: uid.B, ident: uid.B, status: "draft" },
  { id: "zz-t11", org: "zz-other", site: "zz-other", owner: uid.P, ident: uid.P },
  { id: "zz-a9", store: "artwork", org: null, site: "zz-site", owner: uid.A, store_id: S1 },
  { id: "zz-a10", store: "artwork", org: null, site: "zz-site", owner: uid.A, status: "draft", store_id: S1 },
  { id: "zz-a11", store: "artwork", org: null, site: "zz-site", owner: uid.A, status: "archived", hidden: true, store_id: S1 },
  { id: "zz-a12", store: "artwork", org: null, site: "zz-site", owner: uid.C, store_id: S1 },
  { id: "zz-a13", store: "artwork", org: null, site: "zz-site", owner: uid.C, status: "draft", store_id: S1 },
  { id: "zz-a14", store: "artwork", org: "zz-org", site: "zz-site", owner: uid.C, store_id: S2 },
  { id: "zz-a15", store: "artwork", org: "zz-org", site: "zz-site", owner: uid.C, status: "draft", store_id: S2 },
  { id: "zz-a16", store: "artwork", org: null, site: "zz-site", owner: uid.C, ident: uid.A, store_id: S1 },
];

const idsOf = (rows: Array<{ key: string }>) => rows.map((r) => r.key.replace(/^(thread|artwork|person):zz-/, "")).sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
const sorted = (s: string) => s.split(" ").filter(Boolean).sort((a, b) => a.localeCompare(b, "en", { numeric: true }));

try {
  await db.begin(async (tx) => {
    for (const f of FX) {
      const store = f.store ?? "thread";
      await tx`
        INSERT INTO content_index (store, id, type, org_id, site_org_id, store_id, owner_user_id, owner_identity_id, visibility, min_role, status, hidden, title, sort_at)
        VALUES (${store}, ${f.id}, ${store === "thread" ? "writing" : "artwork"}, ${f.org ?? null}, ${f.site ?? null}, ${f.store_id ?? null},
                ${f.owner ?? null}, ${f.ident ?? null}, ${f.vis ?? "PUBLIC"}, ${f.role ?? null}, ${f.status ?? "published"}, ${f.hidden ?? false}, ${f.id}, now())`;
    }
    const see = async (r: ContentRights | null, scope: ContentScope | null, opts?: { includeHidden?: boolean }) =>
      idsOf(await tx<Array<{ key: string }>>`SELECT ci.key FROM content_index ci WHERE ci.id LIKE 'zz-%' AND ${contentReadSql(r, scope, host, opts)}`);
    const org: ContentScope = { kind: "org", orgId: "zz-org" };
    const site: ContentScope = { kind: "site" };
    const mine: ContentScope = { kind: "mine" };
    const net: ContentScope = { kind: "network" };

    await t("org scope: stranger", async () => eq(await see(V.stranger, org), sorted("t1 a14"), "stranger"));
    await t("org scope: author A (not a member)", async () => eq(await see(V.A, org), sorted("t1 t2 t7 a14"), "A"));
    await t("org scope: member", async () => eq(await see(V.member, org), sorted("t1 t4 t5 a14"), "member"));
    await t("org scope: guide", async () => eq(await see(V.guide, org), sorted("t1 t2 t3 t4 t5 a14 a15"), "guide"));
    await t("org scope: owner", async () => eq(await see(V.owner, org), sorted("t1 t2 t3 t4 t5 t6 a14 a15"), "owner"));
    await t("org scope: site keeper (no role in the org) sees the org's site artwork, incl. drafts", async () => eq(await see(V.keeper, org), sorted("t1 a14 a15"), "keeper"));
    await t("org scope: admin sees every row", async () => eq(await see(V.admin, org), sorted("t1 t2 t3 t4 t5 t6 t7 a14 a15"), "admin"));

    await t("site scope: stranger", async () => eq(await see(V.stranger, site), sorted("t9 a9 a12 a14 a16"), "stranger"));
    await t("site scope: author A sees own draft, never the hidden one", async () => eq(await see(V.A, site), sorted("t9 a9 a10 a12 a14 a16"), "A"));
    await t("site scope: includeHidden is ignored for a non-keeper", async () => eq(await see(V.A, site, { includeHidden: true }), sorted("t9 a9 a10 a12 a14 a16"), "A+hidden"));
    await t("site scope: org guide adds the org's unpublished artwork", async () => eq(await see(V.guide, site), sorted("t9 a9 a12 a14 a15 a16"), "guide"));
    await t("site scope: keeper sees drafts, not hidden by default", async () => eq(await see(V.keeper, site), sorted("t9 t10 a9 a10 a12 a13 a14 a15 a16"), "keeper"));
    await t("site scope: keeper with includeHidden sees the hidden row", async () => eq(await see(V.keeper, site, { includeHidden: true }), sorted("t9 t10 a9 a10 a11 a12 a13 a14 a15 a16"), "keeper+hidden"));
    await t("site scope: admin = keeper; hidden only when asked", async () => {
      eq(await see(V.admin, site), sorted("t9 t10 a9 a10 a12 a13 a14 a15 a16"), "admin");
      eq(await see(V.admin, site, { includeHidden: true }), sorted("t9 t10 a9 a10 a11 a12 a13 a14 a15 a16"), "admin+hidden");
    });
    await t("site scope: signed-out is refused", async () => {
      let threw = false;
      try { contentReadSql(null, site, host); } catch { threw = true; }
      if (!threw) throw new Error("did not throw");
    });

    await t("mine+orgs: a guide sees another member's org draft (t3); plain mine does not", async () => {
      const withOrgs: ContentScope = { kind: "mine", includeManagedOrgs: true };
      if ((await see(V.guide, mine)).includes("t3")) throw new Error("plain mine showed another member's draft");
      eq(await see(V.guide, withOrgs), sorted("t1 t2 t3 t4 t5 a14 a15"), "guide mine+orgs");
      eq(await see(V.member, withOrgs), [], "a plain member gains nothing");
      eq(await see(V.stranger, withOrgs), [], "stranger gains nothing");
    });
    await t("mine: stranger has none", async () => eq(await see(V.stranger, mine), [], "stranger"));
    await t("mine: A (own rows, credited piece, own hidden piece a11; no pseudonym row)", async () => eq(await see(V.A, mine), sorted("t1 t2 t7 a9 a10 a11 a16"), "A"));
    await t("mine: A with a live pseudonym adds the pseudonym's row", async () => eq(await see(V.Awith, mine), sorted("t1 t2 t7 t11 a9 a10 a11 a16"), "A+P"));
    await t("mine: C", async () => eq(await see(V.C, mine), sorted("a12 a13 a14 a15 a16"), "C"));

    const publicAll = sorted("t1 t8 t9 t11 a9 a12 a14 a16");
    await t("network: signed-out sees public published only", async () => eq(await see(null, net), publicAll, "signed-out"));
    await t("network: owner, keeper and admin see the same public set", async () => {
      for (const k of ["A", "keeper", "admin", "guide"] as const) eq(await see(V[k], net), publicAll, k);
    });

    // person scope (CONTRACT s11.2): the normal predicate over one person's work
    const personA: ContentScope = { kind: "person", userId: uid.A };
    await t("person scope: stranger sees only A's published public items", async () => eq(await see(V.stranger, personA), sorted("t1 a9 a16"), "stranger"));
    await t("person scope: signed-out sees the same", async () => eq(await see(null, personA), sorted("t1 a9 a16"), "signed-out"));
    await t("person scope: A themself sees everything of theirs incl. hidden (= mine)", async () => eq(await see(V.A, personA), sorted("t1 t2 t7 a9 a10 a11 a16"), "A"));
    await t("hidden rows never reach others: stranger, signed-out, guide and the other owner C see no a11 in mine/person/site/org/network", async () => {
      for (const [n, r] of [["stranger", V.stranger], ["signed-out", null], ["guide", V.guide], ["C", V.C]] as const) {
        for (const sc of [personA, site, net, mine, org] as ContentScope[]) {
          if ((r === null && (sc.kind === "mine" || sc.kind === "org" || sc.kind === "site"))) continue;
          if ((await see(r, sc)).includes("a11")) throw new Error(`${n} saw hidden a11 in ${sc.kind}`);
        }
      }
    });
    await t("person scope: a keeper sees A's site drafts but not hidden or off-site drafts", async () => eq(await see(V.keeper, personA), sorted("t1 a9 a10 a16"), "keeper"));
    await t("person scope: org guide gains only unpublished rows of their own org (A's draft t2)", async () => eq(await see(V.guide, personA), sorted("t1 t2 a9 a16"), "guide"));

    // refs predicate (no scope): unpublish takes a public item away from strangers, never from its owner
    await t("refs predicate: published public item readable by stranger, signed-out and owner", async () => {
      for (const [n, r] of [["stranger", V.stranger], ["signed-out", null], ["owner A", V.A]] as const) {
        if (!(await see(r, null)).includes("t1")) throw new Error(`${n} cannot read t1`);
      }
    });
    await t("refs predicate: after unpublish, gone for stranger and signed-out, still there for owner, keeper-less guide, admin", async () => {
      await tx`UPDATE content_index SET status = 'draft' WHERE id = 'zz-t1'`;
      for (const [n, r] of [["stranger", V.stranger], ["signed-out", null], ["member", V.member]] as const) {
        if ((await see(r, null)).includes("t1")) throw new Error(`${n} still reads unpublished t1`);
      }
      for (const [n, r] of [["owner A", V.A], ["guide", V.guide], ["admin", V.admin]] as const) {
        if (!(await see(r, null)).includes("t1")) throw new Error(`${n} lost t1`);
      }
      await tx`UPDATE content_index SET status = 'published', hidden = true WHERE id = 'zz-t1'`;
      if ((await see(V.A, null)).includes("t1")) throw new Error("hidden item still resolves for owner");
    });

    throw new Rollback();
  });
} catch (e) {
  if (!(e instanceof Rollback)) { failures.push("part A crashed"); console.log("FAIL part A", (e as Error).message); }
}
await t("part A rolled back: no fixture rows remain", async () => {
  const [r] = await db<Array<{ n: number }>>`SELECT count(*)::int AS n FROM content_index WHERE id LIKE 'zz-%'`;
  eq(r!.n, 0, "leftover fixtures");
});

// ── B: contentReadSql agrees with threadReadSql on real threads ─────────────
const orgsWithThreads = (await db<Array<{ org_id: string }>>`SELECT DISTINCT org_id FROM content_index WHERE store = 'thread'`).map((r) => r.org_id);
await t(`threads: contentReadSql = threadReadSql for stranger/member/guide/owner across ${orgsWithThreads.length} orgs`, async () => {
  const kinds = ["writing", "post", "meeting", "reading_group", "series", "workshop", "event"];
  for (const orgId of orgsWithThreads) {
    for (const role of [null, "viewer", "member", "guide", "owner"] as const) {
      const r = rights(randomUUID(), role ? { roles: { [orgId]: role }, managedOrgIds: role === "guide" || role === "owner" ? (orgId === "oad" ? [] : [orgId]) : [] } : {});
      const a = (await db<Array<{ k: string }>>`SELECT ci.key AS k FROM content_index ci WHERE ci.store = 'thread' AND ci.org_id = ${orgId} AND ${contentReadSql(r, { kind: "org", orgId }, defaultHost())}`).map((x) => x.k).sort();
      const b = (await db<Array<{ k: string }>>`SELECT 'thread:' || t.id AS k FROM threads t WHERE t.kind = ANY(${kinds}) AND t.org_id = ${orgId} AND ${threadReadSql(r)}`).map((x) => x.k).sort();
      eq(a, b, `org ${orgId}, role ${role}`);
    }
  }
});

// ── C: facets use the same predicate as the items ───────────────────────────
async function allItems(r: ContentRights | null, query: ContentQuery) {
  const keys: string[] = [];
  let cursor: string | null = null;
  let first: Awaited<ReturnType<typeof searchContent>> | null = null;
  for (let i = 0; i < 30; i++) {
    const res: Awaited<ReturnType<typeof searchContent>> = await searchContent(null, { ...query, limit: 7, cursor }, defaultHost(), { rights: r ?? undefined });
    first ??= res;
    keys.push(...res.items.map((x) => x.key));
    cursor = res.nextCursor;
    if (!cursor) break;
  }
  return { keys, facets: first!.facets };
}
const sum = (o: Record<string, number | undefined>) => Object.values(o).reduce((a: number, b) => a + (b ?? 0), 0);
const orgForFacets = "inner_group";
await t("facets: counts equal the paged item total (stranger, guide, owner, admin; org and site scopes)", async () => {
  const cases: Array<[string, ContentRights, ContentScope]> = [
    ["stranger/org", V.stranger, { kind: "org", orgId: orgForFacets }],
    ["guide/org", rights(randomUUID(), { roles: { [orgForFacets]: "guide" }, managedOrgIds: [orgForFacets] }), { kind: "org", orgId: orgForFacets }],
    ["owner/org", rights(randomUUID(), { roles: { [orgForFacets]: "owner" }, managedOrgIds: [orgForFacets] }), { kind: "org", orgId: orgForFacets }],
    ["admin/org", rights(randomUUID(), { isAdmin: true }), { kind: "org", orgId: orgForFacets }],
    ["stranger/site", V.stranger, { kind: "site" }],
    ["admin/site", rights(randomUUID(), { isAdmin: true }), { kind: "site" }],
  ];
  for (const [name, r, scope] of cases) {
    const { keys, facets } = await allItems(r, { scope });
    eq(new Set(keys).size, keys.length, `${name}: paging repeated a key`);
    eq(sum(facets.types), keys.length, `${name}: facets.types total vs items`);
    eq(sum(facets.statuses), keys.length, `${name}: facets.statuses total vs items`);
  }
});
await t("facets: a stranger's counts never include drafts or hidden rows", async () => {
  const res = await searchContent(null, { scope: { kind: "site" } }, defaultHost(), { rights: V.stranger });
  if (res.facets.statuses.draft) throw new Error("draft counted for a stranger");
  if (res.facets.statuses.archived) throw new Error("archived counted for a stranger");
  const net = await searchContent(null, { scope: { kind: "network" } }, defaultHost());
  // The published view's stores only (thread, artwork): people rows (v1.3) are their own view, and service rows
  // (v1.4, indexed since 2026-11-27) are read only through the offers view.
  const [r] = await db<Array<{ n: number }>>`SELECT count(*)::int AS n FROM content_index WHERE store IN ('thread', 'artwork') AND type <> 'service' AND status = 'published' AND visibility = 'PUBLIC' AND NOT hidden`;
  eq(sum(net.facets.types), r!.n, "network facets vs public rows");
  if (net.items.some((i) => i.can?.edit)) throw new Error("signed-out item has can.edit");
});
await t("signed-out is refused outside the network scope", async () => {
  let threw = false;
  try { await searchContent(null, { scope: { kind: "mine" } }, defaultHost()); } catch { threw = true; }
  if (!threw) throw new Error("did not throw");
});
await t("text search finds by title and ranks; cursor pages without repeats", async () => {
  const any = await searchContent(null, { scope: { kind: "network" }, limit: 100 }, defaultHost());
  const first = any.items[0]!;
  const word = first.title.split(/\s+/).find((w) => w.length > 3) ?? first.title;
  const res = await searchContent(null, { scope: { kind: "network" }, q: word }, defaultHost());
  if (!res.items.some((i) => i.key === first.key)) throw new Error(`"${word}" did not find ${first.key}`);
  const typo = await searchContent(null, { scope: { kind: "network" }, q: word.slice(0, -1) + "x" }, defaultHost());
  console.log(`      q="${word}" -> ${res.items.length} item(s); typo "${word.slice(0, -1)}x" -> ${typo.items.length}`);
  const p1 = await searchContent(null, { scope: { kind: "network" }, sort: "title", limit: 5 }, defaultHost());
  const p2 = await searchContent(null, { scope: { kind: "network" }, sort: "title", limit: 5, cursor: p1.nextCursor }, defaultHost());
  eq(p1.items.some((a) => p2.items.some((b) => b.key === a.key)), false, "title paging repeated a key");
  const titles = [...p1.items, ...p2.items].map((i) => i.title.toLowerCase());
  eq(titles, [...titles].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)), "title order");
});

// ── D: (parity with the legacy loader was retired in Step 7) ───────────────────────────────────────────────
const strip = (i: object) => {
  const { store, can, sale, hidden, storefront, images, ownerName, ...rest } = i as Record<string, unknown>;
  void store; void can; void sale; void hidden; void storefront; void images; void ownerName;
  return rest;
};
const canon = (v: unknown): unknown => Array.isArray(v) ? v.map(canon) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v as object).filter(([, x]) => x !== undefined).sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, x]) => [k, canon(x)])) : v;
const HET = "bb77984c-0bdc-4e47-bb39-33dae6723794"; // house-editor-test (test account)
const STR = "8f2281ae-3efe-49fa-9b1b-9780b95593f1"; // claude-center-1018c@test.invalid (test account)
const ADM = rights(randomUUID(), { isAdmin: true });
const marketHost: ContentHost = { ...defaultHost(), site: { ...defaultHost().site, orgId: "market", name: "Market" } };
const now = new Date();

const het = await resolveRights({ userId: HET });
const strg = await resolveRights({ userId: STR });

await t("storefront: market artwork carries {id, name}; threads carry none", async () => {
  const res = await searchContent(null, { scope: { kind: "network" }, limit: 100 }, defaultHost());
  const art = res.items.filter((i) => i.store === "artwork");
  if (!art.length) throw new Error("no public artwork to check");
  if (art.some((i) => !i.storefront?.id || !i.storefront.name)) throw new Error("artwork without storefront");
  if (res.items.some((i) => i.store === "thread" && i.storefront)) throw new Error("thread has storefront");
});

// ── F: queue freshness, person scope on real data, can.pick, images ─────────
await t("triggers exist on threads, artwork and auction_lot (insert/delete and update), and on users and vouches after 298", async () => {
  const r = await db<Array<{ tgname: string }>>`SELECT tgname FROM pg_trigger WHERE tgname LIKE 'trg_content_index_%' AND NOT tgisinternal`;
  const want = ["trg_content_index_artwork_iud", "trg_content_index_artwork_u", "trg_content_index_lot_iud", "trg_content_index_lot_u", "trg_content_index_threads_iud", "trg_content_index_threads_u"];
  if (await has298()) want.push("trg_content_index_users_iud", "trg_content_index_users_u", "trg_content_index_vouches_iud");
  // Migration 300 (v1.4): a workshop's member price re-indexes its thread.
  const [m300] = await db<Array<{ n: number }>>`SELECT count(*)::int AS n FROM app_schema_migrations WHERE filename = '300_content_index_offers.sql'`;
  if ((m300?.n ?? 0) > 0) want.push("trg_content_index_workshop_pages_iud", "trg_content_index_workshop_pages_u");
  eq(r.map((x) => x.tgname).sort(), want.sort(), "triggers");
});
await t("queue: a raw UPDATE / DELETE on a thread row is reflected by the next search, with no hook", async () => {
  const { drainContentQueue } = await import("@elkdonis/services");
  await drainContentQueue({ all: true });
  const id = `zzq${randomUUID().replace(/-/g, "").slice(0, 12)}`;
  const find = async () => (await searchContent(null, { scope: { kind: "org", orgId: "development" }, q: "zzqfixture", statuses: ["draft", "published"] }, defaultHost(), { rights: ADM })).items.find((i) => i.key === `thread:${id}`);
  try {
    await db`INSERT INTO threads (id, kind, title, slug, org_id, author_id, status, visibility, body)
             VALUES (${id}, 'post', 'zzqfixture alpha', ${id}, 'development', ${HET}, 'draft', 'PUBLIC', 'x')`;
    eq((await find())?.title, "zzqfixture alpha", "after INSERT");
    await db`UPDATE threads SET title = 'zzqfixture beta' WHERE id = ${id}`;
    eq((await find())?.title, "zzqfixture beta", "after raw UPDATE");
    await db`DELETE FROM threads WHERE id = ${id}`;
    eq(await find(), undefined, "after raw DELETE");
  } finally {
    await db`DELETE FROM threads WHERE id = ${id}`;
    await drainContentQueue({ all: true });
    await db`DELETE FROM content_index WHERE id = ${id}`;
    await db`DELETE FROM content_index_queue WHERE key = ${"thread:" + id}`;
  }
  const [left] = await db<Array<{ n: number }>>`SELECT (SELECT count(*) FROM threads WHERE id = ${id})::int + (SELECT count(*) FROM content_index WHERE id = ${id})::int AS n`;
  eq(left!.n, 0, "fixture cleaned up");
  const [q] = await db<Array<{ n: number }>>`SELECT count(*)::int AS n FROM content_index_queue`;
  eq(q!.n, 0, "queue empty after drain");
});
await t("network covers every published PUBLIC item platform-wide", async () => {
  const kinds = ["writing", "post", "meeting", "reading_group", "series", "workshop", "event"];
  const [th] = await db<Array<{ n: number }>>`SELECT count(*)::int AS n FROM threads WHERE kind = ANY(${kinds}) AND status = 'published' AND visibility = 'PUBLIC'`;
  const [aw] = await db<Array<{ n: number }>>`SELECT count(*)::int AS n FROM artwork WHERE status IN ('available', 'reserved', 'sold') AND metadata->'hiddenByAdmin' IS NULL`;
  const res = await searchContent(null, { scope: { kind: "network" }, limit: 1 }, defaultHost());
  eq(sum(res.facets.types), th!.n + aw!.n, "network total vs source tables");
});
await t("person scope on real data: a stranger sees only that person's public published items; listContent(ownerUserId: other) uses it", async () => {
  const stranger = await searchContent({ userId: STR }, { scope: { kind: "person", userId: HET }, limit: 100 }, defaultHost());
  if (stranger.items.some((i) => i.status === "draft" || i.status === "archived")) throw new Error("stranger saw a draft");
  const { listContent: wrapped } = await import("../src/server/list");
  const list = await wrapped({ userId: STR }, { ownerUserId: HET, limit: 100 });
  eq(list.items.map((i) => i.key), stranger.items.map((i) => i.key), "wrapper keys");
  const own = await searchContent({ userId: STR }, { scope: { kind: "person", userId: STR }, limit: 100 }, defaultHost());
  const mine = await searchContent({ userId: STR }, { scope: { kind: "mine" }, limit: 100 }, defaultHost());
  eq(own.items.map((i) => i.key), mine.items.map((i) => i.key), "own person scope = mine");
});
await t("can.pick: signed-in on published public items, always on own items, never signed-out, false on others' drafts", async () => {
  const net = await searchContent({ userId: STR }, { scope: { kind: "network" }, limit: 100 }, defaultHost());
  if (!net.items.length || net.items.some((i) => i.can?.pick !== true)) throw new Error("signed-in network item without pick");
  const out = await searchContent(null, { scope: { kind: "network" }, limit: 100 }, defaultHost());
  if (out.items.some((i) => i.can?.pick)) throw new Error("signed-out viewer got pick");
  const mineSTR = await searchContent({ userId: STR }, { scope: { kind: "mine" }, limit: 100 }, defaultHost());
  if (!mineSTR.items.length || mineSTR.items.some((i) => i.can?.pick !== true)) throw new Error("own item without pick");
  const org = await searchContent({ userId: HET }, { scope: { kind: "org", orgId: "inner_group" }, limit: 100 }, defaultHost());
  const drafts = org.items.filter((i) => i.status === "draft");
  console.log(`      inner_group as guide: ${org.items.length} items, ${drafts.length} drafts`);
  if (drafts.some((i) => i.can?.pick)) throw new Error("pick on someone else's draft");
});
await t("images: cover first, artwork images filled", async () => {
  const res = await searchContent(null, { scope: { kind: "network" }, limit: 100 }, defaultHost());
  for (const i of res.items) {
    if (!Array.isArray(i.images)) throw new Error(`${i.key} has no images array`);
    if (i.cover && i.images[0] !== i.cover) throw new Error(`${i.key}: cover not first`);
  }
  const withImgs = res.items.filter((i) => (i.images?.length ?? 0) > 0).length;
  const art = res.items.filter((i) => i.store === "artwork" && i.cover);
  if (art.some((i) => (i.images?.length ?? 0) < 1)) throw new Error("artwork with cover but no images");
  console.log(`      ${withImgs}/${res.items.length} public items have images; ${art.length} artwork with cover`);
});

await t("resolveContentRefs: public item resolves; after unpublish it is gone for a stranger, still resolves for its owner", async () => {
  const { drainContentQueue } = await import("@elkdonis/services");
  await drainContentQueue({ all: true });
  const id = `zzr${randomUUID().replace(/-/g, "").slice(0, 12)}`;
  const key = `thread:${id}`;
  const strangerRights = rights(randomUUID());
  const ownerRights = await resolveRights({ userId: HET });
  const get = async (r: ContentRights | null) => (await resolveContentRefs(null, [key, "thread:nope-does-not-exist", "garbage"], defaultHost(), { rights: r ?? undefined })).results;
  try {
    await db`INSERT INTO threads (id, kind, title, slug, org_id, author_id, status, visibility, body, published_at)
             VALUES (${id}, 'post', 'zzrefs fixture', ${id}, 'development', ${HET}, 'published', 'PUBLIC', 'x', now())`;
    const a = await get(strangerRights);
    eq((a[0] as { title?: string }).title, "zzrefs fixture", "public item resolves for a stranger");
    eq(a[1], { key: "thread:nope-does-not-exist", gone: true }, "unknown key is gone");
    eq(a[2], { key: "garbage", gone: true }, "malformed key is gone");
    eq((await get(null))[0] && ((await get(null))[0] as { title?: string }).title, "zzrefs fixture", "signed-out resolves");
    await db`UPDATE threads SET status = 'draft' WHERE id = ${id}`;
    eq((await get(strangerRights))[0], { key, gone: true }, "unpublished is gone for a stranger");
    eq((await get(null))[0], { key, gone: true }, "unpublished is gone for signed-out");
    eq((await get(ownerRights))[0] && ((await get(ownerRights))[0] as { title?: string }).title, "zzrefs fixture", "owner still resolves");
    await db`DELETE FROM threads WHERE id = ${id}`;
    eq((await get(ownerRights))[0], { key, gone: true }, "deleted is gone even for the owner");
  } finally {
    await db`DELETE FROM threads WHERE id = ${id}`;
    await drainContentQueue({ all: true });
    await db`DELETE FROM content_index WHERE id = ${id}`;
    await db`DELETE FROM content_index_queue WHERE key = ${key}`;
  }
});

await t("ownerName: a pseudonymous item carries the pseudonym's name, never the account behind it", async () => {
  // No pseudonym exists on dev, so a fixture pair (synthetic pseudonym user + one thread) is created and removed.
  const { drainContentQueue } = await import("@elkdonis/services");
  const pid = randomUUID();
  const tid = `zzp${randomUUID().replace(/-/g, "").slice(0, 12)}`;
  const [acct] = await db<Array<{ display_name: string | null }>>`SELECT display_name FROM users WHERE id = ${HET}`;
  try {
    await db`INSERT INTO users (id, auth_user_id, display_name, slug) VALUES (${pid}, ${pid}, 'Zzq Pseudonym', ${"zzq-pseud-" + pid.slice(0, 6)})`;
    await db`INSERT INTO identity_control (identity_id, account_id, relation, label) VALUES (${pid}, ${HET}, 'pseudonym', 'zzq')`;
    await db`INSERT INTO threads (id, kind, title, slug, org_id, author_id, status, visibility, body, published_at)
             VALUES (${tid}, 'post', 'zzq pseud fixture', ${tid}, 'development', ${pid}, 'published', 'PUBLIC', 'x', now())`;
    const res = await resolveContentRefs(null, [`thread:${tid}`], defaultHost());
    const it = res.results[0] as { ownerName?: string | null };
    eq(it.ownerName, "Zzq Pseudonym", "ownerName is the pseudonym's name");
    if (acct?.display_name && it.ownerName === acct.display_name) throw new Error("exposed the account's name");
    const viaSearch = await searchContent(null, { scope: { kind: "person", userId: pid } }, defaultHost());
    eq(viaSearch.items.map((i) => i.ownerName), ["Zzq Pseudonym"], "person scope of the pseudonym");
  } finally {
    await db`DELETE FROM threads WHERE id = ${tid}`;
    await db`DELETE FROM identity_control WHERE identity_id = ${pid}`;
    await drainContentQueue({ all: true });
    await db`DELETE FROM content_index WHERE id = ${tid}`;
    await db`DELETE FROM content_index_queue WHERE key = ${"thread:" + tid}`;
    await db`DELETE FROM users WHERE id = ${pid}`;
  }
  const [left] = await db<Array<{ n: number }>>`SELECT (SELECT count(*) FROM threads WHERE id = ${tid})::int + (SELECT count(*) FROM users WHERE id = ${pid})::int AS n`;
  eq(left!.n, 0, "fixtures removed");
});

await t("facets sit inside the selection: types [artwork] shows only artwork (no writing/product), statuses and sale agree", async () => {
  const res = await searchContent(null, { scope: { kind: "site" }, types: ["artwork"], limit: 100 }, marketHost, { rights: ADM });
  eq(Object.keys(res.facets.types).sort(), ["artwork"], "facets.types keys");
  eq(sum(res.facets.statuses), res.facets.types.artwork ?? 0, "statuses total = artwork total");
  if (res.facets.sale && sum(res.facets.sale) > (res.facets.types.artwork ?? 0)) throw new Error("sale facet outside the selection");
  eq(sum(res.facets.types), res.items.length, "facet total = items (one page holds them all)");
  const one = res.facets.stores[0];
  if (one) {
    const narrowed = await searchContent(null, { scope: { kind: "site" }, storeIds: [one.id], limit: 100 }, marketHost, { rights: ADM });
    eq(sum(narrowed.facets.types), narrowed.items.length, "storeIds narrows the facets");
    eq(narrowed.facets.stores.map((x) => x.id), [one.id], "stores facet narrowed to the chosen store");
  }
});
await t("store names are readable, never a raw uuid (facets.stores and item.storefront.name)", async () => {
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const res = await searchContent(null, { scope: { kind: "site" }, limit: 100 }, marketHost, { rights: ADM });
  if (!res.facets.stores.length) throw new Error("no stores to check");
  for (const s2 of res.facets.stores) if (!s2.name || uuidRe.test(s2.name)) throw new Error(`facet store name "${s2.name}"`);
  for (const i of res.items) if (i.storefront && (!i.storefront.name || uuidRe.test(i.storefront.name))) throw new Error(`${i.key} storefront "${i.storefront.name}"`);
  console.log(`      ${res.facets.stores.length} store(s): ${res.facets.stores.map((x) => x.name).join(" | ").slice(0, 120)}`);
});
await t("owner keeps a keeper-hidden piece in mine (facets); notes carry the by-design lines, missing stays clean", async () => {
  const mineBefore = await searchContent({ userId: STR }, { scope: { kind: "mine" } }, defaultHost());
  const hid = `zz-hid-${randomUUID().slice(0, 8)}`;
  try {
    await db`INSERT INTO content_index (store, id, type, org_id, site_org_id, owner_user_id, visibility, status, hidden, title, sort_at)
             VALUES ('artwork', ${hid}, 'artwork', NULL, 'market', ${STR}, 'PUBLIC', 'archived', true, 'zz hidden fixture', now())`;
    const mine2 = await searchContent({ userId: STR }, { scope: { kind: "mine" } }, defaultHost());
    eq(mine2.facets.statuses.archived ?? 0, (mineBefore.facets.statuses.archived ?? 0) + 1, "owner's hidden piece counted in mine");
    const other = await searchContent({ userId: HET }, { scope: { kind: "person", userId: STR } }, defaultHost());
    if ((other.facets.statuses.archived ?? 0) !== 0) throw new Error("a stranger's person-scope facets counted the hidden piece");
  } finally {
    await db`DELETE FROM content_index WHERE id = ${hid}`;
  }
  const res = await searchContent(null, { scope: { kind: "network" } }, defaultHost());
  if (res.missing.some((m) => m === "publish_jobs" || m === "plan" || m.startsWith("owner-only"))) throw new Error(`by-design notes leaked into missing: ${res.missing}`);
  if (!res.notes?.length) throw new Error("no notes");
  console.log(`      missing=${JSON.stringify(res.missing)} notes=${res.notes.length}`);
});

await t("text match agrees with suggest: a title prefix and a mid-word substring both find their title", async () => {
  const all = await searchContent(null, { scope: { kind: "network" }, limit: 100 }, defaultHost());
  const it = all.items.find((i) => /^[A-Za-z]{6,}/.test(i.title));
  if (!it) throw new Error("no public title to test with");
  const word = /^[A-Za-z]+/.exec(it.title)![0];
  const prefix = word.slice(0, 3), mid = word.slice(2, 5);
  const byPrefix = await searchContent(null, { scope: { kind: "network" }, q: prefix, limit: 100 }, defaultHost());
  if (!byPrefix.items.some((i) => i.key === it.key)) throw new Error(`prefix "${prefix}" did not find "${it.title}"`);
  if (byPrefix.items[0] && !byPrefix.items.slice(0, 3).some((i) => i.title.toLowerCase().startsWith(prefix.toLowerCase()))) throw new Error("prefix matches not boosted to the top");
  const byMid = await searchContent(null, { scope: { kind: "network" }, q: mid, limit: 100 }, defaultHost());
  if (!byMid.items.some((i) => i.key === it.key)) throw new Error(`substring "${mid}" did not find "${it.title}"`);
  eq(sum(byPrefix.facets.types), byPrefix.items.length, "facets on the same match");
  console.log(`      "${prefix}" and "${mid}" find "${it.title}"`);
});

// ── E: timing and plans ──────────────────────────────────────────────────────
const shapes: Array<[string, ContentRights | null, ContentQuery]> = [
  ["network, browse", null, { scope: { kind: "network" } }],
  ["network, q", null, { scope: { kind: "network" }, q: "art" }],
  ["site (admin), browse", ADM, { scope: { kind: "site" } }],
  ["site (admin), q + types", ADM, { scope: { kind: "site" }, q: "art", types: ["artwork"] }],
  ["org inner_group (guide test acct)", het, { scope: { kind: "org", orgId: "inner_group" } }],
  ["mine (test acct)", het, { scope: { kind: "mine" } }],
  ["site (admin), limit 100 sort title", ADM, { scope: { kind: "site" }, sort: "title", limit: 100 }],
];
for (const [name, r, q] of shapes) {
  await t(`timing: ${name}: p95 under 150 ms`, async () => {
    const ms: number[] = [];
    for (let i = 0; i < 12; i++) {
      const t0 = performance.now();
      await searchContent(r ? { userId: r.userId } : null, q, defaultHost(), { rights: r ?? undefined });
      ms.push(performance.now() - t0);
    }
    ms.shift(); // warm-up
    ms.sort((a, b) => a - b);
    const p95 = ms[Math.ceil(ms.length * 0.95) - 1]!;
    console.log(`      ${name}: median ${ms[Math.floor(ms.length / 2)]!.toFixed(1)} ms, p95 ${p95.toFixed(1)} ms (incl. hydration)`);
    if (p95 > 150) throw new Error(`p95 ${p95.toFixed(0)} ms`);
  });
}
await t("EXPLAIN ANALYZE of the core queries (planner forced off seq scan to prove the indexes are usable)", async () => {
  const plans: Array<[string, ReturnType<typeof db>]> = [
    ["network recent", db`SELECT ci.key FROM content_index ci WHERE ${contentReadSql(null, { kind: "network" }, host)} ORDER BY ci.sort_at DESC, (ci.key COLLATE "C") DESC LIMIT 41`],
    ["owner recent (mine)", db`SELECT ci.key FROM content_index ci WHERE ${contentReadSql(V.A, { kind: "mine" }, host)} ORDER BY ci.sort_at DESC, (ci.key COLLATE "C") DESC LIMIT 41`],
    ["org recent", db`SELECT ci.key FROM content_index ci WHERE ${contentReadSql(V.guide, { kind: "org", orgId: "inner_group" }, host)} ORDER BY ci.sort_at DESC, (ci.key COLLATE "C") DESC LIMIT 41`],
    ["text search", db`SELECT ci.key, ts_rank(ci.tsv, websearch_to_tsquery('english', 'art')) FROM content_index ci WHERE ${contentReadSql(null, { kind: "network" }, host)} AND (ci.tsv @@ websearch_to_tsquery('english', 'art') OR ci.title % 'art') ORDER BY 2 DESC LIMIT 41`],
  ];
  await db.begin(async (tx) => {
    for (const mode of ["default planner", "enable_seqscan=off"]) {
      if (mode !== "default planner") await tx`SET LOCAL enable_seqscan = off`;
      for (const [name, q] of plans) {
        const rows = await tx<Array<Record<string, string>>>`EXPLAIN (ANALYZE, COSTS OFF, TIMING OFF) ${q}`;
        const text = rows.map((r) => r["QUERY PLAN"]).join("\n");
        const uses = [...new Set(text.match(/idx_content_index_\w+/g) ?? [])];
        const exec = /Execution Time: ([\d.]+) ms/.exec(text)?.[1];
        console.log(`      [${mode}] ${name}: exec ${exec} ms; indexes: ${uses.join(", ") || "(seq scan)"}`);
      }
    }
  });
});

// ── G: people (v1.3, CONTRACT s15; migration 298) ─────────────────────────────
// Skipped, not passed, on a database without migration 298. Part G1 uses fixture rows in a rolled-back
// transaction; G2 reads the real index (people are public rows) and never prints an email.
async function has298(): Promise<boolean> {
  const [r] = await db<Array<{ n: number }>>`SELECT count(*)::int AS n FROM information_schema.columns WHERE table_name = 'content_index' AND column_name = 'rank_key'`;
  return (r?.n ?? 0) > 0;
}
if (!(await has298())) {
  console.log("skip  G: people checks (migration 298 not applied)");
} else {
  try {
    await db.begin(async (tx) => {
      for (const [id, status, hidden] of [["zz-p1", "published", false], ["zz-p2", "draft", false], ["zz-p3", "published", true]] as const) {
        await tx`INSERT INTO content_index (store, id, type, visibility, status, hidden, title, sort_at, entity_type, rank_key)
                 VALUES ('person', ${id}, 'person', 'PUBLIC', ${status}, ${hidden}, ${id}, now(), 'person', ${id})`;
      }
      await tx`INSERT INTO content_index (store, id, type, org_id, site_org_id, owner_user_id, owner_identity_id, visibility, status, hidden, title, sort_at)
               VALUES ('thread', 'zz-t1', 'writing', 'zz-site', 'zz-site', ${uid.A}, ${uid.A}, 'PUBLIC', 'published', false, 'zz-t1', now())`;
      const see = async (r: ContentRights | null, scope: ContentScope | null, opts?: { includeHidden?: boolean; people?: boolean }) =>
        idsOf(await tx<Array<{ key: string }>>`SELECT ci.key FROM content_index ci WHERE ci.id LIKE 'zz-%' AND ${contentReadSql(r, scope, host, opts)}`);
      await t("people: without the people option no viewer or scope ever reads a person row", async () => {
        const cases: Array<[string, ContentRights | null, ContentScope | null]> = [
          ["signed-out network", null, { kind: "network" }], ["signed-out refs", null, null], ["admin refs", V.admin, null],
          ["admin site", V.admin, { kind: "site" }], ["keeper site+hidden", V.keeper, { kind: "site" }], ["A mine", V.A, { kind: "mine" }],
        ];
        for (const [n, r, sc] of cases) {
          const got = await see(r, sc, { includeHidden: true });
          if (got.some((k) => k.startsWith("p"))) throw new Error(`${n} read a person row: ${got.join(" ")}`);
        }
      });
      await t("people: with the option, only published, public, unhidden people, the same for signed-out, stranger and admin", async () => {
        for (const [n, r] of [["signed-out", null], ["stranger", V.stranger], ["admin", V.admin]] as const) {
          eq((await see(r, { kind: "network" }, { people: true, includeHidden: true })).filter((k) => k.startsWith("p")), ["p1"], n);
        }
      });
      throw new Rollback();
    });
  } catch (e) {
    if (!(e instanceof Rollback)) { failures.push("part G1 crashed"); console.log("FAIL part G1", (e as Error).message); }
  }

  const { drainContentQueue } = await import("@elkdonis/services");
  await drainContentQueue({ all: true });
  const allPeople = async (q: Partial<ContentQuery> = {}) => {
    const out: Array<import("../src/model").ContentListItem> = [];
    let cursor: string | null = null;
    for (let i = 0; i < 50; i++) {
      const res = await searchContent(null, { scope: { kind: "network" }, view: "people", limit: 25, cursor, ...q }, defaultHost());
      out.push(...res.items);
      cursor = res.nextCursor;
      if (!cursor) break;
    }
    return out;
  };
  const listed = (await db<Array<{ id: string }>>`SELECT id::text AS id FROM users WHERE slug IS NOT NULL AND directory_listed`).map((r) => r.id).sort();
  await t(`people: paging the people view returns exactly the ${listed.length} listed identities, each once`, async () => {
    const got = (await allPeople()).map((i) => i.key.replace(/^person:/, ""));
    eq(got.length, new Set(got).size, "duplicates across pages");
    eq([...got].sort(), listed, "listed identities");
  });
  await t("people: an unlisted identity never appears (index rows and search)", async () => {
    const [r] = await db<Array<{ n: number }>>`SELECT count(*)::int AS n FROM content_index ci JOIN users u ON u.id::text = ci.id
      WHERE ci.store = 'person' AND NOT (u.slug IS NOT NULL AND u.directory_listed)`;
    eq(r!.n, 0, "unlisted rows in the index");
  });
  await t("people: no person row or item carries an account, owner, org or email", async () => {
    const [r] = await db<Array<{ n: number }>>`SELECT count(*)::int AS n FROM content_index WHERE store = 'person'
      AND (owner_user_id IS NOT NULL OR owner_identity_id IS NOT NULL OR org_id IS NOT NULL OR site_org_id IS NOT NULL)`;
    eq(r!.n, 0, "person rows with owner/org columns");
    const items = await allPeople();
    if (items.some((i) => i.ownerIdentityId)) throw new Error("an item has ownerIdentityId");
    const emails = new Set((await db<Array<{ e: string }>>`SELECT lower(email) AS e FROM users WHERE email IS NOT NULL`).map((x) => x.e));
    const text = JSON.stringify(items).toLowerCase();
    let leaked = 0;
    for (const e of emails) if (e && text.includes(e)) leaked++;
    eq(leaked, 0, "emails in people items (count only)");
  });
  await t("people: facets.people appears in the people view only; other views carry no person item", async () => {
    const p = await searchContent(null, { scope: { kind: "network" }, view: "people", limit: 5 }, defaultHost());
    if (!p.facets.people) throw new Error("people view without people facets");
    for (const view of ["published", "all"] as const) {
      const r = await searchContent(null, { scope: { kind: "network" }, view, limit: 100 }, defaultHost());
      if (r.facets.people) throw new Error(`${view} has people facets`);
      if (r.items.some((i) => i.store === "person" || i.key.startsWith("person:"))) throw new Error(`${view} returned a person`);
    }
  });
  await t("people: entity facet counts add up to the listed total; a region filter narrows to that region", async () => {
    const p = await searchContent(null, { scope: { kind: "network" }, view: "people", limit: 1 }, defaultHost());
    const sum = (p.facets.people?.entityTypes ?? []).reduce((a, x) => a + x.count, 0);
    eq(sum, listed.length, "entity facet sum");
    const top = p.facets.people?.regions[0];
    if (top) {
      const inRegion = await allPeople({ region: top.value });
      eq(inRegion.length, top.count, `region ${top.value}`);
      if (inRegion.some((i) => i.person?.region !== top.value)) throw new Error("region filter let another region through");
    }
  });
  await t("people: listing kinds (s16) match the live tables, add up, and filter", async () => {
    const [w] = await db<Array<{ org: number; assoc: number; artist: number }>>`
      SELECT count(*) FILTER (WHERE EXISTS (SELECT 1 FROM organizations o WHERE o.profile_user_id = u.id))::int AS org,
             count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM organizations o WHERE o.profile_user_id = u.id) AND u.entity_type = 'organization')::int AS assoc,
             count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM organizations o WHERE o.profile_user_id = u.id) AND COALESCE(u.entity_type, 'person') <> 'organization')::int AS artist
      FROM users u WHERE u.slug IS NOT NULL AND u.directory_listed`;
    const p = await searchContent(null, { scope: { kind: "network" }, view: "people", limit: 1 }, defaultHost());
    const by = Object.fromEntries((p.facets.people?.listingKinds ?? []).map((x) => [x.value, x.count]));
    eq({ artist: by.artist ?? 0, organization: by.organization ?? 0, associated: by.associated ?? 0 }, { artist: w!.artist, organization: w!.org, associated: w!.assoc }, "listing kind facet");
    const orgs = await allPeople({ listingKinds: ["organization"] });
    eq(orgs.length, w!.org, "organization filter size");
    if (orgs.some((i) => i.person?.listingKind !== "organization")) throw new Error("organization filter let another kind through");
  });
  await t("people: text search finds a listed identity by its name", async () => {
    const [one] = await db<Array<{ id: string; name: string }>>`SELECT id::text AS id, display_name AS name FROM users
      WHERE slug IS NOT NULL AND directory_listed AND length(display_name) > 3 ORDER BY display_name LIMIT 1`;
    if (!one) return;
    const res = await searchContent(null, { scope: { kind: "network" }, view: "people", q: one.name, limit: 10 }, defaultHost());
    if (!res.items.some((i) => i.key === `person:${one.id}`)) throw new Error("name search missed the identity");
  });
}

// ── H: offers (v1.4, CONTRACT s16 revised; paid work) ────────────────────────
// Fixture rows live in a rolled-back transaction (predicate checks); the end-to-end checks read the real index.
// hydrateRows is fed index rows built from live thread rows, so no content_index row is written.
{
  const { offerRowSql, offerKindSql, takeUpOf } = await import("../src/server/offers");
  const { hydrateRows } = await import("../src/server/hydrate");
  const { drainContentQueue } = await import("@elkdonis/services");
  await drainContentQueue({ all: true });
  const net = { kind: "network" } as const;
  const keysOf = async (view: "published" | "all" | "offers", extra: Partial<ContentQuery> = {}) => {
    const out: string[] = [];
    let cursor: string | null = null;
    for (let i = 0; i < 40; i++) {
      const r = await searchContent(null, { scope: net, view, limit: 100, cursor, ...extra }, defaultHost(), { noDrain: true });
      out.push(...r.items.map((x) => x.key));
      cursor = r.nextCursor;
      if (!cursor) break;
    }
    return out;
  };

  try {
    await db.begin(async (tx) => {
      const ins = (id: string, type: string, extra: { price?: number | null; status?: string; hidden?: boolean; store?: string; sale?: string | null } = {}) =>
        tx`INSERT INTO content_index (store, id, type, org_id, site_org_id, owner_user_id, owner_identity_id, visibility, status, hidden, sale_state, price_minor, currency, title, sort_at)
           VALUES (${extra.store ?? "thread"}, ${id}, ${type}, 'zz-org', 'zz-org', ${uid.A}, ${uid.A}, 'PUBLIC', ${extra.status ?? "published"}, ${extra.hidden ?? false}, ${extra.sale ?? null}, ${extra.price ?? null}, ${extra.price ? "CAD" : null}, ${id}, now())`;
      await ins("zz-o1", "service", { price: 5000 });                   // offer: priced service
      await ins("zz-o2", "service");                                    // not an offer: free, no RSVP (no threads row)
      await ins("zz-o3", "event", { price: 2000 });                     // offer
      await ins("zz-o4", "event", { price: 2000, status: "draft" });    // not: draft
      await ins("zz-o5", "series");                                     // offer (subscribe)
      await ins("zz-o6", "writing", { price: 900 });                    // not: wrong type
      await ins("zz-o7", "workshop", { price: 100, hidden: true });     // not: hidden
      await ins("zz-o8", "artwork", { store: "artwork", sale: "for_sale", price: 30000 });  // offer
      await ins("zz-o9", "artwork", { store: "artwork", sale: "sold", price: 30000 });      // not: sold
      const rows = await tx<Array<{ id: string; kind: string }>>`SELECT ci.id, ${offerKindSql()} AS kind FROM content_index ci WHERE ci.id LIKE 'zz-o%' AND ${offerRowSql()}`;
      await t("offers: the row predicate admits exactly the priced/RSVP threads, series and for-sale artwork", () => {
        eq(rows.map((r) => r.id).sort(), ["zz-o1", "zz-o3", "zz-o5", "zz-o8"], "offer rows");
        eq(Object.fromEntries(rows.map((r) => [r.id, r.kind])), { "zz-o1": "service", "zz-o3": "event", "zz-o5": "series", "zz-o8": "artwork" }, "kinds");
      });
      await t("offers: a service row is invisible to published/all/people reads and to refs, visible with the offers option", async () => {
        const read = async (opts: Parameters<typeof contentReadSql>[3]) =>
          idsOf(await tx<Array<{ key: string }>>`SELECT ci.key FROM content_index ci WHERE ci.id LIKE 'zz-o%' AND ${contentReadSql(null, net, host, opts)}`);
        if ((await read({})).includes("o1")) throw new Error("service visible by default");
        if ((await read({ people: true })).includes("o1")) throw new Error("service visible with people");
        if (!(await read({ offers: true })).includes("o1")) throw new Error("service hidden with offers");
        if ((await tx<Array<{ key: string }>>`SELECT ci.key FROM content_index ci WHERE ci.key = 'thread:zz-o1' AND ${contentReadSql(null, null, host)}`).length) throw new Error("service visible to refs");
      });
      throw new Rollback();
    });
  } catch (e) {
    if (!(e instanceof Rollback)) { failures.push("part H1 crashed"); console.log("FAIL part H1", (e as Error).message); }
  }

  await t("offers: takeUp derivation", () => {
    eq(takeUpOf({ artwork: true, type: "artwork", priced: true, rsvp: false }), "order", "artwork");
    eq(takeUpOf({ type: "service", kind: "service", priced: true, rsvp: false }), "pay", "priced service");
    eq(takeUpOf({ type: "event", kind: "event", priced: false, rsvp: true }), "rsvp", "free rsvp event");
    eq(takeUpOf({ type: "meeting", kind: "meeting", priced: true, rsvp: false }), "enquire", "priced meeting is not payable here");
    eq(takeUpOf({ type: "series", kind: "series", priced: true, rsvp: false }), "subscribe", "series");
    eq(takeUpOf({ type: "workshop", kind: "workshop", priced: true, rsvp: true, registrationOpen: false }), "none", "closed workshop");
  });

  await t("offers: published and all return no service rows and no offer field; offers returns only offers", async () => {
    const pub = await searchContent(null, { scope: net, view: "published", limit: 100 }, defaultHost(), { noDrain: true });
    const all = await searchContent(null, { scope: net, view: "all", limit: 100 }, defaultHost(), { noDrain: true });
    for (const [n, r] of [["published", pub], ["all", all]] as const) {
      if (r.items.some((i) => i.type === "service" || i.offer)) throw new Error(`${n} carries a service or offer`);
      if (r.facets.offers) throw new Error(`${n} has offers facets`);
      if (r.facets.types.service) throw new Error(`${n} counts services`);
    }
    const off = await searchContent(null, { scope: net, view: "offers", limit: 100 }, defaultHost(), { noDrain: true });
    if (!off.facets.offers) throw new Error("offers view without offers facets");
    for (const i of off.items) {
      if (!i.offer) throw new Error(`${i.key} has no offer`);
      if (i.store === "artwork" && i.offer.takeUp !== "order") throw new Error(`${i.key} artwork takeUp ${i.offer.takeUp}`);
      if (i.store === "thread" && !["event", "service", "series", "workshop"].includes(i.offer.kind)) throw new Error(`${i.key} kind ${i.offer.kind}`);
    }
    // priced filter and kinds filter narrow, never widen
    const paid = await keysOf("offers", { priced: true });
    const free = await keysOf("offers", { priced: false });
    const every = await keysOf("offers");
    eq([...paid, ...free].sort(), [...every].sort(), "priced + free partition the offers");
  });

  await t("offers: hydration gives pay for a real priced thread and rsvp for a real free RSVP thread", async () => {
    const real = await db<Array<{ id: string; org_id: string; author_id: string; kind: string; price: string | null; rsvp: boolean }>>`
      SELECT t.id, t.org_id, t.author_id::text AS author_id, t.kind, COALESCE(wp.price_member, t.price)::text AS price, t.is_rsvp_enabled AS rsvp
      FROM threads t LEFT JOIN workshop_pages wp ON wp.thread_id = t.id
      WHERE t.status = 'published' AND t.visibility = 'PUBLIC' AND t.kind IN ('event', 'workshop', 'service', 'meeting')
      ORDER BY t.updated_at DESC LIMIT 300`;
    const priced = real.find((r) => r.price != null && Number(r.price) > 0 && ["event", "workshop", "service"].includes(r.kind));
    const free = real.find((r) => !(r.price != null && Number(r.price) > 0) && r.rsvp);
    const mk = (r: { id: string; org_id: string; author_id: string; kind: string }) => ({
      key: `thread:${r.id}`, store: "thread", id: r.id, type: r.kind === "meeting" ? "meeting" : r.kind, org_id: r.org_id, site_org_id: r.org_id, store_id: null,
      owner_user_id: r.author_id, owner_identity_id: r.author_id, status: "published", visibility: "PUBLIC", sale_state: null, hidden: false, series_id: null, sort_iso: new Date().toISOString(),
    });
    const hyd = async (r: { id: string; org_id: string; author_id: string; kind: string }) =>
      (await hydrateRows([mk(r)], { rights: null, scope: net, host: defaultHost(), now: new Date(), offers: true })).items.get(`thread:${r.id}`);
    if (!priced) console.log("      (no real priced event/workshop/service thread on this database: pay case skipped)");
    else {
      const it = await hyd(priced);
      eq(it?.offer?.takeUp, "pay", `takeUp of priced ${priced.kind} ${priced.id}`);
      eq(it?.offer?.price?.amountMinor, Math.round(Number(priced.price) * 100), "price in minor units");
    }
    if (!free) console.log("      (no real free RSVP thread on this database: rsvp case skipped)");
    else {
      const it = await hyd(free);
      eq(it?.offer?.takeUp, "rsvp", `takeUp of free RSVP ${free.id}`);
      eq(it?.offer?.price, null, "free price");
    }
  });

  // 2026-11-27: the route parsed view=offers as junk, so the HTTP search fell back to published (PM report).
  await t("offers: the query string carries view=offers, types=service and the offers filters both ways", async () => {
    const { parseContentQuery, contentQueryParams } = await import("../src/query-string");
    const sp = new URLSearchParams("scope=network&view=offers&types=service&limit=20&kinds=service,bogus&priced=1&upcoming=1");
    const q = parseContentQuery(sp);
    eq(q?.view, "offers", "view");
    eq(q?.types, ["service"], "types");
    eq(q?.offerKinds, ["service"], "kinds (junk dropped)");
    eq(q?.priced, true, "priced");
    eq(q?.upcoming, true, "upcoming");
    const back = parseContentQuery(contentQueryParams(q!));
    eq(back, q, "round trip");
    // Offers filters belong to the offers view only.
    const pub = parseContentQuery(new URLSearchParams("scope=network&view=published&kinds=service&priced=1"));
    eq([pub?.offerKinds, pub?.priced], [undefined, undefined], "filters ignored outside offers");
  });

  await t("offers: GET /api/content/search?view=offers signed out answers offers, not published", async () => {
    const { contentRoutes } = await import("../src/routes");
    const res = await contentRoutes(defaultHost()).search(new Request("http://localhost/api/content/search?scope=network&view=offers&limit=100"));
    eq(res.status, 200, "status");
    const body = (await res.json()) as Awaited<ReturnType<typeof searchContent>>;
    if (!body.facets.offers) throw new Error("no offers facets: the route did not run the offers view");
    for (const i of body.items) if (!i.offer) throw new Error(`${i.key} has no offer`);
    const svc = await contentRoutes(defaultHost()).search(new Request("http://localhost/api/content/search?scope=network&view=offers&types=service&limit=100"));
    const sb = (await svc.json()) as Awaited<ReturnType<typeof searchContent>>;
    for (const i of sb.items) if (i.type !== "service" || !i.offer) throw new Error(`${i.key} is ${i.type} in a services-only offers search`);
    console.log(`      (offers view over HTTP: ${body.items.length} items, ${sb.items.length} services)`);
    // A signed-out published search still never shows a service.
    const pub = await contentRoutes(defaultHost()).search(new Request("http://localhost/api/content/search?scope=network&view=published&types=service&limit=100"));
    const pb = (await pub.json()) as Awaited<ReturnType<typeof searchContent>>;
    eq(pb.items.length, 0, "published types=service is empty");
  });
}

console.log(`\n${pass} passed, ${failures.length} failed`);
await db.end({ timeout: 2 }).catch(() => {});
process.exit(failures.length ? 1 : 0);
