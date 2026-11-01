import { listDossiers } from "@/lib/oad";
import { profileAd } from "@/classifieds/copy";
import { homeCellFor, type RealEntry } from "@/classifieds/plane";

/**
 * The platform's real entries for the plane. Today: ArtDirect dossiers, each
 * an "artist on file" ad with one home cell and echoes elsewhere. Orgs,
 * events, store listings and threads join through the same shape
 * (docs/open/CLASSIFIEDS_PLAN_2026-10-24.md).
 */
export async function loadRealEntries(): Promise<RealEntry[]> {
  try {
    const rows = await listDossiers({ limit: 200 });
    return rows.map((p) => ({
      ad: profileAd(`dossier:${p.slug}`, { slug: p.slug, name: p.name, occupation: p.occupation, location: p.location, claimed: p.claim_status === "claimed" }),
      home: homeCellFor(`dossier:${p.slug}`),
    }));
  } catch {
    return [];
  }
}
