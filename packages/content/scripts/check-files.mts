// File rows in content_index (Step 5): rights, hydration, path classification, incremental reindex.
//   node /app/node_modules/.pnpm/tsx@4.20.6/node_modules/tsx/dist/cli.mjs scripts/check-files.mts   (admin container, cwd packages/content)
// Writes NOTHING lasting: part A inserts synthetic rows inside a rolled-back transaction. Part B reads the real
// file rows through searchContent with SYNTHETIC rights (random stranger; the real owner's id as data, no session).
// Part C re-runs indexFilesUnder on one small root and expects no writes.
import { randomUUID } from "node:crypto";
import { db } from "@elkdonis/db";
import { classifyFilePath, indexFilesUnder, parseMediaPath, userStorageRoot } from "@elkdonis/services";
import { defaultHost, type ContentHost } from "../src/host";
import type { ContentScope } from "../src/search-types";
import { contentReadSql, type ContentRights } from "../src/server/access";
import { searchContent } from "../src/server/search";

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
const U = { A: randomUUID(), B: randomUUID(), S: randomUUID(), M: randomUUID(), G: randomUUID(), V: randomUUID(), K: randomUUID(), ADM: randomUUID() };
const rights = (userId: string, o: Partial<ContentRights> = {}): ContentRights => ({ userId, isAdmin: false, identityIds: [userId], roles: {}, managedOrgIds: [], ...o });
const R = {
  stranger: rights(U.S),
  A: rights(U.A),
  member: rights(U.M, { roles: { "zz-org": "member" } }),
  guide: rights(U.G, { roles: { "zz-org": "guide" }, managedOrgIds: ["zz-org"] }),
  viewerRole: rights(U.V, { roles: { "zz-org": "viewer" } }),
  keeper: rights(U.K, { roles: { "zz-site": "owner" }, managedOrgIds: ["zz-site"] }),
  admin: rights(U.ADM, { isAdmin: true }),
};

// ── A: rights over synthetic file rows ───────────────────────────────────────
class Rollback extends Error {}
const FX = [
  { id: "zz-f1", owner: U.A, org: null, vis: "PUBLIC" },
  { id: "zz-f2", owner: U.A, org: null, vis: "PRIVATE" },
  { id: "zz-f3", owner: null, org: "zz-org", vis: "PUBLIC" },
  { id: "zz-f4", owner: null, org: "zz-org", vis: "PRIVATE" },
  { id: "zz-f5", owner: null, org: "zz-org", vis: "WORKSHOP" },
  { id: "zz-f6", owner: U.B, org: null, vis: "PRIVATE" },
  { id: "zz-f7", owner: null, org: "zz-site", vis: "PRIVATE" },
];
const ids = (rows: Array<{ key: string }>) => rows.map((r) => r.key.replace("file:zz-", "")).sort();
const want = (s: string) => s.split(" ").filter(Boolean).sort();
try {
  await db.begin(async (tx) => {
    for (const f of FX) {
      await tx`INSERT INTO content_index (store, id, type, org_id, site_org_id, owner_user_id, owner_identity_id, visibility, status, title, sort_at, file_path)
        VALUES ('file', ${f.id}, 'file', ${f.org}, ${f.vis === "WORKSHOP" ? null : f.org}, ${f.owner}, ${f.owner}, ${f.vis}, 'published', ${f.id}, now(), ${"EAC_Network/x/" + f.id})`;
    }
    const see = async (r: ContentRights | null, scope: ContentScope | null) =>
      ids(await tx<Array<{ key: string }>>`SELECT ci.key FROM content_index ci WHERE ci.id LIKE 'zz-f%' AND ${contentReadSql(r, scope, host)}`);
    await t("signed-out: no files at all", async () => eq(await see(null, null), [], "signed-out"));
    await t("stranger: no files (public or private)", async () => eq(await see(R.stranger, null), [], "stranger"));
    await t("owner A: own public and private files only", async () => eq(await see(R.A, null), want("f1 f2"), "A"));
    await t("org member: the org's public and private files, not workshop, not a person's", async () => eq(await see(R.member, null), want("f3 f4"), "member"));
    await t("org viewer role is not an affiliate", async () => eq(await see(R.viewerRole, null), [], "viewer"));
    await t("org guide (manager): public, private and workshop files of the org", async () => eq(await see(R.guide, null), want("f3 f4 f5"), "guide"));
    await t("site keeper: the site org's files only", async () => eq(await see(R.keeper, null), want("f7"), "keeper"));
    await t("admin: every file", async () => eq(await see(R.admin, null), want("f1 f2 f3 f4 f5 f6 f7"), "admin"));
    await t("network scope: no files for anyone, owner and admin included", async () => {
      for (const [n, r] of [["signed-out", null], ["stranger", R.stranger], ["A", R.A], ["guide", R.guide], ["admin", R.admin]] as const) eq(await see(r, { kind: "network" }), [], n);
    });
    await t("person scope: signed-out and a stranger get none; the owner sees theirs", async () => {
      eq(await see(null, { kind: "person", userId: U.A }), [], "signed-out");
      eq(await see(R.stranger, { kind: "person", userId: U.A }), [], "stranger");
      eq(await see(R.member, { kind: "person", userId: U.A }), [], "other user");
      eq(await see(R.A, { kind: "person", userId: U.A }), want("f1 f2"), "A");
    });
    await t("org scope: a stranger gets none; a member gets the org's public and private files", async () => {
      eq(await see(R.stranger, { kind: "org", orgId: "zz-org" }), [], "stranger");
      eq(await see(R.member, { kind: "org", orgId: "zz-org" }), want("f3 f4"), "member");
    });
    throw new Rollback();
  });
} catch (e) { if (!(e instanceof Rollback)) throw e; }
await t("rolled back: no synthetic rows remain", async () => {
  const [r] = await db<Array<{ n: number }>>`SELECT count(*)::int AS n FROM content_index WHERE id LIKE 'zz-f%'`;
  eq(r!.n, 0, "leftover rows");
});

