import type { Metadata } from "next";
import { priceOf, type Piece } from "@/blocks/artwork-data";
import { sized } from "@/blocks/media";
import { siteConfig } from "@/config/site";

/** OpenGraph/Twitter metadata for a piece: title, primary picture, a one-line description. */
export function pieceMetadata(piece: Piece, path: string, noindex = false): Metadata {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/+$/, "");
  const desc = [piece.medium, piece.dimensions, priceOf(piece)].filter(Boolean).join(" · ") || siteConfig.tagline;
  const image = piece.image ? `${base}${sized(piece.image, 1024)}` : undefined;
  return {
    title: piece.title,
    description: desc,
    ...(noindex ? { robots: { index: false, follow: false } } : {}),
    openGraph: {
      type: "website",
      title: `${piece.title} · ${siteConfig.orgName}`,
      description: desc,
      url: `${base}${path}`,
      siteName: siteConfig.orgName,
      ...(image ? { images: [{ url: image, alt: piece.images[0]?.alt || piece.title }] } : {}),
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title: piece.title,
      description: desc,
      ...(image ? { images: [image] } : {}),
    },
  };
}
