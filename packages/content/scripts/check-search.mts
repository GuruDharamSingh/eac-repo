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
import { listContentLegacy as listContent } from "../src/server/list-legacy";
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

const idsOf = (rows: Array<{ key: string }>) => rows.map((r) => r.key.replace(/^(thread|artwork):zz-/, "")).sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
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

    await t("mine: stranger has none", async () => eq(await see(V.stranger, mine), [], "stranger"));
    await t("mine: A (own rows, credited piece; no pseudonym row; hidden excluded)", async () => eq(await see(V.A, mine), sorted("t1 t2 t7 a9 a10 a16"), "A"));
    await t("mine: A with a live pseudonym adds the pseudonym's row", async () => eq(await see(V.Awith, mine), sorted("t1 t2 t7 t11 a9 a10 a16"), "A+P"));
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
    await t("person scope: A themself sees everything of theirs (= mine)", async () => eq(await see(V.A, personA), sorted("t1 t2 t7 a9 a10 a16"), "A"));
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
  const [r] = await db<Array<{ n: number }>>`SELECT count(*)::int AS n FROM content_index WHERE status = 'published' AND visibility = 'PUBLIC' AND NOT hidden`;
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

// ── D: parity with listContent ───────────────────────────────────────────────
const strip = (i: object) => {
  const { store, can, sale, hidden, storefront, images, ownerName, ...rest } = i as Record<string, unknown>;
  void store; void can; void sale; void hidden; void storefront; void images; void ownerName;
  return rest;
};
const canon = (v: unknown): unknown => Array.isArray(v) ? v.map(canon) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v as object).filter(([, x]) => x !== undefined).sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, x]) => [k, canon(x)])) : v;
const HET = "bb77984c-0bdc-4e47-bb39-33dae6723794"; // house-editor-test (test account)
const STR = "8f2281ae-3efe-49fa-9b1b-9780b95593f1"; // claude-center-1018c@test.invalid (test account)
const ADM = rights(randomUUID(), { isAdmin: true });
const now = new Date();

async function parity(label: string, r: ContentRights, listQ: { orgId?: string; ownerUserId?: string; types?: ContentQuery["types"] }, scope: ContentScope, pageSize: number, paged: boolean) {
  const viewer = { userId: r.userId };
  const gather = async (kind: "old" | "new") => {
    const out: Array<Record<string, unknown>> = [];
    let cursor: string | null = null;
    for (let i = 0; i < 12; i++) {
      if (kind === "old") {
        const res: Awaited<ReturnType<typeof listContent>> = await listContent(viewer, { ...listQ, limit: pageSize, cursor }, r);
        out.push(...res.items.map((x) => canon(strip(x)) as Record<string, unknown>));
        cursor = res.nextCursor;
      } else {
        const res: Awaited<ReturnType<typeof searchContent>> = await searchContent(viewer, { scope, types: listQ.types, limit: pageSize, cursor }, defaultHost(), { rights: r, maxLimit: 200, now });
        out.push(...res.items.map((x) => canon(strip(x)) as Record<string, unknown>));
        cursor = res.nextCursor;
      }
      if (!paged || !cursor) break;
    }
    return out;
  };
  const [o, n] = await Promise.all([gather("old"), gather("new")]);
  const ok = o.map((x) => x.key as string), nk = n.map((x) => x.key as string);
  console.log(`      ${label}: old ${o.length} item(s), new ${n.length}`);
  eq(nk, ok, `${label}: key sequence`);
  for (let i = 0; i < o.length; i++) {
    if (JSON.stringify(o[i]) !== JSON.stringify(n[i])) {
      const a = o[i]!, b = n[i]!;
      const diff = Object.keys({ ...a, ...b }).filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]));
      throw new Error(`${label}: ${ok[i]} differs in ${diff.join(", ")}\n         old ${JSON.stringify(diff.map((k) => a[k])).slice(0, 400)}\n         new ${JSON.stringify(diff.map((k) => b[k])).slice(0, 400)}`);
    }
  }
}
const het = await resolveRights({ userId: HET });
const strg = await resolveRights({ userId: STR });
await t("parity {ownerUserId, limit:200}: test account house-editor-test", () => parity("mine/HET", het, { ownerUserId: HET }, { kind: "mine" }, 200, false));
await t("parity {ownerUserId, limit:200}: test account claude-center-1018c", () => parity("mine/STR", strg, { ownerUserId: STR }, { kind: "mine" }, 200, false));
for (const o of ["inner_group", "oad", "ifac", "sunjay", "market", "amrit_canada"]) {
  await t(`parity {orgId:${o}, limit:200}: guide test account (no standing in most orgs = public view)`, () => parity(`org ${o}/HET`, het, { orgId: o }, { kind: "org", orgId: o }, 200, false));
  await t(`parity {orgId:${o}, limit:200}: synthetic admin`, () => parity(`org ${o}/admin`, ADM, { orgId: o }, { kind: "org", orgId: o }, 200, false));
}
await t("parity {orgId, limit:40, types, cursor}: paged, inner_group writing, guide + stranger", async () => {
  await parity("paged inner_group writing/HET", het, { orgId: "inner_group", types: ["writing"] }, { kind: "org", orgId: "inner_group" }, 7, true);
  await parity("paged inner_group writing/STR", strg, { orgId: "inner_group", types: ["writing"] }, { kind: "org", orgId: "inner_group" }, 7, true);
});

await t("storefront: market artwork carries {id, name}; threads carry none", async () => {
  const res = await searchContent(null, { scope: { kind: "network" }, limit: 100 }, defaultHost());
  const art = res.items.filter((i) => i.store === "artwork");
  if (!art.length) throw new Error("no public artwork to check");
  if (art.some((i) => !i.storefront?.id || !i.storefront.name)) throw new Error("artwork without storefront");
  if (res.items.some((i) => i.store === "thread" && i.storefront)) throw new Error("thread has storefront");
});

// ── F: queue freshness, person scope on real data, can.pick, images ─────────
await t("triggers exist on threads, artwork and auction_lot (insert/delete and update)", async () => {
  const r = await db<Array<{ tgname: string }>>`SELECT tgname FROM pg_trigger WHERE tgname LIKE 'trg_content_index_%' AND NOT tgisinternal`;
  eq(r.map((x) => x.tgname).sort(), ["trg_content_index_artwork_iud", "trg_content_index_artwork_u", "trg_content_index_lot_iud", "trg_content_index_lot_u", "trg_content_index_threads_iud", "trg_content_index_threads_u"], "triggers");
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

console.log(`\n${pass} passed, ${failures.length} failed`);
await db.end({ timeout: 2 }).catch(() => {});
process.exit(failures.length ? 1 : 0);