// ── classification agrees with media-authz ───────────────────────────────────
await t("classifyFilePath agrees with parseMediaPath", () => {
  for (const p of [
    "EAC_Network/users/ejgold/Media/Images/a.jpg", "EAC_Network/users/ejgold/Private/Video/a.mp4", "EAC_Network/sunjay/Media/Images/a.jpg",
    "EAC_Network/sunjay/Private/x.pdf", "EAC_Network/sunjay/workshops/abc123/mat.pdf", "EAC_Network/sunjay/workshops/covers/c.jpg",
    "EAC-Network/ifac/Media/a.png", "Other/sunjay/a.png",
  ]) {
    const c = classifyFilePath(p), m = parseMediaPath(p);
    if (!m) { eq(c, null, p); continue; }
    const vis = m.kind === "workshop" ? "WORKSHOP" : m.isPrivate ? "PRIVATE" : "PUBLIC";
    eq([c?.visibility, c?.userFolder ?? null, c?.orgId ?? null], [vis, m.kind === "user" ? m.slug : null, m.kind === "user" ? null : m.orgId], p);
  }
});
await t("classifyFilePath refuses traversal and dotfiles", () => {
  eq(classifyFilePath("EAC_Network/users/a/../b/x.jpg"), null, "traversal");
  eq(classifyFilePath("EAC_Network/sunjay/.thumbs/x.jpg"), null, "dot");
});

// ── B: real rows through searchContent ───────────────────────────────────────
const [priv] = await db<Array<{ key: string; title: string; owner_user_id: string; file_path: string }>>`
  SELECT key, title, owner_user_id::text AS owner_user_id, file_path FROM content_index
  WHERE store = 'file' AND visibility = 'PRIVATE' AND owner_user_id IS NOT NULL AND type <> 'file' ORDER BY key LIMIT 1`;
const [pub] = await db<Array<{ key: string; title: string; owner_user_id: string | null; org_id: string | null }>>`
  SELECT key, title, owner_user_id::text AS owner_user_id, org_id FROM content_index
  WHERE store = 'file' AND visibility = 'PUBLIC' AND type = 'image' ORDER BY key LIMIT 1`;
