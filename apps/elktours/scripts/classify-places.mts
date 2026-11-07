// Run: docker exec eac-elktours sh -c "cd /app/apps/elktours && node /app/node_modules/.pnpm/tsx@4.20.6/node_modules/tsx/dist/cli.mjs --tsconfig tsconfig.json scripts/classify-places.mts [--dry]"
//
// Classify catalogue places as OPERATING (a business or venue with a life of its own: shop,
// bakery, restaurant, café, cabaret, museum, gallery, church, theatre ...) or a LANDMARK
// (street, square, monument, bridge ...), and collect official websites for the operating ones.
// Writes places.operating / operating_kind / classification (migration 241) and place_links
// (kind 'website'). Never builds a URL: websites come from OSM website / contact:website tags
// or Wikidata P856 only. Heritage-register "websites" (Mérimée/POP etc.) are not official sites
// and are skipped. Web-search websites are added separately with source 'web'.
//
// Evidence, strongest first:
//   1. OSM: one batched Overpass request for named features within 80 m of every place
//      (retries with backoff, rotating mirrors). Best name match (similarity >= 0.8, <= 80 m).
//   2. Wikidata instance-of (P31) of the place's linked Wikidata item (place_links).
//   3. Keywords in the place title and its stops' copy.
// Idempotent: re-running rewrites the classification and replaces its own website rows
// (source osm/wikidata, kind website, not rejected). Manual, web and rejected rows are kept.
import { db } from "@elkdonis/db";
import { similarity, distM } from "../src/lib/name-match";

