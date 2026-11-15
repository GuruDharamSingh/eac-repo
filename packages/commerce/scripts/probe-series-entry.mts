/**
 * Auction series entries (./src/server/series.ts, 2026-11-12;
 * docs/open/IFAC_STUDIO_STORES_AND_KIT_2026-11-12.md §4): who may enter a
 * piece straight into a series, the lot it gets, and what the desk's removal
 * does (an entered lot is withdrawn, a desk lot is only detached).
 *
 * Runs against the live DB through the real server functions, inside ONE
 * transaction that is rolled back at the end: every function's own db.begin
 * becomes a savepoint on that one connection. Nothing is committed.
 * Uses the published series SERIES_SLUG (default ifac-fall-auction).
 *
 *   cd ~/eac && sg docker -c "docker compose exec -T -w /app/packages/commerce admin \
 *     /app/packages/analytics/node_modules/.bin/tsx scripts/probe-series-entry.mts"
 */

import { createRequire } from "node:module";

let pass = 0;
let fail = 0;
const ok = (label: string, cond: boolean, detail: unknown = "") => {
  if (cond) { pass++; console.log(`  ok   ${label}`); }
  else { fail++; console.log(`  FAIL ${label} ${typeof detail === "string" ? detail : JSON.stringify(detail)}`); }
};
async function throws(label: string, fn: () => Promise<unknown>, re: RegExp) {
  try {
    await fn();
    ok(label, false, "did not throw");
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    ok(label, re.test(m), m);
  }
}

const SERIES_SLUG = process.env.SERIES_SLUG?.trim() || "ifac-fall-auction";
const postgres = createRequire("/app/packages/db/package.json")("postgres") as typeof import("postgres").default;

// ── harness: one rolled-back transaction ─────────────────────────────────────
const base = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
const conn: any = await base.reserve();
await conn.unsafe("BEGIN");
let n = 0;
const begin = async (fn: (tx: unknown) => Promise<unknown>) => {
  const sp = `probe_sp_${++n}`;
  await conn.unsafe(`SAVEPOINT ${sp}`);
  try {
    const r = await fn(proxy);
    await conn.unsafe(`RELEASE SAVEPOINT ${sp}`);
    return r;
  } catch (e) {
    await conn.unsafe(`ROLLBACK TO SAVEPOINT ${sp}`);
    throw e;
  }
};
const proxy: any = new Proxy(function () {}, {
  apply: (_t, _this, args) => conn(...args),
  get: (_t, prop) => {
    if (prop === "begin") return begin;
    const v = conn[prop];
    return typeof v === "function" ? v.bind(conn) : v;
  },
});
(globalThis as any).__db = proxy;

const { db } = await import("@elkdonis/db");
const S = await import("../src/server/index.ts");

async function lot(id: string) {
  const [r] = (await db`
    SELECT al.status, al.series_id, al.lot_number, al.end_at, al.metadata, s.live_at, s.stagger_seconds, s.close_mode
    FROM auction_lot al LEFT JOIN auction_series s ON s.slug = ${SERIES_SLUG}
    WHERE al.id = ${id}
  `) as any[];
  return r;
}

async function makePiece(storeId: string, actorUserId: string, artistUserId: string | null, title: string) {
  const { id } = await S.createArtwork({
    storeId, actorUserId, artistUserId, title, kind: "original", priceMinor: 50000,
    images: [{ url: "https://example.invalid/probe-series-entry.jpg" }],
  } as any);
  await S.publishArtwork(id, actorUserId);
  return id;
}

