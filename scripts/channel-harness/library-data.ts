// Sample content for the library harness: published pieces (with sale state and stores), files, and a
// mock /api/content/search that answers like CONTRACT §3 (q, view, types, saleStates, storeIds, cursor).
import type { ContentIdentity, ContentListItem, ContentStatus, ContentType } from "@elkdonis/content/model";
import type { ContentQuery, ContentSaleState, ContentSearchResult } from "@elkdonis/content/search-types";
import { art } from "./library-mock";

export const ME: ContentIdentity = { id: "user:u1", kind: "user", name: "Guru Dharam", shortName: "You", initials: "GD" };
export const EA: ContentIdentity = { id: "org:elkdonis", kind: "org", name: "Elkdonis Arts Collective", shortName: "Elkdonis Arts", initials: "EA" };
export const IDS = [ME, EA];
export const TZ = "America/Toronto";

const STORES: Record<string, string> = { "st-ember": "Ember Pottery", "st-marsh": "Marsh Studio", "st-loom": "Loom & Line" };

interface Seed {
  key: string; type: ContentType; title: string; store: string; status?: ContentStatus; sale?: ContentSaleState; price?: string; hidden?: boolean; cover?: boolean;
  file?: { name: string; mime: string; size: number; folder: string }; day: string;
}

function mk(s: Seed): ContentListItem {
  const [store] = s.key.split(":");
  const isFile = store === "file";
  const site = { id: "user:u1", name: "Your page" };
  const url = isFile ? art(s.file!.name) : null;
  return {
    key: s.key, type: s.type, title: s.title, meta: s.price ? `Oil on linen · ${s.price}` : "", excerpt: "", cover: isFile ? (s.type === "image" ? url : null) : s.cover === false ? null : art(s.title),
    status: s.status ?? "published", siteIdentityId: site.id, siteName: site.name, siteHost: `${site.id}.example.org`, ownerIdentityId: ["artwork:a1", "artwork:a2", "artwork:a5"].includes(s.key) ? "user:u9" : ME.id, series: null,
    ...(["artwork:a1", "artwork:a2", "artwork:a5"].includes(s.key) ? { ownerName: "Mara Quinn" } : {}),
    images: store === "artwork" ? [1, 2, 3].map((n) => art(s.title + n)) : undefined,
    createdAt: `${s.day}T12:00:00Z`, date: `${s.day}T12:00:00Z`, marks: [], note: { text: "Quiet since Sep 30", motion: false }, timeline: [],
    links: { public: isFile ? url : "https://example.org/p", studio: isFile ? null : "/studio?id=1" },
    store: isFile ? "file" : (store as "thread" | "artwork"),
    file: isFile ? { source: "mine", path: `${s.file!.folder}/${s.file!.name}`, mime: s.file!.mime, size: s.file!.size, folder: s.file!.folder } : null,
    sale: s.sale ? { state: s.sale, price: s.price ?? null } : undefined,
    hidden: s.hidden || undefined,
    storefront: store === "artwork" && STORES[s.store] ? { id: s.store, name: STORES[s.store]! } : null,
    can: { edit: true, hide: store === "artwork", publish: false, archive: false, pick: s.sale !== "not_for_sale" },
  };
}

export const DATA: ContentListItem[] = [
  mk({ key: "artwork:a1", type: "artwork", title: "Salt Marsh, Low Tide", store: "st-marsh", sale: "for_sale", price: "$2,400", day: "2026-11-20" }),
  mk({ key: "artwork:a2", type: "artwork", title: "Reed Beds at Dusk", store: "st-marsh", sale: "in_auction", price: "$1,150", day: "2026-11-19" }),
  mk({ key: "artwork:a3", type: "artwork", title: "Glaze Test Bowl", store: "st-ember", sale: "sold", price: "$180", day: "2026-11-18" }),
  mk({ key: "artwork:a4", type: "artwork", title: "Ash Vase", store: "st-ember", sale: "for_sale", price: "$320", hidden: true, day: "2026-11-17" }),
  mk({ key: "artwork:a5", type: "artwork", title: "Indigo Runner", store: "st-loom", sale: "reserved", price: "$540", day: "2026-11-16" }),
  mk({ key: "artwork:a6", type: "artwork", title: "Wool Study No. 3", store: "st-loom", sale: "not_for_sale", day: "2026-11-15" }),
  mk({ key: "thread:w1", type: "writing", title: "Letter from the studio, No. 7", store: "", day: "2026-11-14", status: "draft" }),
  mk({ key: "thread:w2", type: "writing", title: "On painting the marsh", store: "", day: "2026-11-12" }),
  mk({ key: "thread:m1", type: "meeting", title: "Open studio, November", store: "", day: "2026-11-10" }),
  mk({ key: "file:f1", type: "image", title: "marsh-dawn.jpg", store: "", day: "2026-11-09", file: { name: "marsh-dawn.jpg", mime: "image/jpeg", size: 1820000, folder: "Brittany" } }),
  mk({ key: "file:f2", type: "image", title: "kiln-door.jpg", store: "", day: "2026-11-08", file: { name: "kiln-door.jpg", mime: "image/jpeg", size: 903000, folder: "Studio" } }),
  mk({ key: "file:f3", type: "document", title: "price-list.pdf", store: "", day: "2026-11-07", file: { name: "price-list.pdf", mime: "application/pdf", size: 88000, folder: "Admin" } }),
  mk({ key: "file:f4", type: "audio", title: "bells.mp3", store: "", day: "2026-11-06", file: { name: "bells.mp3", mime: "audio/mpeg", size: 3100000, folder: "Sound" } }),
];

const storeOf = (i: ContentListItem) => i.key.split(":")[0];

/** Answers a ContentQuery like the server would: view, q, types, sale, store, cursor and facets. */
export function answer(q: ContentQuery, pageSize = 6): ContentSearchResult {
  const view = q.view ?? "published";
  let pool = DATA.filter((i) => (view === "all" ? true : view === "files" ? storeOf(i) === "file" : storeOf(i) !== "file"));
  pool = pool.filter((i) => !i.hidden || q.includeHidden);
  const facets: ContentSearchResult["facets"] = { types: {}, statuses: {}, stores: [], sale: {} };
  const stores = new Map<string, { id: string; name: string; count: number }>();
  for (const i of pool) {
    facets.types[i.type] = (facets.types[i.type] ?? 0) + 1;
    facets.statuses[i.status] = (facets.statuses[i.status] ?? 0) + 1;
    if (i.sale) facets.sale[i.sale.state] = (facets.sale[i.sale.state] ?? 0) + 1;
    if (i.storefront) stores.set(i.storefront.id, { id: i.storefront.id, name: i.storefront.name, count: (stores.get(i.storefront.id)?.count ?? 0) + 1 });
  }
  facets.stores = [...stores.values()];
  if (q.q) pool = pool.filter((i) => i.title.toLowerCase().includes(q.q!.toLowerCase()));
  if (q.types?.length) pool = pool.filter((i) => q.types!.includes(i.type));
  if (q.statuses?.length) pool = pool.filter((i) => q.statuses!.includes(i.status));
  if (q.saleStates?.length) pool = pool.filter((i) => i.sale && q.saleStates!.includes(i.sale.state));
  if (q.storeIds?.length) pool = pool.filter((i) => i.storefront && q.storeIds!.includes(i.storefront.id));
  const start = q.cursor ? Number(q.cursor) : 0;
  const page = pool.slice(start, start + pageSize);
  return { items: page, nextCursor: start + pageSize < pool.length ? String(start + pageSize) : null, facets, missing: [] };
}
