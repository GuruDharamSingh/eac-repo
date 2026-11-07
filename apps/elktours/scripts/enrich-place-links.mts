// Run: docker exec eac-elktours sh -c "cd /app/apps/elktours && node /app/node_modules/.pnpm/tsx@4.20.6/node_modules/tsx/dist/cli.mjs --tsconfig tsconfig.json scripts/enrich-place-links.mts [--only <placeId>] [--dry]"
//
// Outbound links for catalogue places (place_links, migration 239). REAL links only:
//   1. Wikidata: items with coordinates (P625) within 150 m of the place, via the Wikidata
//      Query Service (wikibase:around). Best name match wins. From the item: the Wikidata URL,
//      en/fr Wikipedia sitelinks, official website (P856).
//   2. OSM: named features within 150 m carrying website / wikipedia / wikidata tags
//      (Overpass). Best name match wins. From the feature: the OSM URL, its website, and its
//      wikidata tag (resolved through wbgetentities for the sitelinks when Wikidata found
//      nothing itself).
// Confidence: name similarity >= 0.8 (or one name contains the other) AND distance <= 150 m
// => confident (shown). 0.55..0.8 => stored with confident = false (review queue, not shown),
// and printed as LOW. Below that, nothing is stored. A URL is never built from a guess:
// every URL comes from a sitelink, a P856 claim or an OSM tag (normalised to https).
// Idempotent: rows upsert on (place_id, kind, source); manual rows are never touched.
// Rate limits: one request at a time, >= 1.1 s apart per service, retries with backoff on
// 429/5xx, descriptive User-Agent with a contact URL.
import { db } from "@elkdonis/db";

const UA = "ElkdonisToursPlaceLinks/1.0 (https://elkdonisexperiences.com; justin.gillisb@gmail.com) node-fetch";
const RADIUS_M = 150;
const CONFIDENT = 0.8;
const LOW = 0.55;
const argv = process.argv.slice(2);
const ONLY = argv.includes("--only") ? argv[argv.indexOf("--only") + 1] : null;
const DRY = argv.includes("--dry");

type Row = Record<string, unknown>;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const last: Record<string, number> = {};
async function polite(service: string, gapMs: number) {
  const wait = (last[service] ?? 0) + gapMs - Date.now();
  if (wait > 0) await sleep(wait);
  last[service] = Date.now();
}
async function fetchRetry(service: string, url: string, init: RequestInit, gapMs = 1100, tries = 4, timeoutMs = 30_000): Promise<Response | null> {
  for (let i = 0; i < tries; i++) {
    await polite(service, gapMs);
    try {
      const res = await fetch(url, { ...init, headers: { "User-Agent": UA, Accept: "application/json", ...(init.headers ?? {}) }, signal: AbortSignal.timeout(timeoutMs) });
      if (res.ok) return res;
      if (res.status !== 429 && res.status < 500) return null;
      const ra = Number(res.headers.get("retry-after"));
      await sleep(Number.isFinite(ra) && ra > 0 ? ra * 1000 : 2000 * 2 ** i);
    } catch {
      await sleep(2000 * 2 ** i);
    }
  }
  return null;
}

