import { db } from "@elkdonis/db";
import { normalizeLamp, normalizeScene, type PieceLamp, type Scene } from "@elkdonis/three/hallway/model";

// ============================================================================
// Installations: a store's collection hung in the 3D hallway (migration 213).
//
// The hallway package owns the geometry and the walking-order rule; this file
// only stores what it produces. `sequence` is written by the editor on every
// save from `orderInVenue`, so reading a collection in order never needs
// the geometry.
//
// Artist names here are display names or org names only — never an email —
// because the public walk-through shows them to anyone.
// ============================================================================

type Row = Record<string, unknown>;

export type InstallationStatus = "draft" | "published";

export interface Installation {
  id: string;
  /** The store that owns it; null for an organisation's own (the landing loft, migration 230). */
  storeId: string | null;
  /** The organisation that owns a store-less installation (migration 230). */
  orgId: string | null;
  title: string;
  hallway: string;
  status: InstallationStatus;
  updatedAt: string;
  publishedAt: string | null;
  pieceCount: number;
  /** Scene-wide settings (migrations 218, 230): lighting, opening view, free spot. */
  scene: Scene;
}

export interface InstallationPiece {
  artworkId: string;
  wallId: string;
  x: number;
  y: number;
  frameId: string | null;
  /** Size multiplier on the base size; 1 = as recorded (migration 214). */
  scale: number;
  /** The frame's proportion: 'auto' or a `LoftRatio` such as '4:5' (migration 215). */
  ratio: string;
  /** The crop inside the frame: centre in %, zoom 1–3 (migration 215). */
  crop: { x: number; y: number; zoom: number };
  /** The piece's picture lamp (migration 218). */
  lamp: PieceLamp;
  sequence: number;
}

/** A work as the hallway needs it. */
export interface InstallationArtwork {
  id: string;
  title: string;
  imageUrl: string | null;
  artistName: string | null;
  heightCm: number | null;
  widthCm: number | null;
  yearCreated: number | null;
  medium: string | null;
  status: string;
}

const num = (v: unknown) => (v == null ? null : Number(v));

function mapInstallation(r: Row): Installation {
  return {
    id: r.id as string,
    storeId: (r.store_id as string | null) ?? null,
    orgId: (r.org_id as string | null) ?? null,
    title: r.title as string,
    hallway: r.hallway as string,
    status: r.status as InstallationStatus,
    updatedAt: new Date(r.updated_at as string).toISOString(),
    publishedAt: r.published_at ? new Date(r.published_at as string).toISOString() : null,
    pieceCount: Number(r.piece_count ?? 0),
    scene: normalizeScene(r.scene),
  };
}

function mapArtwork(r: Row): InstallationArtwork {
  return {
    id: r.id as string,
    title: r.title as string,
    imageUrl: (r.image_url as string | null) ?? null,
    artistName: (r.artist_name as string | null) ?? null,
    heightCm: num(r.height_cm),
    widthCm: num(r.width_cm),
    yearCreated: num(r.year_created),
    medium: (r.medium as string | null) ?? null,
    status: r.status as string,
  };
}

const ARTWORK_FIELDS = db`
  a.id, a.title, a.height_cm, a.width_cm, a.year_created, a.medium, a.status,
  pm.url AS image_url,
  COALESCE(u.display_name, a.metadata->>'artistName', o.name) AS artist_name
`;

const ARTWORK_JOINS = db`
  JOIN store s ON s.id = a.store_id
  LEFT JOIN organizations o ON o.id = s.owner_org_id
  LEFT JOIN users u ON u.id = a.artist_user_id
  LEFT JOIN artwork_media pm ON pm.id = a.primary_image_id
`;

export async function listInstallationsForStores(storeIds: string[]): Promise<Installation[]> {
  if (storeIds.length === 0) return [];
  const rows = (await db`
    SELECT i.*, (SELECT COUNT(*)::int FROM art_installation_piece p WHERE p.installation_id = i.id) AS piece_count
    FROM art_installation i
    WHERE i.store_id = ANY(${storeIds})
    ORDER BY i.updated_at DESC
  `) as unknown as Row[];
  return rows.map(mapInstallation);
}

