import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { samplePieces } from "@/blocks/artwork-data";
import { detailFrom } from "@/lib/artworks";
import { pieceMetadata } from "@/lib/piece-metadata";
import { renderPieceDetail } from "@/lib/piece-render";
import { lookOf } from "@/blocks/looks";

/** The detail page for a SAMPLE piece, through the same template (see ../../layout.tsx). */
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const detail = detailFrom(samplePieces(), slug);
  if (!detail) return { title: "Not found" };
  return pieceMetadata(detail.piece, `/preview/pieces/${encodeURIComponent(detail.piece.slug)}`, true);
}

export default async function PreviewPieceRoute({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ look?: string }> }) {
  const { slug } = await params;
  const { look } = await searchParams;
  const detail = detailFrom(samplePieces(), slug);
  if (!detail) notFound();
  return renderPieceDetail(detail, { preview: true, look: lookOf(look) });
}
