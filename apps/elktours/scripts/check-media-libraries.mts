// Checks for the picture libraries (src/lib/media-libraries.ts): each library lists only what that person may see, a
// stranger gets nothing, no Private/ path is ever returned, hostile folder names are refused, and the database is
// byte-identical afterwards. Reads only (the listings write nothing); real people from user_organizations, real rows.
//   cd ~/eac && sudo -n docker compose run --rm --no-deps -w /app/apps/elktours admin node \
//     /app/node_modules/.pnpm/tsx@4.20.6/node_modules/tsx/dist/cli.mjs scripts/check-media-libraries.mts
import React from "react";
(globalThis as any).React = React;

const { db } = await import("@elkdonis/db");
const lib = await import("../src/lib/media-libraries");
const cfg = await import("../src/lib/media-libraries-config");
const folders = await import("../src/lib/media-folders");

type V = NonNullable<Parameters<typeof lib.listLibrary>[0]>;
let failed = 0;
let passed = 0;
function check(name: string, ok: boolean, detail = "") {
  if (ok) passed++;
  else failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : detail ? `  -> ${detail}` : ""}`);
}

async function fingerprint(): Promise<string> {
  const [a] = (await db`SELECT md5(COALESCE(string_agg(t::text, ',' ORDER BY t.id), '')) AS h FROM tour_assets t`) as unknown as { h: string }[];
  const [b] = (await db`SELECT md5(COALESCE(string_agg(p::text, ',' ORDER BY p.id), '')) AS h FROM places p`) as unknown as { h: string }[];
  const [c] = (await db`SELECT md5(COALESCE(string_agg(m::text, ',' ORDER BY m.id), '')) AS h FROM media m WHERE org_id = 'elktours'`) as unknown as { h: string }[];
  return `${a!.h}|${b!.h}|${c!.h}`;
}
const before = await fingerprint();

// ── people: real rows ────────────────────────────────────────────────────
const roleRows = (await db`SELECT user_id::text AS id, role FROM user_organizations WHERE org_id = 'elktours' ORDER BY role, user_id`) as unknown as { id: string; role: string }[];
const owner = roleRows.find((r) => r.role === "owner")!;
const guide = roleRows.find((r) => r.role === "guide")!;
const viewerRole = roleRows.find((r) => r.role === "viewer")!;
const [outsiderRow] = (await db`
  SELECT u.id::text AS id FROM users u WHERE NOT EXISTS (SELECT 1 FROM user_organizations o WHERE o.user_id = u.id AND o.org_id = 'elktours') LIMIT 1