try {
  const [ser] = (await db`SELECT id, org_id, presenter_org_id, host_org_id, status, live_at FROM auction_series WHERE slug = ${SERIES_SLUG}`) as any[];
  if (!ser) throw new Error(`No series ${SERIES_SLUG}`);
  console.log(`series ${SERIES_SLUG}: ${ser.status}, presenter ${ser.presenter_org_id}, host ${ser.host_org_id}, close ${new Date(ser.live_at).toISOString()}`);
  const entryOrgs = [ser.presenter_org_id, ser.host_org_id].filter(Boolean);

  // Two people with no role in the series' orgs, not on the desk, not admins.
  const outsiders = (await db`
    SELECT u.id AS user_id FROM users u
    WHERE u.is_admin = false
      AND NOT EXISTS (SELECT 1 FROM user_organizations x WHERE x.user_id = u.id
                      AND (x.org_id = ANY(${entryOrgs}) OR x.org_id = ${ser.org_id}))
      AND NOT EXISTS (SELECT 1 FROM auction_series_member m WHERE m.series_id = ${ser.id} AND m.user_id = u.id)
      AND NOT EXISTS (SELECT 1 FROM store st WHERE st.owner_user_id = u.id)
    ORDER BY u.created_at DESC
    LIMIT 2
  `) as any[];
  const outsider = outsiders[0];
  // The participant: the second of them, made a plain member of the presenting
  // org with a personal store, inside this transaction only (rolled back).
  let member: { user_id: string; store_id: string } | undefined;
  if (outsiders[1]) {
    const uid = outsiders[1].user_id as string;
    await db`INSERT INTO user_organizations (user_id, org_id, role) VALUES (${uid}, ${ser.presenter_org_id}, 'member')`;
    const [st] = (await db`
      INSERT INTO store (owner_user_id, org_id, status, payout_email, display_name)
      VALUES (${uid}, ${ser.org_id}, 'active', 'probe@example.invalid', 'Probe store')
      RETURNING id
    `) as any[];
    member = { user_id: uid, store_id: st.id as string };
  }
  const [desk] = (await db`SELECT user_id FROM auction_series_member WHERE series_id = ${ser.id} AND role = 'editor' LIMIT 1`) as any[];
  const orgStore = await S.seriesStore(ser.id);
  const [seated] = orgStore
    ? ((await db`
        SELECT sm.user_id FROM store_member sm
        JOIN user_organizations uo ON uo.user_id = sm.user_id AND uo.org_id = ANY(${entryOrgs}) AND uo.role IN ('owner', 'guide', 'member')
        WHERE sm.store_id = ${orgStore.id} LIMIT 1
      `) as any[])
    : [];
  const [unseated] = orgStore
    ? ((await db`
        SELECT uo.user_id FROM user_organizations uo JOIN users u ON u.id = uo.user_id AND u.is_admin = false
        WHERE uo.org_id = ${ser.presenter_org_id} AND uo.role = 'guide'
          AND NOT EXISTS (SELECT 1 FROM store_member sm WHERE sm.store_id = ${orgStore.id} AND sm.user_id = uo.user_id)
          AND NOT EXISTS (SELECT 1 FROM auction_series_member m WHERE m.series_id = ${ser.id} AND m.user_id = uo.user_id)
          AND NOT EXISTS (SELECT 1 FROM user_organizations x WHERE x.user_id = uo.user_id AND x.org_id = ${ser.org_id} AND x.role = 'owner')
        LIMIT 1
      `) as any[])
    : [];
  if (!member || !outsider || !desk) throw new Error(`Missing a test person: member ${!!member}, outsider ${!!outsider}, desk ${!!desk}`);

  console.log("\nwho may enter");
  ok("listEnterableSeries lists the series for a participant", (await S.listEnterableSeries(member.user_id)).some((s) => s.id === ser.id));
  ok("canEnterSeries: participant yes", await S.canEnterSeries(member.user_id, ser.id));
  ok("canEnterSeries: outsider no", !(await S.canEnterSeries(outsider.user_id, ser.id)));
  ok("listEnterableSeries is empty for the outsider", (await S.listEnterableSeries(outsider.user_id)).every((s) => s.id !== ser.id));

  console.log("\nentry from a personal store");
  const pieceA = await makePiece(member.store_id, member.user_id, member.user_id, "Probe entry A");
  await throws("outsider cannot enter (even naming someone else's piece)",
    () => S.enterSeries({ seriesId: ser.id, actorUserId: outsider.user_id, artworkId: pieceA, startingBidMinor: 10000 }), /not open to entries/);
  const [mx] = (await db`SELECT COALESCE(MAX(lot_number), 0) AS n FROM auction_lot WHERE series_id = ${ser.id}`) as any[];
  const entry = await S.enterSeries({ seriesId: ser.id, actorUserId: member.user_id, artworkId: pieceA, startingBidMinor: 10000, reserveMinor: 20000 });
  const la = await lot(entry.lotId);
  ok("lot is in the series", la.series_id === ser.id, la.series_id);
  ok("lot takes the next number", entry.lotNumber === Number(mx.n) + 1 && la.lot_number === entry.lotNumber, { entry, mx: mx.n });
  ok("lot is marked enteredSeries / enteredBy", la.metadata?.enteredSeries === ser.id && la.metadata?.enteredBy === member.user_id, la.metadata);
  ok("lot is open (scheduled or live)", la.status === "scheduled" || la.status === "live", la.status);
  const expectEnd = la.close_mode === "staggered"
    ? new Date(new Date(la.live_at).getTime() + entry.lotNumber * Number(la.stagger_seconds) * 1000).getTime()
    : new Date(la.live_at).getTime();
  ok("lot closes on the series' clock", new Date(la.end_at).getTime() === expectEnd, { end: la.end_at, expectEnd: new Date(expectEnd) });
  await throws("the same piece cannot be entered twice",
    () => S.enterSeries({ seriesId: ser.id, actorUserId: member.user_id, artworkId: pieceA, startingBidMinor: 10000 }), /already at auction/);
  const pieceB = await makePiece(member.store_id, member.user_id, member.user_id, "Probe entry B");
  const entryB = await S.enterSeries({ seriesId: ser.id, actorUserId: member.user_id, artworkId: pieceB, startingBidMinor: 10000, weekNo: 1 });
  ok("a second entry takes the number after", entryB.lotNumber === entry.lotNumber + 1, { a: entry.lotNumber, b: entryB.lotNumber });

  console.log("\ndesk removal of an entered lot");
  await db`UPDATE auction_lot SET bid_count = 1 WHERE id = ${entry.lotId}`;
  await throws("an entered lot with bids stays", () => S.removeLotFromSeries(ser.id, desk.user_id, entry.lotId), /has bids/);
  ok("…and is still in the series", (await lot(entry.lotId)).series_id === ser.id);
  await db`UPDATE auction_lot SET bid_count = 0 WHERE id = ${entry.lotId}`;
  await throws("a participant cannot remove lots", () => S.removeLotFromSeries(ser.id, member.user_id, entry.lotId), /cannot edit this series/);
  await S.removeLotFromSeries(ser.id, desk.user_id, entry.lotId);
  const lr = await lot(entry.lotId);
  ok("removed entered lot is withdrawn", lr.status === "cancelled" && lr.series_id === null, { status: lr.status, series: lr.series_id });
  const [pa] = (await db`SELECT status FROM artwork WHERE id = ${pieceA}`) as any[];
  ok("…and the piece stays listed", pa.status === "available", pa.status);

  console.log("\ndesk lot: removal only detaches (unchanged)");
  const pieceC = await makePiece(member.store_id, member.user_id, member.user_id, "Probe desk C");
  const own = await S.createLot({ artworkId: pieceC, actorUserId: member.user_id, endAt: new Date(ser.live_at), startingBidMinor: 10000 });
  await S.addLotToSeries(ser.id, desk.user_id, own.id);
  ok("desk added the lot", (await lot(own.id)).series_id === ser.id);
  await S.removeLotFromSeries(ser.id, desk.user_id, own.id);
  const lc = await lot(own.id);
  ok("desk lot is detached but still open", lc.series_id === null && (lc.status === "scheduled" || lc.status === "live"), { status: lc.status, series: lc.series_id });

  if (orgStore && seated) {
    console.log("\nentry from the presenting org's store");
    const pieceD = await makePiece(orgStore.id, seated.user_id, null, "Probe org D");
    const e2 = await S.enterSeries({ seriesId: ser.id, actorUserId: seated.user_id, artworkId: pieceD, startingBidMinor: 10000 });
    ok("a seated participant enters an org-store piece", (await lot(e2.lotId)).series_id === ser.id);
    if (unseated) {
      const pieceE = await makePiece(orgStore.id, seated.user_id, null, "Probe org E");
      await throws("an unseated guide cannot enter an org-store piece",
        () => S.enterSeries({ seriesId: ser.id, actorUserId: unseated.user_id, artworkId: pieceE, startingBidMinor: 10000 }), /Artwork not found/);
    } else console.log("  skip unseated guide: none found");
  } else console.log("  skip org store: no store or no seated participant");
} catch (e) {
  fail++;
  console.log(`  FAIL harness: ${e instanceof Error ? e.stack : String(e)}`);
} finally {
  await conn.unsafe("ROLLBACK");
  conn.release();
  await base.end({ timeout: 5 });
  console.log(`\n${pass} passed, ${fail} failed (rolled back; nothing committed)`);
  process.exit(fail ? 1 : 0);
}