const STOP = new Set(["le", "la", "les", "l", "de", "du", "des", "d", "the", "of", "a", "et", "and", "en", "au", "aux", "no", "n"]);
function norm(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\bst\b/g, "saint")
    .replace(/\bste\b/g, "sainte")
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((w) => w && !STOP.has(w))
    .join(" ");
}
function bigrams(s: string): string[] {
  const t = s.replace(/ /g, "");
  const out: string[] = [];
  for (let i = 0; i < t.length - 1; i++) out.push(t.slice(i, i + 2));
  return out;
}
function similarity(a: string, b: string): number {
  const x = norm(a);
  const y = norm(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  // Containment of whole words, one direction only: the item's whole name inside the place's
  // title ("Conciergerie" in "Conciergerie & Palais de Justice") is a match. The reverse (the
  // title inside a longer item name: "Notre-Dame" in "Chapitre de Notre-Dame", "Rue
  // Saint-Jacques" in "67 rue Saint-Jacques") names a PART or a neighbour, so it is only LOW.
  const wx = new Set(x.split(" "));
  const wy = new Set(y.split(" "));
  const inter = [...wx].filter((w) => wy.has(w)).length;
  const labelInTitle = [...wy].every((w) => wx.has(w));
  const titleInLabel = [...wx].every((w) => wy.has(w));
  const contScore = labelInTitle ? (wy.size >= 2 ? 0.9 : 0.85) : titleInLabel ? 0.7 : (inter / Math.min(wx.size, wy.size)) * 0.6;
  const A = bigrams(x);
  const B = bigrams(y);
  const pool = new Map<string, number>();
  for (const g of B) pool.set(g, (pool.get(g) ?? 0) + 1);
  let hit = 0;
  for (const g of A) {
    const n = pool.get(g) ?? 0;
    if (n > 0) {
      hit++;
      pool.set(g, n - 1);
    }
  }
  const dice = A.length + B.length ? (2 * hit) / (A.length + B.length) : 0;
  // Address items ("67 rue Saint-Jacques, Paris") are buildings on the street, not the street.
  if (/^\d/.test(y) && !/^\d/.test(x)) return Math.min(Math.max(dice, contScore), 0.6);
  // Without whole-name containment, near-identical spelling is required to be confident;
  // a longer item name that merely shares most letters ("Fête des Tuileries") stays LOW.
  if (labelInTitle) return Math.max(dice, contScore);
  return Math.min(Math.max(dice, contScore), dice >= 0.9 ? 1 : 0.75);
}
function distM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const x = (lng2 - lng1) * Math.cos(((lat1 + lat2) / 2) * (Math.PI / 180));
  return Math.round(Math.sqrt(x * x + (lat2 - lat1) ** 2) * 111_320);
}
// Heritage registers and social pages are not official websites (same list as classify-places.mts).
const NOT_OFFICIAL = /(pop\.culture\.gouv\.fr|monumentum\.fr|structurae|facebook\.com|instagram\.com|tripadvisor)/i;
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
const wikiUrl = (lang: string, title: string) => `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;

interface WdHit { qid: string; labels: string[]; lat: number; lng: number; enwiki: string | null; frwiki: string | null; website: string | null }

async function wikidataNear(lat: number, lng: number): Promise<WdHit[] | null> {
  const q = `SELECT ?item ?loc ?en ?fr ?enwiki ?frwiki ?site WHERE {
  SERVICE wikibase:around { ?item wdt:P625 ?loc. bd:serviceParam wikibase:center "Point(${lng} ${lat})"^^geo:wktLiteral; wikibase:radius "${RADIUS_M / 1000}". }
  OPTIONAL { ?item rdfs:label ?en FILTER(LANG(?en) = "en") }
  OPTIONAL { ?item rdfs:label ?fr FILTER(LANG(?fr) = "fr") }
  OPTIONAL { ?enwiki schema:about ?item; schema:isPartOf <https://en.wikipedia.org/> }
  OPTIONAL { ?frwiki schema:about ?item; schema:isPartOf <https://fr.wikipedia.org/> }
  OPTIONAL { ?item wdt:P856 ?site }
} LIMIT 300`;
  const res = await fetchRetry("wdqs", `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(q)}`, {});
  if (!res) return null;
  const json = (await res.json()) as { results: { bindings: Record<string, { value: string }>[] } };
  const by = new Map<string, WdHit>();
  for (const b of json.results.bindings) {
    const qid = b.item!.value.split("/").pop()!;
    const m = /Point\(([-\d.]+) ([-\d.]+)\)/.exec(b.loc?.value ?? "");
    if (!m) continue;
    const h = by.get(qid) ?? { qid, labels: [], lat: Number(m[2]), lng: Number(m[1]), enwiki: null, frwiki: null, website: null };
    for (const l of [b.en?.value, b.fr?.value]) if (l && !h.labels.includes(l)) h.labels.push(l);
    h.enwiki ??= b.enwiki?.value ? httpsUrl(b.enwiki.value) : null;
    h.frwiki ??= b.frwiki?.value ? httpsUrl(b.frwiki.value) : null;
    h.website ??= httpsUrl(b.site?.value);
    by.set(qid, h);
  }
  return [...by.values()];
}

async function wikidataEntity(qid: string): Promise<WdHit | null> {
  const res = await fetchRetry("wdapi", `https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=sitelinks|labels|claims&languages=en|fr&sitefilter=enwiki|frwiki&ids=${encodeURIComponent(qid)}`, {});
  if (!res) return null;
  const json = (await res.json()) as { entities?: Record<string, { labels?: Record<string, { value: string }>; sitelinks?: Record<string, { title: string }>; claims?: Record<string, { mainsnak?: { datavalue?: { value?: unknown } } }[]> }> };
  const e = json.entities?.[qid];
  if (!e || !e.labels) return null;
  const coord = e.claims?.P625?.[0]?.mainsnak?.datavalue?.value as { latitude?: number; longitude?: number } | undefined;
  const site = e.claims?.P856?.[0]?.mainsnak?.datavalue?.value;
  return {
    qid,
    labels: Object.values(e.labels).map((l) => l.value),
    lat: coord?.latitude ?? NaN,
    lng: coord?.longitude ?? NaN,
    enwiki: e.sitelinks?.enwiki ? wikiUrl("en", e.sitelinks.enwiki.title) : null,
    frwiki: e.sitelinks?.frwiki ? wikiUrl("fr", e.sitelinks.frwiki.title) : null,
    website: typeof site === "string" ? httpsUrl(site) : null,
  };
}

interface OsmHit { ref: string; url: string; names: string[]; lat: number; lng: number; website: string | null; wikidata: string | null; wikipedia: string | null }
const OVERPASS = ["https://overpass-api.de/api/interpreter", "https://overpass.private.coffee/api/interpreter", "https://maps.mail.ru/osm/tools/overpass/api/interpreter"];
// Circuit breaker: the public Overpass instances are often saturated; after 3 places in a row
// with every endpoint failing, skip OSM for the rest of the run (re-run later to fill it in).
let osmFailStreak = 0;
async function osmNear(lat: number, lng: number): Promise<OsmHit[] | null> {
  if (osmFailStreak >= 3) return null;
  const r = await osmNearOnce(lat, lng);
  osmFailStreak = r == null ? osmFailStreak + 1 : 0;
  if (osmFailStreak === 3) console.log("WARN  Overpass unavailable: OSM lookups skipped for the rest of this run");
  return r;
}
async function osmNearOnce(lat: number, lng: number): Promise<OsmHit[] | null> {
  const q = `[out:json][timeout:20];nwr(around:${RADIUS_M},${lat},${lng})["name"][~"^(website|contact:website|wikipedia|wikidata)$"~"."];out center tags 60;`;
  for (const ep of OVERPASS) {
    const res = await fetchRetry(`osm:${ep}`, ep, { method: "POST", body: new URLSearchParams({ data: q }) }, 1100, 1, 15_000);
    if (!res) continue;
    const json = (await res.json().catch(() => null)) as { elements?: { type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }[] } | null;
    if (!json) continue;
    return (json.elements ?? [])
      .map((e) => {
        const t = e.tags ?? {};
        const la = e.lat ?? e.center?.lat;
        const lo = e.lon ?? e.center?.lon;
        if (la == null || lo == null) return null;
        return {
          ref: `osm:${e.type}/${e.id}`,
          url: `https://www.openstreetmap.org/${e.type}/${e.id}`,
          names: [t.name, t["name:en"], t["name:fr"], t.official_name, t.alt_name].filter((n): n is string => !!n),
          lat: la,
          lng: lo,
          website: httpsUrl(t.website ?? t["contact:website"]),
          wikidata: /^Q\d+$/.test(t.wikidata ?? "") ? t.wikidata! : null,
          wikipedia: t.wikipedia ?? null,
        } as OsmHit;
      })
      .filter((h): h is OsmHit => h !== null);
  }
  return null;
}