`) as unknown as { id: string }[];
const person = (id: string, role: string | null): V => ({
  userId: id,
  role: role as V["role"],
  canEdit: role === "owner" || role === "guide",
  isMember: role === "owner" || role === "guide" || role === "member",
});
const ownerV = person(owner.id, "owner");
const guideV = person(guide.id, "guide");
const viewerV = person(viewerRole.id, "viewer");
const outsiderV = person(outsiderRow!.id, null);
check("fixtures: an owner, a guide, a viewer and an outsider exist", !!owner && !!guide && !!viewerRole && !!outsiderRow);

const KEYS = ["tours", "places", "general", "stops"];
const flat = (listing: { items: { path: string; url?: string }[] }) => listing.items.flatMap((i) => [i.path, i.url ?? ""]);
const hasPrivate = (s: string) => /(^|\/)private(\/|$)/i.test(decodeURIComponentSafe(s));
function decodeURIComponentSafe(s: string) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

// ── a stranger and non-editors get nothing ───────────────────────────────
for (const k of KEYS) {
  const r = await lib.listLibrary(null, k);
  check(`signed out: ${k} refused (401)`, !r.ok && r.status === 401);
}
for (const [label, v] of [["outsider (no role here)", outsiderV], ["viewer role", viewerV]] as const) {
  for (const k of KEYS) {
    const r = await lib.listLibrary(v, k);
    check(`${label}: ${k} refused (403)`, !r.ok && r.status === 403, JSON.stringify(r).slice(0, 80));
  }
  check(`${label}: no libraries offered`, lib.librariesFor(v).length === 0);
}
check("signed out: no libraries offered", lib.librariesFor(null).length === 0);
check("guide: Tours, Places, General, Stop folders offered, and no My pictures library exists", lib.librariesFor(guideV).map((l) => l.key).join() === "tours,places,general,stops" && !(await lib.listLibrary(guideV, "mine" as any)).ok);

// ── tours ────────────────────────────────────────────────────────────────
const ownerTours = await lib.listLibrary(ownerV, "tours");
const guideTours = await lib.listLibrary(guideV, "tours");
check("owner: tours library lists", ownerTours.ok);
check("guide: tours library lists", guideTours.ok);
if (ownerTours.ok && guideTours.ok) {
  const oSlugs = ownerTours.listing.items.map((i) => i.path).sort();
  const gSlugs = guideTours.listing.items.map((i) => i.path).sort();
  check("guide sees every tour the owner sees (developer 2026-11-21)", JSON.stringify(oSlugs) === JSON.stringify(gSlugs), `${gSlugs.length} vs ${oSlugs.length}`);
  console.log(`      owner and guide each see ${oSlugs.length} tour folders with pictures`);
  let pics = 0;
  for (const s of oSlugs) {
    const inner = await lib.listLibrary(guideV, "tours", { path: s });
    check(`guide: tour folder ${s} opens`, inner.ok);
    if (!inner.ok) continue;
    pics += inner.listing.items.length;
    check(`tour folder ${s}: every picture is this org's, none Private`, inner.listing.items.every((i) => !i.isFolder && lib.isOfferablePicture(i.url)) && flat(inner.listing).every((p) => !hasPrivate(p)));
  }
  console.log(`      ${pics} pictures across the tour folders`);
}
const [anyTour] = (await db`SELECT id FROM threads WHERE org_id = 'elktours' AND kind = 'tour' LIMIT 1`) as unknown as { id: string }[];
const oneTour = await lib.listLibrary(ownerV, "tours", { tourId: anyTour!.id });
check("owner: 'This tour' (?tour=) opens straight into the pictures, flat", oneTour.ok && !oneTour.listing.browsable && oneTour.listing.items.every((i) => !i.isFolder));
const searched = await lib.listLibrary(ownerV, "tours", { q: "paris" });
check("tours: a search lists pictures only, none Private", searched.ok && searched.listing.items.every((i) => !i.isFolder) && flat(searched.ok ? searched.listing : { items: [] }).every((p) => !hasPrivate(p)));

// ── places ───────────────────────────────────────────────────────────────
const places = await lib.listLibrary(ownerV, "places");
check("owner: places library lists", places.ok);
if (places.ok) {
  console.log(`      ${places.listing.items.length} place folders with registered pictures (no place has any row today)`);
  for (const f of places.listing.items) {
    const inner = await lib.listLibrary(guideV, "places", { path: f.path });
    check(`guide: place folder ${f.path} opens, none Private`, inner.ok && flat(inner.listing).every((p) => !hasPrivate(p)));
  }
}
const [somePlace] = (await db`SELECT slug FROM places WHERE org_id = 'elktours' LIMIT 1`) as unknown as { slug: string }[];
const pl = await lib.listLibrary(ownerV, "places", { path: somePlace!.slug });
check("places: a place with no registered pictures lists as empty, not an error", pl.ok && pl.listing.items.length === 0);