if (!priv || !pub) { failures.push("no real file rows: run content-files-reindex first"); }
else {
  const search = (r: ContentRights, q: string, scope: ContentScope, view: "files" | "all" = "files") =>
    searchContent(null, { q, scope, view }, host, { rights: r, noDrain: true });
  await t(`owner finds their private file by name in Files and All (${priv.title})`, async () => {
    for (const view of ["files", "all"] as const) {
      const res = await search(rights(priv.owner_user_id), priv.title, { kind: "mine" }, view);
      const it = res.items.find((i) => i.key === priv.key);
      if (!it) throw new Error(`not found in ${view}`);
      eq([it.store, it.type !== "writing", Boolean(it.file?.path), it.can?.pick], ["file", true, true, true], "item shape");
    }
  });
  await t("a stranger never gets that private file (network, person, org, site; q and browse)", async () => {
    for (const scope of [{ kind: "network" }, { kind: "person", userId: priv.owner_user_id }, { kind: "site" }] as ContentScope[]) {
      for (const q of [priv.title, ""]) {
        const res = await search(R.stranger, q, scope, "all");
        if (res.items.some((i) => i.key === priv.key)) throw new Error(`leaked in ${scope.kind} q=${JSON.stringify(q)}`);
      }
    }
    const org = priv.file_path.split("/")[1]!;
    if ((await search(R.stranger, priv.title, { kind: "org", orgId: org }, "all")).items.some((i) => i.key === priv.key)) throw new Error("leaked in org");
  });
  await t(`a public file is found by its owner or org affiliate (cover, owner name, pick), never by a stranger on the network or person scope (${pub.title})`, async () => {
    const who = pub.owner_user_id ? rights(pub.owner_user_id) : rights(U.M, { roles: { [pub.org_id!]: "member" } });
    const scope: ContentScope = pub.owner_user_id ? { kind: "mine" } : { kind: "org", orgId: pub.org_id! };
    const it = (await search(who, pub.title, scope, "all")).items.find((i) => i.key === pub.key);
    if (!it) throw new Error("owner or affiliate did not find it");
    eq([it.type, Boolean(it.cover), it.can?.pick, Boolean(it.ownerName)], ["image", true, true, true], "public item");
    for (const sc of [{ kind: "network" }, ...(pub.owner_user_id ? [{ kind: "person", userId: pub.owner_user_id }] : [])] as ContentScope[]) {
      for (const q of [pub.title, ""]) {
        const res = await search(R.stranger, q, sc, "all");
        if (res.items.some((i) => i.store === "file")) throw new Error(`a stranger got a file in ${sc.kind}`);
      }
    }
  });
  await t("Published view never returns files; Files view returns only files", async () => {
    const pubView = await searchContent(null, { q: pub.title, scope: { kind: "network" }, view: "published" }, host, { rights: R.stranger, noDrain: true });
    if (pubView.items.some((i) => i.store === "file")) throw new Error("file in published view");
    const own = await search(rights(priv.owner_user_id), "", { kind: "mine" }, "files");
    if (!own.items.length || own.items.some((i) => i.store !== "file")) throw new Error("files view mixed or empty");
  });
}

// ── C: incremental ───────────────────────────────────────────────────────────
await t("re-indexing a root writes nothing when nothing changed", async () => {
  const [u] = await db<Array<{ storage_folder: string }>>`
    SELECT u.storage_folder FROM users u WHERE u.storage_folder IS NOT NULL AND EXISTS (SELECT 1 FROM content_index ci WHERE ci.owner_user_id = u.id AND ci.store = 'file') ORDER BY 1 LIMIT 1`;
  const r = await indexFilesUnder(userStorageRoot(u!.storage_folder));
  eq([r.listed > 0, r.upserted, r.removed], [true, 0, 0], `${u!.storage_folder} ${JSON.stringify(r)}`);
});

console.log(`\n${pass} passed, ${failures.length} failed`);
await db.end({ timeout: 2 }).catch(() => {});
process.exit(failures.length ? 1 : 0);