function best<T>(title: string, lat: number, lng: number, hits: T[], names: (h: T) => string[], pos: (h: T) => [number, number]) {
  let top: { hit: T; sim: number; dist: number; label: string } | null = null;
  for (const h of hits) {
    const [hl, hg] = pos(h);
    const dist = Number.isFinite(hl) ? distM(lat, lng, hl, hg) : RADIUS_M;
    for (const n of names(h)) {
      const sim = similarity(title, n);
      if (!top || sim > top.sim || (sim === top.sim && dist < top.dist)) top = { hit: h, sim, dist, label: n };
    }
  }
  return top;
}

const places = (await db`
  SELECT id, title, lat, lng FROM places
  WHERE org_id = 'elktours' AND archived_at IS NULL AND lat IS NOT NULL ${ONLY ? db`AND id = ${ONLY}` : db``}
  ORDER BY title
`) as unknown as Row[];

const counts = { places: places.length, matched: 0, none: 0, low: 0, errors: 0, links: 0 };
const lowLog: string[] = [];
let rejected = new Set<string>();

async function save(placeId: string, kind: string, url: string | null, source: "wikidata" | "osm", ref: string, confident: boolean, evidence: object) {
  if (!url || DRY || rejected.has(url)) return;
  await db`
    INSERT INTO place_links (place_id, kind, url, source, source_ref, confident, evidence)
    VALUES (${placeId}, ${kind}, ${url}, ${source}, ${ref}, ${confident}, ${db.json(evidence as never)})
    ON CONFLICT (place_id, kind, source) DO UPDATE SET
      rejected_at = NULL,
      url = EXCLUDED.url, source_ref = EXCLUDED.source_ref, confident = EXCLUDED.confident,
      evidence = EXCLUDED.evidence, updated_at = NOW()
  `;
  if (confident) counts.links++;
}