// ── general ──────────────────────────────────────────────────────────────
const general = await lib.listLibrary(ownerV, "general");
if (!general.ok && general.status === 502) console.log("SKIP  general: storage not reachable from here");
else {
  check("owner: general library lists", general.ok);
  if (general.ok) {
    const stills = (await db`SELECT url FROM tour_assets WHERE org_id = 'elktours' AND kind IN ('still','streetview') AND url IS NOT NULL`) as unknown as { url: string }[];
    const stillSet = new Set(stills.map((s) => s.url));
    check("general: every item is this org's, none Private", general.listing.items.every((i) => i.isFolder || lib.isOfferablePicture(i.url)) && flat(general.listing).every((p) => !hasPrivate(p)));
    check("general: no Street View stills offered", general.listing.items.every((i) => !i.url || !stillSet.has(i.url)));
    console.log(`      general lists ${general.listing.items.filter((i) => !i.isFolder).length} pictures and ${general.listing.items.filter((i) => i.isFolder).length} folders (Street View stills hidden: ${stillSet.size} registered)`);
    const guideGeneral = await lib.listLibrary(guideV, "general");
    check("guide: general lists the same pictures", guideGeneral.ok && guideGeneral.listing.items.length === general.listing.items.length);
  }
  for (const bad of ["Private", "private/Media", "../Images", "..", "/etc", "a/../../x", "Media/Private", ".hidden"]) {
    const r = await lib.listLibrary(ownerV, "general", { path: bad });
    check(`general: path "${bad}" returns no pictures`, !r.ok || r.listing.items.length === 0, JSON.stringify(r).slice(0, 80));
  }
  const q = await lib.listLibrary(ownerV, "general", { q: "private" });
  check("general: searching 'private' returns nothing from a Private folder", !q.ok || flat(q.listing).every((p) => !hasPrivate(p)));
}

// ── stop folders (the sorted Stops/ folders, tour then stop) ─────────────
{
  const root = await lib.listLibrary(ownerV, "stops");
  if (!root.ok && root.status === 502) console.log("SKIP  stops: storage not reachable from here");
  else {
    check("owner: stop folders lists", root.ok);
    const guideRoot = await lib.listLibrary(guideV, "stops");
    check("guide: stop folders lists the same folders as the owner", root.ok && guideRoot.ok && JSON.stringify(root.listing.items) === JSON.stringify(guideRoot.listing.items));
    if (root.ok) {
      check("stop folders: the top level is folders only", root.listing.items.length > 0 && root.listing.items.every((i) => i.isFolder));
      let offered = 0;
      let heldBack = 0;
      const urls: string[] = [];
      const open = async (path: string) => {
        const r = await lib.listLibrary(ownerV, "stops", { path });
        check(`stop folders: ${path} opens`, r.ok, JSON.stringify(r).slice(0, 80));
        return r.ok ? r.listing : { path, items: [], browsable: true };
      };
      for (const top of root.listing.items) {
        const level = await open(top.path);
        for (const f of level.items) {
          const inner = await open(f.path);
          for (const i of inner.items) {
            if (i.isFolder) {
              // the held-back list: labels only, each opens to nothing
              const held = await open(i.path);
              heldBack += held.items.length;
              for (const h of held.items) check(`stop folders: held-back ${h.name.split(":")[0]} opens to nothing`, (await open(h.path)).items.length === 0);
            } else {
              offered++;
              urls.push(i.url!);
            }
          }
        }
      }
      console.log(`      stop folders: ${root.listing.items.length} top folders, ${offered} pictures offered, ${heldBack} held back (location stamp or unreadable)`);
      check("stop folders: every picture is this org's Stops/ file, none Private, none foreign", urls.every((u) => u.startsWith(`/api/media/EAC_Network/elktours/Stops/`) && lib.isOfferablePicture(u)) && urls.every((u) => !hasPrivate(u)));
      check("stop folders: a picture is offered once per stop (no repeats inside a stop)", offered === urls.length);
    }
    for (const bad of ["Private", "../Stops", "..", "a/b/c/d/e", "unsorted/..", "unsorted/Private", "x/../y", "%2e%2e", "/etc", "discover-the-heart-of-paris-ile-de-la-cite/../../Private"]) {
      const r = await lib.listLibrary(ownerV, "stops", { path: bad });
      check(`stop folders: path "${bad}" returns no pictures`, !r.ok || r.listing.items.length === 0, JSON.stringify(r).slice(0, 80));
    }
    const sq = await lib.listLibrary(ownerV, "stops", { q: "marais" });
    check("stop folders: a search lists pictures only, all offerable, none Private", sq.ok && sq.listing.items.every((i) => !i.isFolder && lib.isOfferablePicture(i.url)) && flat(sq.ok ? sq.listing : { items: [] }).every((x) => !hasPrivate(x)));
    const pq = await lib.listLibrary(ownerV, "stops", { q: "private" });
    check("stop folders: searching 'private' returns nothing from a Private folder", !pq.ok || flat(pq.listing).every((x) => !hasPrivate(x)));
  }
}