export async function getInstallation(id: string): Promise<Installation | null> {
  const rows = (await db`
    SELECT i.*, (SELECT COUNT(*)::int FROM art_installation_piece p WHERE p.installation_id = i.id) AS piece_count
    FROM art_installation i WHERE i.id = ${id}
  `) as unknown as Row[];
  return rows[0] ? mapInstallation(rows[0]) : null;
}

export async function listInstallationPieces(id: string): Promise<InstallationPiece[]> {
  const rows = (await db`
    SELECT artwork_id, wall_id, offset_x, centre_y, frame_style, scale, ratio, crop_x, crop_y, crop_zoom, lamp, sequence
    FROM art_installation_piece
    WHERE installation_id = ${id}
    ORDER BY sequence
  `) as unknown as Row[];
  return rows.map((r) => ({
    artworkId: r.artwork_id as string,
    wallId: r.wall_id as string,
    x: Number(r.offset_x),
    y: Number(r.centre_y),
    frameId: (r.frame_style as string | null) ?? null,
    scale: Number(r.scale) || 1,
    ratio: (r.ratio as string) || "auto",
    crop: { x: Number(r.crop_x) || 50, y: Number(r.crop_y) || 50, zoom: Number(r.crop_zoom) || 1 },
    lamp: normalizeLamp(r.lamp),
    sequence: Number(r.sequence),
  }));
}

/** What a store can hang: everything it has that is not archived and has an image. */
export async function listHangableArtworks(storeId: string): Promise<InstallationArtwork[]> {
  const rows = (await db`
    SELECT ${ARTWORK_FIELDS}
    FROM artwork a
    ${ARTWORK_JOINS}
    WHERE a.store_id = ${storeId}
      AND a.status <> 'archived'
      AND a.primary_image_id IS NOT NULL
    ORDER BY a.created_at DESC
  `) as unknown as Row[];
  return rows.map(mapArtwork);
}

/**
 * What an organisation's own installation can hang: every pictured work on
 * show in its marketplace, from any store (the landing loft's tray).
 */
export async function listOrgHangableArtworks(orgId: string): Promise<InstallationArtwork[]> {
  const rows = (await db`
    SELECT ${ARTWORK_FIELDS}
    FROM artwork a
    ${ARTWORK_JOINS}
    WHERE a.org_id = ${orgId}
      AND a.status IN ('available', 'reserved', 'sold')
      AND a.primary_image_id IS NOT NULL
    ORDER BY a.created_at DESC
  `) as unknown as Row[];
  return rows.map(mapArtwork);
}

/** Works by id, in no particular order; `publicOnly` keeps those on show. */
export async function listArtworksByIds(ids: string[], opts: { publicOnly: boolean }): Promise<InstallationArtwork[]> {
  if (ids.length === 0) return [];
  const rows = (await db`
    SELECT ${ARTWORK_FIELDS}
    FROM artwork a
    ${ARTWORK_JOINS}
    WHERE a.id = ANY(${ids})
      ${opts.publicOnly ? db`AND a.status IN ('available', 'reserved', 'sold')` : db``}
  `) as unknown as Row[];
  return rows.map(mapArtwork);
}

/**
 * The works hung in an installation, for showing it. Drafts and archived
 * pieces are left out of a public view even if they are still on a wall.
 */
export async function listInstallationArtworks(
  id: string,
  opts: { publicOnly: boolean }
): Promise<InstallationArtwork[]> {
  const rows = (await db`
    SELECT ${ARTWORK_FIELDS}
    FROM art_installation_piece p
    JOIN artwork a ON a.id = p.artwork_id
    ${ARTWORK_JOINS}
    WHERE p.installation_id = ${id}
      ${opts.publicOnly ? db`AND a.status IN ('available', 'reserved', 'sold')` : db``}
    ORDER BY p.sequence
  `) as unknown as Row[];
  return rows.map(mapArtwork);
}

export async function createInstallation(
  storeId: string,
  title: string,
  userId: string,
  venueId = "northwest"
): Promise<string> {
  const rows = (await db`
    INSERT INTO art_installation (store_id, title, created_by, hallway)
    VALUES (${storeId}, ${title}, ${userId}, ${venueId})
    RETURNING id
  `) as unknown as Row[];
  return rows[0]!.id as string;
}

