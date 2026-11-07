// Run: docker exec eac-elktours sh -c "cd /app/apps/elktours && node /app/node_modules/.pnpm/tsx@4.20.6/node_modules/tsx/dist/cli.mjs --tsconfig tsconfig.json scripts/seed-business-shells-2026-11-04.mts [--dry]"
//
// Seeds stewarded business shells (migration 242, @elkdonis/services/businesses) for every
// OPERATING elktours place (places.operating, scripts/classify-places.mts), steward = elktours,
// and links each as its place's primary business. Justin, 2026-11-04: "update elktours with the
// gathered info": all are listed (directory_listed) and marked "Unclaimed · listed by ...".
//
// Facts, each with its source in facts_source:
//   name          the matched OSM name, else a reviewed name below, else the place title
//   address       OSM addr:* of the matched feature (OSM API), else Photon reverse (OSM data)
//   opening_hours OSM opening_hours; phone OSM phone/contact:phone
//   website       place_links: confident -> 'confirmed'; only low-confidence -> 'pending_review'
//                 (not public until reviewed); none -> none (e.g. Boucherie Tribolet)
//   refs          osm_ref from the classification match; wikidata_ref from a confident link only
// Idempotent: an existing listing (same OSM/Wikidata ref, or same name within 150 m) is
// refreshed, not duplicated; removed (tombstoned) listings are skipped.
import { db } from "@elkdonis/db";
import { createBusinessShell, getBusinessListing, linkPlaceBusiness, updateBusinessFacts, type FactSource } from "@elkdonis/services/businesses";

const ORG = "elktours";
const DRY = process.argv.includes("--dry");
const UA = "ElkdonisToursPlaceLinks/1.0 (https://elkdonisexperiences.com; justin.gillisb@gmail.com)";
const OSM = "© OpenStreetMap contributors";
type Row = Record<string, unknown>;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const now = new Date().toISOString();

/** Reviewed names for venues whose place title is a tour label, not the operator's name. */
const NAMES: Record<string, string> = {
  "Hôtel des Invalides": "Musée de l'Armée – Invalides",
  "Louvre Pyramid": "Musée du Louvre",
  "Hôtel de Soubise & Archives Nationales": "Musée des Archives nationales",
  "Sacré-Cœur & Place du Parvis": "Basilique du Sacré-Cœur de Montmartre",
  "Steps of Sacré-Cœur": "Basilique du Sacré-Cœur de Montmartre",
  "Le Panthéon": "Panthéon",
  "Notre-Dame": "Cathédrale Notre-Dame de Paris",
  "L'Île de la Cité et la Conciergerie": "La Conciergerie",
  "Conciergerie & Palais de Justice": "La Conciergerie",
  "Conciergerie": "La Conciergerie",
};

/** Addresses confirmed on the venue's own (or the City of Paris) page during the website search. */
const ADDRESSES: Record<string, { street: string; postcode: string; url: string }> = {
  "Hôtel des Invalides": { street: "129 Rue de Grenelle", postcode: "75007", url: "https://www.musee-armee.fr/" },
  "Marché des Enfants Rouges": { street: "39 Rue de Bretagne", postcode: "75003", url: "https://www.paris.fr/lieux/marche-couvert-des-enfants-rouges-5461" },
};

async function osmTags(ref: string): Promise<Record<string, string> | null> {
  const [type, id] = ref.split("/");
  if (!type || !id || !["node", "way", "relation"].includes(type)) return null;
  for (let t = 0; t < 3; t++) {
    const res = await fetch(`https://api.openstreetmap.org/api/0.6/${type}/${id}.json`, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(20_000) }).catch(() => null);
    if (res?.ok) {
      const j = (await res.json()) as { elements?: { tags?: Record<string, string> }[] };
      return j.elements?.[0]?.tags ?? {};
    }
    await sleep(2000 * 2 ** t);
  }
  return null;
}