for (const p of places) {
  const id = p.id as string;
  const title = p.title as string;
  const lat = Number(p.lat);
  const lng = Number(p.lng);
  const [wd, osm] = [await wikidataNear(lat, lng), await osmNear(lat, lng)];
  if (wd == null && osm == null) {
    counts.errors++;
    console.log(`ERR   ${title}: both services failed`);
    continue;
  }
  // A service that answered replaces its earlier rows for this place (manual rows are kept),
  // so a re-run with stricter matching removes matches it no longer stands behind.
  // Rejected rows (an editor removed the link) are kept and their URLs are never re-added.
  rejected = new Set(((await db`SELECT url FROM place_links WHERE place_id = ${id} AND rejected_at IS NOT NULL`) as unknown as Row[]).map((r) => r.url as string));
  if (!DRY) {
    if (wd != null) await db`DELETE FROM place_links WHERE place_id = ${id} AND source = 'wikidata' AND rejected_at IS NULL`;
    if (osm != null) await db`DELETE FROM place_links WHERE place_id = ${id} AND source = 'osm' AND rejected_at IS NULL`;
  }
  const w = wd?.length ? best(title, lat, lng, wd, (h) => h.labels, (h) => [h.lat, h.lng]) : null;
  const o = osm?.length ? best(title, lat, lng, osm, (h) => h.names, (h) => [h.lat, h.lng]) : null;
  const level = (b: { sim: number; dist: number } | null) => (!b ? "none" : b.sim >= CONFIDENT && b.dist <= RADIUS_M ? "ok" : b.sim >= LOW ? "low" : "none");
  const wl = level(w);
  const ol = level(o);

  // Wikidata item: from the SPARQL match, else the OSM feature's wikidata tag (confident OSM match only).
  let item: WdHit | null = wl !== "none" ? w!.hit : null;
  let itemConfident = wl === "ok";
  let itemEvidence: object = w ? { label: w.label, sim: Math.round(w.sim * 100) / 100, distM: w.dist } : {};
  if (ol === "ok" && o!.hit.wikidata && (!item || item.qid !== o!.hit.wikidata) && !itemConfident) {
    const viaOsm = await wikidataEntity(o!.hit.wikidata);
    if (viaOsm) {
      item = viaOsm;
      itemConfident = true;
      itemEvidence = { via: o!.hit.ref, label: o!.label, sim: Math.round(o!.sim * 100) / 100, distM: o!.dist };
    }
  }
  // Agreement check: confident on both sides but different items -> not confident.
  if (item && itemConfident && ol === "ok" && o!.hit.wikidata && o!.hit.wikidata !== item.qid) {
    itemConfident = false;
    itemEvidence = { ...itemEvidence, conflict: `OSM says ${o!.hit.wikidata}` };
  }

  if (item) {
    const ref = `wikidata:${item.qid}`;
    await save(id, "wikidata", `https://www.wikidata.org/wiki/${item.qid}`, "wikidata", ref, itemConfident, itemEvidence);
    await save(id, "wikipedia_en", item.enwiki, "wikidata", ref, itemConfident, itemEvidence);
    await save(id, "wikipedia_fr", item.frwiki, "wikidata", ref, itemConfident, itemEvidence);
    await save(id, "website", item.website, "wikidata", ref, itemConfident, itemEvidence);
  }
  if (ol !== "none") {
    const ev = { label: o!.label, sim: Math.round(o!.sim * 100) / 100, distM: o!.dist };
    await save(id, "osm", o!.hit.url, "osm", o!.hit.ref, ol === "ok", ev);
    await save(id, "website", o!.hit.website, "osm", o!.hit.ref, ol === "ok", ev);
  }

  const confident = (item && itemConfident) || ol === "ok";
  const low = !confident && (item != null || ol === "low");
  if (confident) counts.matched++;
  else if (low) counts.low++;
  else counts.none++;
  const tag = confident ? "OK  " : low ? "LOW " : "NONE";
  const line = `${tag} ${title} | wd: ${w ? `${w.hit.qid} "${w.label}" ${w.sim.toFixed(2)} ${w.dist}m` : wd == null ? "error" : "-"} | osm: ${o ? `${o.hit.ref} "${o.label}" ${o.sim.toFixed(2)} ${o.dist}m` : osm == null ? "error" : "-"}`;
  console.log(line);
  if (low) lowLog.push(line);
}

console.log(`\nSUMMARY ${JSON.stringify(counts)}`);
if (lowLog.length) console.log(`\nLOW-CONFIDENCE (stored with confident=false, not shown):\n${lowLog.join("\n")}`);
await db.end();
