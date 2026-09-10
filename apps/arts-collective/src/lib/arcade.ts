import { db } from "@elkdonis/db";

export interface ArcadeArtwork {
  /** Media path without a size hint; callers ask for the width they need. */
  src: string;
  title: string;
  artist: string;
  /** Listing URL, or null when no public marketplace URL is configured. */
  href: string | null;
}

/**
 * Members' work, to hang beside the road in the arcade game and to credit when
 * a player collides with a piece.
 *
 * Only images the media route will serve anonymously are useful here — the
 * game is on a public page — so this is limited to available pieces' hero
 * shots under the shared `EAC_Network/` prefix.
 */
export async function getArcadeArtwork(limit: number = 8): Promise<ArcadeArtwork[]> {
  // Listings live on the marketplace app, which is not published under a
  // domain of its own yet. Without a configured base URL there is nowhere
  // truthful to point, so the credit ships without a link rather than with a
  // broken one.
  const base = process.env.NEXT_PUBLIC_ART_AUCTION_URL?.replace(/\/$/, "") || null;

  try {
    const rows = await db<
      { id: string; title: string; artist: string | null; url: string }[]
    >`
      SELECT DISTINCT ON (a.id)
        a.id, a.title, u.display_name AS artist, m.url
      FROM artwork a
      JOIN artwork_media m ON m.artwork_id = a.id
      LEFT JOIN users u ON u.id = a.artist_user_id
      WHERE a.status = 'available'
        AND m.role = 'hero'
        AND m.url LIKE '/api/media/EAC_Network/%'
      ORDER BY a.id, m.position
      LIMIT ${limit}
    `;

    return rows.map((r) => ({
      src: r.url,
      title: r.title,
      artist: r.artist ?? "Unknown artist",
      href: base ? `${base}/artworks/${r.id}` : null,
    }));
  } catch {
    return [];
  }
}