async function photonAddress(lat: number, lng: number): Promise<{ street: string | null; postcode: string | null; city: string | null } | null> {
  const base = (process.env.PHOTON_URL || "https://photon.komoot.io").replace(/\/$/, "");
  const res = await fetch(`${base}/reverse?lat=${lat}&lon=${lng}&limit=1&lang=fr`, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(10_000) }).catch(() => null);
  if (!res?.ok) return null;
  const p = ((await res.json()) as { features?: { properties?: Record<string, string> }[] }).features?.[0]?.properties;
  if (!p) return null;
  return { street: p.street ? [p.housenumber, p.street].filter(Boolean).join(" ") : null, postcode: p.postcode ?? null, city: p.city ?? null };
}

const places = (await db`
  SELECT p.id, p.title, p.lat, p.lng, p.operating_kind, p.classification
  FROM places p WHERE p.org_id = ${ORG} AND p.archived_at IS NULL AND p.operating
  ORDER BY p.title
`) as unknown as Row[];

const counts = { operatingPlaces: places.length, created: 0, refreshed: 0, linked: 0, skippedRemoved: 0, websiteConfirmed: 0, websitePending: 0, websiteNone: 0, withHours: 0, withAddress: 0 };

for (const p of places) {
  const id = p.id as string;
  const title = p.title as string;
  const lat = Number(p.lat);
  const lng = Number(p.lng);
  const cls = (p.classification ?? {}) as { via?: string; osm?: { ref?: string; label?: string; sim?: number } | null };
  const osmMatch = cls.via !== "override" && cls.osm?.ref && (cls.osm.sim ?? 0) >= 0.8 ? cls.osm : null;
  const facts: Record<string, FactSource> = {};

  const name = NAMES[title] ?? osmMatch?.label ?? title.replace(/,\s*No\.\s*\d+\s*$/i, "").trim();
  facts.name = NAMES[title] ? { source: "steward", note: "reviewed name (tour label differs from the operator)" } : osmMatch ? { source: "osm", ref: `osm:${osmMatch.ref}`, fetchedAt: now, attribution: OSM } : { source: "steward", note: "catalogue title" };

  const tags = osmMatch ? await osmTags(osmMatch.ref!) : null;
  const confirmed = ADDRESSES[title];
  if (osmMatch) await sleep(1100);
  let street: string | null = null;
  let postcode: string | null = null;
  let city: string | null = null;
  if (confirmed) {
    street = confirmed.street;
    postcode = confirmed.postcode;
    city = "Paris";
    facts.address = { source: "web", ref: confirmed.url, fetchedAt: now, note: "address read on the operator's / City of Paris page (2026-11-04)" };
  } else if (tags && (tags["addr:street"] || tags["addr:postcode"])) {
    street = tags["addr:street"] ? [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" ") : null;
    postcode = tags["addr:postcode"] ?? null;
    city = tags["addr:city"] ?? "Paris";
    facts.address = { source: "osm", ref: `osm:${osmMatch!.ref}`, fetchedAt: now, attribution: OSM };
  } else {
    const a = await photonAddress(lat, lng);
    await sleep(1100);
    if (a?.street || a?.postcode) {
      street = a.street;
      postcode = a.postcode;
      city = a.city ?? "Paris";
      facts.address = { source: "photon", note: "reverse geocode of the place position (OSM data)", fetchedAt: now, attribution: OSM };
    }
  }
  const hours = tags?.opening_hours ?? null;
  if (hours) facts.openingHours = { source: "osm", ref: `osm:${osmMatch!.ref}`, fetchedAt: now, attribution: OSM };
  const phone = tags?.phone ?? tags?.["contact:phone"] ?? null;
  if (phone) facts.phone = { source: "osm", ref: `osm:${osmMatch!.ref}`, fetchedAt: now, attribution: OSM };
  facts.position = { source: "steward", note: "the catalogue place position" };
  facts.category = { source: cls.via === "osm" ? "osm" : cls.via === "wikidata" ? "wikidata" : "steward", note: `classified ${cls.via ?? "manually"} (scripts/classify-places.mts)` };

  const links = (await db`
    SELECT kind, url, source, source_ref, confident FROM place_links
    WHERE place_id = ${id} AND rejected_at IS NULL AND kind IN ('website','wikidata')
    ORDER BY confident DESC, CASE source WHEN 'manual' THEN 0 WHEN 'wikidata' THEN 1 WHEN 'osm' THEN 2 ELSE 3 END
  `) as unknown as Row[];
  const site = links.find((l) => l.kind === "website");
  const wd = links.find((l) => l.kind === "wikidata" && l.confident);
  const websiteStatus = !site ? "none" : site.confident ? "confirmed" : "pending_review";
  if (site) facts.website = { source: site.source === "manual" ? "steward" : (site.source as FactSource["source"]), ref: (site.source_ref as string | null) ?? null, fetchedAt: now, note: websiteStatus === "pending_review" ? "low-confidence match: website pending review" : null };
  const wikidataRef = wd?.source_ref && String(wd.source_ref).startsWith("wikidata:") ? String(wd.source_ref).slice(9) : null;
  if (wikidataRef) facts.wikidata = { source: "wikidata", ref: wikidataRef, attribution: "Wikidata (CC0)" };

  const input = {
    name,
    category: (p.operating_kind as string | null) ?? null,
    streetAddress: street,
    postalCode: postcode,
    city,
    country: "FR",
    lat,
    lng,
    website: (site?.url as string | undefined) ?? null,
    websiteStatus: websiteStatus as "confirmed" | "pending_review" | "none",
    phone,
    openingHours: hours,
    osmRef: osmMatch ? `osm:${osmMatch.ref}` : null,
    wikidataRef,
    factsSource: facts,
  };
  counts[websiteStatus === "confirmed" ? "websiteConfirmed" : websiteStatus === "pending_review" ? "websitePending" : "websiteNone"]++;
  if (hours) counts.withHours++;
  if (street) counts.withAddress++;
  if (DRY) {
    console.log(`DRY  ${name} [${input.category}] ${street ?? "-"} ${postcode ?? ""} | hours ${hours ?? "-"} | ${input.website ?? "no website"} (${websiteStatus})`);
    continue;
  }

  const made = await createBusinessShell(input, { stewardOrgId: ORG, actorUserId: null });
  if (!made.ok) {
    counts.skippedRemoved++;
    console.log(`SKIP ${name}: ${(made as { error: string }).error}`);
    continue;
  }
  const business = made.business;
  if (made.created) counts.created++;
  else if (business.status === "shell") {
    // Refresh facts; keep whichever website is stronger when several places share the business.
    const current = await getBusinessListing(business.userId);
    const keepSite = current && current.websiteStatus === "confirmed" && websiteStatus !== "confirmed";
    await updateBusinessFacts(business.userId, {
      ...input,
      ...(keepSite ? { website: current!.websiteCandidate, websiteStatus: "confirmed" as const } : {}),
      name: NAMES[title] || osmMatch ? name : current?.name ?? name,
    });
    counts.refreshed++;
  }
  const l = await linkPlaceBusiness({ placeId: id, businessUserId: business.userId, orgId: ORG, relation: "operates", isPrimary: true, actorUserId: null });
  if (l.ok) counts.linked++;
  console.log(`${made.created ? "NEW " : "OK  "} ${business.slug.padEnd(40)} <- ${title} | ${street ?? "-"} ${postcode ?? ""} | hours ${hours ? "yes" : "-"} | website ${websiteStatus}`);
}

const [n] = (await db`SELECT COUNT(*)::int AS n FROM business_listings WHERE steward_org_id = ${ORG} AND status = 'shell'`) as unknown as Row[];
console.log(`\nSUMMARY ${JSON.stringify({ ...counts, shellsStewardedByElktours: n?.n })}`);
await db.end();
