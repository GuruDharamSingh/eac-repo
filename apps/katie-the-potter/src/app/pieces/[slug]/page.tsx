import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { loadPieceDetail } from "@/lib/artworks";
import { pieceMetadata } from "@/lib/piece-metadata";
import { renderPieceDetail } from "@/lib/piece-render";

/**
 * A piece's own page, drawn from the piece-detail template (lib/piece-render).
 * Reachable without JS, by a middle-click on a card, or from "Open full page"
 * in the popup. `slug` is the marketplace slug; an artwork id answers too.
 * Unknown piece: 404. OpenGraph as before.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const detail = await loadPieceDetail(slug);
  if (!detail) return { title: "Not found" };
  return pieceMetadata(detail.piece, `/pieces/${encodeURIComponent(detail.piece.slug)}`);
}

export default async function PieceRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const detail = await loadPieceDetail(slug);
  if (!detail) notFound();
  return renderPieceDetail(detail);
}