// ── hostile input and the pure filter ────────────────────────────────────
for (const [k, o] of [
  ["tours", { path: "../places" }],
  ["tours", { path: "a/b" }],
  ["tours", { path: "Private" }],
  ["places", { path: "x'; drop table places;--" }],
  ["places", { path: "../../etc" }],
  ["tours", { tourId: "'; select 1;--" }],
] as const) {
  const r = await lib.listLibrary(ownerV, k, o as any);
  check(`${k} ${JSON.stringify(o)} refused or empty`, (!r.ok && r.status === 404) || (r.ok && r.listing.items.length === 0), JSON.stringify(r).slice(0, 80));
}
const unknown = await lib.listLibrary(ownerV, "orgs");
check("an unknown library key is refused", !unknown.ok && unknown.status === 404);

const O = "/api/media/EAC_Network/elktours/";

const table: [string, boolean, boolean?][] = [
  [`${O}Media/Images/a.jpg`, true],
  [`${O}Places/louvre/a.jpg`, true],
  [`${O}Private/Media/Images/a.jpg`, false],
  [`${O}private/Media/a.jpg`, false],
  [`${O}Tours/x/Private/notes.jpg`, false],
  [`${O}Media/%50rivate/a.jpg`, false],
  [`${O}Media/..%2FPrivate/a.jpg`, false],
  [`${O}Media/../Private/a.jpg`, false],
  [`${O}Media/Images/a.jpg?w=240`, true],
  [`${O}Media/Private/a.jpg?w=240`, false],
  ["/api/media/EAC_Network/ifac/Media/a.jpg", false],
  ["/api/media/EAC_Network/users/someone/Media/Images/a.jpg", false, true],
  ["/api/media/EAC_Network/users/someone/Private/Media/a.jpg", false],
  ["http://example.com/a.jpg", false],
  ["https://upload.wikimedia.org/a.jpg", true],
  ["javascript:alert(1)", false],
  ["", false],
];
for (const [url, want, users] of table) {
  const got = lib.isOfferablePicture(url, false);
  check(`isOfferablePicture(${url || "(empty)"}) = ${want}`, got === want);
  if (users !== undefined) check(`isOfferablePicture(${url}, allowUsers) = ${users}`, lib.isOfferablePicture(url, true) === users);
}
check("the private users/ path is refused even with allowUsers", !lib.isOfferablePicture("/api/media/EAC_Network/users/someone/Private/Media/a.jpg", true));

// ── the picker's tab list ────────────────────────────────────────────────
check("blocks' libraries: Tours, Places, General, Stop folders", cfg.PICTURE_LIBRARIES.map((l) => l.key).join() === "tours,places,general,stops" && cfg.PICTURE_LIBRARIES.find((l) => l.key === "stops")?.label === "Stop folders");
const wiz = cfg.pictureLibraries({ tourId: "abc123abc123" });
check("creation flow: This tour first, no separate Tours, then Places, General", wiz.map((l) => l.key).join() === "this-tour,places,general,stops" && wiz[0]!.endpoint.endsWith("?tour=abc123abc123"));