const UA = "ElkdonisToursPlaceLinks/1.0 (https://elkdonisexperiences.com; justin.gillisb@gmail.com)";
const DRY = process.argv.includes("--dry");
const RADIUS = 80;
type Row = Record<string, unknown>;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const NOT_OFFICIAL = /(pop\.culture\.gouv\.fr|monumentum\.fr|structurae|wikipedia\.org|wikidata\.org|facebook\.com|instagram\.com|tripadvisor|parisinfo\.com\/.*\/monuments)/i;
function httpsUrl(v: string | undefined | null): string | null {
  if (!v) return null;
  let s = v.trim().split(/[;\s]/)[0]!;
  if (/^http:\/\//i.test(s)) s = "https://" + s.slice(7);
  if (!/^https:\/\//i.test(s)) return null;
  try {
    const u = new URL(s).toString();
    return NOT_OFFICIAL.test(u) ? null : u;
  } catch {
    return null;
  }
}

const places = (await db`
  SELECT p.id, p.title, p.lat, p.lng, p.body,
         (SELECT string_agg(COALESCE(s.title,'') || ' ' || COALESCE(s.body,''), ' ') FROM tour_stops s WHERE s.place_id = p.id) AS copy,
         (SELECT l.source_ref FROM place_links l WHERE l.place_id = p.id AND l.kind = 'wikidata' AND l.rejected_at IS NULL
           ORDER BY l.confident DESC, (l.source = 'manual') DESC LIMIT 1) AS wd_ref,
         (SELECT l.confident FROM place_links l WHERE l.place_id = p.id AND l.kind = 'wikidata' AND l.rejected_at IS NULL
           ORDER BY l.confident DESC, (l.source = 'manual') DESC LIMIT 1) AS wd_confident
  FROM places p WHERE p.org_id = 'elktours' AND p.archived_at IS NULL AND p.lat IS NOT NULL
  ORDER BY p.title
`) as unknown as Row[];

// ── 1. OSM: one batched request ──────────────────────────────────────────
interface OsmEl { type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }
const KEYS = "shop|amenity|tourism|craft|leisure|historic|highway|place|building|man_made|bridge";
const around = places.map((p) => `nwr(around:${RADIUS},${Number(p.lat)},${Number(p.lng)})["name"][~"^(${KEYS})$"~"."];`).join("\n");
const query = `[out:json][timeout:180];(\n${around}\n);out center tags;`;
const MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];
let osm: OsmEl[] | null = null;
for (let attempt = 0; attempt < 8 && !osm; attempt++) {
  const ep = MIRRORS[attempt % MIRRORS.length]!;
  try {
    const res = await fetch(ep, { method: "POST", body: new URLSearchParams({ data: query }), headers: { "User-Agent": UA }, signal: AbortSignal.timeout(200_000) });
    if (res.ok) {
      const j = (await res.json().catch(() => null)) as { elements?: OsmEl[]; remark?: string } | null;
      if (j?.elements && !(j.remark ?? "").match(/runtime error|timed out/i)) osm = j.elements;
      else console.log(`WARN  ${ep}: ${j?.remark ?? "bad body"}`);
    } else console.log(`WARN  ${ep}: HTTP ${res.status}`);
  } catch (e) {
    console.log(`WARN  ${ep}: ${String(e).slice(0, 80)}`);
  }
  if (!osm) await sleep(Math.min(120_000, 10_000 * 2 ** Math.floor(attempt / MIRRORS.length)));
}
console.log(osm ? `OSM   ${osm.length} named features` : "OSM   unavailable after retries: classification uses Wikidata and keywords only");

// ── 2. Wikidata P31 for linked items ─────────────────────────────────────
const qids = [...new Set(places.map((p) => (p.wd_ref as string | null)?.replace("wikidata:", "")).filter((q): q is string => !!q && /^Q\d+$/.test(q)))];
const p31 = new Map<string, string[]>();
const p856 = new Map<string, string>();
const classLabel = new Map<string, string>();
async function wbget(ids: string[], props: string): Promise<Record<string, { claims?: Record<string, { mainsnak?: { datavalue?: { value?: unknown } } }[]>; labels?: Record<string, { value: string }> }>> {
  const out: Record<string, never> = {};
  for (let i = 0; i < ids.length; i += 50) {
    const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=${props}&languages=en&ids=${ids.slice(i, i + 50).join("|")}`;
    for (let t = 0; t < 4; t++) {
      const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(30_000) }).catch(() => null);
      if (res?.ok) {
        Object.assign(out, ((await res.json()) as { entities: Record<string, never> }).entities);
        break;
      }
      await sleep(2000 * 2 ** t);
    }
    await sleep(1100);
  }
  return out;
}
if (qids.length) {
  const ents = await wbget(qids, "claims");
  for (const [q, e] of Object.entries(ents)) {
    const classes = (e.claims?.P31 ?? []).map((c) => (c.mainsnak?.datavalue?.value as { id?: string } | undefined)?.id).filter((x): x is string => !!x);
    p31.set(q, classes);
    const site = e.claims?.P856?.[0]?.mainsnak?.datavalue?.value;
    const u = typeof site === "string" ? httpsUrl(site) : null;
    if (u) p856.set(q, u);
  }
  const classIds = [...new Set([...p31.values()].flat())];
  const cl = await wbget(classIds, "labels");
  for (const [q, e] of Object.entries(cl)) classLabel.set(q, e.labels?.en?.value ?? q);
}

// ── classification rules ─────────────────────────────────────────────────
type Kind = { operating: boolean; kind: string };
function fromOsm(t: Record<string, string>, name: string): Kind | null {
  const n = name.toLowerCase();
  if (/cabaret|moulin rouge|lapin agile/.test(n) || t["theatre:genre"] === "cabaret") return { operating: true, kind: "cabaret" };
  const shop = t.shop;
  if (shop) {
    if (["bakery", "pastry", "confectionery", "chocolate"].includes(shop)) return { operating: true, kind: "bakery" };
    if (shop === "butcher") return { operating: true, kind: "butcher" };
    if (shop === "cheese") return { operating: true, kind: "cheese" };
    if (["wine", "alcohol"].includes(shop)) return { operating: true, kind: "wine_shop" };
    if (shop === "books") return { operating: true, kind: "bookshop" };
    if (shop === "art") return { operating: true, kind: "gallery" };
    return { operating: true, kind: "shop" };
  }
  const a = t.amenity;
  if (a) {
    if (["restaurant", "fast_food"].includes(a)) return { operating: true, kind: "restaurant" };
    if (a === "cafe") return { operating: true, kind: "cafe" };
    if (["bar", "pub", "nightclub", "music_venue"].includes(a)) return { operating: true, kind: "bar" };
    if (["theatre", "arts_centre", "cinema"].includes(a)) return { operating: true, kind: "theatre" };
    if (a === "place_of_worship") return { operating: true, kind: t.religion === "jewish" ? "synagogue" : "church" };
    if (["library", "archive"].includes(a)) return { operating: true, kind: "library" };
    if (a === "marketplace") return { operating: true, kind: "market" };
    if (["townhall", "courthouse", "university", "college", "school"].includes(a)) return { operating: false, kind: "institution" };
    if (a === "fountain") return { operating: false, kind: "monument" };
  }
  if (t.tourism === "museum") return { operating: true, kind: "museum" };
  if (t.tourism === "gallery") return { operating: true, kind: "gallery" };
  if (t.tourism === "hotel") return { operating: true, kind: "hotel" };
  if (t.craft === "winery" || t.landuse === "vineyard") return { operating: false, kind: "landmark" };
  if (t.highway) return { operating: false, kind: "street" };
  if (t.place === "square" || t.leisure === "park" || t.leisure === "garden") return { operating: false, kind: "square" };
  if (t.bridge || t.man_made === "bridge") return { operating: false, kind: "bridge" };
  if (t.historic) return { operating: false, kind: t.historic === "monument" || t.historic === "memorial" ? "monument" : "landmark" };
  if (t.tourism === "attraction" || t.tourism === "viewpoint") return { operating: false, kind: "landmark" };
  return null;
}
const WD_RULES: [RegExp, Kind][] = [
  [/cabaret/i, { operating: true, kind: "cabaret" }],
  [/patisserie|pâtisserie|bakery/i, { operating: true, kind: "bakery" }],
  [/restaurant/i, { operating: true, kind: "restaurant" }],
  [/caf[eé]|coffeehouse/i, { operating: true, kind: "cafe" }],
  [/\bbar\b|jazz club|nightclub|music venue/i, { operating: true, kind: "bar" }],
  [/museum/i, { operating: true, kind: "museum" }],
  [/art gallery/i, { operating: true, kind: "gallery" }],
  [/synagogue/i, { operating: true, kind: "synagogue" }],
  [/church|cathedral|basilica|chapel|abbey/i, { operating: true, kind: "church" }],
  [/theatre|theater|opera house|concert hall/i, { operating: true, kind: "theatre" }],
  [/bookshop|bookstore/i, { operating: true, kind: "bookshop" }],
  [/library|archives/i, { operating: true, kind: "library" }],
  [/\bshop\b|store|market/i, { operating: true, kind: "shop" }],
  [/street|road|avenue|boulevard|quay/i, { operating: false, kind: "street" }],
  [/square|plaza|park|garden/i, { operating: false, kind: "square" }],
  [/bridge/i, { operating: false, kind: "bridge" }],
  [/monument|memorial|column|fountain|statue|arch|wall|obelisk|tower/i, { operating: false, kind: "monument" }],
];
const KEYWORDS: [RegExp, Kind][] = [
  [/cabaret|moulin rouge|lapin agile/i, { operating: true, kind: "cabaret" }],
  [/p[aâ]tisserie|boulangerie|stohrer/i, { operating: true, kind: "bakery" }],
  [/boucherie/i, { operating: true, kind: "butcher" }],
  [/fromager|fermette/i, { operating: true, kind: "cheese" }],
  [/caviste|cavistes|\bwine\b/i, { operating: true, kind: "wine_shop" }],
  [/caf[eé]\b/i, { operating: true, kind: "cafe" }],
  [/caveau|jazz/i, { operating: true, kind: "bar" }],
  [/mus[eé]e|museum/i, { operating: true, kind: "museum" }],
  [/shakespeare and company|librairie/i, { operating: true, kind: "bookshop" }],
  [/[eé]glise|church|cathedral|notre-dame|sainte-chapelle|basilique|sacr[eé]-c[oœ]ur/i, { operating: true, kind: "church" }],
  [/synagogue/i, { operating: true, kind: "synagogue" }],
  [/march[eé]/i, { operating: true, kind: "market" }],
  [/\brue\b|street|boulevard|quai/i, { operating: false, kind: "street" }],
  [/\bplace\b|square|jardin|garden|parvis/i, { operating: false, kind: "square" }],
  [/\bpont\b|bridge/i, { operating: false, kind: "bridge" }],
];

/**
 * Reviewed by hand (2026-11-04, Platform Engineer) after the first run: places whose
 * nearest named OSM feature is the street/square around them, but which are visited venues
 * with their own operator and site. Keyed by exact place title.
 */
const OVERRIDES: Record<string, Kind> = {
  "Hôtel des Invalides": { operating: true, kind: "museum" },
  "Louvre Pyramid": { operating: true, kind: "museum" },
  "Le Panthéon": { operating: true, kind: "museum" },
  "Panthéon": { operating: true, kind: "museum" },
  "Sacré-Cœur & Place du Parvis": { operating: true, kind: "church" },
  "Hôtel de Soubise & Archives Nationales": { operating: true, kind: "museum" },
  "Marché des Enfants Rouges": { operating: true, kind: "market" },
};

const counts = { places: places.length, operating: 0, landmark: 0, websiteFound: 0, websiteLow: 0, operatingWithoutWebsite: 0, bySource: { override: 0, osm: 0, wikidata: 0, keywords: 0 } };
const missing: string[] = [];

for (const p of places) {
  const id = p.id as string;
  const title = p.title as string;
  const lat = Number(p.lat);
  const lng = Number(p.lng);
  let match: { el: OsmEl; sim: number; dist: number; label: string } | null = null;
  for (const el of osm ?? []) {
    const la = el.lat ?? el.center?.lat;
    const lo = el.lon ?? el.center?.lon;
    if (la == null || lo == null) continue;
    const dist = distM(lat, lng, la, lo);
    if (dist > RADIUS) continue;
    const t = el.tags ?? {};
    for (const n of [t.name, t["name:en"], t["name:fr"], t.official_name, t.alt_name].filter((x): x is string => !!x)) {
      const sim = similarity(title, n);
      if (!match || sim > match.sim || (sim === match.sim && dist < match.dist)) match = { el, sim, dist, label: n };
    }
  }
  const osmOk = match && match.sim >= 0.8;
  const qid = (p.wd_ref as string | null)?.replace("wikidata:", "") ?? null;
  const classes = qid ? (p31.get(qid) ?? []).map((c) => classLabel.get(c) ?? c) : [];

  let k: Kind | null = OVERRIDES[title] ?? null;
  let via = k ? "override" : "";
  if (!k && osmOk) {
    k = fromOsm(match!.el.tags ?? {}, match!.label);
    if (k) via = "osm";
  }
  if (!k && classes.length) {
    for (const [re, kind] of WD_RULES) if (classes.some((c) => re.test(c))) { k = kind; via = "wikidata"; break; }
  }
  if (!k) {
    const text = `${title} ${String(p.copy ?? "").replace(/<[^>]*>/g, " ")}`;
    for (const [re, kind] of KEYWORDS) if (re.test(title) || (kind.operating && re.test(text.slice(0, 400)))) { k = kind; via = "keywords"; break; }
  }
  k ??= { operating: false, kind: "landmark" };
  if (via) counts.bySource[via as "override" | "osm" | "wikidata" | "keywords"]++;
  const evidence = {
    via: via || "default",
    osm: match ? { ref: `${match.el.type}/${match.el.id}`, label: match.label, sim: Math.round(match.sim * 100) / 100, distM: match.dist, tags: Object.fromEntries(Object.entries(match.el.tags ?? {}).filter(([key]) => /^(shop|amenity|tourism|craft|historic|highway|place|religion|website|contact:website)$/.test(key))) } : null,
    wikidata: qid ? { qid, confident: Boolean(p.wd_confident), instanceOf: classes } : null,
    at: new Date().toISOString(),
  };

  // Websites for operating places: OSM tag of the matched feature, then Wikidata P856.
  const sites: { url: string; source: "osm" | "wikidata"; ref: string; confident: boolean; ev: object }[] = [];
  if (k.operating) {
    const t = match?.el.tags ?? {};
    const ou = osmOk && via !== "override" ? httpsUrl(t.website ?? t["contact:website"]) : null;
    if (ou) sites.push({ url: ou, source: "osm", ref: `osm:${match!.el.type}/${match!.el.id}`, confident: match!.sim >= 0.8 && match!.dist <= RADIUS, ev: evidence.osm! });
    const wu = qid ? p856.get(qid) : undefined;
    if (wu) sites.push({ url: wu, source: "wikidata", ref: `wikidata:${qid}`, confident: Boolean(p.wd_confident), ev: { qid } });
  }

  if (!DRY) {
    await db`
      UPDATE places SET operating = ${k.operating}, operating_kind = ${k.kind}, classification = ${db.json(evidence as never)}, updated_at = NOW()
      WHERE id = ${id}
    `;
    if (osm) await db`DELETE FROM place_links WHERE place_id = ${id} AND kind = 'website' AND source = 'osm' AND rejected_at IS NULL`;
    if (qids.length) await db`DELETE FROM place_links WHERE place_id = ${id} AND kind = 'website' AND source = 'wikidata' AND rejected_at IS NULL`;
    const rejected = new Set(((await db`SELECT url FROM place_links WHERE place_id = ${id} AND rejected_at IS NOT NULL`) as unknown as Row[]).map((r) => r.url as string));
    for (const s of sites) {
      if (rejected.has(s.url)) continue;
      await db`
        INSERT INTO place_links (place_id, kind, url, source, source_ref, confident, evidence)
        VALUES (${id}, 'website', ${s.url}, ${s.source}, ${s.ref}, ${s.confident}, ${db.json(s.ev as never)})
        ON CONFLICT (place_id, kind, source) DO UPDATE SET url = EXCLUDED.url, source_ref = EXCLUDED.source_ref,
          confident = EXCLUDED.confident, evidence = EXCLUDED.evidence, rejected_at = NULL, updated_at = NOW()
      `;
    }
  }
  const okSite = sites.find((s) => s.confident);
  if (k.operating) {
    counts.operating++;
    if (okSite) counts.websiteFound++;
    else if (sites.length) counts.websiteLow++;
    else {
      counts.operatingWithoutWebsite++;
      missing.push(`${title} [${k.kind}] ${lat.toFixed(5)},${lng.toFixed(5)}`);
    }
  } else counts.landmark++;
  console.log(`${k.operating ? "OPER" : "LAND"} ${k.kind.padEnd(10)} ${via.padEnd(8)} ${title}${sites.length ? ` -> ${sites.map((s) => `${s.url} (${s.source}${s.confident ? "" : ", low"})`).join(" ; ")}` : ""}`);
}
console.log(`\nSUMMARY ${JSON.stringify(counts)}`);
if (missing.length) console.log(`\nOPERATING WITHOUT WEBSITE:\n${missing.join("\n")}`);
await db.end();
