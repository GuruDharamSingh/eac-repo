import { listArtworks } from "@elkdonis/commerce/queries";
import { normalizeScene, type OpenSpot, type Scene } from "@elkdonis/three/hallway/model";
import { siteConfig } from "@/config/site";
import { loadValue, saveValue } from "./home-sections";
import { cleanPieces } from "./installation-input";
import {
  createOrgInstallation,
  getInstallation,
  listArtworksByIds,
  listInstallationPieces,
  listOrgHangableArtworks,
  saveInstallationLayout,
  saveInstallationScene,
  type Installation,
  type InstallationArtwork,
  type InstallationPiece,
} from "./installations";

// ============================================================================
// The Collect Art landing loft (phase 4 of
// docs/open/LOFT_SCENE_EDITOR_BRIEF_2026-10-29.md).
//
// The scene is an installation owned by the marketplace org (no store;
// migration 230), edited at /admin/loft in the installations editor. The
// editor autosaves to that installation; visitors see a copy of it stamped by
// "Put on the landing page" (`published` below), so work in progress never
// shows. Both live in `site_config` (org market, key `home_loft`):
//   { installationId, published: { at, hallway, scene, pieces } | null }
// With nothing published, the home page shows the starting hang (`SEED`).
// ============================================================================

export const LOFT_KEY = "home_loft";

/** What visitors see: a copy of the installation at the moment it was put on the page. */
export interface LoftSnapshot {
  at: string;
  hallway: string;
  scene: Scene;
  pieces: InstallationPiece[];
}

export interface LoftPointer {
  installationId: string | null;
  published: LoftSnapshot | null;
}

/** A work the visitor may hang in the free spot. */
export interface LoftWork {
  id: string;
  title: string;
  artistName: string | null;
  imageUrl: string;
  heightCm: number | null;
  widthCm: number | null;
}

/** What the home page draws. */
export interface HomeLoft {
  hallway: string;
  /** The hung works on show (drafts and archived works are left out). */
  works: InstallationArtwork[];
  /** Their placements, in walking order. */
  pieces: InstallationPiece[];
  scene: Scene;
  /** What a visitor may hang in the free spot. */
  pool: LoftWork[];
}

const VENUE = "loft";

/**
 * The starting hang, as the loft first shipped (2026-10-29): two works on the
 * long wall `S1` and the visitors' free spot to their right.
 */
const SEED_SPOTS: Array<{ x: number; y: number }> = [
  { x: -2.6, y: 1.55 },
  { x: 0.2, y: 1.55 },
];
const SEED_OPEN_SPOT: OpenSpot = { wallId: "S1", x: 3.0, y: 1.55, scale: 1 };

function seedPieces(ids: string[]): InstallationPiece[] {
  return ids.slice(0, SEED_SPOTS.length).map((artworkId, i) => ({
    artworkId,
    wallId: "S1",
    ...SEED_SPOTS[i]!,
    frameId: null,
    scale: 1,
    ratio: "auto",
    crop: { x: 50, y: 50, zoom: 1 },
    lamp: { at: "above" },
    sequence: i + 1,
  }));
}

const seedScene = (): Scene => ({ ...normalizeScene({}), openSpot: SEED_OPEN_SPOT });

const isUuid = (x: unknown): x is string => typeof x === "string" && /^[0-9a-f-]{36}$/i.test(x);

function cleanSnapshot(v: unknown): LoftSnapshot | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  return {
    at: typeof o.at === "string" ? o.at : new Date(0).toISOString(),
    hallway: typeof o.hallway === "string" ? o.hallway.slice(0, 40) : VENUE,
    scene: normalizeScene(o.scene),
    pieces: cleanPieces(o.pieces),
  };
}

/** The pointer. A setting from before the scene editor (`spots`, `hungIds`) reads as none. */
export async function loadLoftPointer(): Promise<LoftPointer> {
  const v = (await loadValue(LOFT_KEY)) as Record<string, unknown> | null;
  return {
    installationId: isUuid(v?.installationId) ? v!.installationId : null,
    published: cleanSnapshot(v?.published),
  };
}

async function saveLoftPointer(p: LoftPointer): Promise<void> {
  await saveValue(LOFT_KEY, p);
}

/** True when this installation is the landing loft. */
export async function isLandingInstallation(id: string): Promise<boolean> {
  return (await loadLoftPointer()).installationId === id;
}

/**
 * The landing installation, created on first use: seeded with what visitors
 * see now (the published copy, or the starting hang of the two newest
 * pictured works), so opening the editor changes nothing on the page.
 */
export async function ensureLandingInstallation(userId: string): Promise<Installation> {
  const pointer = await loadLoftPointer();
  if (pointer.installationId) {
    const existing = await getInstallation(pointer.installationId);
    if (existing && existing.orgId === siteConfig.marketplaceOrgId) return existing;
  }
  const id = await createOrgInstallation(siteConfig.marketplaceOrgId, "Landing loft", userId, pointer.published?.hallway ?? VENUE);
  const scope = { orgId: siteConfig.marketplaceOrgId };
  if (pointer.published) {
    await saveInstallationLayout(id, scope, pointer.published.pieces);
    await saveInstallationScene(id, pointer.published.scene);
  } else {
    const works = await listOrgHangableArtworks(siteConfig.marketplaceOrgId);
    await saveInstallationLayout(id, scope, seedPieces(works.map((w) => w.id)));
    await saveInstallationScene(id, seedScene());
  }
  await saveLoftPointer({ installationId: id, published: pointer.published });
  return (await getInstallation(id))!;
}

/** "Put on the landing page": copy the installation as it is now for visitors. */
export async function publishLanding(installation: Installation): Promise<LoftSnapshot> {
  const pieces = await listInstallationPieces(installation.id);
  const snapshot: LoftSnapshot = {
    at: new Date().toISOString(),
    hallway: installation.hallway,
    scene: installation.scene,
    pieces,
  };
  await saveLoftPointer({ installationId: installation.id, published: snapshot });
  return snapshot;
}

/** "Go back to what visitors see": the installation takes the published copy again. */
export async function revertLanding(installation: Installation): Promise<boolean> {
  const { published } = await loadLoftPointer();
  if (!published) return false;
  await saveInstallationLayout(installation.id, { orgId: siteConfig.marketplaceOrgId }, published.pieces);
  await saveInstallationScene(installation.id, published.scene);
  return true;
}

/** The loft as visitors see it: the published copy, or the starting hang. */
export async function loadHomeLoft(): Promise<HomeLoft> {
  const [pointer, artworks] = await Promise.all([loadLoftPointer(), listArtworks({ limit: 48 }).catch(() => [])]);
  const pool: LoftWork[] = artworks
    .filter((a) => a.primaryImageUrl)
    .map((a) => ({
      id: a.id,
      title: a.title,
      artistName: a.artistName ?? null,
      imageUrl: a.primaryImageUrl!,
      heightCm: a.heightCm ?? null,
      widthCm: a.widthCm ?? null,
    }));

  const snap = pointer.published;
  const hallway = snap?.hallway ?? VENUE;
  const scene = snap?.scene ?? seedScene();
  const wanted = snap ? snap.pieces : seedPieces(pool.map((w) => w.id));
  const works = (await listArtworksByIds(wanted.map((p) => p.artworkId), { publicOnly: true })).filter((w) => w.imageUrl);
  const onShow = new Set(works.map((w) => w.id));
  const pieces = wanted.filter((p) => onShow.has(p.artworkId)).sort((a, b) => a.sequence - b.sequence);
  return { hallway, works, pieces, scene, pool };
}