/** An organisation's own installation, with no store (migration 230). Returns its id. */
export async function createOrgInstallation(orgId: string, title: string, userId: string, venueId: string): Promise<string> {
  const rows = (await db`
    INSERT INTO art_installation (org_id, title, created_by, hallway)
    VALUES (${orgId}, ${title}, ${userId}, ${venueId})
    RETURNING id
  `) as unknown as Row[];
  return rows[0]!.id as string;
}

export async function updateInstallation(
  id: string,
  patch: { title?: string; status?: InstallationStatus }
): Promise<void> {
  if (patch.title != null) {
    await db`UPDATE art_installation SET title = ${patch.title}, updated_at = NOW() WHERE id = ${id}`;
  }
  if (patch.status != null) {
    await db`
      UPDATE art_installation
      SET status = ${patch.status},
          published_at = CASE WHEN ${patch.status} = 'published' THEN COALESCE(published_at, NOW()) ELSE published_at END,
          updated_at = NOW()
      WHERE id = ${id}
    `;
  }
}

/**
 * Move an installation to another space. Placements are coordinates on one
 * space's walls and mean nothing in another, so the hang is cleared with it.
 */
export async function setInstallationVenue(id: string, venueId: string): Promise<void> {
  await db.begin(async (tx) => {
    await tx`DELETE FROM art_installation_piece WHERE installation_id = ${id}`;
    await tx`UPDATE art_installation SET hallway = ${venueId}, updated_at = NOW() WHERE id = ${id}`;
  });
}

/**
 * Replace the scene document. Only keys this version knows are written, each
 * bounded (`normalizeScene`), so the column never holds arbitrary input.
 */
export async function saveInstallationScene(id: string, scene: unknown): Promise<void> {
  const clean = normalizeScene(scene);
  await db`
    UPDATE art_installation
    SET scene = ${db.json(clean as never)}, updated_at = NOW()
    WHERE id = ${id}
  `;
}

export async function deleteInstallation(id: string): Promise<void> {
  await db`DELETE FROM art_installation WHERE id = ${id}`;
}

/** Whose works an installation may hang: one store's, or any on show in an organisation's marketplace. */
export type HangScope = { storeId: string } | { orgId: string };

/** The scope an installation hangs from, by its owner. */
export function hangScope(installation: Installation): HangScope {
  return installation.storeId ? { storeId: installation.storeId } : { orgId: installation.orgId ?? "" };
}

/**
 * Replace the whole hang in one transaction. The editor always sends the full
 * layout, already in walking order, so a save is never a partial state; works
 * outside the installation's scope are dropped rather than hung.
 */
export async function saveInstallationLayout(
  id: string,
  scope: HangScope,
  pieces: InstallationPiece[]
): Promise<number> {
  const ids = [...new Set(pieces.map((p) => p.artworkId))];
  return db.begin(async (tx) => {
    const owned = !ids.length
      ? []
      : "storeId" in scope
        ? ((await tx`SELECT id FROM artwork WHERE store_id = ${scope.storeId} AND id = ANY(${ids})`) as unknown as Row[])
        : ((await tx`
            SELECT id FROM artwork
            WHERE org_id = ${scope.orgId} AND status IN ('available', 'reserved', 'sold') AND id = ANY(${ids})
          `) as unknown as Row[]);
    const allowed = new Set(owned.map((r) => r.id as string));
    const keep = pieces.filter((p) => allowed.has(p.artworkId));

    await tx`DELETE FROM art_installation_piece WHERE installation_id = ${id}`;
    for (const p of keep) {
      await tx`
        INSERT INTO art_installation_piece
          (installation_id, artwork_id, wall_id, offset_x, centre_y, frame_style, scale,
           ratio, crop_x, crop_y, crop_zoom, lamp, sequence)
        VALUES (${id}, ${p.artworkId}, ${p.wallId}, ${p.x}, ${p.y}, ${p.frameId}, ${p.scale},
                ${p.ratio}, ${p.crop.x}, ${p.crop.y}, ${p.crop.zoom}, ${tx.json(normalizeLamp(p.lamp) as never)},
                ${p.sequence})
        ON CONFLICT (installation_id, artwork_id) DO NOTHING
      `;
    }
    await tx`UPDATE art_installation SET updated_at = NOW() WHERE id = ${id}`;
    return keep.length;
  });
}
