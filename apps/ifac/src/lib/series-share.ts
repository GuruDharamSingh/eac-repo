import type { Metadata } from "next";
import type { SeriesCoverMedia } from "@elkdonis/services";
import { siteConfig } from "@/config/site";

/**
 * Share previews for the series pages (2026-10-18): the picture a link shows
 * when pasted into email or social media. A video cover shares its still, or
 * nothing; the site's absolute base comes from `metadataBase` (layout.tsx).
 */
export function coverStill(cover: SeriesCoverMedia | null | undefined): string | null {
  if (!cover) return null;
  return cover.kind === "image" ? cover.url : cover.posterUrl ?? null;
}

export function shareMetadata(input: { title: string; description?: string | null; path: string; image?: string | null }): Metadata {
  const description = input.description ?? undefined;
  const images = input.image ? [{ url: input.image }] : undefined;
  return {
    title: `${input.title} | ${siteConfig.shortName}`,
    description,
    openGraph: { type: "website", siteName: siteConfig.orgName, title: input.title, description, url: input.path, images },
    twitter: { card: images ? "summary_large_image" : "summary", title: input.title, description, images: input.image ? [input.image] : undefined },
  };
}