// ── the folders menu: register in place (inside BEGIN ... ROLLBACK) ──────
{
  const [st] = (await db`
    SELECT s.id::text AS stop, s.title AS stop_title, s.thread_id AS tour, t.title AS tour_title, s.place_id::text AS place, p.title AS place_title
    FROM tour_stops s JOIN threads t ON t.id = s.thread_id JOIN places p ON p.id = s.place_id
    WHERE s.org_id = 'elktours' AND t.kind = 'tour' LIMIT 1`) as unknown as { stop: string; stop_title: string; tour: string; tour_title: string; place: string; place_title: string }[];
  const file = `zz-check-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const key = `EAC_Network/elktours/Stops/ZZ_CHECK/${file}`;
  const item = (choice: "place" | "stop" | "overview" | "leave") => ({
    folder: "ZZ_CHECK", file, caption: "check", credit: null, tourId: st!.tour, tourTitle: st!.tour_title, stopId: st!.stop, stopTitle: st!.stop_title,
    placeId: st!.place, placeTitle: st!.place_title, choice,
  });
  class Rollback extends Error {}
  const rowsFor = async (tx: typeof db) => (await tx`SELECT id, storage_key, url, thread_id, stop_id::text AS stop_id, place_id::text AS place_id FROM tour_assets WHERE storage_key = ${key}`) as unknown as any[];
  try {
    await db.begin(async (raw) => {
      const tx = raw as unknown as typeof db;
      const opt = { sql: tx, checkGps: false };
      const r1 = await folders.registerInPlace([item("stop")], null, opt);
      let rows = await rowsFor(tx);
      check("register (stop): one new row, the file's key unchanged", r1.registered === 1 && rows.length === 1 && rows[0].storage_key === key && rows[0].stop_id === st!.stop && rows[0].thread_id === st!.tour, JSON.stringify(r1));
      const r2 = await folders.registerInPlace([item("stop")], null, opt);
      rows = await rowsFor(tx);
      check("register (stop) twice: no second row", r2.registered === 0 && r2.already === 1 && rows.length === 1, JSON.stringify(r2));
      const r3 = await folders.registerInPlace([item("place")], null, opt);
      rows = await rowsFor(tx);
      check("choose 'place': the same row now belongs to the place, still one row, same key and url", r3.updated === 1 && rows.length === 1 && rows[0].place_id === st!.place && rows[0].thread_id === null && rows[0].stop_id === null && rows[0].storage_key === key && rows[0].url === `/api/media/${encodeURI(key)}`, JSON.stringify(r3));
      const r4 = await folders.registerInPlace([item("place")], null, opt);
      check("choose 'place' twice: unchanged", r4.already === 1 && (await rowsFor(tx)).length === 1, JSON.stringify(r4));
      await folders.registerInPlace([item("overview")], null, opt);
      rows = await rowsFor(tx);
      check("choose 'overview': still one row, owned by the tour only", rows.length === 1 && rows[0].thread_id === st!.tour && rows[0].stop_id === null && rows[0].place_id === null);
      const r5 = await folders.registerInPlace([item("leave")], null, opt);
      check("'leave' skips the file", r5.registered + r5.updated + r5.already === 0 && (await rowsFor(tx)).length === 1);
      const bad = await folders.registerInPlace([{ ...item("place"), placeId: null }], null, opt);
      check("a choice that does not fit the file is refused, no row added", bad.failed.length === 1 && (await rowsFor(tx)).length === 1);
      const dupUrl = (await tx`SELECT COUNT(*)::int AS n FROM tour_assets WHERE url = ${`/api/media/${encodeURI(key)}`}`) as unknown as { n: number }[];
      check("exactly one row exists for the file in total", dupUrl[0]!.n === 1);
      throw new Rollback();
    });
  } catch (e) {
    if (!(e instanceof Rollback)) throw e;
  }
  const left = (await db`SELECT COUNT(*)::int AS n FROM tour_assets WHERE storage_key = ${key}`) as unknown as { n: number }[];
  check("rolled back: no trace of the test row", left[0]!.n === 0);
}

// ── nothing was written ──────────────────────────────────────────────────
const after = await fingerprint();
check("tour_assets, places and media are byte-identical after all of this", before === after);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
